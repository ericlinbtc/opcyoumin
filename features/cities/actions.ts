'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDatabase } from '@/db';
import { cities, cityMemberships } from '@/db/schema';
import { requireSession } from '@/server/auth/session';
import type { ActionResult } from '@/features/posts/actions';

const cityIdSchema = z.uuid();

export async function joinCity(cityIdInput: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const cityId = cityIdSchema.parse(cityIdInput);
    await getDatabase().transaction(async (tx) => {
      const inserted = await tx.insert(cityMemberships).values({ cityId, userId: session.id }).onConflictDoNothing().returning({ cityId: cityMemberships.cityId });
      if (inserted.length > 0) await tx.update(cities).set({ memberCount: sql`${cities.memberCount} + 1`, updatedAt: new Date() }).where(eq(cities.id, cityId));
    });
    revalidatePath('/cities');
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, code: 'VALIDATION_ERROR', message: '城市参数不正确' };
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '加入城市失败' };
  }
}

export async function leaveCity(cityIdInput: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const cityId = cityIdSchema.parse(cityIdInput);
    await getDatabase().transaction(async (tx) => {
      const removed = await tx.delete(cityMemberships).where(and(eq(cityMemberships.cityId, cityId), eq(cityMemberships.userId, session.id))).returning({ cityId: cityMemberships.cityId });
      if (removed.length > 0) await tx.update(cities).set({ memberCount: sql`greatest(${cities.memberCount} - 1, 0)`, updatedAt: new Date() }).where(eq(cities.id, cityId));
    });
    revalidatePath('/cities');
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.message : 'INTERNAL_ERROR', message: '退出城市失败' };
  }
}
