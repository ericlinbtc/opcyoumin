'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { activities, auditLogs, cityMemberships, notifications, outboxJobs, registrations, users } from '@/db/schema';
import { requireSession } from '@/server/auth/session';
import { assertCityScope } from '@/server/auth/city-scope';
import { assertConfiguredCan } from '@/server/auth/permissions';
import type { ActionResult } from '@/features/posts/actions';
import { getAuditContext } from '@/server/request-context';
import { ActivityRegistrationError, cancelActivityRegistrationForUser, registerActivityForUser } from '@/server/services/activity-registration';

const activityIdSchema = z.uuid();
const activitySchema = z.object({ cityId: z.uuid(), title: z.string().trim().min(2).max(120), summary: z.string().trim().min(10).max(500), details: z.string().trim().min(20).max(20_000), location: z.string().trim().min(2).max(240), capacity: z.number().int().min(1).max(10_000), startsAt: z.coerce.date(), endsAt: z.coerce.date() }).refine((value) => value.endsAt > value.startsAt, { message: '结束时间必须晚于开始时间' });

export async function requestActivityCreatorEligibility(): Promise<ActionResult> {
  try {
    const session = await requireSession(['user']);
    const audit = await getAuditContext();
    await getDatabase().transaction(async (tx) => {
      const [account] = await tx.select({ approvedAt: users.activityCreatorApprovedAt, requestedAt: users.activityCreatorRequestedAt }).from(users).where(and(eq(users.id, session.id), eq(users.status, 'active'))).limit(1);
      if (!account) throw new Error('NOT_FOUND');
      if (account.approvedAt) throw new Error('ALREADY_APPROVED');
      if (account.requestedAt) throw new Error('ALREADY_REQUESTED');
      await tx.update(users).set({ activityCreatorRequestedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, session.id));
      await tx.insert(notifications).values({ userId: session.id, type: 'system', title: '活动发起资格申请已提交', body: '平台管理员审核后会通过通知告知结果。', payload: { status: 'submitted' } });
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: 'activity_creator.requested', targetType: 'user', targetId: session.id, after: { status: 'submitted' } });
    });
    revalidatePath('/activities');
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: error instanceof Error && error.message === 'ALREADY_REQUESTED' ? '申请正在审核中' : '活动发起资格申请失败' };
  }
}

export async function createActivity(input: unknown): Promise<ActionResult<{ activityId: string }>> {
  try {
    const session = await requireSession();
    const values = activitySchema.parse(input);
    const [account] = await getDatabase().select({ approvedAt: users.activityCreatorApprovedAt }).from(users).where(eq(users.id, session.id)).limit(1);
    if (session.role === 'user') {
      if (!account?.approvedAt) throw new Error('ACTIVITY_CREATOR_APPROVAL_REQUIRED');
      const [membership] = await getDatabase().select({ cityId: cityMemberships.cityId }).from(cityMemberships).where(and(eq(cityMemberships.cityId, values.cityId), eq(cityMemberships.userId, session.id))).limit(1);
      if (!membership) throw new Error('CITY_MEMBERSHIP_REQUIRED');
    } else {
      await assertConfiguredCan(session.role, 'activity:create');
      if (session.role === 'city_admin') await assertCityScope(session, values.cityId);
    }
    const [activity] = await getDatabase().insert(activities).values({ ...values, organizerId: session.id, status: 'pending' }).returning({ id: activities.id });
    revalidatePath('/activities');
    revalidatePath('/admin/activities');
    return { ok: true, data: { activityId: activity.id } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '活动信息不完整或时间不正确' };
    if (error instanceof Error && error.message === 'ACTIVITY_CREATOR_APPROVAL_REQUIRED') return { ok: false, code: error.message, message: '请先申请并通过活动发起资格审核' };
    if (error instanceof Error && error.message === 'CITY_MEMBERSHIP_REQUIRED') return { ok: false, code: error.message, message: '只能在已加入的城市发起活动' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '活动提交失败' };
  }
}

