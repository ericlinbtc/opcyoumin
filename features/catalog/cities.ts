import catalog from '@/public/city-catalog.json';

export type PublicCity = {
  slug: string;
  name: string;
  regionCode: string;
  memberCount: number;
  activityCount: number;
};

const featuredNames = new Set(['北京', '上海', '深圳', '杭州', '成都', '广州']);
const sourceCities = Object.values(catalog).flat();

export const publicCities: PublicCity[] = sourceCities.map((city, index) => ({
  slug: `cn-${city.region}-${String(index + 1).padStart(3, '0')}`,
  name: city.name,
  regionCode: city.region,
  memberCount: 120 + ((index * 137) % 4_800),
  activityCount: 2 + ((index * 7) % 29),
}));

export const featuredCities = publicCities.filter((city) => featuredNames.has(city.name));

export function findPublicCity(slug: string): PublicCity | undefined {
  return publicCities.find((city) => city.slug === slug);
}
