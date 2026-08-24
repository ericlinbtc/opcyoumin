# 测试与验收策略

- 单元测试：RBAC、状态机、内容规则、手机号隐私、限流和领域服务；核心领域覆盖率 ≥ 80%。
- 集成测试：使用独立 PostgreSQL/Redis，覆盖迁移、事务、唯一约束、报名并发、会话撤销和 OSS 回调验签。
- E2E：登录、加入城市、发帖、评论、关注、报名、取消报名、举报、审核、误删恢复。
- 安全：IDOR、XSS、CSRF、SQL 注入、验证码枚举、短信滥用、MIME 欺骗、超大文件、OSS 回调伪造。
- 体验：360/390/768/1280/1440 像素视口，键盘导航、焦点顺序、表单错误、无阻塞级 WCAG 问题。
- 性能：k6 场景覆盖登录、城市列表、动态流、评论和活动报名；结果与发布 SHA 一起归档。

当前自动化入口：`pnpm test:coverage` 执行纯领域覆盖率门禁，`pnpm test:e2e` 在桌面、手机和四个固定视口执行公开路由、CSRF、响应式和 axe WCAG 验收；CI 配置 PostgreSQL 16 与 Redis 7，用于额外执行手机号登录、城市/动态/评论/活动/治理/Worker/媒体等集成闭环。只有远端 job 实际全绿，才能记录为 CI 通过。

`pnpm test:load` 默认执行短时 smoke；设置 `LOAD_PROFILE=release` 后执行发布压测：公共页面、城市动态流和评论流为 100 RPS / 15 分钟，登录事务、评论写入和活动报名/取消各为 5 RPS / 5 分钟。写场景使用固定测试数据 ID 和独立手机号段，调用与产品端相同的登录后事务、评论服务和报名服务。它不发送真实短信，短信供应商通道与防滥用规则由集成/E2E 单独验证。

压测接口默认关闭。只允许在隔离的 staging 压测窗口设置 `LOAD_TEST_ENABLED=true`、至少 32 位的 `LOAD_TEST_SECRET`，并同时提供同源 `Origin`、密钥和登录会话。执行前创建 `artifacts/load`，并设置 `RELEASE_SHA`；k6 会先拒绝目标 SHA 不一致的环境，再将环境 URL、阈值与完整指标写到 `LOAD_RESULT_JSON`（默认 `artifacts/load/summary.json`）。发布压测必须由工作流归档结果，不能用终端截图代替证据；结束后关闭压测入口并重置专用 staging 测试数据。

任何 Critical/High 安全问题、P0/P1 缺陷或核心 E2E 失败都会阻塞生产发布。

覆盖率百分比只代表 `server/domain/**/*.ts` 和 `lib/phone.ts`，不得写成全项目覆盖率。当前剩余自动化缺口和最新执行结果见 `critical-scenarios.md` 与验收审计文档。
