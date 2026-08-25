import type { ReactNode } from 'react';

function inline(value: string): ReactNode[] {
  const parts = value.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (!match) return part;
    return <a href={match[2]} key={`${match[2]}-${index}`} target="_blank" rel="noreferrer">{match[1]}</a>;
  });
}

export function RichText({ body }: { body: string }) {
  const lines = body.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (!list.length) return;
    blocks.push(<ul key={`list-${blocks.length}`}>{list.map((item, index) => <li key={`${item}-${index}`}>{inline(item)}</li>)}</ul>);
    list = [];
  };
  lines.forEach((raw) => {
    const line = raw.trim();
    if (line.startsWith('- ')) { list.push(line.slice(2)); return; }
    flushList();
    if (!line) return;
    if (line.startsWith('### ')) blocks.push(<h3 key={`h3-${blocks.length}`}>{inline(line.slice(4))}</h3>);
    else if (line.startsWith('## ')) blocks.push(<h2 key={`h2-${blocks.length}`}>{inline(line.slice(3))}</h2>);
    else if (line.startsWith('> ')) blocks.push(<blockquote key={`quote-${blocks.length}`}>{inline(line.slice(2))}</blockquote>);
    else blocks.push(<p key={`p-${blocks.length}`}>{inline(line)}</p>);
  });
  flushList();
  return <>{blocks}</>;
}
