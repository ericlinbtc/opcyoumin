export type DemoOrganization = {
  id: string;
  cityId: string;
  citySlug: string;
  city: string;
  name: string;
  category: string;
  summary: string;
  location: string;
  memberCount: number;
};

export const demoOrganizations: DemoOrganization[] = [
  { id: '00000000-0000-4000-8000-000000000201', cityId: 'cn-shanghai-001', citySlug: 'cn-shanghai-001', city: '上海', name: '方寸工坊', category: '社区共创空间', summary: '向 OPC 创业者开放工具、场地和每周共创时段，也欢迎成员分享自己的专业能力。', location: '上海 OPC 社区公共客厅', memberCount: 286 },
  { id: '00000000-0000-4000-8000-000000000202', cityId: 'cn-beijing-002', citySlug: 'cn-beijing-002', city: '北京', name: '城屿自然社', category: '环境与自然教育', summary: '从一棵树、一条河开始认识城市生态，持续组织公众观察、自然笔记与社区课堂。', location: '北京河岸自然教育中心', memberCount: 412 },
  { id: '00000000-0000-4000-8000-000000000203', cityId: 'cn-chengdu-003', citySlug: 'cn-chengdu-003', city: '成都', name: '城市慢行小组', category: '公共空间与步行', summary: '记录适合步行的街道，邀请居民共同测试无障碍路径、夜间照明和公共休息点。', location: '成都社区公共客厅', memberCount: 198 },
];
