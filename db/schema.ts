import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['user', 'editor', 'city_admin', 'platform_admin']);
export const contentStatus = pgEnum('content_status', ['draft', 'pending', 'published', 'hidden', 'deleted']);
export const moderationStatus = pgEnum('moderation_status', ['open', 'reviewing', 'approved', 'rejected', 'appealed', 'closed']);
export const activityStatus = pgEnum('activity_status', ['draft', 'pending', 'published', 'cancelled', 'ended']);
export const registrationStatus = pgEnum('registration_status', ['registered', 'cancelled', 'attended', 'no_show']);
export const notificationType = pgEnum('notification_type', ['comment', 'reply', 'reaction', 'follow', 'activity', 'moderation', 'security', 'system']);
export const applicationStatus = pgEnum('application_status', ['submitted', 'reviewing', 'approved', 'rejected', 'cancelled']);
export const ticketStatus = pgEnum('ticket_status', ['open', 'in_progress', 'resolved', 'closed']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneHash: varchar('phone_hash', { length: 64 }).notNull(),
  phoneEncrypted: text('phone_encrypted').notNull(),
  role: userRole('role').default('user').notNull(),
  status: varchar('status', { length: 24 }).default('active').notNull(),
  activityCreatorApprovedAt: timestamp('activity_creator_approved_at', { withTimezone: true }),
  activityCreatorRequestedAt: timestamp('activity_creator_requested_at', { withTimezone: true }),
  deletionReviewNotes: text('deletion_review_notes'),
  deletionCompletedAt: timestamp('deletion_completed_at', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex('users_phone_hash_uq').on(table.phoneHash)]);

export const roles = pgTable('roles', {
  key: varchar('key', { length: 32 }).primaryKey(),
  label: varchar('label', { length: 80 }).notNull(),
  permissions: text('permissions').array().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  nickname: varchar('nickname', { length: 40 }).notNull(),
  avatarKey: text('avatar_key'),
  bio: varchar('bio', { length: 280 }),
  occupationTags: text('occupation_tags').array().default([]).notNull(),
  ...timestamps,
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  ipHash: varchar('ip_hash', { length: 64 }),
  userAgent: varchar('user_agent', { length: 500 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('sessions_token_hash_uq').on(table.tokenHash), index('sessions_user_idx').on(table.userId)]);

export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 80 }).notNull(),
  name: varchar('name', { length: 80 }).notNull(),
  regionCode: varchar('region_code', { length: 12 }).notNull(),
  description: text('description'),
  isFeatured: boolean('is_featured').default(false).notNull(),
  memberCount: integer('member_count').default(0).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex('cities_slug_uq').on(table.slug), index('cities_region_idx').on(table.regionCode)]);

export const cityMemberships = pgTable('city_memberships', {
  cityId: uuid('city_id').notNull().references(() => cities.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 24 }).default('member').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.cityId, table.userId] }), index('city_memberships_user_idx').on(table.userId)]);

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => users.id),
  cityId: uuid('city_id').references(() => cities.id),
  content: text('content').notNull(),
  topics: text('topics').array().default([]).notNull(),
  status: contentStatus('status').default('draft').notNull(),
  reactionCount: integer('reaction_count').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),
  saveCount: integer('save_count').default(0).notNull(),
  shareCount: integer('share_count').default(0).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [index('posts_city_feed_idx').on(table.cityId, table.status, table.publishedAt), index('posts_author_idx').on(table.authorId)]);

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 16 }).notNull(),
  originalKey: text('original_key').notNull(),
  publicKey: text('public_key'),
  mimeType: varchar('mime_type', { length: 120 }).notNull(),
  byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
  width: integer('width'),
  height: integer('height'),
  status: varchar('status', { length: 24 }).default('pending').notNull(),
  ...timestamps,
}, (table) => [index('media_post_idx').on(table.postId)]);

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id),
  parentId: uuid('parent_id'),
  content: text('content').notNull(),
  status: contentStatus('status').default('published').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [index('comments_post_idx').on(table.postId, table.createdAt), index('comments_parent_idx').on(table.parentId)]);

export const reactions = pgTable('reactions', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 16 }).default('like').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.postId, table.kind] })]);

export const saves = pgTable('saves', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.postId] })]);

export const postShares = pgTable('post_shares', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.postId] })]);

export const follows = pgTable('follows', {
  followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.followerId, table.followingId] })]);

