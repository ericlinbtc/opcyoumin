import type { Metadata } from 'next';
import { PageHero } from '@/components/product-shell';
import { CityCatalogGrid } from '@/features/cities/city-catalog-grid';
import { createPageMetadata } from '@/lib/seo';
import { listPublicCities } from '@/server/repositories/public-content';

export const metadata: Metadata = createPageMetadata({ title: '全国 OPC 城市｜游民', description: '浏览全国 694 个 OPC 城市社区。', canonical: '/cities' });

export default async function CitiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = (await searchParams).q?.trim() ?? '';
  const cities = await listPublicCities(query);
  return (
    <main className="feature-page city-catalog-page">
      <PageHero eyebrow="694 OPC CITIES" title="找到你的城市社区" description="每座城市都有稳定、可刷新和可分享的独立入口。" count={String(cities.length)} unit={query ? '个搜索结果' : '个 OPC 城市'} />
      <section className="feature-page-body">
        <form className="catalog-search" action="/cities"><label htmlFor="city-search">搜索城市</label><div><input id="city-search" name="q" defaultValue={query} placeholder="输入城市名称" /><button type="submit">搜索</button></div></form>
        <p className="catalog-summary">{query ? `“${query}”共有 ${cities.length} 个结果` : `全国共 ${cities.length} 个城市`}</p>
        <CityCatalogGrid cities={cities} />
      </section>
    </main>
  );
}
