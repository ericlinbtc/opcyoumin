'use server';

import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { helpTicketMessages, helpTickets, organizationApplications, organizationMemberships, organizations } from '@/db/schema';
import type { ActionResult } from '@/features/posts/actions';
import { readSession, requireSession } from '@/server/auth/session';
import { getAuditContext } from '@/server/request-context';

const organizationApplicationSchema = z.object({
  organizationId: z.uuid(),
  motivation: z.string().trim().max(1_000).optional(),
});

export async function applyToOrganization(input: unknown): Promise<ActionResult<{ applicationId: string }>> {
  try {
    const session = await requireSession();
    const values = organizationApplicationSchema.parse(input);
    const application = await getDatabase().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${values.organizationId}:${session.id}`}))`);
      const [organization] = await tx.select({ id: organizations.id }).from(organizations)
        .where(and(eq(organizations.id, values.organizationId), eq(organizations.status, 'published'))).limit(1);
      if (!organization) throw new Error('NOT_FOUND');
      const [membership] = await tx.select({ userId: organizationMemberships.userId }).from(organizationMemberships)
        .where(and(eq(organizationMemberships.organizationId, values.organizationId), eq(organizationMemberships.userId, session.id))).limit(1);
      if (membership) throw new Error('ALREADY_MEMBER');
      const [active] = await tx.select({ id: organizationApplications.id }).from(organizationApplications)
        .where(and(eq(organizationApplications.organizationId, values.organizationId), eq(organizationApplications.userId, session.id), sql`${organizationApplications.status} in ('submitted', 'reviewing', 'approved')`))
        .orderBy(desc(organizationApplications.createdAt)).limit(1);
      if (active) throw new Error('APPLICATION_EXISTS');
      const [created] = await tx.insert(organizationApplications).values({ organizationId: values.organizationId, userId: session.id, motivation: values.motivation }).returning({ id: organizationApplications.id });
      return created;
    });
    revalidatePath('/');
    revalidatePath('/me/applications');
    revalidatePath('/admin/applications');
    return { ok: true, data: { applicationId: application.id } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '机构申请参数不正确' };
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return { ok: false, code: 'UNAUTHORIZED', message: '请先登录后申请加入机构' };
    if (error instanceof Error && error.message === 'NOT_FOUND') return { ok: false, code: 'NOT_FOUND', message: '机构不存在或暂不接受申请' };
    if (error instanceof Error && error.message === 'ALREADY_MEMBER') return { ok: false, code: 'ALREADY_MEMBER', message: '你已经是该机构成员' };
    if (error instanceof Error && error.message === 'APPLICATION_EXISTS') return { ok: false, code: 'APPLICATION_EXISTS', message: '你已有正在处理的申请' };
    return { ok: false, code: 'INTERNAL_ERROR', message: '机构申请提交失败，请稍后重试' };
  }
}

export async function withdrawOrganizationApplication(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const applicationId = z.uuid().parse(input);
    const [changed] = await getDatabase().update(organizationApplications).set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(organizationApplications.id, applicationId), eq(organizationApplications.userId, session.id), sql`${organizationApplications.status} in ('submitted', 'reviewing')`))
      .returning({ id: organizationApplications.id });
    if (!changed) return { ok: false, code: 'NOT_FOUND', message: '申请不存在或当前不可撤回' };
    revalidatePath('/me/applications');
    revalidatePath('/organizations');
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '申请参数不正确' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '撤回申请失败' };
  }
}

export async function leaveOrganization(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const organizationId = z.uuid().parse(input);
    await getDatabase().transaction(async (tx) => {
      const removed = await tx.delete(organizationMemberships).where(and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.userId, session.id))).returning({ organizationId: organizationMemberships.organizationId });
      if (!removed[0]) throw new Error('NOT_FOUND');
      await tx.update(organizations).set({ memberCount: sql`greatest(${organizations.memberCount} - 1, 0)`, updatedAt: new Date() }).where(eq(organizations.id, organizationId));
    });
    revalidatePath(`/organizations/${organizationId}`);
    revalidatePath('/organizations');
    revalidatePath('/me/applications');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '退出机构失败' };
  }
}

