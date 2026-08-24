'use client';

import Link from 'next/link';
import { useState } from 'react';

type CityItem = { id: string; slug: string; name: string; regionCode: string; memberCount: number; activityCount: number };

const colors = ['violet', 'lime', 'peach', 'blue', 'yellow', 'rose'] as const;
const pageSize = 24;

export function CityCatalogGrid({ cities }: { cities: CityItem[] }) {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(pageSize, cities.length));
  const visibleCities = cities.slice(0, visibleCount);
  const remaining = cities.length - visibleCount;

  return (
    <>
      <div className="city-grid city-route-grid">
        {visibleCities.map((city, index) => <Link className={`city-card ${colors[index % colors.length]}`} href={`/cities/${city.slug}`} key={city.slug}><div className="city-card-head"><span><strong className="city-name">{city.name}</strong><small className="city-en">REGION {city.regionCode}</small></span></div><p className="city-people">{city.memberCount.toLocaleString('zh-CN')} 位社区成员</p><div className="city-stats"><span><b>{city.activityCount}</b><small>近期活动</small></span><span><b>{city.memberCount}</b><small>成员</small></span><span><b>开放</b><small>状态</small></span></div><div className="city-card-footer"><small>OPC 城市社区</small><strong>进入城市 →</strong></div></Link>)}
      </div>
      {remaining > 0 ? <button className="load-more-cities" type="button" onClick={() => setVisibleCount((count) => Math.min(count + pageSize, cities.length))}><span>加载更多城市</span><i>+{Math.min(pageSize, remaining)}</i></button> : null}
      <p className="city-catalog-status" aria-live="polite">已展示 {visibleCities.length.toLocaleString('zh-CN')} / {cities.length.toLocaleString('zh-CN')} 个城市</p>
    </>
  );
}