export const userBlocks = pgTable('user_blocks', {
  blockerId: uuid('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: uuid('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.blockerId, table.blockedId] })]);

export const polls = pgTable('polls', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  question: varchar('question', { length: 240 }).notNull(),
  options: jsonb('options').$type<Array<{ id: string; label: string; votes: number }>>().notNull(),
  closesAt: timestamp('closes_at', { withTimezone: true }),
  ...timestamps,
});

export const pollVotes = pgTable('poll_votes', {
  pollId: uuid('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  optionId: uuid('option_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.pollId, table.userId] })]);

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizerId: uuid('organizer_id').notNull().references(() => users.id),
  cityId: uuid('city_id').notNull().references(() => cities.id),
  title: varchar('title', { length: 120 }).notNull(),
  summary: varchar('summary', { length: 500 }).notNull(),
  details: text('details').notNull(),
  location: varchar('location', { length: 240 }).notNull(),
  capacity: integer('capacity').notNull(),
  registrationCount: integer('registration_count').default(0).notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  status: activityStatus('status').default('draft').notNull(),
  ...timestamps,
}, (table) => [index('activities_city_time_idx').on(table.cityId, table.status, table.startsAt)]);

export const registrations = pgTable('registrations', {
  activityId: uuid('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: registrationStatus('status').default('registered').notNull(),
  registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.activityId, table.userId] }), index('registrations_user_idx').on(table.userId)]);

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  cityId: uuid('city_id').notNull().references(() => cities.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  category: varchar('category', { length: 80 }).notNull(),
  summary: varchar('summary', { length: 500 }).notNull(),
  location: varchar('location', { length: 240 }).notNull(),
  memberCount: integer('member_count').default(0).notNull(),
  status: contentStatus('status').default('published').notNull(),
  ...timestamps,
}, (table) => [uniqueIndex('organizations_city_name_uq').on(table.cityId, table.name), index('organizations_city_status_idx').on(table.cityId, table.status)]);

export const organizationApplications = pgTable('organization_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  motivation: varchar('motivation', { length: 1000 }),
  status: applicationStatus('status').default('submitted').notNull(),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  reviewNotes: varchar('review_notes', { length: 1000 }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex('organization_applications_org_user_uq').on(table.organizationId, table.userId), index('organization_applications_status_idx').on(table.status, table.createdAt), index('organization_applications_user_idx').on(table.userId, table.createdAt)]);

export const opcVerificationApplications = pgTable('opc_verification_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cityName: varchar('city_name', { length: 80 }).notNull(),
  contact: varchar('contact', { length: 120 }).notNull(),
  realName: varchar('real_name', { length: 80 }).notNull(),
  idNumberHash: varchar('id_number_hash', { length: 64 }).notNull(),
  idNumberLast4: varchar('id_number_last4', { length: 4 }).notNull(),
  idea: varchar('idea', { length: 2000 }).notNull(),
  status: applicationStatus('status').default('submitted').notNull(),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  reviewNotes: varchar('review_notes', { length: 1000 }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [index('opc_verification_applications_status_idx').on(table.status, table.createdAt), index('opc_verification_applications_user_idx').on(table.userId, table.createdAt)]);

export const helpTickets = pgTable('help_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  requesterName: varchar('requester_name', { length: 80 }).notNull(),
  contact: varchar('contact', { length: 160 }).notNull(),
  description: varchar('description', { length: 3000 }).notNull(),
  status: ticketStatus('status').default('open').notNull(),
  assigneeId: uuid('assignee_id').references(() => users.id),
  resolution: varchar('resolution', { length: 2000 }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [index('help_tickets_status_idx').on(table.status, table.createdAt), index('help_tickets_user_idx').on(table.userId, table.createdAt)]);

export const knowledgeArticles = pgTable('knowledge_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 160 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  summary: varchar('summary', { length: 500 }).notNull(),
  body: text('body').notNull(),
  category: varchar('category', { length: 80 }).notNull(),
  authorId: uuid('author_id').references(() => users.id),
  status: contentStatus('status').default('draft').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex('knowledge_articles_slug_uq').on(table.slug)]);

export const insights = pgTable('insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 160 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  summary: varchar('summary', { length: 500 }).notNull(),
  body: text('body').notNull(),
  category: varchar('category', { length: 80 }).notNull(),
  importance: integer('importance').default(1).notNull(),
  status: contentStatus('status').default('draft').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex('insights_slug_uq').on(table.slug), index('insights_date_idx').on(table.publishedAt)]);

