export type HelpFaq = {
  id: string;
  slug: string;
  category: string;
  question: string;
  answer: string;
};

export const defaultHelpFaqs: HelpFaq[] = [
  { id: 'profile', slug: 'complete-profile', category: '账号', question: '如何完善公开资料？', answer: '登录后进入个人中心，可修改昵称、简介、职业标签并上传头像。头像通过安全审核后才会公开。' },
  { id: 'city', slug: 'join-city', category: '城市', question: '如何加入或退出一个城市社区？', answer: '进入城市主页后点击“加入社区”；已加入的成员可在同一位置退出，加入记录会同步到个人中心。' },
  { id: 'post', slug: 'post-formats', category: '发布', question: '动态支持哪些内容形式？', answer: '支持文字、图片、视频、话题和投票。媒体会经过安全审核，未通过的内容不会公开。' },
  { id: 'activity', slug: 'activity-registration', category: '活动', question: '如何报名或取消报名？', answer: '在活动详情页报名。活动开始前可取消，名额会自动释放；已取消、已结束或已满额的活动不能新增报名。' },
  { id: 'safety', slug: 'report-content', category: '安全', question: '如何举报不合适的内容？', answer: '在动态详情、评论或活动旁打开举报表单，选择原因并补充说明。处理进度和申诉结果会保留在账号记录中。' },
];
