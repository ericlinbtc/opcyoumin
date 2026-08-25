# 可观测性、SLO 与告警验收

更新日期：2026-08-25

## 已接入的代码边界

- Web 进程通过 OpenTelemetry 注册 `youmin-web` 服务，Next.js 请求异常以 JSON 记录方法、路径、路由类型和 digest。
- `/health` 用于存活检查；`/ready` 并行检查 PostgreSQL 和 Redis，返回 release SHA、instance ID 与 `no-store` 头。
- Worker 对任务使用处理状态、尝试次数、下次可用时间、最后错误和死信表。死信入队时向平台管理员发通知。
- 管理写操作保留 actor、request ID、IP 哈希、before/after 和目标，审计表禁止 UPDATE/DELETE。

## 必备看板和告警

| 类别 | 指标 | 告警条件 |
| --- | --- | --- |
| Web | 请求量、5xx、p50/p95/p99、实例与 release SHA | 5xx 5 分钟 > 2%；p95 10 分钟 > 2s；同时存在多 SHA |
| 数据库 | 连接数、慢 SQL、锁等待、副本延迟、存储 | 连接 > 80%；慢 SQL 突增；存储 > 75% |
| Redis | 内存、命中率、连接、驱逐、延迟 | 任何驱逐；内存 > 80%；连续健康检查失败 |
| Worker | pending/processing/failed 数量、最旧任务年龄、重试和死信 | 死信 > 0；最旧 pending > 5 分钟；处理中锁超时连续发生 |
| 媒体 | 预签名、回调、审核、复制、清理成功率 | 审核积压 > 15 分钟；清理失败进死信；签名 5xx > 1% |
| 业务 | 发布、评论、报名、申请、工单成功率与限流数 | 任一核心写成功率 < 98%；限流较 7 日基线突增 3 倍 |

## 演练与责任

- staging 每季度演练一次数据库断开、Redis 断开、OSS 回调失败、Worker 死信和错误版本回滚。
- 每次演练记录告警触发时间、响应人、恢复时间、遗留风险和 artifact 链接。
- 联系人、SLS/ARMS 工作区 ID 和告警群必须由部署环境配置，不得在代码库使用真实手机号或密钥。