export const policies = pgTable('policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  cityId: uuid('city_id').references(() => cities.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 240 }).notNull(),
  category: varchar('category', { length: 80 }).notNull(),
  summary: varchar('summary', { length: 1000 }).notNull(),
  interpretation: text('interpretation').notNull(),
  keyPoints: text('key_points').array().default([]).notNull(),
  issuingAuthority: varchar('issuing_authority', { length: 160 }).notNull(),
  documentNumber: varchar('document_number', { length: 80 }),
  sourceName: varchar('source_name', { length: 160 }).notNull(),
  sourceUrl: text('source_url').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  effectiveAt: timestamp('effective_at', { withTimezone: true }),
  status: contentStatus('status').default('draft').notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex('policies_source_url_uq').on(table.sourceUrl),
  index('policies_city_status_date_idx').on(table.cityId, table.status, table.publishedAt),
]);

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').notNull().references(() => users.id),
  targetType: varchar('target_type', { length: 24 }).notNull(),
  targetId: uuid('target_id').notNull(),
  reason: varchar('reason', { length: 80 }).notNull(),
  details: varchar('details', { length: 1000 }),
  status: moderationStatus('status').default('open').notNull(),
  ...timestamps,
}, (table) => [uniqueIndex('reports_reporter_target_uq').on(table.reporterId, table.targetType, table.targetId), index('reports_target_idx').on(table.targetType, table.targetId), index('reports_status_idx').on(table.status)]);

export const moderationCases = pgTable('moderation_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id').references(() => reports.id),
  assigneeId: uuid('assignee_id').references(() => users.id),
  targetType: varchar('target_type', { length: 24 }).notNull(),
  targetId: uuid('target_id').notNull(),
  status: moderationStatus('status').default('open').notNull(),
  decision: varchar('decision', { length: 80 }),
  notes: text('notes'),
  ...timestamps,
}, (table) => [uniqueIndex('moderation_cases_report_uq').on(table.reportId), index('moderation_cases_status_idx').on(table.status)]);

export const moderationAppeals = pgTable('moderation_appeals', {
  id: uuid('id').primaryKey().defaultRandom(),
  appellantId: uuid('appellant_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetType: varchar('target_type', { length: 24 }).notNull(),
  targetId: uuid('target_id').notNull(),
  reason: varchar('reason', { length: 1000 }).notNull(),
  status: moderationStatus('status').default('open').notNull(),
  decision: varchar('decision', { length: 80 }),
  notes: text('notes'),
  ...timestamps,
}, (table) => [index('moderation_appeals_status_idx').on(table.status), index('moderation_appeals_user_idx').on(table.appellantId, table.createdAt)]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationType('type').notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  body: varchar('body', { length: 500 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index('notifications_user_unread_idx').on(table.userId, table.readAt, table.createdAt)]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id),
  action: varchar('action', { length: 80 }).notNull(),
  targetType: varchar('target_type', { length: 40 }).notNull(),
  targetId: varchar('target_id', { length: 120 }),
  requestId: uuid('request_id'),
  ipHash: varchar('ip_hash', { length: 64 }),
  before: jsonb('before').$type<Record<string, unknown>>(),
  after: jsonb('after').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index('audit_logs_actor_idx').on(table.actorId, table.createdAt), index('audit_logs_target_idx').on(table.targetType, table.targetId)]);

export const outboxJobs = pgTable('outbox_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  topic: varchar('topic', { length: 80 }).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 160 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  status: varchar('status', { length: 24 }).default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('outbox_jobs_idempotency_uq').on(table.idempotencyKey), index('outbox_jobs_pending_idx').on(table.status, table.availableAt)]);

export const deadLetterJobs = pgTable('dead_letter_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  outboxJobId: uuid('outbox_job_id').notNull().references(() => outboxJobs.id),
  topic: varchar('topic', { length: 80 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  error: text('error').notNull(),
  status: varchar('status', { length: 24 }).default('open').notNull(),
  resolutionNotes: text('resolution_notes'),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('dead_letter_jobs_outbox_uq').on(table.outboxJobId), index('dead_letter_jobs_topic_idx').on(table.status, table.topic, table.failedAt)]);
