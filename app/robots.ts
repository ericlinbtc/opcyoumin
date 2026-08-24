import type { MetadataRoute } from 'next';
import { getServerEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const origin = new URL(getServerEnv().APP_URL).origin;
  return { rules: { userAgent: '*', allow: '/', disallow: ['/admin/', '/me/', '/api/', '/prototype'] }, sitemap: `${origin}/sitemap.xml`, host: origin };
}
