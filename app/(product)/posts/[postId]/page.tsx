/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CommentComposer, PollControl, PostInteractionControls, ReplyControl, ReportControl } from '@/features/product-controls';
import { readSession } from '@/server/auth/session';
import { getPostViewerState, getPublicPost, getPublicPostPoll, listPostComments, listPublicPostMedia } from '@/server/repositories/public-content';

export async function generateMetadata({ params }: { params: Promise<{ postId: string }> }): Promise<Metadata> {
  const { postId } = await params;
  const post = await getPublicPost(postId);
  return post ? { title: `${post.title}｜游民`, description: post.body } : {};
}

export default async function PostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const post = await getPublicPost(postId);
  if (!post) notFound();
  const session = await readSession();
  const [comments, mediaItems, poll, viewerState] = await Promise.all([listPostComments(postId), listPublicPostMedia(postId), getPublicPostPoll(postId, session?.id), session ? getPostViewerState(session.id, postId) : { reacted: false, saved: false }]);
  return <main className="feed-detail-page"><header className="feed-detail-page-head"><Link href="/cities">← 返回城市</Link><small>{post.city} · 社区动态</small><h1>{post.title}</h1></header><article className="feed-detail-page-body"><Link className="author-row author-link" href={`/members/${post.authorId}`}><span className="avatar avatar-initial" aria-hidden="true">{post.author.slice(0, 1)}</span><span><strong>{post.author}</strong><small>{post.city}</small></span></Link><p className="feed-detail-copy">{post.body}</p>{mediaItems.length > 0 && <div className="post-media-grid">{mediaItems.map((item) => item.kind === 'video' ? <video key={item.id} controls preload="metadata" src={item.url} /> : <img key={item.id} src={item.url} alt="动态配图" loading="lazy" width={item.width ?? undefined} height={item.height ?? undefined} />)}</div>}{poll && (session ? <PollControl poll={poll} /> : <section className="post-poll"><h2>{poll.question}</h2>{poll.options.map((option) => <p key={option.id}>{option.label} · {option.votes} 票</p>)}<Link href="/login">登录后投票</Link></section>)}{session ? <><PostInteractionControls postId={postId} initiallyReacted={viewerState.reacted} initiallySaved={viewerState.saved} reactionCount={post.reactions ?? 0} saveCount={post.saves ?? 0} shareCount={post.shares ?? 0} /><ReportControl targetType="post" targetId={postId} /></> : <div className="feed-actions route-feed-stats"><span>{post.replies} 条回复</span><Link href="/login">登录后互动</Link></div>}<section className="feed-replies discussion-section"><div className="feed-detail-head"><strong>讨论 · {comments.length}</strong></div>{session && <CommentComposer postId={postId} />}{comments.length > 0 ? <div className="comment-list">{comments.map((comment) => <article key={comment.id}><h3><Link href={`/members/${comment.authorId}`}>{comment.author}</Link></h3><p>{comment.content}</p><time dateTime={comment.createdAt.toISOString()}>{comment.createdAt.toLocaleString('zh-CN')}</time>{session && <><ReplyControl postId={postId} parentId={comment.id} /><ReportControl targetType="comment" targetId={comment.id} /></>}</article>)}</div> : <p className="empty-state">还没有评论，欢迎开始讨论。</p>}</section></article></main>;
}
