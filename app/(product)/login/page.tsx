import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/features/auth/login-form';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({ title: '登录或注册｜游民', description: '使用手机号验证码登录游民 OPC 社区。', canonical: '/login', index: false, useBrandImage: false });

export default function LoginPage() {
  return <main className="static-login-page"><div className="login-box"><div className="login-head"><div><small>手机验证码</small><h1>登录游民</h1></div><Link href="/" aria-label="关闭并返回首页">×</Link></div><LoginForm /></div><aside><small>ONE ACCOUNT</small><strong>一个账号，连接城市与同行</strong><ul><li>加入全国 694 个 OPC 城市</li><li>发布动态、评论、关注与收藏</li><li>报名城市活动并管理个人记录</li></ul></aside></main>;
}
