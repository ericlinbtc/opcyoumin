import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { activities, outboxJobs, registrations } from '@/db/schema';

export class ActivityRegistrationError extends Error {}

export async function registerActivityForUser(activityId: string, userId: string): Promise<'REGISTERED' | 'ALREADY_REGISTERED'> {
  return getDatabase().transaction(async (tx) => {
    const activated = await tx.insert(registrations)
      .values({ activityId, userId, status: 'registered' })
      .onConflictDoUpdate({
        target: [registrations.activityId, registrations.userId],
        set: { status: 'registered', registeredAt: new Date(), updatedAt: new Date() },
        setWhere: eq(registrations.status, 'cancelled'),
      })
      .returning({ activityId: registrations.activityId });
    if (activated.length === 0) return 'ALREADY_REGISTERED';

    const reserved = await tx.update(activities)
      .set({ registrationCount: sql`${activities.registrationCount} + 1`, updatedAt: new Date() })
      .where(and(
        eq(activities.id, activityId),
        eq(activities.status, 'published'),
        gt(activities.startsAt, new Date()),
        lt(activities.registrationCount, activities.capacity),
      ))
      .returning({ id: activities.id });
    if (reserved.length === 0) throw new ActivityRegistrationError('ACTIVITY_FULL_OR_CLOSED');

    await tx.insert(outboxJobs).values({
      topic: 'registration.created',
      idempotencyKey: `registration.created:${activityId}:${userId}`,
      payload: { activityId, userId },
    }).onConflictDoNothing();
    return 'REGISTERED';
  });
}

export async function cancelActivityRegistrationForUser(activityId: string, userId: string): Promise<boolean> {
  return getDatabase().transaction(async (tx) => {
    const [activity] = await tx.select({ startsAt: activities.startsAt, status: activities.status }).from(activities).where(eq(activities.id, activityId)).limit(1);
    if (!activity || activity.status !== 'published' || activity.startsAt <= new Date()) throw new ActivityRegistrationError('ACTIVITY_STARTED_OR_CLOSED');
    const changed = await tx.update(registrations)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(
        eq(registrations.activityId, activityId),
        eq(registrations.userId, userId),
        eq(registrations.status, 'registered'),
      ))
      .returning({ activityId: registrations.activityId });
    if (changed.length === 0) return false;
    await tx.update(activities)
      .set({ registrationCount: sql`greatest(${activities.registrationCount} - 1, 0)`, updatedAt: new Date() })
      .where(eq(activities.id, activityId));
    return true;
  });
}
