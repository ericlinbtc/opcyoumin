export const demoPosts = [
  { id: 'city-walk', authorId: 'zhou-yuan', author: '周予安', city: '杭州', title: '雨后的城市漫步路线', body: '沿着运河慢慢走，从旧码头到老邮局，重新认识平时容易错过的城市细节。', replies: 12 },
  { id: 'opc-weekly', authorId: 'lin-ye', author: '林野', city: '深圳', title: '一人公司这一周做对了什么', body: '把产品范围缩到一个能够被用户完整验证的闭环，比同时追逐十个功能更重要。', replies: 26 },
  { id: 'ai-workflow', authorId: 'chen-jian', author: '陈见山', city: '上海', title: '我的 AI 内容工作流复盘', body: '从资料收集、结构化到最终交付，最值得保留的是人工判断与可追溯来源。', replies: 18 },
] as const;

export const demoActivities = [
  { id: 'hangzhou-opc-night', city: '杭州', title: 'OPC 创业者开放夜', summary: '12 位一人公司经营者的小规模深度交流。', date: '2026-09-12', location: '运河创业街区', capacity: 30, registered: 18 },
  { id: 'shenzhen-ai-build', city: '深圳', title: 'AI 产品共创工作坊', summary: '用一个下午完成从问题到可测试原型。', date: '2026-09-20', location: '南山智园', capacity: 24, registered: 21 },
] as const;

export const demoKnowledge = [
  { slug: 'opc-first-customer', category: '经营基础', title: '一人公司如何找到第一个付费客户', summary: '从明确问题、缩小受众到完成第一次可信交付。' },
  { slug: 'product-scope', category: '产品方法', title: '用可验收闭环控制产品范围', summary: '把愿景拆成可以真实使用、测量和继续迭代的最小闭环。' },
] as const;

export const demoInsights = [
  { slug: 'ai-agent-market-2026-08', category: 'AI 趋势', importance: 3, date: '2026-08-24', title: '智能体产品正在从演示走向可运营系统', summary: '持久化、审计、成本与失败恢复成为落地分水岭。' },
  { slug: 'opc-city-network', category: '城市观察', importance: 2, date: '2026-08-22', title: '本地连接是 OPC 社区的长期复利', summary: '线上内容帮助发现彼此，线下活动建立更深的信任。' },
] as const;
