import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getDatabase } from './index';
import { activities, cities, insights, knowledgeArticles, posts, profiles, roles, users } from './schema';
import { eq } from 'drizzle-orm';

type CitySource = { name: string; en: string; region: string };
type CityCatalog = Record<string, CitySource[]>;

const raw = await readFile(resolve(process.cwd(), 'public/city-catalog.json'), 'utf8');
const catalog = JSON.parse(raw) as CityCatalog;
const sourceCities = Object.values(catalog).flat();
if (sourceCities.length !== 694) {
  throw new Error(`Expected 694 cities, received ${sourceCities.length}`);
}

const values = sourceCities.map((city, index) => ({
  slug: `cn-${city.region}-${String(index + 1).padStart(3, '0')}`,
  name: city.name,
  regionCode: city.region,
  isFeatured: ['北京', '上海', '深圳', '杭州', '成都', '广州'].includes(city.name),
}));

await getDatabase().insert(cities).values(values).onConflictDoNothing({ target: cities.slug });
await getDatabase().insert(roles).values([
  { key: 'user', label: '注册用户', permissions: ['content:create', 'content:edit-own'] },
  { key: 'editor', label: '内容编辑', permissions: ['content:create', 'content:edit-own', 'activity:create', 'knowledge:publish'] },
  { key: 'city_admin', label: '城市管理员', permissions: ['content:create', 'activity:create', 'activity:approve', 'city:manage', 'moderation:review'] },
  { key: 'platform_admin', label: '平台管理员', permissions: ['platform:manage'] },
]).onConflictDoNothing({ target: roles.key });
await getDatabase().insert(knowledgeArticles).values([
  { slug: 'opc-first-customer', category: '经营基础', title: '一人公司如何找到第一个付费客户', summary: '从明确问题、缩小受众到完成第一次可信交付。', body: '先选择一个足够具体、愿意为结果付费的问题，再用小范围交付验证价值。', status: 'published', publishedAt: new Date() },
  { slug: 'product-scope', category: '产品方法', title: '用可验收闭环控制产品范围', summary: '把愿景拆成可以真实使用、测量和继续迭代的最小闭环。', body: '每个版本同时定义用户操作、成功结果、异常恢复与可量化指标。', status: 'published', publishedAt: new Date() },
]).onConflictDoNothing({ target: knowledgeArticles.slug });
await getDatabase().insert(insights).values([
  { slug: 'ai-agent-market-2026-08', category: 'AI 趋势', importance: 3, title: '智能体产品正在从演示走向可运营系统', summary: '持久化、审计、成本与失败恢复成为落地分水岭。', body: '真正进入生产的智能体需要可追踪输入输出、稳定重试和人工接管边界。', status: 'published', publishedAt: new Date() },
  { slug: 'opc-city-network', category: '城市观察', importance: 2, title: '本地连接是 OPC 社区的长期复利', summary: '线上内容帮助发现彼此，线下活动建立更深的信任。', body: '稳定的城市成员关系和小规模活动，比单次流量更容易形成长期协作。', status: 'published', publishedAt: new Date() },
]).onConflictDoNothing({ target: insights.slug });
if (process.env.SEED_DEMO_CONTENT === 'true') {
  const demoUserId = '00000000-0000-4000-8000-000000000001';
  const demoPostId = '00000000-0000-4000-8000-000000000002';
  const demoActivityId = '00000000-0000-4000-8000-000000000003';
  await getDatabase().insert(users).values({ id: demoUserId, phoneHash: '0'.repeat(64), phoneEncrypted: 'seed-demo', role: 'editor' }).onConflictDoNothing({ target: users.id });
  await getDatabase().insert(profiles).values({ userId: demoUserId, nickname: '游民演示账号', bio: '用于持续集成验收的公开演示内容。', occupationTags: ['OPC'] }).onConflictDoNothing({ target: profiles.userId });
  const [demoCity] = await getDatabase().select({ id: cities.id }).from(cities).where(eq(cities.name, '北京')).limit(1);
  if (!demoCity) throw new Error('Demo city seed failed');
  await getDatabase().insert(posts).values({ id: demoPostId, authorId: demoUserId, cityId: demoCity.id, content: '持续集成公开社区动态', status: 'published', publishedAt: new Date() }).onConflictDoNothing({ target: posts.id });
  await getDatabase().insert(activities).values({ id: demoActivityId, organizerId: demoUserId, cityId: demoCity.id, title: '持续集成 OPC 社区活动', summary: '用于验证公开活动列表、详情与报名入口。', details: '这是持续集成环境的固定活动数据，仅用于自动化产品闭环验收。', location: '北京 OPC 社区', capacity: 30, startsAt: new Date('2027-01-10T10:00:00+08:00'), endsAt: new Date('2027-01-10T12:00:00+08:00'), status: 'published' }).onConflictDoNothing({ target: activities.id });
}
console.info(`Seeded ${values.length} cities, role definitions, knowledge and insights.`);
