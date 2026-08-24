import { count, eq } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { auditLogs, sessions, users } from '@/db/schema';
import { getPhoneHashPepper } from '@/lib/env';
import { hashPhone, normalizePhone } from '@/lib/phone';

const phoneValue = process.env.BOOTSTRAP_ADMIN_PHONE;
if (!phoneValue) throw new Error('BOOTSTRAP_ADMIN_PHONE is required');
const phone = normalizePhone(phoneValue);
if (process.env.BOOTSTRAP_ADMIN_CONFIRM !== `promote-${phone.slice(-4)}`) throw new Error('BOOTSTRAP_ADMIN_CONFIRM must equal promote-<last4>');

const db = getDatabase();
const [existingAdmins] = await db.select({ value: count() }).from(users).where(eq(users.role, 'platform_admin'));
if (existingAdmins.value > 0 && process.env.ALLOW_ADDITIONAL_PLATFORM_ADMIN !== 'true') throw new Error('A platform admin already exists; set ALLOW_ADDITIONAL_PLATFORM_ADMIN=true only after an access review');

const phoneHash = hashPhone(phone, getPhoneHashPepper());
await db.transaction(async (tx) => {
  const [account] = await tx.select({ id: users.id, role: users.role, status: users.status }).from(users).where(eq(users.phoneHash, phoneHash)).limit(1);
  if (!account || account.status !== 'active') throw new Error('Create and verify this account through the product before bootstrapping it');
  await tx.update(users).set({ role: 'platform_admin', updatedAt: new Date() }).where(eq(users.id, account.id));
  await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, account.id));
  await tx.insert(auditLogs).values({ actorId: null, action: 'platform_admin.bootstrapped', targetType: 'user', targetId: account.id, before: { role: account.role }, after: { role: 'platform_admin', method: 'bootstrap-script' } });
});

console.info('Platform administrator promoted. Existing sessions were revoked; sign in again.');
