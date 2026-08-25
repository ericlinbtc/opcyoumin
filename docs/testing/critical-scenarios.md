# 关键业务自动化测试

## 默认 CI 的实际结构

CI 启动 PostgreSQL 16 和 Redis 7、执行全部迁移与种子数据后，依次运行类型检查、lint、Vitest coverage、构建、Playwright 和生产依赖 audit。数据库集成用例在没有 `DATABASE_URL` 的开发机上自动跳过，在 CI 中必须真实执行。第二个 job 独立验证 Terraform、k6 release profile 和 web/worker Docker 镜像。

当前已有自动化证据覆盖：

- 管理员角色修改、城市管理员作用域和平台模块越权访问；
- 动态编辑/删除、评论回复、举报—审核—申诉恢复；
- 点赞、收藏、分享、投票、关注、屏蔽和计数幂等；
- 活动创建—审核—取消、取消报名、最后一个名额的并发争抢；
- 上传大小/MIME/对象归属、OSS 回调公钥 URL、回调幂等和媒体审核 Worker；
- 会话撤销、通知已读、注销申请、Worker 重试和死信通知；
- IDOR、XSS、SQL/对象注入、验证码枚举、伪造 Origin 和 OSS 回调攻击；
- 数据库唯一约束、迁移文件连续性和仅增量的应用回滚兼容契约；
- 360、768、1280、1440 像素视口的横向溢出和主标题裁切回归。

机构申请—审批—入会—退出—重申、帮助工单回复—解决—通知、活动签到/缺席和注销内容匿名化已经进入 PostgreSQL 集成测试。仍需补充的独立场景：

- 机构、帮助工单、注销匿名化和死信重放/忽略的浏览器 E2E；
- 390px 精确视口；
- 更完整的 SQL/对象注入字典、超大请求体和验证码高频滥用负载；
- 真实环境的数据库迁移回滚与恢复演练。

截至 2026-08-24，远端公开 API 仍只显示旧失败 CI run `32729229546`。新增/修复用例只有在当前改动推送且两个 CI job 全绿后，才能记为远端通过。

## 真实 OSS staging 验证

默认 CI 使用确定性的 OSS 签名和内容安全替身，避免测试依赖公网云资源。发布到 staging 后，使用专用测试账号和短期会话运行真实链路：

```bash
E2E_REAL_OSS=true \
E2E_BASE_URL=https://staging.example.com \
E2E_SESSION_COOKIE='short-lived-test-session' \
DATABASE_URL='staging-read-write-test-database' \
MEDIA_PUBLIC_BASE_URL=https://media-staging.example.com \
pnpm exec playwright test e2e/staging-media.spec.ts --project=desktop-chromium
```

该用例会真实上传一张最小 PNG，等待 OSS 回调和 Worker 审核，最后读取公开媒体 URL。会话必须是可随时删除的 staging 专用账号，禁止使用生产用户会话。

手机号/短信暂缓期间，不阻塞其他登录后 E2E：除短信登录用例外，测试通过数据库创建隔离账号和短期会话。只有显式设置 `E2E_SMS_LOGIN=true` 且提供 Redis 时才执行短信登录用例；生产发布前如该功能仍在范围外，应在发布证据中记录批准人和恢复验收条件。
