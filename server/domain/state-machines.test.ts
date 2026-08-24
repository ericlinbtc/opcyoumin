import { describe, expect, it } from 'vitest';
import { canTransitionActivity, canTransitionModeration, canTransitionPost } from './state-machines';
import { assertCan, can } from './rbac';
import { moderateText } from './moderation';

describe('domain rules', () => {
  it('only allows declared post transitions', () => {
    expect(canTransitionPost('draft', 'published')).toBe(true);
    expect(canTransitionPost('published', 'draft')).toBe(false);
    expect(canTransitionPost('hidden', 'published')).toBe(true);
  });

  it('prevents completed activities from reopening', () => {
    expect(canTransitionActivity('published', 'ended')).toBe(true);
    expect(canTransitionActivity('ended', 'published')).toBe(false);
  });

  it('supports moderation appeal review', () => {
    expect(canTransitionModeration('approved', 'appealed')).toBe(true);
    expect(canTransitionModeration('appealed', 'reviewing')).toBe(true);
  });

  it('enforces role permissions on the server', () => {
    expect(can('user', 'content:create')).toBe(true);
    expect(can('user', 'moderation:review')).toBe(false);
    expect(() => assertCan('editor', 'platform:manage')).toThrow('FORBIDDEN');
  });

  it('routes suspicious content through moderation', () => {
    expect(moderateText('分享一下今天的城市漫步路线')).toBe('publish');
    expect(moderateText('高收益项目，加我微信')).toBe('review');
    expect(moderateText('出售游戏账号')).toBe('reject');
  });
});
