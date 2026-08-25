'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile } from '@/features/account/actions';
import { registerActivity, cancelRegistration } from '@/features/activities/actions';
import { createHelpTicket, applyToOrganization } from '@/features/applications/actions';
import { joinCity, leaveCity } from '@/features/cities/actions';
import { recordShare, toggleFollow, toggleReaction, toggleSave, votePoll } from '@/features/interactions/actions';
import { createComment, createPost } from '@/features/posts/actions';
import { officialPolicies } from '@/features/catalog/policies';

type InformationView = 'about' | 'terms' | 'privacy' | 'risk' | 'cooperation';
type View = 'community' | 'knowledge' | 'insights' | 'help' | InformationView | 'profile' | 'myActivities' | 'myDynamics' | 'myCollections' | 'myApplications' | 'member' | 'article';
type PersonalSeriesKind = '动态' | '收藏' | '申请';
type FeedType = '动态' | '活动' | '机构';
type CommunitySection = '动态' | '活动' | '成员' | '机构' | '政策';
type Country = '中国';
type KnowledgeCategory = '全部' | 'AI 入门' | '大模型' | '智能体' | 'AI 工具';
type InsightCategory = '全部' | '模型发布' | '产品工具' | '行业动向' | '研究前沿';

type City = {
  country: Country;
  region?: string;
  name: string;
  en: string;
  color: string;
  people: string;
  topic: string;
  statement: string;
  population: string;
  area: string;
  temperature: string;
  air: string;
  score: number;
  trend: string;
  stats?: { members: number; posts: number; events: number; orgs: number };
};

type CityCatalogEntry = { name: string; en: string; region: string };
type CityCatalog = Record<Country, CityCatalogEntry[]>;

type FeedItemData = {
  id?: string;
  authorId?: string;
  type: FeedType;
  content: string;
  author: string;
  meta: string;
  avatar: string;
  stats: { likes: number; replies: number; shares: number; saves?: number };
  viewer?: { reacted: boolean; saved: boolean };
  media?: { kind: 'image' | 'video'; src: string; alt: string; poster?: string };
  poll?: { id?: string; question: string; options: { id?: string; label: string; votes: number }[]; viewerVoted?: boolean };
  topic?: string;
  title?: string;
  category?: string;
  location?: string;
  capacity?: number;
  members?: number;
  cover?: string;
  registered?: boolean;
  applied?: boolean;
};

type ComposerTool = '话题' | '投票';

type CommunityMemberData = {
  id?: string;
  name: string;
  role: string;
  avatar: string;
  contribution: number;
  posts: number;
  followers: number;
  following?: boolean;
};

type PrototypeCityPayload = {
  connected: boolean;
  city?: { id: string; name: string; memberCount: number; postCount: number; activityCount: number; organizationCount: number; joined: boolean };
  posts?: Array<{ id: string; authorId: string; author: string; avatarUrl?: string; content: string; topic?: string; publishedAt: string; stats: { likes: number; replies: number; shares: number; saves: number }; viewer: { reacted: boolean; saved: boolean }; media?: { kind: string; src: string }; poll?: { id: string; question: string; options: Array<{ id: string; label: string; votes: number }>; viewerVoted: boolean } }>;
  activities?: Array<{ id: string; organizerId: string; organizer: string; avatarUrl?: string; title: string; summary: string; details: string; location: string; capacity: number; registeredCount: number; startsAt: string; registered: boolean }>;
  organizations?: Array<{ id: string; name: string; category: string; summary: string; location: string; memberCount: number; applied: boolean }>;
  members?: Array<{ id: string; name: string; avatarUrl?: string; role: string; contribution: number; postCount: number; followerCount: number; following: boolean }>;
};

type PrototypeAccountPayload = {
  connected: boolean;
  userId?: string;
  profile?: { name: string; bio: string | null; tags: string[]; avatarUrl?: string; followingCount: number; followerCount: number };
  joinedCities?: Array<{ id: string; name: string; postCount: number }>;
  posts?: Array<{ id: string; content: string; status: string; createdAt: string }>;
  saves?: Array<{ id: string; content: string; city: string | null; savedAt: string }>;
  activities?: Array<{ id: string; title: string; city: string; startsAt: string; status: string }>;
  applications?: Array<{ id: string; kind: string; title: string; status: string; createdAt: string }>;
};

const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=96&h=96&q=85';

function handleActionError(result: { ok: boolean; code?: string; message?: string }): string | null {
  if (result.ok) return null;
  if (result.code === 'UNAUTHORIZED') return '请先登录';
  return result.message ?? '操作失败，请稍后重试';
}

