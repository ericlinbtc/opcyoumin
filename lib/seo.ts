import type { Metadata } from 'next';

type PageMetadataOptions = {
  title: string;
  description: string;
  canonical: string;
  index?: boolean;
  useBrandImage?: boolean;
};

const brandImage = { url: '/og.png', width: 1672, height: 941, alt: '游民 OPC 城市创业者社区' };

export function createPageMetadata({
  title,
  description,
  canonical,
  index = true,
  useBrandImage = true,
}: PageMetadataOptions): Metadata {
  const images = useBrandImage ? [brandImage] : [];
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index, follow: index },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: '游民',
      locale: 'zh_CN',
      type: 'website',
      images,
    },
    twitter: {
      card: useBrandImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images,
    },
  };
}
