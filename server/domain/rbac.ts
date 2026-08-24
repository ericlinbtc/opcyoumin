import type { UserRole } from './types';

export type Permission =
  | 'content:create'
  | 'content:edit-own'
  | 'activity:create'
  | 'activity:approve'
  | 'knowledge:publish'
  | 'city:manage'
  | 'moderation:review'
  | 'platform:manage';

const permissions: Record<UserRole, ReadonlySet<Permission>> = {
  user: new Set(['content:create', 'content:edit-own']),
  editor: new Set(['content:create', 'content:edit-own', 'activity:create', 'knowledge:publish']),
  city_admin: new Set(['content:create', 'content:edit-own', 'activity:create', 'activity:approve', 'city:manage', 'moderation:review']),
  platform_admin: new Set(['content:create', 'content:edit-own', 'activity:create', 'activity:approve', 'knowledge:publish', 'city:manage', 'moderation:review', 'platform:manage']),
};

export function can(role: UserRole, permission: Permission): boolean {
  return permissions[role].has(permission);
}

export function assertCan(role: UserRole, permission: Permission): void {
  if (!can(role, permission)) throw new Error('FORBIDDEN');
}
