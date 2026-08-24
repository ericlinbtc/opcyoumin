'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Stage = 'phone' | 'code';

export function LoginForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    try {
      const endpoint = stage === 'phone' ? '/api/auth/sms/send' : '/api/auth/sms/verify';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(stage === 'phone' ? { phone } : { phone, code }),
      });
      const payload = await response.json() as { ok: boolean; error?: { message?: string } };
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? '请求失败');
      if (stage === 'phone') {
        setStage('code');
        setMessage('验证码已发送，5 分钟内有效。');
      } else {
        router.push('/me');
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '请求失败，请稍后再试');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="phone"><span>手机号码</span><input id="phone" name="phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="请输入手机号码" required disabled={stage === 'code'} /></label>
      {stage === 'code' ? <label htmlFor="code"><span>短信验证码</span><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="请输入 6 位验证码" required autoFocus /></label> : null}
      <p className={message && !message.includes('已发送') ? 'login-message error' : 'login-message'} role="status" aria-live="polite">{message || (stage === 'phone' ? '使用手机号验证码登录或注册' : '验证码 5 分钟内有效')}</p>
      <button className="login-submit" type="submit" disabled={pending}>{pending ? '正在处理…' : stage === 'phone' ? '获取验证码' : '登录 / 注册'} <span aria-hidden="true">→</span></button>
      {stage === 'code' ? <button className="text-button" type="button" onClick={() => { setStage('phone'); setCode(''); setMessage(''); }}>更换手机号</button> : null}
      <small>继续即代表你同意平台服务条款与隐私规则。我们不采集身份证信息。</small>
    </form>
  );
}