const helpTicketSchema = z.object({
  requesterName: z.string().trim().min(2).max(80),
  contact: z.string().trim().email().max(160),
  description: z.string().trim().min(10).max(3_000),
});

export async function createHelpTicket(input: unknown): Promise<ActionResult<{ ticketId: string }>> {
  try {
    const values = helpTicketSchema.parse(input);
    const session = await readSession();
    const audit = await getAuditContext();
    const ticket = await getDatabase().transaction(async (tx) => {
      const since = new Date(Date.now() - 60 * 60 * 1000);
      const [recent] = await tx.select({ value: count() }).from(helpTickets).where(and(
        gte(helpTickets.createdAt, since),
        session ? eq(helpTickets.userId, session.id) : eq(helpTickets.requestIpHash, audit.ipHash),
      ));
      if (recent.value >= 3) throw new Error('RATE_LIMITED');
      const [duplicate] = await tx.select({ id: helpTickets.id }).from(helpTickets).where(and(eq(helpTickets.contact, values.contact), eq(helpTickets.description, values.description), gte(helpTickets.createdAt, since))).limit(1);
      if (duplicate) throw new Error('DUPLICATE_TICKET');
      const [created] = await tx.insert(helpTickets).values({ ...values, userId: session?.id, requestIpHash: audit.ipHash }).returning({ id: helpTickets.id });
      await tx.insert(helpTicketMessages).values({ ticketId: created.id, authorId: session?.id, authorRole: 'requester', body: values.description });
      return created;
    });
    revalidatePath('/admin/applications');
    if (session) revalidatePath('/me/applications');
    return { ok: true, data: { ticketId: ticket.id } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '请填写有效邮箱，问题描述至少 10 个字' };
    if (error instanceof Error && error.message === 'RATE_LIMITED') return { ok: false, code: 'RATE_LIMITED', message: '提交过于频繁，请一小时后再试' };
    if (error instanceof Error && error.message === 'DUPLICATE_TICKET') return { ok: false, code: 'DUPLICATE_TICKET', message: '相同问题已经提交，请等待处理' };
    return { ok: false, code: 'INTERNAL_ERROR', message: '问题提交失败，请稍后重试' };
  }
}

const ticketReplySchema = z.object({ ticketId: z.uuid(), body: z.string().trim().min(2).max(3_000) });

export async function replyToHelpTicket(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const values = ticketReplySchema.parse(input);
    await getDatabase().transaction(async (tx) => {
      const [ticket] = await tx.select({ id: helpTickets.id, status: helpTickets.status }).from(helpTickets).where(and(eq(helpTickets.id, values.ticketId), eq(helpTickets.userId, session.id))).limit(1);
      if (!ticket || ticket.status === 'closed') throw new Error('NOT_FOUND');
      await tx.insert(helpTicketMessages).values({ ticketId: ticket.id, authorId: session.id, authorRole: 'requester', body: values.body });
      await tx.update(helpTickets).set({ status: 'in_progress', resolvedAt: null, updatedAt: new Date() }).where(eq(helpTickets.id, ticket.id));
    });
    revalidatePath('/me/applications');
    revalidatePath('/admin/applications');
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '回复内容格式不正确' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '工单回复失败' };
  }
}

export async function closeOwnHelpTicket(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const ticketId = z.uuid().parse(input);
    const [changed] = await getDatabase().update(helpTickets).set({ status: 'closed', updatedAt: new Date() })
      .where(and(eq(helpTickets.id, ticketId), eq(helpTickets.userId, session.id), eq(helpTickets.status, 'resolved'))).returning({ id: helpTickets.id });
    if (!changed) return { ok: false, code: 'NOT_FOUND', message: '工单不存在或尚未解决' };
    revalidatePath('/me/applications');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '关闭工单失败' };
  }
}