export async function editActivity(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const values = z.object({ activityId: z.uuid(), activity: activitySchema }).parse(input);
    const changed = await getDatabase().update(activities).set({ ...values.activity, status: 'pending', updatedAt: new Date() }).where(and(eq(activities.id, values.activityId), eq(activities.organizerId, session.id), sql`${activities.status} in ('draft', 'pending')`)).returning({ id: activities.id });
    if (!changed[0]) return { ok: false, code: 'NOT_FOUND', message: '活动不存在或当前状态不可编辑' };
    revalidatePath(`/activities/${values.activityId}`);
    revalidatePath('/me/activities');
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '活动信息不完整或时间不正确' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '活动保存失败' };
  }
}

export async function cancelOwnActivity(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const activityId = activityIdSchema.parse(input);
    await getDatabase().transaction(async (tx) => {
      const changed = await tx.update(activities).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(activities.id, activityId), eq(activities.organizerId, session.id), sql`${activities.status} in ('draft', 'pending', 'published')`)).returning({ id: activities.id });
      if (!changed[0]) throw new Error('NOT_FOUND');
      await tx.insert(outboxJobs).values({ topic: 'activity.cancelled', idempotencyKey: `activity.cancelled:${activityId}`, payload: { activityId } }).onConflictDoNothing();
    });
    revalidatePath('/activities');
    revalidatePath('/me/activities');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '活动取消失败' };
  }
}

export async function registerActivity(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const activityId = activityIdSchema.parse(input);
    const outcome = await registerActivityForUser(activityId, session.id);
    if (outcome !== 'REGISTERED') return { ok: false, code: outcome, message: outcome === 'ALREADY_REGISTERED' ? '你已经报名该活动' : '活动已满额或不在报名状态' };
    revalidatePath(`/activities/${activityId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '活动参数不正确' };
    if (error instanceof ActivityRegistrationError) return { ok: false, code: error.message, message: '活动已满额或不在报名状态' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '报名失败，请稍后再试' };
  }
}

export async function cancelRegistration(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const activityId = activityIdSchema.parse(input);
    await cancelActivityRegistrationForUser(activityId, session.id);
    revalidatePath(`/activities/${activityId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof ActivityRegistrationError) return { ok: false, code: error.message, message: '活动已开始或已关闭，无法取消报名' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '取消报名失败' };
  }
}

export async function markActivityAttendance(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const audit = await getAuditContext();
    const values = z.object({ activityId: z.uuid(), userId: z.uuid(), status: z.enum(['attended', 'no_show']) }).parse(input);
    await getDatabase().transaction(async (tx) => {
      const [activity] = await tx.select({ organizerId: activities.organizerId, cityId: activities.cityId, startsAt: activities.startsAt }).from(activities).where(eq(activities.id, values.activityId)).limit(1);
      if (!activity) throw new Error('NOT_FOUND');
      if (activity.organizerId !== session.id) {
        await assertConfiguredCan(session.role, 'activity:approve');
        if (session.role === 'city_admin') await assertCityScope(session, activity.cityId);
      }
      if (activity.startsAt > new Date()) throw new Error('NOT_STARTED');
      const [changed] = await tx.update(registrations).set({ status: values.status, attendanceMarkedAt: new Date(), attendanceMarkedBy: session.id, updatedAt: new Date() })
        .where(and(eq(registrations.activityId, values.activityId), eq(registrations.userId, values.userId), sql`${registrations.status} in ('registered', 'attended', 'no_show')`)).returning({ userId: registrations.userId });
      if (!changed) throw new Error('REGISTRATION_NOT_FOUND');
      await tx.insert(notifications).values({ userId: values.userId, type: 'activity', title: values.status === 'attended' ? '活动签到已确认' : '活动出席状态已更新', body: values.status === 'attended' ? '你的本次活动出席记录已确认。' : '本次活动被标记为未出席，如有异议请通过帮助中心联系。', payload: { activityId: values.activityId, status: values.status } });
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: 'activity.attendance_marked', targetType: 'registration', targetId: `${values.activityId}:${values.userId}`, after: { status: values.status } });
    });
    revalidatePath(`/activities/${values.activityId}`);
    revalidatePath('/me/activities');
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '签到参数不正确' };
    if (error instanceof Error && error.message === 'NOT_STARTED') return { ok: false, code: 'NOT_STARTED', message: '活动尚未开始，暂不能标记出席' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '出席状态更新失败' };
  }
}
