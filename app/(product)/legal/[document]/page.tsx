import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { legalDocuments, type LegalDocumentKey } from '@/features/catalog/legal';
import { createPageMetadata } from '@/lib/seo';

function getDocument(value: string) {
  return value in legalDocuments ? legalDocuments[value as LegalDocumentKey] : null;
}

export function generateStaticParams() {
  return Object.keys(legalDocuments).map((document) => ({ document }));
}

export async function generateMetadata({ params }: { params: Promise<{ document: string }> }): Promise<Metadata> {
  const { document } = await params;
  const item = getDocument(document);
  return item ? createPageMetadata({ title: `${item.title}｜游民`, description: item.description, canonical: `/legal/${document}` }) : {};
}

export default async function LegalDocumentPage({ params }: { params: Promise<{ document: string }> }) {
  const item = getDocument((await params).document);
  if (!item) notFound();
  return <main className="information-page"><header><Link className="back-link" href="/">← 返回首页</Link><small>{item.eyebrow}</small><h1>{item.title}</h1><p>{item.description}</p></header><div className="information-page-body">{item.sections.map((section, index) => <section key={section.title}><span>{String(index + 1).padStart(2, '0')}</span><div><h2>{section.title}</h2><p>{section.copy}</p></div></section>)}</div></main>;
}
