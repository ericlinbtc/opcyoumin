import { describe, expect, it } from 'vitest';
import { createPageMetadata } from './seo';

describe('createPageMetadata', () => {
  it('keeps canonical and social URLs aligned for public pages', () => {
    const metadata = createPageMetadata({ title: '城市活动｜游民', description: '活动描述', canonical: '/activities' });
    expect(metadata).toMatchObject({
      title: '城市活动｜游民',
      description: '活动描述',
      alternates: { canonical: '/activities' },
      robots: { index: true, follow: true },
      openGraph: { title: '城市活动｜游民', description: '活动描述', url: '/activities', images: [{ url: '/og.png' }] },
      twitter: { card: 'summary_large_image', images: [{ url: '/og.png' }] },
    });
  });

  it('marks private pages noindex and removes inherited share images', () => {
    const metadata = createPageMetadata({ title: '登录', description: '登录页', canonical: '/login', index: false, useBrandImage: false });
    expect(metadata).toMatchObject({
      alternates: { canonical: '/login' },
      robots: { index: false, follow: false },
      openGraph: { url: '/login', images: [] },
      twitter: { card: 'summary', images: [] },
    });
  });
});
