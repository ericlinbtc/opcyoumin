'use server';

import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { helpTickets, opcVerificationApplications, organizationApplications, organizations } from '@/db/schema';
import type { ActionResult } from '@/features/posts/actions';
import { getPhoneHashPepper } from '@/lib/env';
import { readSession, requireSession } from '@/server/auth/session';

const opcApplicationSchema = z.object({
  city: z.string().trim().min(2).max(80),
  contact: z.string().trim().min(5).max(120),
  realName: z.string().trim().min(2).max(80),
  idNumber: z.string().trim().regex(/^\d{17}[\dXx]$/),
  idea: z.string().trim().min(20).max(2_000),
});

export async function createOpcApplication(input: unknown): Promise<ActionResult<{ applicationId: string }>> {
  try {
    const session = await requireSession();
    const values = opcApplicationSchema.parse(input);
    const existing = await getDatabase().select({ id: opcVerificationApplications.id })
      .from(opcVerificationApplications)
      .where(and(eq(opcVerificationApplications.userId, session.id), eq(opcVerificationApplications.status, 'submitted')))
      .limit(1);
    if (existing[0]) return { ok: false, code: 'APPLICATION_EXISTS', message: '你已有待处理的 OPC 认证申请' };
    const normalizedId = values.idNumber.toUpperCase();
    const [application] = await getDatabase().insert(opcVerificationApplications).values({
      userId: session.id,
      cityName: values.city,
      contact: values.contact,
      realName: values.realName,
      idNumberHash: createHash('sha256').update(`${normalizedId}:${getPhoneHashPepper()}`).digest('hex'),
      idNumberLast4: normalizedId.slice(-4),
      idea: values.idea,
    }).returning({ id: opcVerificationApplications.id });
    revalidatePath('/');
    revalidatePath('/me/applications');
    revalidatePath('/admin/applications');
    return { ok: true, data: { applicationId: application.id } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '请完整填写认证资料，申请想法至少 20 个字' };
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return { ok: false, code: 'UNAUTHORIZED', message: '请先登录后提交认证申请' };
    return { ok: false, code: 'INTERNAL_ERROR', message: '认证申请提交失败，请稍后重试' };
  }
}

const organizationApplicationSchema = z.object({
  organizationId: z.uuid(),
  motivation: z.string().trim().max(1_000).optional(),
});

export async function applyToOrganization(input: unknown): Promise<ActionResult<{ applicationId: string }>> {
  try {
    const session = await requireSession();
    const values = organizationApplicationSchema.parse(input);
    const [organization] = await getDatabase().select({ id: organizations.id }).from(organizations)
      .where(and(eq(organizations.id, values.organizationId), eq(organizations.status, 'published'))).limit(1);
    if (!organization) return { ok: false, code: 'NOT_FOUND', message: '机构不存在或暂不接受申请' };
    const [application] = await getDatabase().insert(organizationApplications).values({
      organizationId: values.organizationId,
      userId: session.id,
      motivation: values.motivation,
    }).onConflictDoNothing().returning({ id: organizationApplications.id });
    if (!application) return { ok: false, code: 'APPLICATION_EXISTS', message: '你已经申请加入该机构' };
    revalidatePath('/');
    revalidatePath('/me/applications');
    revalidatePath('/admin/applications');
    return { ok: true, data: { applicationId: application.id } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '机构申请参数不正确' };
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return { ok: false, code: 'UNAUTHORIZED', message: '请先登录后申请加入机构' };
    return { ok: false, code: 'INTERNAL_ERROR', message: '机构申请提交失败，请稍后重试' };
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
    const [ticket] = await getDatabase().insert(helpTickets).values({ ...values, userId: session?.id }).returning({ id: helpTickets.id });
    revalidatePath('/admin/applications');
    return { ok: true, data: { ticketId: ticket.id } };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '请填写有效邮箱，问题描述至少 10 个字' };
    return { ok: false, code: 'INTERNAL_ERROR', message: '问题提交失败，请稍后重试' };
  }
}