function usePrototypeAccount() {
  const [account, setAccount] = useState<PrototypeAccountPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = () => {
    setLoading(true);
    fetch('/api/prototype/account').then((response) => response.json()).then((payload: { ok: boolean; data?: PrototypeAccountPayload }) => {
      if (payload.ok && payload.data) setAccount(payload.data);
    }).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => {
    let active = true;
    fetch('/api/prototype/account').then((response) => response.json()).then((payload: { ok: boolean; data?: PrototypeAccountPayload }) => {
      if (active && payload.ok && payload.data) setAccount(payload.data);
    }).catch(console.error).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { account, loading, refresh };
}

const chinaCities: Omit<City, 'country'>[] = [
  { name: '上海', en: 'SHANGHAI', color: 'violet', people: '24.8K', topic: '梧桐区更新计划', statement: '海纳百川，在日常的缝隙里遇见新鲜事。', population: '2,487 万', area: '6,340 km²', temperature: '26°', air: '优 · 32', score: 96, trend: '+12%' },
  { name: '成都', en: 'CHENGDU', color: 'lime', people: '18.2K', topic: '公园城市生活周', statement: '慢一点，才能听见一座城市真正的呼吸。', population: '2,140 万', area: '14,335 km²', temperature: '24°', air: '良 · 54', score: 94, trend: '+18%' },
  { name: '北京', en: 'BEIJING', color: 'peach', people: '31.5K', topic: '城市漫游路线征集', statement: '旧街巷与新想法，总会在一个转角相遇。', population: '2,183 万', area: '16,410 km²', temperature: '28°', air: '优 · 41', score: 92, trend: '+9%' },
  { name: '杭州', en: 'HANGZHOU', color: 'blue', people: '16.9K', topic: '运河创意市集', statement: '湖山之外，每一种数字生活也有人情味。', population: '1,252 万', area: '16,850 km²', temperature: '27°', air: '优 · 29', score: 90, trend: '+15%' },
  { name: '广州', en: 'GUANGZHOU', color: 'yellow', people: '20.3K', topic: '街坊共建计划', statement: '食在街巷，情在人间，街坊就是城市的根。', population: '1,882 万', area: '7,434 km²', temperature: '30°', air: '优 · 36', score: 89, trend: '+11%' },
  { name: '西安', en: 'XI’AN', color: 'rose', people: '12.7K', topic: '城墙青年音乐会', statement: '在千年时间里，继续写年轻的新一页。', population: '1,308 万', area: '10,108 km²', temperature: '25°', air: '良 · 58', score: 87, trend: '+21%' },
  { name: '深圳', en: 'SHENZHEN', color: 'blue', people: '22.6K', topic: '海边公共空间计划', statement: '年轻的城市，也能生长出深厚的邻里关系。', population: '1,779 万', area: '1,997 km²', temperature: '29°', air: '优 · 25', score: 86, trend: '+14%' },
  { name: '重庆', en: 'CHONGQING', color: 'peach', people: '17.4K', topic: '山城步道共创', statement: '爬坡上坎的日常，连起立体而热烈的生活。', population: '3,190 万', area: '82,400 km²', temperature: '31°', air: '良 · 61', score: 85, trend: '+17%' },
  { name: '南京', en: 'NANJING', color: 'violet', people: '14.8K', topic: '梧桐树下读书会', statement: '历史从不遥远，它就在每一次树影和钟声里。', population: '955 万', area: '6,587 km²', temperature: '27°', air: '优 · 43', score: 84, trend: '+8%' },
  { name: '武汉', en: 'WUHAN', color: 'lime', people: '15.6K', topic: '江滩夜跑地图', statement: '两江交汇，也让千万种生活方式在这里相遇。', population: '1,381 万', area: '8,569 km²', temperature: '30°', air: '良 · 52', score: 83, trend: '+13%' },
  { name: '苏州', en: 'SUZHOU', color: 'rose', people: '13.9K', topic: '古城河道观察', statement: '园林之外，小桥流水仍是寻常人的日常。', population: '1,295 万', area: '8,657 km²', temperature: '27°', air: '优 · 35', score: 82, trend: '+10%' },
  { name: '天津', en: 'TIANJIN', color: 'yellow', people: '11.3K', topic: '海河公共艺术季', statement: '幽默、爽朗，城市的性格藏在一句问候里。', population: '1,364 万', area: '11,966 km²', temperature: '28°', air: '良 · 57', score: 81, trend: '+7%' },
  { name: '厦门', en: 'XIAMEN', color: 'blue', people: '10.8K', topic: '海岸线净滩行动', statement: '海风穿过街巷，也把人与人的距离吹得更近。', population: '535 万', area: '1,701 km²', temperature: '29°', air: '优 · 22', score: 80, trend: '+16%' },
  { name: '青岛', en: 'QINGDAO', color: 'violet', people: '10.5K', topic: '老城建筑散步', statement: '红瓦、绿树与海，构成舒展的城市日常。', population: '1,044 万', area: '11,293 km²', temperature: '26°', air: '优 · 31', score: 79, trend: '+9%' },
  { name: '长沙', en: 'CHANGSHA', color: 'lime', people: '14.1K', topic: '社区夜市观察', statement: '烟火气从不打烊，新的想法也总在发生。', population: '1,062 万', area: '11,819 km²', temperature: '31°', air: '良 · 49', score: 78, trend: '+20%' },
  { name: '郑州', en: 'ZHENGZHOU', color: 'peach', people: '9.8K', topic: '城市绿廊骑行', statement: '在交通的十字路口，重新发现彼此的方向。', population: '1,301 万', area: '7,567 km²', temperature: '29°', air: '良 · 63', score: 77, trend: '+12%' },
  { name: '昆明', en: 'KUNMING', color: 'yellow', people: '9.4K', topic: '春城花市地图', statement: '四季都有花开，也总有适合相遇的温度。', population: '868 万', area: '21,013 km²', temperature: '22°', air: '优 · 20', score: 76, trend: '+15%' },
  { name: '宁波', en: 'NINGBO', color: 'rose', people: '8.9K', topic: '港口记忆征集', statement: '书藏古今，港通天下，也珍藏普通人的故事。', population: '977 万', area: '9,816 km²', temperature: '27°', air: '优 · 37', score: 75, trend: '+6%' },
  { name: '福州', en: 'FUZHOU', color: 'lime', people: '8.6K', topic: '坊巷生活档案', statement: '榕荫之下，老街与新的社区生活一同生长。', population: '846 万', area: '12,252 km²', temperature: '29°', air: '优 · 28', score: 74, trend: '+11%' },
  { name: '无锡', en: 'WUXI', color: 'blue', people: '8.2K', topic: '太湖自然课堂', statement: '湖光与产业之外，是细腻踏实的人间生活。', population: '750 万', area: '4,627 km²', temperature: '27°', air: '优 · 39', score: 73, trend: '+8%' },
  { name: '济南', en: 'JINAN', color: 'peach', people: '7.9K', topic: '泉水公共空间', statement: '泉水穿城而过，也滋养开放爽朗的街坊气质。', population: '944 万', area: '10,244 km²', temperature: '28°', air: '良 · 55', score: 72, trend: '+9%' },
  { name: '合肥', en: 'HEFEI', color: 'violet', people: '7.6K', topic: '青年科学夜校', statement: '创新不仅发生在实验室，也发生在社区之间。', population: '985 万', area: '11,445 km²', temperature: '28°', air: '优 · 44', score: 71, trend: '+13%' },
  { name: '沈阳', en: 'SHENYANG', color: 'yellow', people: '7.3K', topic: '老厂房新生计划', statement: '工业记忆有了新的表达，日子依然热气腾腾。', population: '924 万', area: '12,948 km²', temperature: '23°', air: '良 · 59', score: 70, trend: '+7%' },
  { name: '大连', en: 'DALIAN', color: 'rose', people: '7.1K', topic: '滨海步道体验', statement: '山海之间，每一次散步都能遇见开阔的风。', population: '754 万', area: '12,574 km²', temperature: '24°', air: '优 · 26', score: 69, trend: '+10%' },
  { name: '石家庄', en: 'SHIJIAZHUANG', color: 'violet', people: '6.9K', topic: '老铁路社区更新', statement: '山与平原交会，也让踏实的生活不断向前。', population: '1,122 万', area: '14,530 km²', temperature: '27°', air: '良 · 62', score: 68, trend: '+8%' },
  { name: '太原', en: 'TAIYUAN', color: 'lime', people: '6.7K', topic: '汾河生活观察', statement: '一条汾河穿过古老城池，也连接起新的日常。', population: '543 万', area: '6,988 km²', temperature: '25°', air: '良 · 57', score: 67, trend: '+9%' },
  { name: '呼和浩特', en: 'HOHHOT', color: 'peach', people: '6.5K', topic: '草原城市音乐周', statement: '风从草原来到街区，城市因此格外辽阔坦荡。', population: '361 万', area: '17,224 km²', temperature: '21°', air: '优 · 33', score: 66, trend: '+11%' },
  { name: '长春', en: 'CHANGCHUN', color: 'blue', people: '6.4K', topic: '电影城市记忆', statement: '电影、汽车与林荫大道，保存着城市的温柔底色。', population: '909 万', area: '24,734 km²', temperature: '20°', air: '优 · 40', score: 65, trend: '+7%' },
  { name: '哈尔滨', en: 'HARBIN', color: 'yellow', people: '6.8K', topic: '松花江冬日计划', statement: '冰雪让城市明亮，也让热情成为最暖的语言。', population: '939 万', area: '53,186 km²', temperature: '18°', air: '优 · 35', score: 69, trend: '+15%' },
  { name: '南昌', en: 'NANCHANG', color: 'rose', people: '6.6K', topic: '赣江夜游地图', statement: '江水与晚风相伴，城市的热烈藏在寻常夜色里。', population: '656 万', area: '7,195 km²', temperature: '29°', air: '优 · 38', score: 67, trend: '+12%' },
  { name: '南宁', en: 'NANNING', color: 'lime', people: '6.9K', topic: '绿城社区花园', statement: '四季常绿的城市，也把包容写进街头巷尾。', population: '894 万', area: '22,112 km²', temperature: '30°', air: '优 · 24', score: 70, trend: '+14%' },
  { name: '海口', en: 'HAIKOU', color: 'blue', people: '6.2K', topic: '骑楼老街生活节', statement: '海风吹过骑楼，松弛与烟火气在此并肩生长。', population: '300 万', area: '3,145 km²', temperature: '31°', air: '优 · 18', score: 68, trend: '+13%' },
  { name: '贵阳', en: 'GUIYANG', color: 'peach', people: '6.3K', topic: '山地生活实验', statement: '群山塑造城市，也让清凉与活力彼此相遇。', population: '660 万', area: '8,034 km²', temperature: '23°', air: '优 · 21', score: 66, trend: '+10%' },
  { name: '拉萨', en: 'LHASA', color: 'violet', people: '5.8K', topic: '高原公共文化日', statement: '阳光照进古老街巷，时间在这里变得辽阔。', population: '87 万', area: '29,640 km²', temperature: '17°', air: '优 · 12', score: 72, trend: '+16%' },
  { name: '兰州', en: 'LANZHOU', color: 'yellow', people: '6.1K', topic: '黄河岸线漫步', statement: '黄河穿城而过，也把坚韧与温暖留给每个人。', population: '442 万', area: '13,086 km²', temperature: '24°', air: '良 · 51', score: 64, trend: '+8%' },
  { name: '西宁', en: 'XINING', color: 'blue', people: '5.6K', topic: '夏都自然课堂', statement: '高原的风很清澈，生活也有舒展从容的尺度。', population: '248 万', area: '7,607 km²', temperature: '16°', air: '优 · 17', score: 65, trend: '+9%' },
  { name: '银川', en: 'YINCHUAN', color: 'rose', people: '5.7K', topic: '塞上湖城观察', statement: '贺兰山与黄河之间，绿洲生活安静而丰盛。', population: '290 万', area: '9,025 km²', temperature: '24°', air: '优 · 34', score: 63, trend: '+7%' },
  { name: '乌鲁木齐', en: 'URUMQI', color: 'lime', people: '6.4K', topic: '天山多元文化周', statement: '天山脚下，不同文化共同写下热烈的城市日常。', population: '408 万', area: '13,788 km²', temperature: '22°', air: '优 · 29', score: 71, trend: '+15%' },
  { name: '唐山', en: 'TANGSHAN', color: 'peach', people: '6.0K', topic: '工业遗产开放日', statement: '从工业记忆中生长出的，是朴实而坚定的生活。', population: '772 万', area: '13,472 km²', temperature: '26°', air: '良 · 56', score: 62, trend: '+6%' },
  { name: '温州', en: 'WENZHOU', color: 'yellow', people: '7.2K', topic: '山水斗城漫步', statement: '敢闯敢试之外，山水与乡情始终温柔相连。', population: '985 万', area: '12,110 km²', temperature: '28°', air: '优 · 30', score: 73, trend: '+12%' },
  { name: '佛山', en: 'FOSHAN', color: 'violet', people: '7.5K', topic: '岭南功夫文化季', statement: '功夫、陶艺与制造，共同延续务实的岭南精神。', population: '961 万', area: '3,798 km²', temperature: '30°', air: '优 · 39', score: 74, trend: '+13%' },
  { name: '东莞', en: 'DONGGUAN', color: 'lime', people: '7.0K', topic: '青年制造者大会', statement: '制造业的脉搏里，也跳动着年轻的创造力。', population: '1,050 万', area: '2,460 km²', temperature: '29°', air: '优 · 36', score: 72, trend: '+11%' },
  { name: '珠海', en: 'ZHUHAI', color: 'blue', people: '6.8K', topic: '情侣路公共生活', statement: '海岸线拉长日常，也让城市保持轻盈开放。', population: '250 万', area: '1,736 km²', temperature: '29°', air: '优 · 20', score: 75, trend: '+14%' },
  { name: '泉州', en: 'QUANZHOU', color: 'peach', people: '6.6K', topic: '古城声音档案', statement: '海丝故事仍在街巷、庙宇与寻常生活里回响。', population: '890 万', area: '11,015 km²', temperature: '28°', air: '优 · 27', score: 74, trend: '+16%' },
  { name: '常州', en: 'CHANGZHOU', color: 'rose', people: '6.2K', topic: '运河工业记忆', statement: '运河与制造相伴，让细致踏实成为城市性格。', population: '538 万', area: '4,385 km²', temperature: '27°', air: '优 · 42', score: 66, trend: '+8%' },
  { name: '烟台', en: 'YANTAI', color: 'yellow', people: '6.1K', topic: '滨海生活观察', statement: '葡萄园与海风之间，生活有着清爽明亮的节奏。', population: '710 万', area: '13,745 km²', temperature: '24°', air: '优 · 23', score: 68, trend: '+10%' },
  { name: '徐州', en: 'XUZHOU', color: 'violet', people: '6.4K', topic: '两汉文化新表达', statement: '南北在此交会，豪爽与厚重成为共同的底色。', population: '902 万', area: '11,258 km²', temperature: '27°', air: '良 · 50', score: 65, trend: '+9%' },
  { name: '洛阳', en: 'LUOYANG', color: 'lime', people: '6.7K', topic: '古都青年生活节', statement: '千年古都并不遥远，新的生活每天都在发芽。', population: '708 万', area: '15,230 km²', temperature: '26°', air: '良 · 48', score: 70, trend: '+12%' },
  { name: '绍兴', en: 'SHAOXING', color: 'peach', people: '6.0K', topic: '水城生活档案', statement: '河道、石桥与黄酒香，让日常保留从容的温度。', population: '539 万', area: '8,279 km²', temperature: '27°', air: '优 · 35', score: 69, trend: '+10%' },
  { name: '嘉兴', en: 'JIAXING', color: 'yellow', people: '5.9K', topic: '运河社区共创', statement: '水乡的柔软与制造的活力，在街区里自然相遇。', population: '558 万', area: '4,223 km²', temperature: '27°', air: '优 · 33', score: 68, trend: '+9%' },
  { name: '金华', en: 'JINHUA', color: 'rose', people: '5.8K', topic: '古城青年市集', statement: '山水之间，务实的生活也始终保持创造力。', population: '712 万', area: '10,942 km²', temperature: '28°', air: '优 · 36', score: 67, trend: '+11%' },
  { name: '台州', en: 'TAIZHOU', color: 'blue', people: '5.7K', topic: '山海步道计划', statement: '山海相拥，让每一次出发都保有开阔的方向。', population: '671 万', area: '10,050 km²', temperature: '28°', air: '优 · 24', score: 69, trend: '+13%' },
  { name: '惠州', en: 'HUIZHOU', color: 'lime', people: '6.1K', topic: '西湖公共生活季', statement: '湖山与产业并行，城市仍保有松弛的生活尺度。', population: '607 万', area: '11,347 km²', temperature: '30°', air: '优 · 28', score: 70, trend: '+12%' },
  { name: '中山', en: 'ZHONGSHAN', color: 'violet', people: '5.9K', topic: '香山社区漫游', statement: '侨乡记忆与岭南日常，共同延续开放的城市性格。', population: '447 万', area: '1,784 km²', temperature: '30°', air: '优 · 31', score: 68, trend: '+10%' },
  { name: '江门', en: 'JIANGMEN', color: 'peach', people: '5.6K', topic: '侨乡建筑观察', statement: '骑楼与碉楼收藏远方，也连接当下的社区生活。', population: '483 万', area: '9,505 km²', temperature: '30°', air: '优 · 34', score: 66, trend: '+9%' },
  { name: '汕头', en: 'SHANTOU', color: 'yellow', people: '5.8K', topic: '小公园开埠文化周', statement: '海风、骑楼与潮汕味道，组成鲜明的城市记忆。', population: '554 万', area: '2,248 km²', temperature: '30°', air: '优 · 27', score: 67, trend: '+12%' },
  { name: '扬州', en: 'YANGZHOU', color: 'rose', people: '5.7K', topic: '运河生活笔记', statement: '慢生活不只是节奏，也是人与城市相处的智慧。', population: '458 万', area: '6,591 km²', temperature: '27°', air: '优 · 38', score: 70, trend: '+11%' },
  { name: '镇江', en: 'ZHENJIANG', color: 'blue', people: '5.3K', topic: '江山城市漫步', statement: '大江与群山交会，让小城拥有舒展而坚定的气质。', population: '322 万', area: '3,840 km²', temperature: '27°', air: '优 · 40', score: 65, trend: '+8%' },
  { name: '泰州', en: 'TAIZHOU-JS', color: 'lime', people: '5.2K', topic: '水城慢生活节', statement: '水巷深处的烟火气，让生活始终安稳而亲切。', population: '451 万', area: '5,787 km²', temperature: '27°', air: '优 · 37', score: 64, trend: '+9%' },
  { name: '盐城', en: 'YANCHENG', color: 'peach', people: '5.1K', topic: '湿地自然课堂', statement: '海岸湿地与城市相邻，自然成为日常的一部分。', population: '669 万', area: '16,931 km²', temperature: '26°', air: '优 · 25', score: 66, trend: '+12%' },
  { name: '连云港', en: 'LIANYUNGANG', color: 'violet', people: '5.2K', topic: '山海港城观察', statement: '山、海与港口相连，也连接起辽阔的城市想象。', population: '460 万', area: '7,615 km²', temperature: '26°', air: '优 · 29', score: 65, trend: '+10%' },
  { name: '淄博', en: 'ZIBO', color: 'yellow', people: '5.9K', topic: '工业城市新生活', statement: '工业底色与年轻烟火气，共同写下城市的新篇章。', population: '470 万', area: '5,965 km²', temperature: '28°', air: '良 · 52', score: 69, trend: '+15%' },
  { name: '潍坊', en: 'WEIFANG', color: 'blue', people: '5.4K', topic: '风筝城市文化季', statement: '风筝飞向天空，也把开放和想象留在城市里。', population: '936 万', area: '16,167 km²', temperature: '27°', air: '良 · 46', score: 66, trend: '+10%' },
  { name: '临沂', en: 'LINYI', color: 'rose', people: '5.5K', topic: '沂河公共空间计划', statement: '沂河穿过城市，连接起踏实而热情的生活。', population: '1,099 万', area: '17,191 km²', temperature: '28°', air: '良 · 49', score: 65, trend: '+11%' },
  { name: '济宁', en: 'JINING', color: 'lime', people: '5.2K', topic: '运河文化共创周', statement: '运河与传统文化，在新的社区日常里继续流动。', population: '829 万', area: '11,187 km²', temperature: '28°', air: '良 · 47', score: 64, trend: '+9%' },
  { name: '威海', en: 'WEIHAI', color: 'peach', people: '5.6K', topic: '千里海岸生活季', statement: '清澈海岸让城市舒展，也让邻里关系更轻盈。', population: '292 万', area: '5,799 km²', temperature: '24°', air: '优 · 18', score: 72, trend: '+14%' },
  { name: '秦皇岛', en: 'QINHUANGDAO', color: 'yellow', people: '5.1K', topic: '海岸慢行地图', statement: '长城入海的地方，也生长着松弛的滨海日常。', population: '313 万', area: '7,802 km²', temperature: '25°', air: '优 · 30', score: 66, trend: '+10%' },
  { name: '保定', en: 'BAODING', color: 'violet', people: '5.3K', topic: '古城公共生活计划', statement: '古城记忆与新的社区关系，在街巷里彼此照亮。', population: '919 万', area: '22,135 km²', temperature: '27°', air: '良 · 55', score: 64, trend: '+8%' },
  { name: '廊坊', en: 'LANGFANG', color: 'blue', people: '4.9K', topic: '京津社区连接计划', statement: '两座大城之间，也能生长清晰而自在的生活。', population: '548 万', area: '6,429 km²', temperature: '27°', air: '良 · 51', score: 63, trend: '+9%' },
  { name: '鄂尔多斯', en: 'ORDOS', color: 'lime', people: '4.8K', topic: '草原城市公共艺术', statement: '草原、能源与现代城市，共同定义辽阔的新日常。', population: '221 万', area: '86,752 km²', temperature: '20°', air: '优 · 19', score: 68, trend: '+13%' },
  { name: '遵义', en: 'ZUNYI', color: 'rose', people: '5.0K', topic: '山城街巷生活节', statement: '群山环抱的城市，把厚重历史融入热烈日常。', population: '660 万', area: '30,780 km²', temperature: '23°', air: '优 · 23', score: 67, trend: '+12%' },
  { name: '桂林', en: 'GUILIN', color: 'peach', people: '5.5K', topic: '山水社区共生计划', statement: '山水不仅是风景，也是城市生活最自然的背景。', population: '495 万', area: '27,809 km²', temperature: '27°', air: '优 · 20', score: 71, trend: '+14%' },
];

const cities: City[] = chinaCities.map((city) => ({ ...city, country: '中国' as const }));

const countries: Country[] = ['中国'];

const countryCodes: Record<Country, string> = { 中国: 'CN' };
const CHINA_CITY_TOTAL = 694;
const CITY_CATALOG_VERSION = '2026-08-24-694';

const normalizeCityName = (value: string) => value.trim().toLocaleLowerCase().replace(/[\s'’·().-]/g, '').replace(/市$/, '');

function makeCatalogCity(entry: CityCatalogEntry, country: Country, index: number): City {
  const seed = [...`${country}${entry.name}${entry.region}`].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const colors = ['violet', 'lime', 'peach', 'blue', 'yellow', 'rose'];
  return {
    country,
    region: entry.region,
    name: entry.name,
    en: entry.en,
    color: colors[(seed + index) % colors.length],
    people: `${(1.2 + (seed % 178) / 10).toFixed(1)}K`,
    topic: `${entry.name}城市生活观察`,
    statement: `在${entry.name}，发现正在发生的事，也遇见认真生活的人。`,
    population: '数据接入中',
    area: '数据接入中',
    temperature: '--°',
    air: '数据接入中',
    score: 60 + (seed % 37),
    trend: `+${5 + (seed % 16)}%`,
  };
}

function mergeCatalog(catalog: CityCatalog): City[] {
  return countries.flatMap((country) => {
    const featured = cities.filter((city) => city.country === country).map((city) => ({ ...city, region: catalog[country].find((entry) => normalizeCityName(entry.name) === normalizeCityName(city.name))?.region }));
    const featuredKeys = new Set(featured.flatMap((city) => [city.name, city.en].map(normalizeCityName)));
    const additions = catalog[country]
      .filter((entry) => ![entry.name, entry.en].some((value) => featuredKeys.has(normalizeCityName(value))))
      .map((entry, index) => makeCatalogCity(entry, country, index));
    return [...featured, ...additions];
  });
}

function useCompleteCityCatalog() {
  const [allCities, setAllCities] = useState<City[]>(cities);
  const [catalogReady, setCatalogReady] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/city-catalog.json?v=${CITY_CATALOG_VERSION}`, { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error('城市目录加载失败');
        return response.json() as Promise<CityCatalog>;
      }),
      fetch('/api/prototype/cities').then((response) => response.ok ? response.json() as Promise<{ ok: boolean; data?: { connected: boolean; cities: Array<{ name: string; regionCode: string; memberCount: number; postCount: number; activityCount: number; organizationCount: number }> } }> : null).catch(() => null),
    ]).then(([catalog, statsPayload]) => {
        if (!active) return;
        const cityStats = new Map((statsPayload?.data?.connected ? statsPayload.data.cities : []).map((item) => [`${item.name}:${item.regionCode}`, item]));
        setAllCities(mergeCatalog(catalog).map((city) => {
          const stats = cityStats.get(`${city.name}:${city.region}`);
          return stats ? { ...city, people: stats.memberCount.toLocaleString('zh-CN'), stats: { members: stats.memberCount, posts: stats.postCount, events: stats.activityCount, orgs: stats.organizationCount } } : city;
        }));
        setCatalogReady(true);
      })
      .catch(() => {
        if (active) setCatalogReady(true);
      });
    return () => { active = false; };
  }, [CITY_CATALOG_VERSION]);

  return { allCities, catalogReady };
}

const baseFeeds: FeedItemData[] = [
  { type: '动态', content: '我把周末走过的 12 条小路整理成了一张地图。避开人潮，从菜市场、旧书店到河边长椅，欢迎大家继续补充自己的私藏地点。', author: '林野', meta: '18 分钟前', avatar: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?auto=format&fit=crop&w=96&h=96&q=85', stats: { likes: 128, replies: 34, shares: 16 } },
  { type: '动态', content: '今天沿着河岸走到旧码头，雨后的树影和慢下来的行人，让熟悉的城市突然有了新的层次。', author: '阿乔', meta: '42 分钟前', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=96&h=96&q=85', stats: { likes: 96, replies: 21, shares: 9 }, media: { kind: 'image', src: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1400&q=85', alt: '河岸与城市街区的俯瞰景色' } },
  { type: '动态', content: '把傍晚公园里的风、树叶和孩子们的笑声录了下来。城市最松弛的时刻，往往没有宏大的故事。', author: '许川', meta: '1 小时前', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=96&h=96&q=85', stats: { likes: 82, replies: 18, shares: 12 }, media: { kind: 'video', src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', poster: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=85', alt: '傍晚公园中的自然影像' } },
  { type: '动态', content: '如果周末在社区里增加一项长期共享服务，你最希望先从哪一项开始？欢迎选出你的答案，也可以在回复里补充建议。', author: '社区共创组', meta: '2 小时前', avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=96&h=96&q=85', stats: { likes: 74, replies: 46, shares: 8 }, poll: { question: '你最期待的社区共享服务是？', options: [{ label: '共享工具间', votes: 86 }, { label: '周末公共课堂', votes: 64 }, { label: '社区儿童照护', votes: 52 }] } },
  { type: '活动', title: '没有目的地的城市漫步', category: '城市漫步', content: '周六见：一起完成一场「没有目的地」的城市漫步。下午三点从老邮局门口出发，不赶路、不打卡，沿途由每个人轮流决定下一个方向。', author: '慢行小组', meta: '8 月 29 日 15:00', location: '老邮局门口', capacity: 36, cover: 'https://images.unsplash.com/photo-1533929736458-ca588d08c8be?auto=format&fit=crop&w=1200&q=85', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=96&h=96&q=85', stats: { likes: 108, replies: 29, shares: 23 } },
  { type: '机构', title: '方寸工坊', category: '社区共创空间', content: '一间向所有人开放的社区工作室。我们提供工具、场地和每周两次的免费修理时段，也在寻找愿意分享手艺的新朋友。', author: '方寸工坊', meta: '每周二、周六开放', location: '老城创意街区 18 号', members: 286, cover: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&q=85', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=96&h=96&q=85', stats: { likes: 67, replies: 14, shares: 11 } },
  { type: '活动', title: '城市植物观察课', category: '自然教育', content: '认识身边那些叫不出名字的树。由自然教育老师带队，适合所有年龄，请带水杯，现场会提供观察手册。', author: '城屿自然社', meta: '9 月 2 日 09:30', location: '城市植物园东门', capacity: 24, cover: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=85', avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=96&h=96&q=85', stats: { likes: 92, replies: 20, shares: 18 } },
  { type: '活动', title: '街区露天电影夜', category: '邻里文化', content: '带上坐垫和喜欢的零食，在街角广场看一部关于城市与人的纪录片。映后会有二十分钟自由交流。', author: '街角放映组', meta: '9 月 6 日 19:30', location: '青年广场', capacity: 80, cover: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=85', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=96&h=96&q=85', stats: { likes: 118, replies: 36, shares: 31 } },
  { type: '机构', title: '城屿自然社', category: '环境与自然教育', content: '从一棵树、一条河开始认识城市生态，持续组织公众观察、自然笔记与青少年环境课堂。', author: '城屿自然社', meta: '成立 4 年', location: '河岸自然教育中心', members: 412, cover: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=85', avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=96&h=96&q=85', stats: { likes: 92, replies: 20, shares: 18 } },
  { type: '机构', title: '城市慢行小组', category: '公共空间与步行', content: '记录适合步行的街道，也邀请居民共同测试城市里的无障碍路径、夜间照明和公共休息点。', author: '城市慢行小组', meta: '成立 2 年', location: '社区公共客厅', members: 198, cover: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=85', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=96&h=96&q=85', stats: { likes: 108, replies: 29, shares: 23 } },
];

const cityContributors: CommunityMemberData[] = [
  { name: '林野', role: '城市观察者', avatar: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?auto=format&fit=crop&w=96&h=96&q=85', contribution: 2860, posts: 24, followers: 126 },
  { name: '阿乔', role: '城市影像记录者', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=96&h=96&q=85', contribution: 2415, posts: 19, followers: 328 },
  { name: '许川', role: '声音采集者', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=96&h=96&q=85', contribution: 2180, posts: 16, followers: 214 },
  { name: '周予安', role: '空间策划师', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=96&h=96&q=85', contribution: 1968, posts: 15, followers: 196 },
  { name: '叶知秋', role: '自然教育发起人', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=96&h=96&q=85', contribution: 1836, posts: 14, followers: 178 },
  { name: '沈一白', role: '社区营造师', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=96&h=96&q=85', contribution: 1724, posts: 13, followers: 162 },
  { name: '陈见山', role: '独立开发者', avatar: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=96&h=96&q=85', contribution: 1590, posts: 12, followers: 151 },
  { name: '唐小满', role: '社区主理人', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=96&h=96&q=85', contribution: 1462, posts: 11, followers: 143 },
  { name: '顾南枝', role: '公共艺术创作者', avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=96&h=96&q=85', contribution: 1328, posts: 10, followers: 137 },
  { name: '陆嘉禾', role: '城市研究者', avatar: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?auto=format&fit=crop&w=96&h=96&q=85', contribution: 1216, posts: 9, followers: 119 },
];

const profileJoinedCities = [
  ['上海', 24], ['杭州', 12], ['成都', 8], ['北京', 9], ['深圳', 15], ['广州', 7],
  ['南京', 6], ['苏州', 11], ['武汉', 8], ['重庆', 5], ['西安', 5], ['厦门', 4],
  ['青岛', 6], ['长沙', 11], ['郑州', 3], ['天津', 4], ['昆明', 4], ['宁波', 5],
  ['福州', 3], ['无锡', 6], ['合肥', 5], ['济南', 4], ['大连', 3], ['珠海', 7],
] as const;

const occupationOptions = ['城市观察者', '内容创作者', '社区共建顾问', '独立开发者', '产品设计师', 'AI 创业者', '品牌顾问', '摄影师', '研究者'] as const;

const profileSeriesLinks: { label: `我的${PersonalSeriesKind}`; kind: PersonalSeriesKind; view: View; count: string; description: string }[] = [
  { label: '我的动态', kind: '动态', view: 'myDynamics', count: '24', description: '城市记录与观点' },
  { label: '我的收藏', kind: '收藏', view: 'myCollections', count: '18', description: '稍后继续阅读' },
  { label: '我的申请', kind: '申请', view: 'myApplications', count: '3', description: '机构申请进度' },
];

const personalSeriesContent: Record<PersonalSeriesKind, { title: string; meta: string; copy: string; status: string }[]> = {
  动态: [
    { title: '周末城市小路地图', meta: '18 分钟前 · 上海', copy: '把周末走过的 12 条小路整理成一张可共同补充的地图。', status: '128 喜欢' },
    { title: '运河边的公共空间观察', meta: '3 天前 · 杭州', copy: '真正让公共空间有生命力的，还是那些愿意停下来的人。', status: '96 喜欢' },
  ],
  收藏: [
    { title: '如何选择真正适合自己的 AI 工具？', meta: '知识 · 2 天前收藏', copy: '从任务、隐私、成本和协作方式出发，建立清晰的工具选择标准。', status: '已收藏' },
    { title: '城市慢行与社区商业', meta: '动态 · 上海', copy: '讨论步行环境如何重新连接街区里的小店和居民。', status: '已收藏' },
  ],
  申请: [
    { title: '加入方寸工坊', meta: '机构申请 · OPC-0821-018', copy: '欢迎加入社区共创空间，下一次成员见面将在周六下午举行。', status: '已通过' },
  ],
};

function memberAsFeed(member: CommunityMemberData, cityName: string): FeedItemData {
  return { authorId: member.id, type: '动态', content: `${member.role}，持续参与${cityName}城市社区共建与内容分享。`, author: member.name, meta: '最近活跃', avatar: member.avatar, stats: { likes: member.contribution, replies: member.posts, shares: member.followers } };
}

const knowledgeCategories: KnowledgeCategory[] = ['全部', 'AI 入门', '大模型', '智能体', 'AI 工具'];

const knowledge: { no: string; title: string; desc: string; tag: Exclude<KnowledgeCategory, '全部'>; time: string }[] = [
  { no: '01', title: '人工智能到底在做什么？', desc: '从识别、预测到生成，用日常语言理解人工智能最基本的工作方式。', tag: 'AI 入门', time: '8 分钟' },
  { no: '02', title: '生成式 AI 和传统 AI 有什么不同？', desc: '理解“判断已有答案”和“创造新内容”背后不同的技术逻辑。', tag: 'AI 入门', time: '6 分钟' },
  { no: '03', title: '大模型为什么能够理解语言？', desc: '从训练数据、参数到概率预测，拆解大语言模型的核心原理。', tag: '大模型', time: '10 分钟' },
  { no: '04', title: '上下文窗口，决定了 AI 能记住多少', desc: '读懂上下文长度、记忆与成本之间的关系，避免常见使用误区。', tag: '大模型', time: '9 分钟' },
  { no: '05', title: '智能体如何规划并完成一项任务？', desc: '当模型学会调用工具、拆解步骤和检查结果，工作方式会怎样改变。', tag: '智能体', time: '12 分钟' },
  { no: '06', title: '多智能体协作，不只是让 AI 开会', desc: '了解角色分工、共享上下文与结果验证如何组成可靠的协作系统。', tag: '智能体', time: '11 分钟' },
  { no: '07', title: '如何选择真正适合自己的 AI 工具？', desc: '从任务、隐私、成本和协作方式出发，建立清晰的工具选择标准。', tag: 'AI 工具', time: '7 分钟' },
  { no: '08', title: '搭建你的第一个个人 AI 工作流', desc: '把检索、整理、写作和复盘连接起来，让工具成为稳定的工作系统。', tag: 'AI 工具', time: '9 分钟' },
];

type KnowledgeItem = (typeof knowledge)[number];

const insightCategories: InsightCategory[] = ['全部', '模型发布', '产品工具', '行业动向', '研究前沿'];

const dailyInsights: { time: string; category: Exclude<InsightCategory, '全部'>; title: string; summary: string; source: string; signal: '重要' | '关注' | '速览' }[] = [
  { time: '08:30', category: '模型发布', title: '多模态模型开始走向更长时程的任务执行', summary: '新一轮模型更新把重点从单次回答转向持续观察、规划与修正。对一人公司而言，真正值得关注的是任务完成率，而不只是榜单分数。', source: '模型动态', signal: '重要' },
  { time: '09:45', category: '产品工具', title: 'AI 工作台正在整合搜索、文档与自动化流程', summary: '越来越多产品把分散的 AI 功能收进同一个工作台，减少在工具之间来回切换的成本。团队应优先评估数据能否顺畅流动。', source: '产品观察', signal: '关注' },
  { time: '11:20', category: '行业动向', title: '企业采用 AI 的指标从使用率转向可量化回报', summary: '企业采购开始更关心节省了多少时间、提升了多少转化，以及风险是否可控。提供 AI 服务时，应把价值证明提前放进交付方案。', source: '产业简报', signal: '重要' },
  { time: '13:10', category: '研究前沿', title: '智能体评测更强调真实环境中的可靠性', summary: '研究者正在用更长链路、更复杂工具和动态网页检验智能体，单一成功案例已不足以说明稳定性。设计工作流时要保留检查点和人工接管。', source: '研究速递', signal: '关注' },
  { time: '15:40', category: '产品工具', title: '轻量级本地模型扩展个人知识库使用场景', summary: '本地推理在隐私、离线与成本方面继续改善，适合处理内部资料初筛、结构化抽取等任务，但复杂判断仍需更强模型复核。', source: '工具雷达', signal: '速览' },
  { time: '17:30', category: '行业动向', title: 'AI 原生服务开始出现按结果计费的新模式', summary: '部分服务商不再按账号或调用量收费，而是围绕线索、报告或已完成任务定价。这会重新定义产品边界，也要求更清楚地约定结果标准。', source: '商业观察', signal: '速览' },
];

const helpQuestions = [
  { category: '账号', question: '如何登录游民？', answer: '使用中国大陆手机号获取验证码并完成登录。登录后即可加入城市、发布动态和参与活动。' },
  { category: '城市', question: '如何加入或退出一个城市社区？', answer: '进入城市主页后点击“加入社区”。已加入的城市会出现在个人主页；退出入口将在该城市的成员设置中提供。' },
  { category: '发布', question: '动态支持哪些内容形式？', answer: '可发布文字、图片、视频、话题和投票。请确保内容与城市生活、OPC 创业或社区共建相关。' },
  { category: '安全', question: '如何举报不合适的内容？', answer: '在动态、成员或机构详情页中打开更多操作，选择举报原因。平台会保护举报人的个人信息。' },
] as const;

const informationPages: Record<InformationView, { eyebrow: string; title: string; description: string; sections: { title: string; copy: string }[] }> = {
  about: { eyebrow: 'ABOUT YOUMIN', title: '关于我们', description: '连接城市里的 OPC 创业者，让一个人的公司也拥有可信赖的同伴与支持网络。', sections: [{ title: '我们是谁', copy: '游民是以城市为连接方式的一人公司创业者社区，关注真实交流、长期成长与可持续经营。' }, { title: '我们提供什么', copy: '平台汇集城市社区、AI 知识与创业者活动，帮助成员分享经验并建立真实连接。' }, { title: '我们的原则', copy: '尊重独立判断，鼓励真实分享，保护成员隐私，并持续建设开放、友善、有行动力的社区。' }] },
  terms: { eyebrow: 'TERMS OF SERVICE · V2026.08', title: '服务条款', description: '使用游民即表示你同意遵守社区规则、尊重他人权利，并对自己发布和提交的信息负责。', sections: [{ title: '账号与使用', copy: '你应提供真实、合法且必要的账号资料，妥善保管登录凭证，不得冒用他人身份、绕过权限或以自动化方式破坏平台正常运行。' }, { title: '内容与许可', copy: '你保留原创内容的权利，同时授权平台在提供、展示、审核和改进服务所必需的范围内处理内容。侵权、违法或危害社区安全的内容可能被限制或移除。' }, { title: '服务变更与责任', copy: '我们会尽力保障服务连续性，但可能因维护、安全、监管或不可抗力调整功能。平台不对用户间交易、第三方服务或基于社区信息作出的经营决策提供结果承诺。' }] },
  privacy: { eyebrow: 'PRIVACY POLICY · V2026.08', title: '隐私政策', description: '我们重视你的个人信息与使用数据，并以最小必要、公开透明和安全可控为基本处理原则。', sections: [{ title: '收集范围与目的', copy: '注册和安全验证会处理手机号；资料、发布、互动、申请和工单功能会处理你主动提交的内容；安全与审计会记录必要的设备、时间和操作信息。相关信息仅用于提供功能、保障安全、处理申请和履行法定义务。' }, { title: '共享、保存与权利', copy: '未经授权不会出售个人信息。仅在取得同意、使用受托服务商或履行法定义务时按最小范围共享。你可以在个人中心访问、更正和删除公开资料，并可通过帮助中心申请导出、注销或提出隐私问题。' }, { title: '安全与未成年人', copy: '账号敏感信息采用加密、哈希、权限隔离和审计措施保护，并按业务与法定义务所需期限保存。未成年人应在监护人同意和指导下使用；发现风险时可通过帮助中心联系我们。' }] },
  risk: { eyebrow: 'RISK NOTICE · V2026.08', title: '风险提示', description: '平台内容用于社区交流与信息参考，请结合自身情况独立判断并审慎决策。', sections: [{ title: '内容与政策边界', copy: '社区观点、AI 生成内容、案例和平台解读不构成投资、法律、财税、医疗或申报意见。政策可能修订或存在地方执行差异，请以发布机关原文和主管部门答复为准。' }, { title: '经营与合作判断', copy: '创业项目、机构申请、活动和合作机会具有不确定性。请独立核验主体资质、合同、费用、知识产权和交付条件，不要仅依据点赞、成员数或平台展示作出决定。' }, { title: '第三方与安全', copy: '外部链接、工具和服务由第三方独立运营。使用前请阅读其条款和隐私政策；不要在公开内容中泄露身份证件、验证码、密钥、客户数据或其他敏感信息。' }] },
  cooperation: { eyebrow: 'BUSINESS COOPERATION', title: '商务合作', description: '欢迎城市机构、创业服务伙伴和品牌方，与游民共同服务一人公司创业者。', sections: [{ title: '城市共建', copy: '联合发起城市活动、创业者连接计划、公共空间项目与本地服务网络。' }, { title: '内容与品牌', copy: '围绕 AI、OPC 经营与城市创新开展专题内容、行业研究和品牌共创。' }, { title: '服务合作', copy: '为社区成员提供专业工具、政策服务与可信赖的商业解决方案。合作意向可通过帮助中心提交。' }] },
};

const replyAuthors = ['周予安', '叶知秋', '陈见山', '林野', '唐小满', '许川', '顾南枝', '陆嘉禾', '阿乔', '沈一白'];
const replyCopies = [
  '这条路线很适合周末慢慢走，我补充了老邮局旁边的树荫广场。',
  '河岸那段傍晚光线很好，也可以增加一处公共饮水点。',
  '雨后的城市会显出平时容易忽略的层次，照片里的光线很有现场感。',
  '旧码头附近还有一段保存完整的石阶，下次可以一起走过去看看。',
  '喜欢这种不急着给城市下结论、只是认真观察的记录方式。',
  '慢下来之后，熟悉的街道确实会变得不一样。',
  '这张照片让我想起去年秋天沿河散步时遇到的薄雾。',
  '如果整理成一条城市漫步路线，我很愿意参与补充地点。',
  '雨后树影的颜色很特别，城市也像暂时安静了下来。',
  '感谢分享，已经把旧码头加入这个周末的散步计划。',
];

function createFeedReplies(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    author: replyAuthors[index % replyAuthors.length],
    time: index === 0 ? '刚刚' : `${index * 3 + 2} 分钟前`,
    copy: replyCopies[(index * 3) % replyCopies.length],
  }));
}

export default function Home() {
  return <PrototypeHome />;
}

export function PrototypeHome() {
  const router = useRouter();
  const [view, setView] = useState<View>('community');
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [feedFilter, setFeedFilter] = useState<CommunitySection>('动态');
  const [publishedFeeds, setPublishedFeeds] = useState<Record<string, FeedItemData[]>>({});
  const [joined, setJoined] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FeedItemData | null>(null);
  const [followedMembers, setFollowedMembers] = useState<string[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeItem | null>(null);
  const [runtimeCity, setRuntimeCity] = useState<{ name: string; cityId: string; feeds: FeedItemData[]; members: CommunityMemberData[]; stats: { members: number; posts: number; events: number; orgs: number } } | null>(null);
  const [cityLoading, setCityLoading] = useState(false);
  const { allCities, catalogReady } = useCompleteCityCatalog();

  const writeUrl = (nextView: View, city: City | null = null, section: CommunitySection = '动态') => {
    const query = new URLSearchParams();
    if (city) {
      query.set('city', city.name);
      if (city.region) query.set('region', city.region);
      if (section !== '动态') query.set('section', section);
    } else if (nextView !== 'community') query.set('view', nextView);
    const suffix = query.size ? `?${query}` : '';
    window.history.pushState({}, '', `${window.location.pathname}${suffix}`);
  };

  useEffect(() => {
    if (!catalogReady) return;
    const restore = () => {
      const query = new URLSearchParams(window.location.search);
      const cityName = query.get('city');
      const region = query.get('region');
      const restoredCity = cityName ? allCities.find((city) => city.name === cityName && (!region || city.region === region)) ?? null : null;
      const section = query.get('section');
      const restoredSection = (['动态', '活动', '成员', '机构', '政策'] as const).find((item) => item === section) ?? '动态';
      const requestedView = query.get('view');
      const restoredView = (['community', 'knowledge', 'insights', 'help', 'about', 'terms', 'privacy', 'risk', 'cooperation', 'profile', 'myActivities', 'myDynamics', 'myCollections', 'myApplications'] as View[]).includes(requestedView as View) ? requestedView as View : 'community';
      setSelectedCity(restoredCity);
      setFeedFilter(restoredSection);
      setView(restoredCity ? 'community' : restoredView);
      if (restoredCity) setCityLoading(true);
    };
    const timer = window.setTimeout(restore, 0);
    window.addEventListener('popstate', restore);
    return () => { window.clearTimeout(timer); window.removeEventListener('popstate', restore); };
  }, [allCities, catalogReady]);

  useEffect(() => {
    if (!selectedCity) return;
    const controller = new AbortController();
    const cityQuery = new URLSearchParams({ name: selectedCity.name });
    if (selectedCity.region) cityQuery.set('region', selectedCity.region);
    fetch(`/api/prototype/city?${cityQuery}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { ok: boolean; data?: PrototypeCityPayload };
        if (!payload.ok || !payload.data?.connected || !payload.data.city) return;
        const posts: FeedItemData[] = (payload.data.posts ?? []).map((post) => ({
          id: post.id,
          authorId: post.authorId,
          type: '动态',
          content: post.content,
          author: post.author,
          meta: post.publishedAt ? new Date(post.publishedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '刚刚',
          avatar: post.avatarUrl ?? defaultAvatar,
          stats: post.stats,
          viewer: post.viewer,
          topic: post.topic,
          media: post.media ? { kind: post.media.kind === 'video' ? 'video' : 'image', src: post.media.src, alt: `${post.author}发布的媒体` } : undefined,
          poll: post.poll,
        }));
        const activityCover = baseFeeds.find((feed) => feed.type === '活动')?.cover;
        const activityFeeds: FeedItemData[] = (payload.data.activities ?? []).map((activity) => ({
          id: activity.id,
          authorId: activity.organizerId,
          type: '活动',
          title: activity.title,
          category: '城市活动',
          content: activity.details || activity.summary,
          author: activity.organizer,
          meta: new Date(activity.startsAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          location: activity.location,
          capacity: activity.capacity,
          members: activity.registeredCount,
          registered: activity.registered,
          cover: activityCover,
          avatar: activity.avatarUrl ?? defaultAvatar,
          stats: { likes: 0, replies: 0, shares: 0 },
        }));
        const organizationCovers = baseFeeds.filter((feed) => feed.type === '机构').map((feed) => feed.cover);
        const organizationFeeds: FeedItemData[] = (payload.data.organizations ?? []).map((organization, index) => ({
          id: organization.id,
          type: '机构',
          title: organization.name,
          category: organization.category,
          content: organization.summary,
          author: organization.name,
          meta: '开放申请',
          location: organization.location,
          members: organization.memberCount,
          applied: organization.applied,
          cover: organizationCovers[index % Math.max(organizationCovers.length, 1)],
          avatar: defaultAvatar,
          stats: { likes: 0, replies: 0, shares: 0 },
        }));
        const members: CommunityMemberData[] = (payload.data.members ?? []).map((member) => ({ id: member.id, name: member.name, role: member.role, avatar: member.avatarUrl ?? defaultAvatar, contribution: member.contribution, posts: member.postCount, followers: member.followerCount, following: member.following }));
        setRuntimeCity({ name: selectedCity.name, cityId: payload.data.city.id, feeds: [...posts, ...activityFeeds, ...organizationFeeds], members, stats: { members: payload.data.city.memberCount, posts: payload.data.city.postCount, events: payload.data.city.activityCount, orgs: payload.data.city.organizationCount } });
        setJoined(payload.data.city.joined);
        setFollowedMembers(members.filter((member) => member.following).map((member) => member.name));
      })
      .catch((error) => { if (!(error instanceof DOMException && error.name === 'AbortError')) console.error(error); })
      .finally(() => { if (!controller.signal.aborted) setCityLoading(false); });
    return () => controller.abort();
  }, [selectedCity]);

  const feeds = useMemo(() => {
    const cityFeeds = selectedCity ? publishedFeeds[selectedCity.name] ?? [] : [];
    const targetType: FeedType | null = feedFilter === '动态' ? '动态' : feedFilter === '活动' ? '活动' : feedFilter === '机构' ? '机构' : null;
    const sourceFeeds = runtimeCity && runtimeCity.name === selectedCity?.name ? runtimeCity.feeds : [...cityFeeds, ...baseFeeds];
    return targetType ? sourceFeeds.filter((feed) => feed.type === targetType) : [];
  }, [feedFilter, publishedFeeds, runtimeCity, selectedCity]);

  const navigate = (next: View) => {
    setView(next);
    if (next === 'community') { setSelectedCity(null); setRuntimeCity(null); }
    writeUrl(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCity = (city: City) => {
    setView('community');
    setSelectedCity(city);
    setCityLoading(true);
    setFeedFilter('动态');
    writeUrl('community', city);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changeFeedFilter = (next: CommunitySection) => {
    setFeedFilter(next);
    if (selectedCity) writeUrl('community', selectedCity, next);
  };

  const publishFeed = (feed: FeedItemData) => {
    if (!selectedCity) return;
    setRuntimeCity((current) => current?.name === selectedCity.name ? { ...current, feeds: [feed, ...current.feeds] } : current);
    setPublishedFeeds((current) => ({
      ...current,
      [selectedCity.name]: [feed, ...(current[selectedCity.name] ?? [])],
    }));
    setFeedFilter('动态');
  };

  const toggleMemberFollow = async (name: string, memberId?: string) => {
    if (memberId) {
      const result = await toggleFollow(memberId);
      if (!result.ok) { handleActionError(result); return; }
      const active = Boolean(result.data?.active);
      setFollowedMembers((current) => active ? [...new Set([...current, name])] : current.filter((item) => item !== name));
      return;
    }
    setFollowedMembers((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  };

  return (
    <main>
      <Header view={view} navigate={navigate} />
      {searching && <SearchPanel cities={allCities} catalogReady={catalogReady} onClose={() => setSearching(false)} onPick={(city) => { openCity(city); setSearching(false); }} />}
      {view === 'community' && !selectedCity && <CommunityHome cities={allCities} catalogReady={catalogReady} openCity={openCity} openSearch={() => setSearching(true)} />}
      {view === 'community' && selectedCity && (
        <CityCommunity key={selectedCity.name} city={runtimeCity?.name === selectedCity.name ? { ...selectedCity, stats: runtimeCity.stats } : selectedCity} cityId={runtimeCity?.name === selectedCity.name ? runtimeCity.cityId : undefined} cityLoading={cityLoading} feeds={feeds} members={runtimeCity?.name === selectedCity.name ? runtimeCity.members : cityContributors} filter={feedFilter} setFilter={changeFeedFilter} joined={joined} setJoined={setJoined} onPublish={publishFeed} followedMembers={followedMembers} onToggleFollow={toggleMemberFollow} onOpenAuthor={(member) => { if (member.authorId) { router.push(`/members/${member.authorId}`); return; } setSelectedMember(member); setView('member'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
      )}
      {view === 'knowledge' && <Knowledge onOpenArticle={(article) => { setSelectedArticle(article); setView('article'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
      {view === 'insights' && <InsightDaily />}
      {view === 'help' && <HelpCenter />}
      {view === 'profile' && <PersonalProfile navigate={navigate} onOpenCity={(name) => { const city = allCities.find((item) => item.name === name); if (city) openCity(city); }} />}
      {view === 'myActivities' && <MyActivities />}
      {view === 'myDynamics' && <PersonalSeriesPage kind="动态" onBack={() => navigate('profile')} />}
      {view === 'myCollections' && <PersonalSeriesPage kind="收藏" onBack={() => navigate('profile')} />}
      {view === 'myApplications' && <PersonalSeriesPage kind="申请" onBack={() => navigate('profile')} />}
      {view === 'member' && selectedMember && <MemberProfile member={selectedMember} followed={followedMembers.includes(selectedMember.author)} onToggleFollow={() => toggleMemberFollow(selectedMember.author, selectedMember.authorId)} onBack={() => { setView('community'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
      {view === 'article' && selectedArticle && <KnowledgeArticle article={selectedArticle} onBack={() => navigate('knowledge')} />}
      {(['about', 'terms', 'privacy', 'risk', 'cooperation'] as InformationView[]).includes(view as InformationView) && <InformationPage page={informationPages[view as InformationView]} onBack={() => navigate('community')} />}
      <SiteFooter navigate={navigate} />
    </main>
  );
}

function SiteFooter({ navigate }: { navigate: (view: View) => void }) {
  const footerLinks: { label: string; view: InformationView }[] = [{ label: '关于我们', view: 'about' }, { label: '服务条款', view: 'terms' }, { label: '隐私政策', view: 'privacy' }, { label: '风险提示', view: 'risk' }, { label: '商务合作', view: 'cooperation' }];
  const record = process.env.NEXT_PUBLIC_ICP_RECORD?.trim();
  return (
    <footer className="site-footer">
      <div className="site-footer-row"><button className="site-footer-home" type="button" onClick={() => navigate('community')}>游民</button><span>Copyright © 2026</span><div className="site-footer-links" aria-label="网站信息">{footerLinks.map((item) => <button type="button" key={item.view} onClick={() => navigate(item.view)}>{item.label}</button>)}</div>{record ? <a className="site-footer-record" href={process.env.NEXT_PUBLIC_ICP_LINK || 'https://beian.miit.gov.cn/'} target="_blank" rel="noreferrer">{record}</a> : <span className="site-footer-record">备案信息由部署环境配置</span>}</div>
    </footer>
  );
}

function InformationPage({ page, onBack }: { page: (typeof informationPages)[InformationView]; onBack: () => void }) {
  return (
    <article className="information-page"><header><button type="button" onClick={onBack}>← 返回首页</button><small>{page.eyebrow}</small><h1>{page.title}</h1><p>{page.description}</p></header><div className="information-page-body">{page.sections.map((section, index) => <section key={section.title}><span>{String(index + 1).padStart(2, '0')}</span><div><h2>{section.title}</h2><p>{section.copy}</p></div></section>)}</div></article>
  );
}

function Header({ view, navigate }: { view: View; navigate: (view: View) => void }) {
  const [loginOpen, setLoginOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ phone: string } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedPhone = window.localStorage.getItem('opc-local-user');
      if (savedPhone) setCurrentUser({ phone: savedPhone });
    }, 0);
    fetch('/api/prototype/account').then((response) => response.json()).then((payload: { ok: boolean; data?: PrototypeAccountPayload }) => {
      if (payload.ok && payload.data?.connected) setCurrentUser({ phone: 'server-session' });
    }).catch(() => undefined);
    return () => window.clearTimeout(timer);
  }, []);

  const completeLogin = (phone: string) => {
    window.localStorage.setItem('opc-local-user', phone);
    setCurrentUser({ phone });
    setLoginOpen(false);
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.localStorage.removeItem('opc-local-user');
    setCurrentUser(null);
  };
  const activeNav: View = view === 'member' ? 'community' : view === 'article' ? 'knowledge' : view;

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <button className="brand naked" onClick={() => navigate('community')} aria-label="游民首页">
            <span className="brand-mark" aria-hidden="true"><i /></span>
          </button>
          <nav aria-label="主导航">
            {([['community', '社区'], ['knowledge', '知识'], ['insights', '洞察'], ['help', '帮助']] as [View, string][]).map(([key, label]) => (
              <button className={activeNav === key ? 'active' : ''} onClick={() => navigate(key)} key={key}>{label}</button>
            ))}
          </nav>
          <div className="header-actions">
            {currentUser ? (
              <div className="user-menu">
                <button className="user-avatar" aria-label="打开个人菜单"><img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=96&h=96&q=85" alt="个人头像" /></button>
                <div className="user-menu-panel" aria-label="个人功能">
                  <button onClick={() => navigate('profile')}>个人主页</button>
                  <button className="logout-button" onClick={logout}>退出</button>
                </div>
              </div>
            ) : <button className="login-button" onClick={() => setLoginOpen(true)}>登录</button>}
          </div>
        </div>
      </header>
      {loginOpen ? <LoginPanel onClose={() => setLoginOpen(false)} onLogin={completeLogin} /> : null}
    </>
  );
}

function LoginPanel({ onClose, onLogin }: { onClose: () => void; onLogin: (phone: string) => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^1\d{10}$/.test(phone)) return setError('请输入 11 位手机号码');
    if (code.trim().length < 4) return setError('请输入验证码');
    onLogin(phone);
  };

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="手机验证码登录">
      <button className="search-backdrop" onClick={onClose} aria-label="关闭登录" />
      <div className="login-box">
              <div className="login-head"><div><small>本地登录</small><h2>登录游民</h2></div><button onClick={onClose} aria-label="关闭">×</button></div>
        <form className="login-form" onSubmit={submit}>
          <label><span>手机号码</span><input autoFocus value={phone} onChange={(event) => { setPhone(event.target.value.replace(/\D/g, '').slice(0, 11)); setError(''); }} inputMode="tel" autoComplete="tel" placeholder="请输入手机号码" /></label>
          <label><span>验证码</span><div className="verification-field"><input value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} inputMode="numeric" autoComplete="one-time-code" placeholder="请输入验证码" /><button type="button" onClick={() => setSent(true)}>{sent ? '已发送' : '获取验证码'}</button></div></label>
          <p className={error ? 'login-message error' : 'login-message'}>{error || (sent ? '演示环境：输入任意 4—6 位验证码即可登录' : '暂时使用本地登录，不会发送真实短信')}</p>
          <button className="login-submit" type="submit">登录 <span aria-hidden="true">→</span></button>
        </form>
      </div>
    </div>
  );
}

function SearchPanel({ cities: searchableCities, catalogReady, onClose, onPick }: { cities: City[]; catalogReady: boolean; onClose: () => void; onPick: (city: City) => void }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const keyword = normalizeCityName(deferredQuery);
  const matches = useMemo(() => keyword
    ? searchableCities.filter((city) => [city.name, city.en].some((name) => normalizeCityName(name).includes(keyword)))
    : [], [keyword, searchableCities]);
  const displayedMatches = matches.slice(0, 80);
  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="搜索城市">
      <button className="search-backdrop" onClick={onClose} aria-label="关闭搜索" />
      <div className="search-box">
        <div className="search-input-row"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入城市名称…" /><button className="search-close" onClick={onClose} aria-label="关闭搜索"><i aria-hidden="true" /></button></div>
        <div className="search-results">
          {displayedMatches.map((city) => <button key={`${city.country}-${city.name}-${city.en}`} onClick={() => onPick(city)}><span>{city.name}</span><small>{city.en} · {city.people} 位入驻用户</small></button>)}
          {!keyword && <p>{catalogReady ? '输入城市名称开始搜索' : '正在加载完整城市目录…'}</p>}
          {keyword && matches.length === 0 && <p>暂时还没有找到这座城市。</p>}
          {matches.length > displayedMatches.length && <p className="search-result-summary">已找到 {matches.length.toLocaleString('zh-CN')} 座城市，请继续输入以缩小范围。</p>}
        </div>
      </div>
    </div>
  );
}

function CommunityHome({ cities: allCities, catalogReady, openCity, openSearch }: { cities: City[]; catalogReady: boolean; openCity: (city: City) => void; openSearch: () => void }) {
  const [visibleCount, setVisibleCount] = useState(24);
  const visibleCities = allCities;
  const displayedCities = visibleCities.slice(0, visibleCount);
  const remainingCities = Math.max(visibleCities.length - visibleCount, 0);

  return (
    <>
      <section className="hero" id="top">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">一人公司创业者的 AI 垂直社区</p>
            <h1 className="hero-title"><span className="hero-title-primary">游民</span><span className="hero-title-secondary">在 OPC 城市寻找志同道合的人</span></h1>
            <p className="hero-text">汇集全国 694 个 OPC 城市，为 OPC 创业者提供交流沟通、城市活动与知识分享服务。</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={openSearch}><span className="button-label">搜索 OPC 城市</span></button>
            </div>
          </div>
          <CityArtwork />
        </div>
      </section>

      <section className="city-section" id="cities">
        <div className="section-heading">
          <div><h2>找到你的城市</h2></div>
          <p className="city-country-summary" title="4 个直辖市、293 个地级市、397 个县级市">
            <strong>{CHINA_CITY_TOTAL} 个城市</strong>
            <small>4 直辖市 · 293 地级市 · 397 县级市</small>
          </p>
        </div>
        <div className="city-grid">
          {displayedCities.map((city) => <CityCard city={city} onClick={() => openCity(city)} key={`${city.country}-${city.name}-${city.en}`} />)}
        </div>
        {!catalogReady ? <p className="city-catalog-status">正在加载中国完整市级城市目录…</p> : null}
        {remainingCities > 0 ? <button className="load-more-cities" onClick={() => setVisibleCount((current) => Math.min(current + 24, visibleCities.length))}><span>查看更多城市</span></button> : null}
      </section>

    </>
  );
}

function CityArtwork() {
  return (
    <div className="hero-art" role="img" aria-label="抽象城市插画">
      <div className="sun" /><div className="cloud cloud-one" /><div className="cloud cloud-two" />
      <div className="tower tower-one"><i /><i /><i /></div><div className="tower tower-two"><i /><i /></div><div className="tower tower-three"><i /><i /><i /><i /></div>
      <div className="tree tree-one" /><div className="tree tree-two" /><div className="ground" />
    </div>
  );
}

function CityCard({ city, onClick }: { city: City; onClick: () => void }) {
  const stats = getCityStats(city);
  return (
    <button className={`city-card ${city.color}`} onClick={onClick}>
      <span className="city-card-head">
        <span><span className="city-name">{city.name}</span><span className="city-en">{city.en}</span></span>
        <span className="city-presence"><i />{stats.online.toLocaleString('zh-CN')} 人在线</span>
      </span>
      <span className="city-meta">{city.people} 位入驻用户</span>
      <span className="city-stats">
        <span><b>{stats.posts.toLocaleString('zh-CN')}</b><small>动态</small></span>
        <span><b>{stats.events}</b><small>活动</small></span>
        <span><b>{stats.orgs}</b><small>机构</small></span>
      </span>
      <span className="city-topic"><small>本周热议</small><b>{city.topic}</b></span>
    </button>
  );
}

function getCityStats(city: City) {
  if (city.stats) return { online: city.stats.members, posts: city.stats.posts, events: city.stats.events, orgs: city.stats.orgs };
  const seed = [...city.en].reduce((total, character) => total + character.charCodeAt(0), city.score * 17);
  return {
    online: 180 + (seed % 1640),
    posts: 460 + (seed % 4260),
    events: 12 + (seed % 78),
    orgs: 8 + (seed % 54),
  };
}

function CityCommunity({ city, cityId, cityLoading, feeds, members, filter, setFilter, joined, setJoined, onPublish, followedMembers, onToggleFollow, onOpenAuthor }: { city: City; cityId?: string; cityLoading: boolean; feeds: FeedItemData[]; members: CommunityMemberData[]; filter: CommunitySection; setFilter: (filter: CommunitySection) => void; joined: boolean; setJoined: (value: boolean) => void; onPublish: (feed: FeedItemData) => void; followedMembers: string[]; onToggleFollow: (name: string, memberId?: string) => void | Promise<void>; onOpenAuthor: (feed: FeedItemData) => void }) {
  const [publishing, setPublishing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<FeedItemData | null>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<FeedItemData | null>(null);
  const [registeredActivities, setRegisteredActivities] = useState<string[]>([]);
  const [organizationApplications, setOrganizationApplications] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [selectedFeed, setSelectedFeed] = useState<FeedItemData | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const cityStats = getCityStats(city);

  const activityKey = (feed: FeedItemData) => `${city.name}-${feed.title ?? feed.content}`;
  const organizationKey = (feed: FeedItemData) => `${city.name}-${feed.title ?? feed.author}`;
  const switchFilter = (next: CommunitySection) => {
    setFilter(next);
    setSelectedActivity(null);
    setSelectedOrganization(null);
    setSelectedFeed(null);
  };
  const confirmMembership = async () => {
    if (!cityId) {
      setJoined(true);
      setJoining(false);
      return;
    }
    const result = await joinCity(cityId);
    const error = handleActionError(result);
    if (error) return setActionMessage(error);
    setJoined(true);
    setJoining(false);
    setActionMessage('已加入社区');
  };
  const toggleActivityRegistration = async (activity: FeedItemData) => {
    const key = activityKey(activity);
    const current = activity.registered || registeredActivities.includes(key);
    if (!activity.id) return setRegisteredActivities((items) => current ? items.filter((item) => item !== key) : [...items, key]);
    const result = current ? await cancelRegistration(activity.id) : await registerActivity(activity.id);
    const error = handleActionError(result);
    if (error) return setActionMessage(error);
    activity.registered = !current;
    setRegisteredActivities((items) => !current ? [...new Set([...items, key])] : items.filter((item) => item !== key));
    setActionMessage(current ? '已取消报名' : '报名成功');
  };
  const applyOrganization = async (organization: FeedItemData) => {
    const key = organizationKey(organization);
    if (!organization.id) return setOrganizationApplications((items) => [...new Set([...items, key])]);
    const result = await applyToOrganization({ organizationId: organization.id });
    const error = handleActionError(result);
    if (error) return setActionMessage(error);
    organization.applied = true;
    setOrganizationApplications((items) => [...new Set([...items, key])]);
    setActionMessage('机构申请已提交');
  };
  return (
    <div className="community-page">
      {publishing ? <PublishPanel cityId={cityId} onClose={() => setPublishing(false)} onPublish={onPublish} /> : null}
      {joining ? <JoinConfirmation city={city} onClose={() => setJoining(false)} onConfirm={confirmMembership} /> : null}
      {previewImage ? <ImagePreview image={previewImage} onClose={() => setPreviewImage(null)} /> : null}
      <section className={`city-banner ${city.color}`}>
        <div className="city-banner-copy"><h1>{city.name}</h1><p>{city.statement}</p></div>
      </section>

      <div className="community-layout">
        <section className="feed-column">
          <div className="feed-toolbar">
            <div className="filter-tabs" role="tablist">
              {(['动态', '活动', '成员', '机构', '政策'] as const).map((item) => <button role="tab" aria-selected={filter === item} className={filter === item ? 'active' : ''} onClick={() => switchFilter(item)} key={item}>{item}</button>)}
            </div>
            <button className="publish-button" onClick={() => setPublishing(true)}>＋ 发布动态</button>
          </div>
          <div className={`feed-list feed-list-${filter}`}>
            {cityLoading && <p className="empty-state" role="status">正在连接真实社区数据…</p>}
            {filter === '活动' && selectedActivity ? <ActivityDetail city={city} activity={selectedActivity} registered={Boolean(selectedActivity.registered || registeredActivities.includes(activityKey(selectedActivity)))} onToggle={() => toggleActivityRegistration(selectedActivity)} onClose={() => setSelectedActivity(null)} /> : null}
            {filter === '活动' && !selectedActivity ? <ActivityDirectory city={city} activities={feeds} registeredActivities={registeredActivities} getKey={activityKey} onSelect={(activity) => { setSelectedActivity(activity); window.scrollTo({ top: 260, behavior: 'smooth' }); }} /> : null}
            {filter === '机构' && selectedOrganization ? <OrganizationDetail city={city} organization={selectedOrganization} applied={Boolean(selectedOrganization.applied || organizationApplications.includes(organizationKey(selectedOrganization)))} onApply={() => applyOrganization(selectedOrganization)} onClose={() => setSelectedOrganization(null)} /> : null}
            {filter === '机构' && !selectedOrganization ? <OrganizationDirectory organizations={feeds} appliedOrganizations={organizationApplications} getKey={organizationKey} onSelect={(organization) => { setSelectedOrganization(organization); window.scrollTo({ top: 260, behavior: 'smooth' }); }} /> : null}
            {filter === '动态' && selectedFeed ? <InlineFeedDetail feed={selectedFeed} onBack={() => setSelectedFeed(null)} onOpenAuthor={() => onOpenAuthor(selectedFeed)} onOpenImage={setPreviewImage} /> : null}
            {filter === '动态' && !selectedFeed ? feeds.map((feed, index) => <FeedCard feed={feed} onOpenDetail={() => setSelectedFeed(feed)} onOpenAuthor={() => onOpenAuthor(feed)} onOpenImage={setPreviewImage} key={`${feed.content}-${index}`} />) : null}
            {filter === '成员' ? <CommunityMemberDirectory city={city} members={members} followedMembers={followedMembers} onToggleFollow={onToggleFollow} onOpenMember={(member) => onOpenAuthor(memberAsFeed(member, city.name))} /> : null}
            {filter === '政策' ? <PolicyDirectory city={city} /> : null}
          </div>
        </section>

        <aside className="city-data">
          <button className={`wide-join ${joined ? 'joined' : ''}`} onClick={async () => { if (!joined) return setJoining(true); if (!cityId) return setJoined(false); const result = await leaveCity(cityId); const error = handleActionError(result); if (error) return setActionMessage(error); setJoined(false); setActionMessage('已退出社区'); }}>{joined ? '✓ 已加入社区' : '加入社区'}</button>
          {actionMessage ? <small role="status">{actionMessage}</small> : null}
          <CityWeather key={city.name} city={city} />
          <div className="metric-grid">
            <div><small>常住人口</small><strong>{city.population}</strong></div><div><small>城市面积</small><strong>{city.area}</strong></div>
            <div><small>空气质量</small><strong>{city.air}</strong></div><div><small>社区成员</small><strong>{city.people}</strong></div>
          </div>
          <ActivityChart posts={cityStats.posts} trend={city.trend} />
          <ContributionRanking members={members} onOpenMember={(member) => onOpenAuthor(memberAsFeed(member, city.name))} />
        </aside>
      </div>
    </div>
  );
}

function ActivityDirectory({ city, activities, registeredActivities, getKey, onSelect }: { city: City; activities: FeedItemData[]; registeredActivities: string[]; getKey: (activity: FeedItemData) => string; onSelect: (activity: FeedItemData) => void }) {
  return (
    <div className="activity-directory" aria-label={`${city.name}活动列表`}>
      {activities.map((activity) => {
        const registered = Boolean(activity.registered || registeredActivities.includes(getKey(activity)));
        return (
          <article className="activity-list-card" key={getKey(activity)}>
            {activity.cover ? <img src={activity.cover} alt="" loading="lazy" /> : null}
            <div className="activity-list-body">
              <div className="directory-meta"><span>{activity.category}</span><b>{activity.meta}</b></div>
              <h3>{activity.title}</h3>
              <p>{activity.content}</p>
              <div className="directory-facts"><span>{activity.location}</span><span>{activity.capacity} 人限额</span><span>{registered ? '已报名' : `${activity.members ?? Math.min(activity.capacity ?? 0, activity.stats.likes % 50)} 人已报名`}</span></div>
              <button type="button" onClick={() => onSelect(activity)}>查看活动详情 <span aria-hidden="true">→</span></button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function OrganizationDirectory({ organizations, appliedOrganizations, getKey, onSelect }: { organizations: FeedItemData[]; appliedOrganizations: string[]; getKey: (organization: FeedItemData) => string; onSelect: (organization: FeedItemData) => void }) {
  return (
    <div className="organization-directory" aria-label="城市机构列表">
      {organizations.map((organization) => {
        const applied = Boolean(organization.applied || appliedOrganizations.includes(getKey(organization)));
        return (
          <article className="organization-list-card" key={getKey(organization)}>
            {organization.cover ? <img className="organization-list-cover" src={organization.cover} alt={`${organization.title ?? organization.author}的空间`} loading="lazy" /> : null}
            <div className="organization-list-body">
            <div className="directory-meta"><span>{organization.category}</span><b>{organization.meta}</b></div>
            <h3>{organization.title ?? organization.author}</h3>
            <p>{organization.content}</p>
            <div className="organization-summary"><span><b>{organization.members}</b> 位成员</span><span>{organization.location}</span></div>
            <button type="button" onClick={() => onSelect(organization)}>{applied ? '查看申请进度' : '查看机构详情'} <span aria-hidden="true">→</span></button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ActivityDetail({ city, activity, registered, onToggle, onClose }: { city: City; activity: FeedItemData; registered: boolean; onToggle: () => void; onClose: () => void }) {
  return (
      <article className="directory-detail-box inline-directory-detail">
        <button className="directory-back" type="button" onClick={onClose}>← 返回活动列表</button>
        <div className="directory-detail-head"><div><small>{activity.category} · {city.name}</small><h2>{activity.title}</h2></div></div>
        {activity.cover ? <img className="directory-detail-cover" src={activity.cover} alt={`${activity.title}活动现场`} /> : null}
        <div className="directory-detail-content">
          <div className="directory-detail-facts"><span><small>时间</small><b>{activity.meta}</b></span><span><small>地点</small><b>{activity.location}</b></span><span><small>人数</small><b>限 {activity.capacity} 人</b></span></div>
          <p>{activity.content}</p>
          <div className="directory-organizer"><span>发起方</span><b>{activity.author}</b></div>
          <button className={registered ? 'directory-primary registered' : 'directory-primary'} type="button" onClick={onToggle}>{registered ? '✓ 已报名 · 点击取消' : '立即报名'} <span aria-hidden="true">→</span></button>
        </div>
      </article>
  );
}

function OrganizationDetail({ city, organization, applied, onApply, onClose }: { city: City; organization: FeedItemData; applied: boolean; onApply: () => void; onClose: () => void }) {
  return (
      <article className="directory-detail-box organization-detail-box inline-directory-detail">
        <button className="directory-back" type="button" onClick={onClose}>← 返回机构列表</button>
        <div className="directory-detail-head"><div><small>{organization.category} · {city.name}</small><h2>{organization.title ?? organization.author}</h2></div></div>
        {organization.cover ? <img className="directory-detail-cover" src={organization.cover} alt={`${organization.title ?? organization.author}的机构空间`} /> : null}
        <div className="organization-detail-hero"><strong>{organization.members}</strong><span>位社区成员正在共同参与</span></div>
        <div className="directory-detail-content">
          <p>{organization.content}</p>
          <div className="directory-detail-facts"><span><small>关注领域</small><b>{organization.category}</b></span><span><small>活动地点</small><b>{organization.location}</b></span><span><small>开放时间</small><b>{organization.meta}</b></span></div>
          <button className={applied ? 'directory-primary registered' : 'directory-primary'} type="button" onClick={onApply} disabled={applied}>{applied ? '✓ 加入申请已提交' : '申请加入机构'} <span aria-hidden="true">→</span></button>
        </div>
      </article>
  );
}

function ContributionRanking({ members, onOpenMember }: { members: CommunityMemberData[]; onOpenMember: (member: CommunityMemberData) => void }) {
  return (
    <section className="data-card contribution-ranking" aria-labelledby="contribution-ranking-title">
      <div className="contribution-ranking-head"><div><h3 id="contribution-ranking-title">城市贡献榜</h3></div><span>本周</span></div>
      <ol>{members.slice(0, 10).map((member, index) => <li key={member.name}><button type="button" onClick={() => onOpenMember(member)}><b>{String(index + 1).padStart(2, '0')}</b><img src={member.avatar} alt="" loading="lazy" /><strong>{member.name}</strong><em>{member.contribution.toLocaleString('zh-CN')}</em></button></li>)}</ol>
    </section>
  );
}

function CommunityMemberDirectory({ city, members, followedMembers, onToggleFollow, onOpenMember }: { city: City; members: CommunityMemberData[]; followedMembers: string[]; onToggleFollow: (name: string, memberId?: string) => void | Promise<void>; onOpenMember: (member: CommunityMemberData) => void }) {
  return (
    <div className="member-directory" aria-label={`${city.name}活跃成员`}>
      <header><div><small>COMMUNITY MEMBERS</small><h2>{city.name}活跃成员</h2></div><p>按本周城市贡献值排序 · 共 {city.people} 位成员</p></header>
      <div className="member-directory-grid">{members.map((member, index) => {
        const followed = followedMembers.includes(member.name);
        return <article key={member.id ?? member.name}><div className="member-rank">#{String(index + 1).padStart(2, '0')}</div><button className="member-directory-profile" type="button" onClick={() => onOpenMember(member)}><img src={member.avatar} alt={`${member.name}的头像`} loading="lazy" /><span><strong>{member.name}</strong><small>{member.role}</small></span></button><dl><div><dt>{member.contribution.toLocaleString('zh-CN')}</dt><dd>贡献值</dd></div><div><dt>{member.posts}</dt><dd>动态</dd></div><div><dt>{member.followers}</dt><dd>关注者</dd></div></dl><button className={followed ? 'member-follow-button followed' : 'member-follow-button'} type="button" aria-pressed={followed} onClick={() => onToggleFollow(member.name, member.id)}>{followed ? '✓ 已关注' : '＋ 关注'}</button></article>;
      })}</div>
    </div>
  );
}

function PolicyDirectory({ city }: { city: City }) {
  const router = useRouter();
  return (
    <div className="policy-directory" aria-label={`${city.name}OPC政策`}>
      <header><div><small>SOURCED OPC POLICY</small><h2>{city.name} OPC 政策</h2></div><p>当前展示适用于全国的已核验政策；地方政策只有在取得官方来源后才会发布。</p></header>
      <div className="policy-grid">{officialPolicies.map((policy) => <article key={policy.id}><div className="policy-meta"><span>{policy.category}</span><time>{new Date(policy.publishedAt).toLocaleDateString('zh-CN')}</time></div><h3>{policy.title}</h3><p>{policy.summary}</p><div className="policy-interpretation"><strong>{policy.issuingAuthority}</strong><ul>{policy.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul></div><button type="button" onClick={() => router.push(`/policies/${policy.id}`)}>阅读政策与解读 <span aria-hidden="true">→</span></button></article>)}</div>
    </div>
  );
}

function FeedCard({ feed, onOpenDetail, onOpenAuthor, onOpenImage }: { feed: FeedItemData; onOpenDetail: () => void; onOpenAuthor: () => void; onOpenImage: (image: { src: string; alt: string }) => void }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reply.trim()) return;
    if (feed.id) {
      const result = await createComment({ postId: feed.id, content: reply });
      const error = handleActionError(result);
      if (error) return setMessage(error);
    }
    setReply('');
    setSent(true);
    setMessage('');
  };
  return (
    <article className="feed-item" role="link" tabIndex={0} aria-label={`打开${feed.author}的动态详情`} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpenDetail(); } }} onClick={(event) => {
      if ((event.target as HTMLElement).closest('button, input, textarea, video')) return;
      onOpenDetail();
    }}>
      <div className="feed-content">
        <button className="author-row author-link" type="button" onClick={onOpenAuthor}><img className="avatar" src={feed.avatar} alt={`${feed.author}的头像`} loading="lazy" /><span><strong>{feed.author}</strong><small>{feed.meta}</small></span></button>
        <p className="feed-copy">{feed.content}</p>
        {feed.topic ? <button className="feed-topic" type="button">#{feed.topic}</button> : null}
        {feed.media?.kind === 'image' ? <button className="feed-media-button" type="button" onClick={() => onOpenImage({ src: feed.media!.src, alt: feed.media!.alt })} aria-label="查看完整图片"><img className="feed-media" src={feed.media.src} alt={feed.media.alt} loading="lazy" /></button> : null}
        {feed.media?.kind === 'video' ? <video className="feed-media" controls preload="metadata" poster={feed.media.poster} aria-label={feed.media.alt}><source src={feed.media.src} type="video/mp4" />你的浏览器暂不支持视频播放。</video> : null}
        {feed.poll ? <FeedPoll poll={feed.poll} /> : null}
        <FeedActions feed={feed} onReply={() => setReplyOpen(true)} />
        {replyOpen ? <section className="quick-reply-composer" aria-label="快速回复"><form className="reply-form" onSubmit={submitReply}><textarea autoFocus value={reply} onChange={(event) => { setReply(event.target.value); setSent(false); setMessage(''); }} placeholder="回复这条动态…" rows={3} /><button type="submit">发布回复</button></form>{sent || message ? <p role="status">{message || '回复已发布'}</p> : null}</section> : null}
      </div>
    </article>
  );
}

function InlineFeedDetail({ feed, onBack, onOpenAuthor, onOpenImage }: { feed: FeedItemData; onBack: () => void; onOpenAuthor: () => void; onOpenImage: (image: { src: string; alt: string }) => void }) {
  const [reply, setReply] = useState('');
  const [replies, setReplies] = useState(() => createFeedReplies(feed.stats.replies));
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!feed.id) return;
    const controller = new AbortController();
    fetch(`/api/prototype/posts/${feed.id}`, { signal: controller.signal }).then((response) => response.json()).then((payload: { ok: boolean; data?: { connected: boolean; comments: Array<{ author: string; content: string; createdAt: string }> } }) => {
      if (payload.ok && payload.data?.connected) setReplies(payload.data.comments.map((comment) => ({ author: comment.author, time: new Date(comment.createdAt).toLocaleString('zh-CN'), copy: comment.content })));
    }).catch((error) => { if (!(error instanceof DOMException && error.name === 'AbortError')) console.error(error); });
    return () => controller.abort();
  }, [feed.id]);
  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const copy = reply.trim();
    if (!copy) return;
    if (feed.id) {
      const result = await createComment({ postId: feed.id, content: copy });
      const error = handleActionError(result);
      if (error) return setMessage(error);
    }
    setReplies((current) => [...current, { author: '我', time: '刚刚', copy }]);
    setReply('');
    setSent(true);
  };

  return (
    <article className="inline-feed-detail" aria-labelledby="inline-feed-detail-title">
      <div className="inline-feed-detail-head"><button type="button" onClick={onBack}>← 返回动态</button><strong id="inline-feed-detail-title">动态详情</strong></div>
      <div className="inline-feed-detail-body">
        <button className="author-row author-link" type="button" onClick={onOpenAuthor}><img className="avatar" src={feed.avatar} alt={`${feed.author}的头像`} /><span><strong>{feed.author}</strong><small>{feed.meta}</small></span></button>
        <p className="feed-copy">{feed.content}</p>
        {feed.topic ? <span className="feed-topic">#{feed.topic}</span> : null}
        {feed.media?.kind === 'image' ? <button className="feed-media-button" type="button" onClick={() => onOpenImage({ src: feed.media!.src, alt: feed.media!.alt })} aria-label="查看完整图片"><img className="feed-media" src={feed.media.src} alt={feed.media.alt} /></button> : null}
        {feed.media?.kind === 'video' ? <video className="feed-media" controls preload="metadata" poster={feed.media.poster} aria-label={feed.media.alt}><source src={feed.media.src} type="video/mp4" />你的浏览器暂不支持视频播放。</video> : null}
        {feed.poll ? <FeedPoll poll={feed.poll} /> : null}
        <FeedActions feed={{ ...feed, stats: { ...feed.stats, replies: replies.length } }} onReply={() => replyInputRef.current?.focus()} />
        <section className="detail-replies" aria-labelledby="detail-replies-title"><div className="feed-detail-head"><strong id="detail-replies-title">全部回复 · {replies.length}</strong></div><div className="reply-list">{replies.map((item, index) => <article key={`${item.author}-${item.time}-${index}`}><div><b>{item.author}</b><small>{item.time}</small></div><p>{item.copy}</p></article>)}</div><form className="reply-form" onSubmit={submitReply}><textarea ref={replyInputRef} value={reply} onChange={(event) => { setReply(event.target.value); setSent(false); setMessage(''); }} placeholder="回复这条动态…" rows={4} /><button type="submit">发布回复</button></form>{sent || message ? <p className="reply-sent" role="status">{message || '回复已发布'}</p> : null}</section>
      </div>
    </article>
  );
}

function ImagePreview({ image, onClose }: { image: { src: string; alt: string }; onClose: () => void }) {
  return (
    <div className="image-preview" role="dialog" aria-modal="true" aria-label="完整图片预览" onClick={onClose}>
      <button className="image-preview-close" type="button" onClick={onClose} aria-label="关闭图片预览">×</button>
      <img src={image.src} alt={image.alt} onClick={(event) => event.stopPropagation()} />
    </div>
  );
}

function JoinConfirmation({ city, onClose, onConfirm }: { city: City; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label={`确认加入${city.name}社区`}>
      <button className="search-backdrop" onClick={onClose} aria-label="关闭确认窗口" />
      <div className="join-confirmation">
        <button className="join-confirm-close" type="button" onClick={onClose} aria-label="关闭">×</button>
        <small>加入社区</small><h2>确认加入{city.name}社区？</h2>
        <p>加入后可以参与社区讨论、活动报名，并关注本地机构的最新动态。</p>
        <div><button type="button" onClick={onClose}>暂不加入</button><button type="button" onClick={onConfirm}>确认加入</button></div>
      </div>
    </div>
  );
}

function FeedActions({ feed, onReply }: { feed: FeedItemData; onReply: () => void }) {
  const { stats } = feed;
  const [liked, setLiked] = useState(Boolean(feed.viewer?.reacted));
  const [likes, setLikes] = useState(stats.likes);
  const [shares, setShares] = useState(stats.shares);
  const [shared, setShared] = useState(false);
  const [saved, setSaved] = useState(Boolean(feed.viewer?.saved));
  const [message, setMessage] = useState('');

  const shareFeed = async () => {
    if (feed.id) {
      const result = await recordShare(feed.id);
      if (!result.ok) return setMessage(handleActionError(result) ?? result.message);
      if (result.data?.counted) setShares((current) => current + 1);
    } else setShares((current) => current + 1);
    const url = feed.id ? `${window.location.origin}/posts/${feed.id}` : window.location.href;
    if (navigator.share) await navigator.share({ title: document.title, url }).catch(() => undefined);
    else await navigator.clipboard.writeText(url).catch(() => undefined);
    setShared(true);
    window.setTimeout(() => setShared(false), 1600);
  };

  const react = async () => {
    if (!feed.id) return setLiked((current) => !current);
    const result = await toggleReaction(feed.id);
    if (!result.ok) return setMessage(handleActionError(result) ?? result.message);
    const active = Boolean(result.data?.active);
    setLikes((current) => Math.max(0, current + (active === liked ? 0 : active ? 1 : -1)));
    setLiked(active);
  };

  const save = async () => {
    if (!feed.id) return setSaved((current) => !current);
    const result = await toggleSave(feed.id);
    if (!result.ok) return setMessage(handleActionError(result) ?? result.message);
    setSaved(Boolean(result.data?.active));
  };

  return (
    <div className="feed-actions" aria-label="动态操作">
      <button type="button" className={liked ? 'active' : ''} aria-pressed={liked} onClick={react}><small>{liked ? '已喜欢' : '喜欢'} <b>{likes}</b></small></button>
      <button type="button" onClick={onReply}><small>回复 <b>{stats.replies}</b></small></button>
      <button type="button" className={shared ? 'shared' : ''} onClick={shareFeed}><small>{shared ? '已复制' : '分享'} <b>{shares}</b></small></button>
      <button type="button" className={saved ? 'saved' : ''} aria-pressed={saved} onClick={save}><small>{saved ? '已收藏' : '收藏'}</small></button>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}

function FeedPoll({ poll }: { poll: NonNullable<FeedItemData['poll']> }) {
  const [selected, setSelected] = useState<number | null>(poll.viewerVoted ? -1 : null);
  const [message, setMessage] = useState('');
  const totalVotes = poll.options.reduce((total, option) => total + option.votes, 0) + (selected === null ? 0 : 1);

  return (
    <div className="feed-poll">
      <strong>{poll.question}</strong>
      <div>
        {poll.options.map((option, index) => {
          const votes = option.votes + (selected === index ? 1 : 0);
          const percentage = Math.round(votes / Math.max(totalVotes, 1) * 100);
          return <button type="button" disabled={selected !== null} className={selected === index ? 'selected' : ''} onClick={async () => { if (poll.id && option.id) { const result = await votePoll({ pollId: poll.id, optionId: option.id }); const error = handleActionError(result); if (error) return setMessage(error); } setSelected(index); }} aria-pressed={selected === index} key={option.id ?? option.label}><span>{option.label}</span><b>{percentage}%</b><i style={{ width: `${percentage}%` }} /></button>;
        })}
      </div>
      <small>{message || `${totalVotes} 人参与`}</small>
    </div>
  );
}

function ActivityChart({ posts, trend }: { posts: number; trend: string }) {
  const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '今天'];
  const values = [0.72, 0.84, 0.77, 0.91, 0.82, 0.96, 1].map((ratio) => Math.max(1, Math.round(posts * ratio)));
  const maximum = Math.max(...values);
  const [activeIndex, setActiveIndex] = useState(values.length - 1);

  return (
    <div className="data-card activity-card">
      <div className="data-title"><h3>本周社区动态数量</h3><span>{trend}</span></div>
      <div className="score-row"><strong>{values[activeIndex].toLocaleString('zh-CN')}</strong><small>{labels[activeIndex]}</small></div>
      <div className="chart" aria-label="本周动态数量趋势">
        {values.map((value, index) => <button type="button" className={activeIndex === index ? 'active' : ''} style={{ height: `${Math.max(38, value / maximum * 100)}%` }} onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} onClick={() => setActiveIndex(index)} aria-label={`${labels[index]}发布 ${value} 条动态`} key={labels[index]}><span>{value.toLocaleString('zh-CN')} 条</span></button>)}
      </div>
      <div className="chart-labels">{labels.map((label, index) => <span className={activeIndex === index ? 'active' : ''} key={label}>{index === 6 ? '今' : label.slice(-1)}</span>)}</div>
    </div>
  );
}

function PublishPanel({ cityId, onClose, onPublish }: { cityId?: string; onClose: () => void; onPublish: (feed: FeedItemData) => void }) {
  const [activeTool, setActiveTool] = useState<ComposerTool | null>(null);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  const submitPublish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const content = String(data.get('content') ?? '').trim();
    if (!content) return;
    const topic = String(data.get('topic') ?? '').trim().replace(/^#+/, '');
    const pollQuestion = String(data.get('pollQuestion') ?? '').trim();
    const options = pollOptions.map((_, index) => String(data.get(`pollOption${index}`) ?? '').trim()).filter(Boolean);

    let postId: string | undefined;
    if (cityId) {
      setPending(true);
      try {
        const mediaIds: string[] = [];
        for (const file of attachments) {
          const presign = await fetch('/api/uploads/presign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: file.name, mimeType: file.type, byteSize: file.size }) });
          const payload = await presign.json() as { ok: boolean; data?: { mediaId: string; uploadUrl: string; headers: Record<string, string> }; error?: { code?: string; message?: string } };
          if (!presign.ok || !payload.ok || !payload.data) {
            throw new Error(payload.error?.message ?? '无法创建上传凭证');
          }
          const uploaded = await fetch(payload.data.uploadUrl, { method: 'PUT', headers: payload.data.headers, body: file });
          if (!uploaded.ok) throw new Error(`文件 ${file.name} 上传失败`);
          mediaIds.push(payload.data.mediaId);
        }
        const result = await createPost({ cityId, content, topics: topic ? [topic] : [], mediaIds, poll: pollQuestion && options.length >= 2 ? { question: pollQuestion, options } : undefined });
        if (!result.ok) return setMessage(handleActionError(result) ?? result.message);
        postId = result.data?.postId;
        if (result.data?.status === 'pending') setMessage('动态已提交审核');
      } catch (error) {
        return setMessage(error instanceof Error ? error.message : '发布失败，请稍后重试');
      } finally {
        setPending(false);
      }
    }

    onPublish({
      id: postId,
      type: '动态',
      content,
      author: '我',
      meta: '刚刚',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=96&h=96&q=85',
      stats: { likes: 0, replies: 0, shares: 0 },
      topic: topic || undefined,
      poll: pollQuestion && options.length >= 2 ? { question: pollQuestion, options: options.map((label) => ({ label, votes: 0 })) } : undefined,
    });
    onClose();
  };

  return (
    <div className="search-overlay publish-overlay" role="dialog" aria-modal="true" aria-labelledby="publish-title">
      <button className="search-backdrop" onClick={onClose} aria-label="关闭发布动态面板" />
      <div className="publish-box">
        <div className="publish-head"><h2 id="publish-title">发布动态</h2><button type="button" onClick={onClose} aria-label="关闭">×</button></div>
        <form className="publish-form" onSubmit={submitPublish}>
          <label><span>动态内容</span><textarea name="content" autoFocus required rows={8} maxLength={1000} placeholder="分享此刻正在发生的事、你的观察或城市发现……" /></label>
          <div className="composer-tools" aria-label="动态内容工具">
            <label className="composer-file" aria-label="添加图片" title="添加图片"><span className="composer-icon composer-icon-image" aria-hidden="true" /><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); setAttachments(files); setAttachmentName(files.map((file) => file.name).join('、')); }} /></label>
            <label className="composer-file" aria-label="添加视频" title="添加视频"><span className="composer-icon composer-icon-video" aria-hidden="true" /><input type="file" accept="video/mp4,video/webm" onChange={(event) => { const files = Array.from(event.target.files ?? []); setAttachments(files); setAttachmentName(files.map((file) => file.name).join('、')); }} /></label>
            <button type="button" className={activeTool === '话题' ? 'active' : ''} aria-label="添加话题" title="添加话题" aria-pressed={activeTool === '话题'} onClick={() => setActiveTool((current) => current === '话题' ? null : '话题')}><span className="composer-icon composer-icon-topic" aria-hidden="true" /></button>
            <button type="button" className={activeTool === '投票' ? 'active' : ''} aria-label="添加投票" title="添加投票" aria-pressed={activeTool === '投票'} onClick={() => setActiveTool((current) => current === '投票' ? null : '投票')}><span className="composer-icon composer-icon-poll" aria-hidden="true" /></button>
          </div>
          {attachmentName ? <p className="composer-attachment">已选择：{attachmentName}</p> : null}
          {activeTool === '话题' ? <label className="composer-extra"><span>添加话题</span><div className="topic-input"><b>#</b><input name="topic" placeholder="输入话题名称" /></div></label> : null}
          {activeTool === '投票' ? <div className="poll-builder"><label><span>投票问题</span><input name="pollQuestion" placeholder="输入投票问题" /></label><div>{pollOptions.map((option, index) => <input name={`pollOption${index}`} value={option} onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`选项 ${index + 1}`} key={index} />)}</div><button type="button" className="add-poll-option" onClick={() => setPollOptions((current) => current.length >= 6 ? current : [...current, ''])} disabled={pollOptions.length >= 6}>＋ 添加投票选项</button></div> : null}
          {message ? <p role="status">{message}</p> : null}
          <button className="publish-submit" type="submit" disabled={pending}>{pending ? '发布中…' : '发布动态'} <span aria-hidden="true">→</span></button>
        </form>
      </div>
    </div>
  );
}

type WeatherState = { temperature: number; weatherCode: number; isDay: boolean };

function getWeatherMeta(code: number, isDay: boolean) {
  if (code === 0) return { label: isDay ? '晴朗' : '晴夜', advice: isDay ? '适合户外活动' : '适合夜间散步', icon: isDay ? '☀' : '☾', tone: 'clear' };
  if (code <= 2) return { label: '晴间多云', advice: '适合城市漫步', icon: '◒', tone: 'cloudy' };
  if (code === 3) return { label: '阴天', advice: '留意体感温度', icon: '☁', tone: 'cloudy' };
  if (code === 45 || code === 48) return { label: '有雾', advice: '出行注意能见度', icon: '≋', tone: 'fog' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { label: code >= 61 ? '有雨' : '毛毛雨', advice: '出门记得带伞', icon: '☂', tone: 'rain' };
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return { label: '有雪', advice: '注意路面湿滑', icon: '❄', tone: 'snow' };
  if (code >= 95) return { label: '雷暴', advice: '尽量减少户外活动', icon: 'ϟ', tone: 'storm' };
  return { label: '天气变化中', advice: '出行前留意天气', icon: '○', tone: 'cloudy' };
}

function CityWeather({ city }: { city: City }) {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather() {
      try {
        const geocoding = new URL('https://geocoding-api.open-meteo.com/v1/search');
        geocoding.search = new URLSearchParams({ name: city.en.replace('’', "'"), count: '1', language: 'en', format: 'json', countryCode: countryCodes[city.country] }).toString();
        const locationResponse = await fetch(geocoding, { signal: controller.signal });
        if (!locationResponse.ok) throw new Error('城市定位失败');
        const locationData = await locationResponse.json() as { results?: { latitude: number; longitude: number }[] };
        const location = locationData.results?.[0];
        if (!location) throw new Error('未找到城市');

        const forecast = new URL('https://api.open-meteo.com/v1/forecast');
        forecast.search = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), current: 'temperature_2m,weather_code,is_day', timezone: 'auto' }).toString();
        const weatherResponse = await fetch(forecast, { signal: controller.signal });
        if (!weatherResponse.ok) throw new Error('天气获取失败');
        const weatherData = await weatherResponse.json() as { current?: { temperature_2m: number; weather_code: number; is_day: number } };
        if (!weatherData.current) throw new Error('天气数据不可用');
        setWeather({ temperature: weatherData.current.temperature_2m, weatherCode: weatherData.current.weather_code, isDay: Boolean(weatherData.current.is_day) });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setFailed(true);
      }
    }

    loadWeather();
    return () => controller.abort();
  }, [city]);

  const fallbackTemperature = Number.parseInt(city.temperature, 10);
  const meta = weather
    ? getWeatherMeta(weather.weatherCode, weather.isDay)
    : { label: failed ? '暂用城市参考值' : '正在获取实时天气', advice: failed ? '稍后将自动恢复' : '连接气象数据中', icon: '◌', tone: 'loading' };

  return (
    <div className={`weather-card weather-${meta.tone}`} aria-live="polite">
      <div><small>今日天气 · {weather ? '实时' : '更新中'}</small><strong>{Math.round(weather?.temperature ?? fallbackTemperature)}°</strong><span>{meta.label} · {meta.advice}</span></div>
      <b className="weather-icon" aria-label={meta.label}>{meta.icon}</b>
    </div>
  );
}

function Knowledge({ onOpenArticle }: { onOpenArticle: (article: KnowledgeItem) => void }) {
  const [category, setCategory] = useState<KnowledgeCategory>('全部');
  const visibleKnowledge = category === '全部' ? knowledge : knowledge.filter((item) => item.tag === category);

  return (
    <div className="feature-page knowledge-center">
      <FeaturePageHeader eyebrow="OPC AI KNOWLEDGE" title="知识" description="从基础概念到可执行的 AI 工作方法，建立一人公司真正用得上的知识体系。" count="128" unit="篇系统知识" />
      <section className="feature-page-body"><div className="feature-filter knowledge-category-switch" role="tablist" aria-label="选择 AI 知识分类">{knowledgeCategories.map((item) => <button type="button" role="tab" aria-selected={category === item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div><div className="knowledge-grid">{visibleKnowledge.map((item) => <article key={item.no}><span className="knowledge-no">{item.no}</span><div className="knowledge-tag">{item.tag}</div><h3>{item.title}</h3><p>{item.desc}</p><footer><span>{item.time}阅读</span><button type="button" onClick={() => onOpenArticle(item)}>阅读全文 <span aria-hidden="true">→</span></button></footer></article>)}</div></section>
    </div>
  );
}

function FeaturePageHeader({ eyebrow, title, description, count, unit }: { eyebrow: string; title: string; description: string; count: string; unit: string }) {
  return <header className="feature-page-hero"><div><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></div><div className="feature-hero-count"><strong>{count}</strong><span>{unit}</span></div></header>;
}

function InsightDaily() {
  const [category, setCategory] = useState<InsightCategory>('全部');
  const [expanded, setExpanded] = useState<string | null>(dailyInsights[0].title);
  const visible = category === '全部' ? dailyInsights : dailyInsights.filter((item) => item.category === category);

  return (
    <div className="feature-page insight-daily">
      <FeaturePageHeader eyebrow="OPC AI DAILY" title="洞察" description="每天筛选真正值得关注的 AI 动态，用几分钟掌握变化、判断影响、找到行动方向。" count="08.24" unit="今日 AI 日报" />
      <section className="feature-page-body insight-body">
        <div className="daily-edition" aria-label="今日日报摘要"><div><small>MONDAY · 2026</small><strong>今日共 6 条 AI 快讯</strong></div><p>今天的关键信号：AI 产品正从“回答问题”走向“完成任务”，可靠性与可量化回报成为新一轮竞争重点。</p><span>每日 18:00 前更新</span></div>
        <div className="feature-filter" role="tablist" aria-label="洞察分类">{insightCategories.map((item) => <button type="button" role="tab" aria-selected={category === item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
        <div className="insight-list">{visible.map((item, index) => { const isOpen = expanded === item.title; return <article className={isOpen ? 'open' : ''} key={item.title}><div className="insight-time"><b>{item.time}</b><span>{String(index + 1).padStart(2, '0')}</span></div><div className="insight-copy"><div className="insight-meta"><span>{item.category}</span><em className={`signal-${item.signal}`}>{item.signal}</em></div><h2>{item.title}</h2>{isOpen ? <p>{item.summary}</p> : null}<footer><span>{item.source} · 编辑部整理</span><button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : item.title)}>{isOpen ? '收起摘要' : '展开摘要'} <span aria-hidden="true">{isOpen ? '↑' : '↓'}</span></button></footer></div></article>; })}</div>
      </section>
    </div>
  );
}

function HelpCenter() {
  const [query, setQuery] = useState('');
  const [openQuestion, setOpenQuestion] = useState<string | null>(helpQuestions[0].question);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const keyword = query.trim().toLocaleLowerCase('zh-CN');
  const visible = keyword ? helpQuestions.filter((item) => `${item.category}${item.question}${item.answer}`.toLocaleLowerCase('zh-CN').includes(keyword)) : helpQuestions;
  return (
    <div className="feature-page help-center">
      <FeaturePageHeader eyebrow="SUPPORT & GUIDE" title="帮助" description="查找使用指南、常见问题与社区规则，或者直接告诉我们你遇到的问题。" count="24h" unit="社区响应" />
      <section className="feature-page-body help-layout"><div className="help-main"><label className="help-search"><span>搜索帮助</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：如何加入城市社区" /></label><div className="faq-list">{visible.length ? visible.map((item) => { const open = openQuestion === item.question; return <article key={item.question}><button type="button" aria-expanded={open} onClick={() => setOpenQuestion(open ? null : item.question)}><span><small>{item.category}</small><strong>{item.question}</strong></span><b>{open ? '−' : '+'}</b></button>{open ? <p>{item.answer}</p> : null}</article>; }) : <p className="help-empty">没有找到相关答案，请提交问题给我们。</p>}</div></div><aside className="help-contact"><small>CONTACT SUPPORT</small><h2>还需要帮助？</h2><p>留下你的问题，社区支持团队会在一个工作日内回复。</p>{sent ? <div className="help-sent"><strong>✓ 问题已提交</strong><span>我们会通过站内消息联系你。</span><button type="button" onClick={() => { setSent(false); setMessage(''); }}>继续提问</button></div> : <form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setPending(true); const result = await createHelpTicket({ requesterName: form.get('requesterName'), contact: form.get('contact'), description: form.get('description') }); setPending(false); const error = handleActionError(result); if (error) return setMessage(error); setSent(true); }}><label><span>你的称呼</span><input name="requesterName" required /></label><label><span>联系方式</span><input name="contact" required type="email" placeholder="name@example.com" /></label><label><span>问题描述</span><textarea name="description" required minLength={10} rows={5} /></label>{message ? <p role="status">{message}</p> : null}<button type="submit" disabled={pending}>{pending ? '提交中…' : '提交问题 →'}</button></form>}</aside></section>
    </div>
  );
}

function AccountPage({ eyebrow, title, description, avatar, hideHero = false, children }: { eyebrow?: string; title: string; description: string; avatar?: { src: string; alt: string }; hideHero?: boolean; children: ReactNode }) {
  return (
    <div className="account-page">
      {!hideHero && <section className="account-hero">
        <div className={`account-hero-inner ${avatar ? 'has-avatar' : ''}`}>
          {avatar ? <img className="account-hero-avatar" src={avatar.src} alt={avatar.alt} /> : null}
          <div className="account-hero-copy">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </div>
      </section>}
      <section className="account-content">{children}</section>
    </div>
  );
}

function PersonalProfile({ navigate, onOpenCity }: { navigate: (view: View) => void; onOpenCity: (name: string) => void }) {
  const { account, loading, refresh } = usePrototypeAccount();
  const [profile, setProfile] = useState({
    name: '林野',
    bio: '城市观察者、步行爱好者。关注公共空间、社区营造与普通人的日常经验。',
    tags: ['城市观察者', '内容创作者', '社区共建顾问'],
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=360&h=360&q=90',
  });
  const [draft, setDraft] = useState(profile);
  const [editing, setEditing] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');

  const displayedProfile = account?.connected && account.profile
    ? { name: account.profile.name, bio: account.profile.bio ?? '', tags: account.profile.tags, avatar: account.profile.avatarUrl ?? defaultAvatar }
    : profile;

  const openEditor = () => { setDraft(displayedProfile); setAvatarFile(null); setMessage(''); setEditing(true); };
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (account?.connected) {
      const result = await updateProfile({ nickname: draft.name, bio: draft.bio, occupationTags: draft.tags.filter(Boolean) });
      const error = handleActionError(result);
      if (error) return setMessage(error);
      if (avatarFile) {
        try {
          const presign = await fetch('/api/uploads/presign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: avatarFile.name, mimeType: avatarFile.type, byteSize: avatarFile.size }) });
          const payload = await presign.json() as { ok: boolean; data?: { mediaId: string; uploadUrl: string; headers: Record<string, string> }; error?: { message?: string } };
          if (!presign.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message ?? '无法创建头像上传凭证');
          const uploaded = await fetch(payload.data.uploadUrl, { method: 'PUT', headers: payload.data.headers, body: avatarFile });
          if (!uploaded.ok) throw new Error('头像上传失败');
          setMessage('头像已上传，审核通过后会自动更新。');
        } catch (error) {
          return setMessage(error instanceof Error ? error.message : '头像上传失败');
        }
      }
    }
    setProfile({ ...draft, name: draft.name.trim(), bio: draft.bio.trim(), tags: draft.tags.filter(Boolean) });
    setEditing(false);
    refresh();
  };

  return (
    <AccountPage title={profile.name} description="个人资料" hideHero>
      <div className="profile-overview">
        <div className="profile-main">
          <img className="profile-avatar" src={displayedProfile.avatar} alt={`${displayedProfile.name}的个人头像`} />
          <div className="profile-bio">
            <span>OPC 创业者档案</span>
            <h2>{displayedProfile.name}</h2>
            <p>{displayedProfile.bio}</p>
            <dl className="profile-social-stats"><div><dt>{account?.profile?.followingCount ?? 68}</dt><dd>正在关注</dd></div><div><dt>{account?.profile?.followerCount ?? 126}</dt><dd>关注者</dd></div></dl>
            <div className="profile-occupation"><small>职业标签</small><div className="profile-tags">{displayedProfile.tags.map((tag) => <i key={tag}>{tag}</i>)}</div></div>
          </div>
          <button className="profile-edit-trigger" type="button" onClick={openEditor}>修改资料</button>
        </div>
      </div>
      <section className="profile-series-panel" aria-labelledby="profile-series-title">
        <div className="profile-series-head"><div><small>个人功能</small><h2 id="profile-series-title">我的内容与进度</h2></div><p>集中管理你在游民社区里的创作、收藏与创业服务。</p></div>
        <div className="profile-series-grid">{profileSeriesLinks.map((item) => <button type="button" key={item.kind} onClick={() => navigate(item.view)}><span><small>{item.description}</small><strong>{item.label}</strong></span><b>{item.count}</b></button>)}</div>
      </section>
      <section className="joined-cities-panel" aria-labelledby="joined-cities-title">
        <div className="joined-cities-head"><div><h2 id="joined-cities-title">已加入的城市</h2></div><div><strong>{account?.connected ? account.joinedCities?.length ?? 0 : 24}</strong><span>个 OPC 城市</span></div></div>
        <ul className="profile-city-list">{(account?.connected ? (account.joinedCities ?? []).map((item) => [item.name, item.postCount] as const) : profileJoinedCities).map(([name, posts]) => <li key={name}><button type="button" onClick={() => onOpenCity(name)} aria-label={`进入${name}城市社区，当前有${posts}条动态`}><b>{name}</b><em>{posts} 条动态</em></button></li>)}</ul>
        {loading ? <p role="status">正在同步个人资料…</p> : null}
      </section>
      {editing && <div className="search-overlay profile-edit-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
        <button className="search-backdrop" onClick={() => setEditing(false)} aria-label="关闭资料编辑" />
        <div className="application-box profile-edit-box">
          <div className="application-head"><div><small>个人资料</small><h2 id="profile-edit-title">修改个人资料</h2><p>完善你的职业身份，让更多志同道合的人找到你。</p></div><button type="button" onClick={() => setEditing(false)} aria-label="关闭">×</button></div>
          <form className="application-form profile-edit-form" onSubmit={saveProfile}>
            <div className="full edit-avatar-field"><span>个人头像</span><div><img src={draft.avatar} alt="头像预览" /><label><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (!file) return; setAvatarFile(file); const reader = new FileReader(); reader.onload = () => { const result = reader.result; if (typeof result === 'string') setDraft((current) => ({ ...current, avatar: result })); }; reader.readAsDataURL(file); }} /><b>选择新头像</b></label><small>支持 JPG、PNG、WebP</small></div></div>
            <label className="full"><span>昵称</span><input required maxLength={20} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <fieldset className="full occupation-picker"><legend>职业标签 <small>{draft.tags.length}/3</small></legend><p>选择最能代表你的职业身份，最多选择三个。</p><div>{occupationOptions.map((option) => { const selected = draft.tags.includes(option); const disabled = !selected && draft.tags.length >= 3; return <button key={option} type="button" className={selected ? 'selected' : ''} aria-pressed={selected} disabled={disabled} onClick={() => setDraft((current) => ({ ...current, tags: selected ? current.tags.filter((tag) => tag !== option) : [...current.tags, option].slice(0, 3) }))}>{selected ? '✓ ' : ''}{option}</button>; })}</div></fieldset>
            <label className="full"><span>个人简介</span><textarea required maxLength={160} rows={4} value={draft.bio} onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))} /></label>
            {message ? <p className="full" role="status">{message}</p> : null}<button className="application-submit" type="submit">保存修改</button>
          </form>
        </div>
      </div>}
    </AccountPage>
  );
}

function PersonalSeriesPage({ kind, onBack }: { kind: PersonalSeriesKind; onBack: () => void }) {
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const { account, loading } = usePrototypeAccount();
  const items = account?.connected ? (kind === '动态'
    ? (account.posts ?? []).map((item) => ({ id: item.id, meta: new Date(item.createdAt).toLocaleDateString('zh-CN'), title: item.content.slice(0, 42), copy: item.content, status: item.status }))
    : kind === '收藏'
      ? (account.saves ?? []).map((item) => ({ id: item.id, meta: `${item.city ?? '全国'} · ${new Date(item.savedAt).toLocaleDateString('zh-CN')}`, title: item.content.slice(0, 42), copy: item.content, status: '已收藏' }))
      : (account.applications ?? []).map((item) => ({ id: item.id, meta: `${item.kind} · ${new Date(item.createdAt).toLocaleDateString('zh-CN')}`, title: item.title, copy: '审核进度会持续保留在个人中心。', status: item.status }))) : personalSeriesContent[kind].map((item, index) => ({ ...item, id: `demo-${index}` }));
  const descriptions: Record<PersonalSeriesKind, string> = {
    动态: '查看和管理你发布过的城市动态。', 收藏: '继续阅读你收藏的动态与文章。',
    申请: '跟进机构申请进度。',
  };

  return (
    <AccountPage eyebrow="个人中心" title={`我的${kind}`} description={descriptions[kind]}>
      <button className="account-back" type="button" onClick={onBack}>← 返回个人主页</button>
      <div className="personal-series-list">{items.map((item) => { const open = activeTitle === item.title; const managePath = kind === '动态' ? '/me/posts' : kind === '收藏' ? '/me/saves' : '/me/applications'; return <article className={open ? 'open' : ''} key={item.id}><div><small>{item.meta}</small><h2>{item.title}</h2><p>{item.copy}</p></div><div className="personal-series-action"><span>{item.status}</span><button type="button" aria-expanded={open} onClick={() => setActiveTitle(open ? null : item.title)}>{open ? '收起详情' : '查看详情'}</button></div>{open ? <div className="personal-series-detail"><strong>当前记录</strong><p>此内容已同步到你的个人中心。后续更新、互动和服务进度都会保留在这里。</p><a href={managePath}>管理这项内容</a></div> : null}</article>; })}</div>
      {loading ? <p role="status">正在同步记录…</p> : null}
      {!loading && items.length === 0 ? <p className="empty-state">暂时没有相关记录。</p> : null}
    </AccountPage>
  );
}

function MyActivities() {
  const router = useRouter();
  const { account, loading } = usePrototypeAccount();
  const demoActivities = baseFeeds.filter((feed) => feed.type === '活动');
  const [activeTab, setActiveTab] = useState<'已报名' | '已收藏' | '历史活动'>('已报名');
  const tabItems = [
    { label: '已报名' as const, count: 2 },
    { label: '已收藏' as const, count: 4 },
    { label: '历史活动' as const, count: 7 },
  ];
  const liveActivities = account?.connected ? (account.activities ?? []) : [];
  const visibleLiveActivities = activeTab === '历史活动' ? liveActivities.filter((item) => new Date(item.startsAt) < new Date()) : activeTab === '已报名' ? liveActivities.filter((item) => item.status === 'registered' && new Date(item.startsAt) >= new Date()) : [];
  const visibleActivities = account?.connected ? [] : activeTab === '已报名' ? demoActivities.slice(0, 2) : activeTab === '已收藏' ? demoActivities.slice(1) : [...demoActivities].reverse();
  return (
    <AccountPage eyebrow="MY ACTIVITIES" title="我的活动" description="统一查看已报名、已收藏和参加过的城市活动。">
      <div className="account-tabs" role="tablist" aria-label="我的活动分类">{tabItems.map((tab) => <button key={tab.label} type="button" role="tab" aria-selected={activeTab === tab.label} className={activeTab === tab.label ? 'active' : ''} onClick={() => setActiveTab(tab.label)}>{tab.label} {tab.count}</button>)}</div>
      <div className="my-activity-list">{visibleLiveActivities.map((activity) => <article className="my-activity-card" key={activity.id}><div><small>{activity.city}</small><h3>{activity.title}</h3><p>{new Date(activity.startsAt).toLocaleString('zh-CN')}</p><div className="activity-status"><b>{activeTab === '历史活动' ? '已结束' : '报名成功'}</b><span>{activity.status}</span></div><button type="button" onClick={() => router.push(`/activities/${activity.id}`)}>查看活动</button></div></article>)}{visibleActivities.map((activity, index) => <article className="my-activity-card" key={`${activeTab}-${activity.title}`}><img src={activity.cover} alt={`${activity.title}活动封面`} loading="lazy" /><div><small>{activity.category} · {activity.location}</small><h3>{activity.title}</h3><p>{activity.content}</p><div className="activity-status"><b>{activeTab === '历史活动' ? '已结束' : index === 0 ? '报名成功' : '等待开始'}</b><span>{activity.meta}</span></div><button type="button" onClick={() => router.push('/activities')}>查看活动</button></div></article>)}</div>
      {loading ? <p role="status">正在同步活动记录…</p> : null}
      {!loading && account?.connected && visibleLiveActivities.length === 0 ? <p className="empty-state">这个分类暂无活动。</p> : null}
    </AccountPage>
  );
}

function MemberProfile({ member, followed, onToggleFollow, onBack }: { member: FeedItemData; followed: boolean; onToggleFollow: () => void; onBack: () => void }) {
  const posts: FeedItemData[] = [
    member,
    { ...member, meta: '3 天前 · 杭州', content: '傍晚沿着运河走了一段，桥下的旧石阶、慢慢亮起的灯和散步的人，让城市的边缘也有了温度。', stats: { likes: 84, replies: 17, shares: 8 }, media: undefined },
    { ...member, meta: '1 周前 · 广州', content: '记录了一组老街骑楼下的日常：修鞋摊、糖水铺和等公交的人。真正构成城市记忆的，常常就是这些普通瞬间。', stats: { likes: 112, replies: 26, shares: 14 }, media: undefined },
    { ...member, meta: '2 周前 · 成都', content: '在社区花园里认识了几位一直照顾植物的邻居。他们不把这件事叫共建，只说是顺手让大家路过时更开心一点。', stats: { likes: 73, replies: 19, shares: 6 }, media: undefined },
  ];
  const joinedCities = member.author === '阿乔'
    ? [['上海', 18], ['杭州', 9], ['广州', 12], ['成都', 7], ['厦门', 6], ['青岛', 5]] as const
    : profileJoinedCities.slice(0, 6);

  return (
    <AccountPage title={member.author} description="成员主页" hideHero>
      <button className="account-back" onClick={onBack}>← 返回社区</button>
      <div className="member-card"><img src={member.avatar} alt={`${member.author}的头像`} /><div className="member-card-copy"><small>上海 · 2024 年加入</small><h2>{member.author}</h2><p>{member.author === '林野' ? '城市观察者、步行爱好者，持续记录街道与公共空间里的日常。' : '关注社区文化与城市生活，愿意认识更多认真生活的人。'}</p></div><dl><div><dt>{posts.length}</dt><dd>动态</dd></div><div><dt>{326 + (followed ? 1 : 0)}</dt><dd>关注者</dd></div><div><dt>42</dt><dd>参与活动</dd></div></dl><div className="member-follow-zone"><button className={followed ? 'followed' : ''} type="button" aria-pressed={followed} onClick={onToggleFollow}>{followed ? '✓ 已关注' : '＋ 关注'}</button></div></div>
      <div className="member-profile-layout">
        <section className="member-posts" aria-labelledby="member-posts-title"><div className="account-section-head"><h2 id="member-posts-title">动态</h2><span>全部 {posts.length} 条</span></div><div className="member-post-list">{posts.map((post, index) => <article key={`${post.meta}-${index}`}><small>{post.meta}</small><p>{post.content}</p>{post.media?.kind === 'image' ? <img src={post.media.src} alt={post.media.alt} loading="lazy" /> : null}<footer><span>喜欢 {post.stats.likes}</span><span>回复 {post.stats.replies}</span><span>分享 {post.stats.shares}</span></footer></article>)}</div></section>
        <aside className="member-cities" aria-labelledby="member-cities-title"><div className="account-section-head"><h2 id="member-cities-title">已加入的城市</h2><span>{joinedCities.length} 个</span></div><ul>{joinedCities.map(([name, postCount]) => <li key={name}><b>{name}</b><span>{postCount} 条动态</span></li>)}</ul></aside>
      </div>
    </AccountPage>
  );
}

function KnowledgeArticle({ article, onBack }: { article: KnowledgeItem; onBack: () => void }) {
  return (
    <article className="article-page">
      <header className="article-hero"><button onClick={onBack}>← 返回知识</button><span className="knowledge-tag">{article.tag} · {article.time}阅读</span><h1>{article.title}</h1><p>{article.desc}</p></header>
      <div className="article-body"><p className="article-lead">人工智能不是一个遥远的抽象概念。它已经进入搜索、创作、交通、医疗与我们每天使用的工具之中。理解它，首先要从它真正能够完成的任务开始。</p><h2>从识别到生成</h2><p>早期的人工智能系统更擅长在已有信息中做分类和预测。今天的生成式模型，则可以在大量经验的基础上组织语言、图像、声音与代码。两者共同点是：它们都在根据输入寻找最可能的结果。</p><img src="https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1600&q=88" alt="抽象人工智能网络视觉" loading="lazy" /><h2>模型如何学习</h2><p>训练过程会让模型反复观察样本，并不断调整内部参数。它不是像人一样背诵每一条内容，而是逐渐建立关于结构、关系与概率的表示。</p><blockquote>好的 AI 使用方式，不是把判断全部交出去，而是让工具帮助我们看见更多可能。</blockquote><h2>视频：一分钟理解生成式 AI</h2><video controls preload="metadata" poster="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1400&q=85"><source src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。</video><h2>接下来可以做什么</h2><p>选择一个自己熟悉的任务，明确输入、结果与判断标准，再让 AI 参与其中。保持验证、记录和复盘，是建立可靠工作流的开始。</p></div>
    </article>
  );
}
