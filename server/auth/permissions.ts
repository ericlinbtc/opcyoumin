import 'server-only';

import { eq } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { roles } from '@/db/schema';
import { can, type Permission } from '@/server/domain/rbac';
import type { UserRole } from '@/server/domain/types';

export async function canConfigured(role: UserRole, permission: Permission): Promise<boolean> {
  const [configured] = await getDatabase().select({ permissions: roles.permissions }).from(roles).where(eq(roles.key, role)).limit(1);
  return configured ? configured.permissions.includes(permission) : can(role, permission);
}

export async function assertConfiguredCan(role: UserRole, permission: Permission): Promise<void> {
  if (!(await canConfigured(role, permission))) throw new Error('FORBIDDEN');
}
