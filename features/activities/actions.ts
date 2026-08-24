'use server';

import { and, eq, lt, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { activities, outboxJobs, registrations } from '@/db/schema';
import { requireSession } from '@/server/auth/session';
import { assertCan } from '@/server/domain/rbac';
import type { ActionResult } from '@/features/posts/actions';

const activityIdSchema = z.uuid();
const activitySchema = z.object({ cityId: z.uuid(), title: z.string().trim().min(2).max(120), summary: z.string().trim().min(10).max(500), details: z.string().trim().min(20).max(20_000), location: z.string().trim().min(2).max(240), capacity: z.number().int().min(1).max(10_000), startsAt: z.coerce.date(), endsAt: z.coerce.date() }).refine((value) => value.endsAt > value.startsAt, { message: '结束时间必须晚于开始时间' });

class ActivityRegistrationError extends Error {}

export async function createActivity(input: unknown): Promise<ActionResult<{ activityId: string }>> {
  try {
    const session = await requireSession(['editor', 'city_admin', 'platform_admin']);
    assertCan(session.role, 'activity:create');
    const values = activitySchema.parse(input);
    const [activity] = await getDatabase().insert(activities).values({ ...values, organizerId: session.id, status: 'pending' }).returning({ id: activities.id });
    revalidatePath('/activities');
    revalidatePath('/admin/activities');
    return { ok: true, data: { activityId: activity.id } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '活动信息不完整或时间不正确' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '活动提交失败' };
  }
}

export async function editActivity(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession(['editor', 'city_admin', 'platform_admin']);
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
    const session = await requireSession(['editor', 'city_admin', 'platform_admin']);
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
    const outcome = await getDatabase().transaction(async (tx) => {
      const activated = await tx.insert(registrations)
        .values({ activityId, userId: session.id, status: 'registered' })
        .onConflictDoUpdate({
          target: [registrations.activityId, registrations.userId],
          set: { status: 'registered', registeredAt: new Date(), updatedAt: new Date() },
          setWhere: eq(registrations.status, 'cancelled'),
        })
        .returning({ activityId: registrations.activityId });
      if (activated.length === 0) return 'ALREADY_REGISTERED';

      const reserved = await tx.update(activities)
        .set({ registrationCount: sql`${activities.registrationCount} + 1`, updatedAt: new Date() })
        .where(and(eq(activities.id, activityId), eq(activities.status, 'published'), lt(activities.registrationCount, activities.capacity)))
        .returning({ id: activities.id });
      if (reserved.length === 0) throw new ActivityRegistrationError('ACTIVITY_FULL_OR_CLOSED');
      await tx.insert(outboxJobs).values({ topic: 'registration.created', idempotencyKey: `registration.created:${activityId}:${session.id}`, payload: { activityId, userId: session.id } }).onConflictDoNothing();
      return 'REGISTERED';
    });
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
    await getDatabase().transaction(async (tx) => {
      const changed = await tx.update(registrations).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(registrations.activityId, activityId), eq(registrations.userId, session.id), eq(registrations.status, 'registered'))).returning({ activityId: registrations.activityId });
      if (changed.length > 0) await tx.update(activities).set({ registrationCount: sql`greatest(${activities.registrationCount} - 1, 0)`, updatedAt: new Date() }).where(eq(activities.id, activityId));
    });
    revalidatePath(`/activities/${activityId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '取消报名失败' };
  }
}
