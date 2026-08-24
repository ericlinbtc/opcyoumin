'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { auditLogs, notifications, profiles, sessions, users } from '@/db/schema';
import type { ActionResult } from '@/features/posts/actions';
import { clearSessionCookie, requireSession } from '@/server/auth/session';
import { getAuditContext } from '@/server/request-context';

const profileSchema = z.object({ nickname: z.string().trim().min(2).max(40), bio: z.string().trim().max(280), occupationTags: z.array(z.string().trim().min(1).max(30)).max(8) });

export async function updateProfile(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const audit = await getAuditContext();
    const values = profileSchema.parse(input);
    await getDatabase().transaction(async (tx) => {
      const [before] = await tx.select({ nickname: profiles.nickname, bio: profiles.bio, occupationTags: profiles.occupationTags }).from(profiles).where(eq(profiles.userId, session.id)).limit(1);
      await tx.update(profiles).set({ ...values, updatedAt: new Date() }).where(eq(profiles.userId, session.id));
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: 'profile.updated', targetType: 'user', targetId: session.id, before: before ?? {}, after: values });
    });
    revalidatePath('/me');
    revalidatePath(`/members/${session.id}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '昵称、简介或职业标签格式不正确' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '资料保存失败' };
  }
}

export async function revokeSession(input: unknown): Promise<ActionResult> {
  try {
    const current = await requireSession();
    const sessionId = z.uuid().parse(input);
    await getDatabase().update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.id, sessionId), eq(sessions.userId, current.id), isNull(sessions.revokedAt)));
    revalidatePath('/me/sessions');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '撤销会话失败' };
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await getDatabase().update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, session.id), isNull(notifications.readAt)));
    revalidatePath('/me/notifications');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '通知更新失败' };
  }
}

export async function requestAccountDeletion(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const audit = await getAuditContext();
    z.literal('DELETE').parse(input);
    await getDatabase().transaction(async (tx) => {
      await tx.update(users).set({ status: 'deletion_requested', updatedAt: new Date() }).where(eq(users.id, session.id));
      await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, session.id));
      await tx.insert(auditLogs).values({ ...audit, actorId: session.id, action: 'account.deletion_requested', targetType: 'user', targetId: session.id, after: { status: 'deletion_requested' } });
    });
    await clearSessionCookie();
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '账号注销申请失败' };
  }
}
