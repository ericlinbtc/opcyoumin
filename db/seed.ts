import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getDatabase } from './index';
import { activities, cities, helpFaqs, insights, knowledgeArticles, organizations, policies, posts, profiles, roles, users } from './schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { officialPolicies } from '../features/catalog/policies';

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
const organizationCities = await getDatabase().select({ id: cities.id, name: cities.name }).from(cities).where(inArray(cities.name, ['上海', '北京', '成都', '杭州', '广州', '深圳']));
if (organizationCities.length > 0) {
  await getDatabase().insert(organizations).values(organizationCities.flatMap((city) => [
    { cityId: city.id, name: '方寸工坊', category: '社区共创空间', summary: '向 OPC 创业者开放工具、场地和每周共创时段，也欢迎成员分享自己的专业能力。', location: `${city.name} OPC 社区公共客厅`, memberCount: 286, status: 'published' as const },
    { cityId: city.id, name: '城屿自然社', category: '环境与自然教育', summary: '从一棵树、一条河开始认识城市生态，持续组织公众观察、自然笔记与社区课堂。', location: `${city.name}河岸自然教育中心`, memberCount: 412, status: 'published' as const },
    { cityId: city.id, name: '城市慢行小组', category: '公共空间与步行', summary: '记录适合步行的街道，邀请居民共同测试无障碍路径、夜间照明和公共休息点。', location: `${city.name}社区公共客厅`, memberCount: 198, status: 'published' as const },
  ])).onConflictDoNothing({ target: [organizations.cityId, organizations.name] });
}
await getDatabase().insert(roles).values([
  { key: 'user', label: '注册用户', permissions: ['content:create', 'content:edit-own'] },
  { key: 'editor', label: '内容编辑', permissions: ['content:create', 'content:edit-own', 'activity:create', 'knowledge:publish'] },
  { key: 'city_admin', label: '城市管理员', permissions: ['content:create', 'activity:create', 'activity:approve', 'city:manage', 'moderation:review'] },
  { key: 'platform_admin', label: '平台管理员', permissions: ['content:create', 'content:edit-own', 'activity:create', 'activity:approve', 'knowledge:publish', 'city:manage', 'moderation:review', 'platform:manage'] },
]).onConflictDoUpdate({
  target: roles.key,
  set: { label: sql`excluded.label`, permissions: sql`excluded.permissions`, updatedAt: new Date() },
});
await getDatabase().insert(knowledgeArticles).values([
  { slug: 'opc-first-customer', category: '经营基础', title: '一人公司如何找到第一个付费客户', summary: '从明确问题、缩小受众到完成第一次可信交付。', body: '先选择一个足够具体、愿意为结果付费的问题，再用小范围交付验证价值。', status: 'published', publishedAt: new Date() },
  { slug: 'product-scope', category: '产品方法', title: '用可验收闭环控制产品范围', summary: '把愿景拆成可以真实使用、测量和继续迭代的最小闭环。', body: '每个版本同时定义用户操作、成功结果、异常恢复与可量化指标。', status: 'published', publishedAt: new Date() },
]).onConflictDoNothing({ target: knowledgeArticles.slug });
await getDatabase().insert(insights).values([
  { slug: 'ai-agent-market-2026-08', category: 'AI 趋势', importance: 3, title: '智能体产品正在从演示走向可运营系统', summary: '持久化、审计、成本与失败恢复成为落地分水岭。', body: '真正进入生产的智能体需要可追踪输入输出、稳定重试和人工接管边界。', status: 'published', publishedAt: new Date() },
  { slug: 'opc-city-network', category: '城市观察', importance: 2, title: '本地连接是 OPC 社区的长期复利', summary: '线上内容帮助发现彼此，线下活动建立更深的信任。', body: '稳定的城市成员关系和小规模活动，比单次流量更容易形成长期协作。', status: 'published', publishedAt: new Date() },
]).onConflictDoNothing({ target: insights.slug });
await getDatabase().insert(helpFaqs).values([
  { slug: 'account-register', category: '账号', question: '如何注册游民账号？', answer: '账号认证功能暂不纳入本轮开发；开放后将通过正式登录入口完成注册和登录。', sortOrder: 10, status: 'published', publishedAt: new Date() },
  { slug: 'join-city', category: '城市', question: '如何加入或退出一个城市社区？', answer: '进入城市主页后点击“加入社区”；再次点击同一位置即可退出。加入记录会同步到个人中心。', sortOrder: 20, status: 'published', publishedAt: new Date() },
  { slug: 'publish-content', category: '发布', question: '动态支持哪些内容形式？', answer: '支持文字、图片、视频、话题和投票。每张图片不超过 10MB，每条动态最多上传 9 张图片。', sortOrder: 30, status: 'published', publishedAt: new Date() },
  { slug: 'activity-registration', category: '活动', question: '如何报名或取消报名？', answer: '在活动详情页点击报名。活动开始前可在详情页或“我的活动”中取消，名额会自动释放。', sortOrder: 40, status: 'published', publishedAt: new Date() },
  { slug: 'report-content', category: '安全', question: '如何举报不合适的内容？', answer: '在动态详情或评论旁打开举报表单，选择原因并补充说明。处理进度和申诉结果会保留在账号记录中。', sortOrder: 50, status: 'published', publishedAt: new Date() },
]).onConflictDoNothing({ target: helpFaqs.slug });
await getDatabase().insert(policies).values(officialPolicies.map((policy) => ({
  id: policy.id,
  title: policy.title,
  category: policy.category,
  summary: policy.summary,
  interpretation: policy.interpretation,
  keyPoints: policy.keyPoints,
  issuingAuthority: policy.issuingAuthority,
  documentNumber: policy.documentNumber,
  sourceName: policy.sourceName,
  sourceUrl: policy.sourceUrl,
  publishedAt: new Date(policy.publishedAt),
  effectiveAt: policy.effectiveAt ? new Date(policy.effectiveAt) : null,
  sourceCheckedAt: new Date(),
  status: 'published' as const,
}))).onConflictDoNothing({ target: policies.sourceUrl });
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
console.info(`Seeded ${values.length} cities, role definitions, knowledge, insights and sourced policies.`);
