# 缓存与多实例一致性

当前公开业务数据以 PostgreSQL 为唯一事实来源。仓库暂未启用 ISR 或持久化 Cache Components；仓库层的 React `cache` 仅用于同一次服务器渲染内去重，不会在 SAE 多实例间保留旧数据。写入后使用 `revalidatePath` 使当前 Next.js 页面数据重新读取。

| 数据 | 事实来源 | 当前缓存 | 一致性要求 |
| --- | --- | --- | --- |
| 会话、限流 | Redis + PostgreSQL 会话状态 | Redis TTL | 撤销后下次请求失效 |
| 城市、动态、活动、政策 | PostgreSQL | 请求内去重 | 写入事务提交后新请求可见 |
| 报名和成员计数 | PostgreSQL 事务 | 无持久缓存 | 关系表和计数在同一事务更新 |
| 通知和媒体审核 | PostgreSQL Outbox | 无 | 最终一致，必须使用幂等键和死信 |

如后续引入 ISR、`use cache` 或 CDN 长 TTL，必须先接入远程 cache handler/标签失效消息，并在两个及以上实例验证发布、隐藏、报名、通知已读的可见时延。未完成该验收前，不得为动态业务路由配置长时间 CDN 缓存。
