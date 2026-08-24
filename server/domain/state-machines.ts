import type { ActivityStatus, ModerationStatus, PostStatus } from './types';

const postTransitions: Record<PostStatus, readonly PostStatus[]> = {
  draft: ['pending', 'published', 'deleted'],
  pending: ['published', 'hidden', 'deleted'],
  published: ['hidden', 'deleted'],
  hidden: ['published', 'deleted'],
  deleted: ['hidden'],
};

const activityTransitions: Record<ActivityStatus, readonly ActivityStatus[]> = {
  draft: ['pending', 'published', 'cancelled'],
  pending: ['published', 'cancelled'],
  published: ['cancelled', 'ended'],
  cancelled: [],
  ended: [],
};

const moderationTransitions: Record<ModerationStatus, readonly ModerationStatus[]> = {
  open: ['reviewing', 'closed'],
  reviewing: ['approved', 'rejected', 'closed'],
  approved: ['appealed', 'closed'],
  rejected: ['appealed', 'closed'],
  appealed: ['reviewing', 'closed'],
  closed: [],
};

export function canTransitionPost(from: PostStatus, to: PostStatus): boolean {
  return postTransitions[from].includes(to);
}

export function canTransitionActivity(from: ActivityStatus, to: ActivityStatus): boolean {
  return activityTransitions[from].includes(to);
}

export function canTransitionModeration(from: ModerationStatus, to: ModerationStatus): boolean {
  return moderationTransitions[from].includes(to);
}
