'use client';

import { useDeferredValue, useState, type FormEvent } from 'react';
import { createHelpTicket } from '@/features/applications/actions';

const questions = [
  { category: '账号', question: '如何完成 OPC 注册？', answer: '使用中国大陆手机号获取验证码并完成登录。注册成功后即可加入城市、发布动态和参与活动。' },
  { category: '城市', question: '如何加入或退出一个城市社区？', answer: '进入城市主页后点击“加入社区”；再次点击同一位置即可退出。加入记录会同步到个人中心。' },
  { category: '发布', question: '动态支持哪些内容形式？', answer: '支持文字、图片、视频、话题和投票。每张图片不超过 10MB，每条动态最多上传 9 张图片。' },
  { category: '活动', question: '如何报名或取消报名？', answer: '在活动详情页点击报名。活动开始前可在详情页或“我的活动”中取消，名额会自动释放。' },
  { category: '安全', question: '如何举报不合适的内容？', answer: '在动态详情或评论旁打开举报表单，选择原因并补充说明。处理进度和申诉结果会保留在账号记录中。' },
] as const;

const information = [
  { id: 'about', no: '01', title: '关于我们', copy: '游民是以城市为连接方式的一人公司创业者社区，关注真实交流、长期成长与可持续经营。' },
  { id: 'privacy', no: '02', title: '隐私政策', copy: '仅在注册、社区互动和提供服务所必需的范围内收集信息，并通过加密、权限隔离和审计保护数据。' },
  { id: 'risk', no: '03', title: '风险提示', copy: '社区内容用于交流与信息参考，不构成投资、法律、财税、医疗或其他专业意见。' },
  { id: 'cooperation', no: '04', title: '商务合作', copy: '欢迎城市机构、创业服务伙伴和品牌方联合发起活动、专题内容与社区共建项目。' },
] as const;

export function HelpCenter() {
  const [query, setQuery] = useState('');
  const [openQuestion, setOpenQuestion] = useState<string | null>(questions[0].question);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase('zh-CN'));
  const visible = deferredQuery
    ? questions.filter((item) => `${item.category}${item.question}${item.answer}`.toLocaleLowerCase('zh-CN').includes(deferredQuery))
    : questions;

  const submitQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await createHelpTicket({ requesterName: form.get('requesterName'), contact: form.get('contact'), description: form.get('description') });
    setPending(false);
    if (!result.ok) return setMessage(result.message);
    setSent(true);
  };

  return (
    <>
      <section className="feature-page-body help-layout">
        <div className="help-main">
          <label className="help-search"><span>搜索帮助</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：如何加入城市" /></label>
          <div className="faq-list">
            {visible.length ? visible.map((item) => {
              const open = openQuestion === item.question;
              return <article key={item.question}><button type="button" aria-expanded={open} onClick={() => setOpenQuestion(open ? null : item.question)}><span><small>{item.category}</small><strong>{item.question}</strong></span><b>{open ? '−' : '+'}</b></button>{open ? <p>{item.answer}</p> : null}</article>;
            }) : <p className="help-empty">没有找到相关答案，请提交问题给我们。</p>}
          </div>
        </div>
        <aside className="help-contact">
          <small>CONTACT SUPPORT</small><h2>还需要帮助？</h2><p>留下你的问题，社区支持团队会在一个工作日内通过站内消息回复。</p>
          {sent ? <div className="help-sent"><strong>✓ 问题已提交</strong><span>我们会通过站内消息联系你。</span><button type="button" onClick={() => { setSent(false); setMessage(''); }}>继续提问</button></div> : <form onSubmit={submitQuestion}><label><span>你的称呼</span><input name="requesterName" required /></label><label><span>联系方式</span><input name="contact" required type="email" placeholder="name@example.com" /></label><label><span>问题描述</span><textarea name="description" required minLength={10} rows={5} /></label>{message ? <p role="status">{message}</p> : null}<button type="submit" disabled={pending}>{pending ? '提交中…' : '提交问题 →'}</button></form>}
        </aside>
      </section>
      <section className="information-page-body help-information" aria-label="网站信息">
        {information.map((item) => <section id={item.id} key={item.id}><span>{item.no}</span><div><h2>{item.title}</h2><p>{item.copy}</p></div></section>)}
      </section>
    </>
  );
}
