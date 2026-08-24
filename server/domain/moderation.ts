export type ModerationDecision = 'reject' | 'review' | 'publish';

const blockedPatterns = [/代开.*发票/i, /出售.*账号/i, /博彩|赌球|裸聊/i];
const reviewPatterns = [/加我微信/i, /高收益|稳赚不赔/i, /站外交易/i];

export function moderateText(input: string): ModerationDecision {
  const text = input.normalize('NFKC').trim();
  if (blockedPatterns.some((pattern) => pattern.test(text))) return 'reject';
  if (reviewPatterns.some((pattern) => pattern.test(text))) return 'review';
  return 'publish';
}
