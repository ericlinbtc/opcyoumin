export type PublicPolicy = {
  id: string;
  city: string | null;
  title: string;
  category: string;
  summary: string;
  interpretation: string;
  keyPoints: string[];
  issuingAuthority: string;
  documentNumber: string | null;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  effectiveAt: string | null;
};

export const officialPolicies: PublicPolicy[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    city: null,
    title: '国务院办公厅关于进一步优化营商环境降低市场主体制度性交易成本的意见',
    category: '营商环境',
    summary: '围绕市场准入、涉企收费、政务服务、行政执法和监管等环节，提出降低市场主体制度性交易成本的政策措施。',
    interpretation: 'OPC 在设立和经营过程中，可以重点关注准入隐性壁垒、涉企收费清单、电子证照互通和办事材料精简等内容。具体办理条件仍应以所在地主管部门最新口径为准。',
    keyPoints: ['破除隐性准入壁垒', '规范涉企收费', '提升线上政务服务能力'],
    issuingAuthority: '国务院办公厅',
    documentNumber: '国办发〔2022〕30号',
    sourceName: '中国政府网',
    sourceUrl: 'https://www.gov.cn/zhengce/content/2022-09/15/content_5709962.htm',
    publishedAt: '2022-09-15T00:00:00+08:00',
    effectiveAt: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    city: null,
    title: '促进个体工商户发展条例',
    category: '经营主体',
    summary: '条例明确个体工商户在市场经济中的法律地位，并从登记服务、创业就业、经营场所、财税金融和权益保护等方面作出制度安排。',
    interpretation: '采用个体工商户形态开展业务的独立经营者，可据此了解登记注册、经营场所、公共服务和合法权益保护的基础制度；行业许可、税务申报等仍需按具体业务核验。',
    keyPoints: ['优化登记和变更服务', '支持创业就业与经营发展', '保护合法财产与经营自主权'],
    issuingAuthority: '国务院',
    documentNumber: '国务院令第755号',
    sourceName: '国家行政法规库',
    sourceUrl: 'https://xzfg.moj.gov.cn/law/detail?LawID=738',
    publishedAt: '2022-10-01T00:00:00+08:00',
    effectiveAt: '2022-11-01T00:00:00+08:00',
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    city: null,
    title: '国务院关于深入实施“人工智能+”行动的意见',
    category: 'AI 赋能',
    summary: '意见部署人工智能与科技、产业、消费、民生、治理和全球合作等领域深度融合，推动形成智能经济和智能社会新形态。',
    interpretation: '对使用 AI 改造产品与工作流的 OPC，这份意见提供的是国家层面的方向性框架，并不等同于具体补贴申报通知。任何资金、算力券或项目申报都应继续核对地方主管部门原文。',
    keyPoints: ['推动人工智能与产业深度融合', '培育智能原生新模式新业态', '强调安全可控与治理能力'],
    issuingAuthority: '国务院',
    documentNumber: '国发〔2025〕11号',
    sourceName: '中国政府网（网信中国转载）',
    sourceUrl: 'https://www.cac.gov.cn/2025-08/27/c_1758018277755538.htm',
    publishedAt: '2025-08-26T00:00:00+08:00',
    effectiveAt: null,
  },
];
