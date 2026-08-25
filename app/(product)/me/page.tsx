/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { AccountDeletionControl, ProfileEditor } from '@/features/account/account-controls';
import { readSession } from '@/server/auth/session';
import { getAccountProfile } from '@/server/repositories/account';
import { getMediaPublicBaseUrl } from '@/lib/env';

const areas = [
  ['posts', '我的动态'],
  ['saves', '我的收藏'],
  ['follows', '我的关注'],
  ['activities', '我的活动'],
  ['applications', '我的申请'],
  ['notifications', '通知中心'],
  ['sessions', '会话管理'],
  ['appeals', '我的申诉'],
] as const;

export default async function MePage() {
  const session = await readSession();
  const profile = session ? await getAccountProfile(session.id) : null;
  const avatarUrl = profile?.avatarKey ? `${getMediaPublicBaseUrl()}/${profile.avatarKey.split('/').map(encodeURIComponent).join('/')}` : null;
  return <main className="account-page"><section className="account-content"><div className="profile-overview"><div className="profile-main">{avatarUrl ? <img className="profile-avatar" src={avatarUrl} alt={`${profile?.nickname ?? '我的'}头像`} /> : <div className="profile-avatar profile-avatar-initial" aria-hidden="true">{profile?.nickname.slice(0, 1) ?? '我'}</div>}<div className="profile-bio"><span>OPC 创业者档案</span><h2>{profile?.nickname ?? '个人中心'}</h2><p>{profile?.bio || '完善个人简介，让更多志同道合的人认识你。'}</p><div className="profile-occupation"><small>职业标签</small><div className="profile-tags">{profile?.occupationTags.length ? profile.occupationTags.map((tag) => <i key={tag}>{tag}</i>) : <i>OPC 创业者</i>}</div></div><small className="profile-account-meta">账号 {session?.id.slice(0, 8)} · {session?.role}</small></div><Link className="profile-edit-trigger" href={`/members/${session?.id}`}>公开主页</Link></div></div><section className="profile-series-panel" aria-labelledby="profile-series-title"><div className="profile-series-head"><div><small>个人功能</small><h2 id="profile-series-title">我的内容与进度</h2></div><p>集中管理你在游民社区里的创作、收藏、活动与账号安全。</p></div><div className="profile-series-grid profile-series-grid-wide">{areas.map(([slug, label], index) => <Link href={`/me/${slug}`} key={slug}><span><small>{['管理发布记录', '继续阅读收藏', '查看关注成员', '报名与发起记录', '跟踪申请进度', '查看社区消息', '管理登录设备', '跟踪申诉进度'][index]}</small><strong>{label}</strong></span><b>{String(index + 1).padStart(2, '0')}</b></Link>)}</div></section>{profile && <section className="account-settings"><div className="account-section-head"><h2>修改个人资料</h2><span>公开信息</span></div><ProfileEditor profile={profile} /></section>}<section className="account-settings"><div className="account-section-head"><h2>我的数据</h2><span>个人信息权利</span></div><p>下载当前账号中的资料、内容、关系、活动、申请和通知副本。</p><a className="primary-product-button" href="/api/account/export" download>下载账号数据副本</a></section><AccountDeletionControl /></section></main>;
}
