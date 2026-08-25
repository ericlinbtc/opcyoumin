# 六项整改执行进度与下一步

更新日期：2026-08-25

结论：**第 1 项已通过；第 2、3、6 项已在 GitHub CI 的 PostgreSQL 16、Redis 7 和浏览器环境中通过，第 3 项仅剩真实 OSS/内容安全；第 4 项已完成远端 CI，但 ACR、Terraform apply 和 SAE 尚未执行；第 5 项仍需真实阿里云与主体证据。当前仍不能判定生产上线验收通过。**

本文件只记录已经实际执行的结果。工作流、Terraform、脚本或文档存在，不代表阿里云环境已经验收通过。

## 状态总览

| 顺序 | 整改项 | 当前状态 | 本轮结果 | 尚欠的通过条件 |
| --- | --- | --- | --- | --- |
| 1 | canonical/noindex、后台未登录日志 | 已通过 | 路由级 SEO metadata、登录页 noindex、后台服务端 redirect 已完成；单元和 E2E 通过 | 无 |
| 2 | PostgreSQL/Redis/迁移/Worker 数据底座 | CI 已通过，staging 未通过 | CI 已启动 PostgreSQL 16/Redis 7，完成配置门禁、迁移、种子和数据库集成测试 | 在隔离 staging 启动托管数据库、Redis、web、Worker，并使 `/ready` 为 200 |
| 3 | 登录后业务、后台权限、真实 OSS | CI 业务通过，真实 OSS 未通过 | 真实数据库/Redis 下 SMS 开发码登录、登录后业务、后台角色与城市权限 E2E 已通过；OSS 用例完善 | 配置 staging OSS、内容安全和 Worker，执行 2 项被明确跳过的真实媒体 E2E |
| 4 | commit、CI、镜像、Terraform、SAE、单 SHA | GitHub CI 已通过，云发布未通过 | 分支已推送；工作流、Terraform、k6、双生产镜像构建及全量 verify 全绿 | 推送不可变 ACR 镜像；Terraform apply；SAE 多实例同 SHA 验证并归档证据 |
| 5 | 域名备案、压测、监控灾备、法务 | 未通过 | 仓库已有 k6、告警/恢复要求、发布证据模板 | 必须由阿里云账号和主体负责人执行并提供真实 ID、artifact、签署记录 |
| 6 | 关键模块自动化与全站复验 | CI 已通过，云链路待补 | 66 项 coverage 测试、68 项浏览器 E2E、生产构建和生产依赖审计通过，无 flaky；Worker 租约防重已由 PostgreSQL 集成测试覆盖 | staging 后补真实 OSS、Worker 外部媒体生命周期、压测与部署后全站复验 |

## 1. 代码问题整改

已完成：

- 新增统一页面 metadata helper，为城市、活动、机构、知识、洞察、政策、帮助、法律及详情页输出与路由一致的 canonical 和 Open Graph URL。
- `/login` 输出 `noindex, nofollow`。
- `/admin` 未登录访问改为读取会话后服务端重定向，不再把正常未登录状态抛成 `UNAUTHORIZED` 服务器错误。
- 新增 SEO 回归测试，并把后台未登录重定向加入浏览器测试。

本地复验：

- SEO 单元测试通过。
- desktop/mobile canonical 与 noindex E2E 通过。
- `/admin` 未登录重定向 E2E 通过，测试服务器未再出现对应 `next_request_error`。

## 2. staging 数据底座

已完成的仓库工作：

- `pnpm stack:up`：启动 PostgreSQL 16 与 Redis 7。
- `pnpm stack:prepare`：启动依赖、执行迁移、种子并验证。
- `pnpm stack:verify`：检查 PostgreSQL/Redis 连接、Drizzle 迁移记录和城市种子数据。
- `db:migrate`、`db:seed`、`worker`、`admin:bootstrap` 自动读取可选 `.env.local`。
- 增加 `config:check:core`、`config:check:media`、`config:check:production`，在连接服务前识别缺失值、仓库示例值、弱 secret、无效 URL/SHA/Server Actions 密钥和 production 非 HTTPS/保留域名；检查过程不输出变量值。CI 已执行 core 配置门禁。

CI 已通过证据：

- GitHub Actions 使用 PostgreSQL 16 与 Redis 7 服务容器，`config:check:core`、`db:migrate`、`db:seed` 和 13 项数据库集成测试均已执行通过。
- 这证明仓库迁移、种子和测试业务能在干净依赖中运行，但服务容器不是阿里云 staging。

当前未通过证据：

- 尚无隔离 staging 的 RDS/Tair 连接证据、`/ready` 连续探测结果或 Worker 运行日志。
- 当前机器仍未配置用于真实环境的 `.env.local`、`DATABASE_URL` 和 `REDIS_URL`。

明确下一步：

1. 在隔离 staging 配置 PostgreSQL 16、Redis 7 和 `.env.local`/SAE Secrets。
2. 执行 `pnpm stack:prepare`，或在托管服务上依次执行 `pnpm db:migrate`、`pnpm db:seed`、`pnpm stack:verify`。
3. 启动 web 和 Worker，连续检查 `/ready` 为 200，且 database/redis 均为 true。
4. 抽查城市、活动、机构、政策、帮助页以及迁移前后表/索引/种子计数。

## 3. 登录业务、后台与 OSS

已完成的自动化整改：

- 只有设置 `E2E_SMS_LOGIN=true` 且配置 Redis 时才运行短信登录用例；手机号/真实短信继续按产品决定暂缓。
- 其他登录后业务只依赖 PostgreSQL，可通过测试账号/受控测试会话执行。
- 真实 OSS 用例现在验证 `originalKey` 与 `publicKey` 不同、原图不能公开读取、审核图可公开读取、审核完成后页面头像确实切到 `publicKey`。
- CI 保留开发验证码测试，不调用真实短信供应商。

CI 已通过证据：

- Vitest：17 个测试文件、66 项测试全部通过；PostgreSQL 集成测试已在 CI 执行，不再跳过。
- Playwright：70 项中 68 项通过、2 项跳过、0 失败、0 flaky。开发验证码登录实际创建 PostgreSQL 账号和会话，并使用 Redis 验证码状态；后台角色、城市权限和登录后业务均通过桌面/移动端复验。
- 2 项跳过均来自 `staging-media.spec.ts`，原因是 CI 没有真实 staging URL、测试会话和真实 OSS 配置。

当前未通过证据：

- CI 使用开发验证码，不调用真实阿里云短信供应商。
- 尚无真实 OSS 私有原图、内容安全审核、公开派生图和 Worker 完整生命周期证据。

明确下一步：

1. 配置 staging OSS、内容安全、Worker、临时测试会话和数据库访问，运行 `pnpm test:staging:oss`。
2. 核对原图不可公开读取、审核图可公开读取、头像引用公开 key，并归档 OSS/内容安全/Worker 日志。
3. 若手机号登录恢复为上线范围，使用已审核短信签名和模板单独执行真实短信验收；否则保留产品负责人的书面暂缓记录。

## 4. 单一 SHA 发布

已核对的仓库能力：

- CI 包含迁移、种子、类型检查、Lint、coverage、build、E2E、生产依赖 audit、Terraform validate、k6 inspect 和 web/worker 镜像构建。
- release workflow 要求当前 SHA 的 CI 成功，双镜像使用完整 40 位 SHA，不可变推送前执行 Trivy HIGH/CRITICAL 阻断，并生成 SBOM/provenance。
- Terraform 强制 web/worker 镜像包含同一 `release_sha`，production 具备必需变量与资源 ID 门禁。
- 部署验证会采样 30 次 `/health`，同时检查 `/ready`、单一 SHA 和最少实例数。
- 镜像构建现在显式接收目标环境 `APP_URL`、备案号和备案链接；production 发布在构建前要求 HTTPS origin 和非空备案号，避免只在 SAE 运行时配置 `NEXT_PUBLIC_*` 导致客户端仍显示空值。
- Terraform production 运行变量门禁已加入 OSS、内容安全、公开媒体域名和备案变量；全部 workflow 通过 actionlint 1.7.12，Terraform 1.15.9 `fmt/init/validate` 通过，staging/production plan-only fixtures 均可生成 17 add、0 change、0 destroy 的离线计划。
- 使用生产形态变量构建 standalone 后，实测 robots Host/Sitemap、登录页 canonical/noindex、页脚备案号、`/health` 发布 SHA 和实例 ID 均与输入一致。

GitHub 已通过证据：

- 分支 `codex/acceptance-remediation-20260825` 已推送到 GitHub；代码验收提交为 `1d313f1329423c4a6913a8e0c159c5b9d3eaaea2`。
- 原本地 `main` 与 GitHub `main` 因相同代码被不同作者身份重写而形成 21/7 历史分叉；树内容核对为完全一致。集成分支直接基于 GitHub `main`，不会要求强推主分支。
- [GitHub Actions CI 32815879160](https://github.com/ericlinbtc/opcyoumin/actions/runs/32815879160) 已通过：`infrastructure-and-images` 1 分 24 秒，`verify` 4 分 32 秒。
- [GitHub Actions CI 32819697065](https://github.com/ericlinbtc/opcyoumin/actions/runs/32819697065) 已通过提交 `b1e0158193cbb1ad312f717aa8356031f7198b34`：新增的 staging/production Terraform 离线 plan、生产镜像构建、完整应用验证与生产依赖审计全部成功。
- [GitHub Actions CI 32820975792](https://github.com/ericlinbtc/opcyoumin/actions/runs/32820975792) 已通过提交 `1c415a336c3c02430d070c5161e4c5cf60552fce`：迁移 `0014`、Worker 租约防重集成测试、66 项 Vitest、68 项浏览器 E2E、生产构建和双镜像构建全部成功。
- 远端已通过 actionlint、Terraform validate、k6 inspect、web/worker 生产镜像构建、迁移、种子、类型、Lint、coverage、production build、E2E 和生产依赖 audit。

当前未通过证据：

- `pnpm env:check:release` 在本机仍显示 Docker、Terraform、k6 未安装；远端只完成校验与镜像构建，没有发布云资源。
- 没有 ACR digest、Terraform state/apply 或 SAE 部署 artifact。
- GitHub 远端实况、19 个 Environment Secret、3 个 Environment Variable 和安全执行顺序见 `docs/acceptance/cloud-release-readiness-2026-08-25.md`。

明确下一步：

1. 在 GitHub `staging` Environment 配置 reviewer 和 secrets，触发 immutable image、Terraform plan/apply。
2. 部署后运行 `Post-deploy verification`，staging/production 按要求观察至少两个 web 实例。
3. 把 CI、ACR 镜像 digest、Trivy、SBOM/provenance、Terraform 和 deployment JSON 填入发布证据记录。

## 5. 上线保障

这一项不能仅靠本地代码完成，以下每一项都必须提供实际账号或主体证据：

- 正式 HTTPS 域名、DNS、证书、ICP备案/公安备案、WAF、CDN/DCDN、OSS 私有回源。
- `APP_URL`、`RELEASE_SHA`、`SAE_INSTANCE_ID`、有效备案号；robots、sitemap、canonical、Open Graph 使用同一生产域名。
- 经批准窗口执行 k6 smoke/release，阈值和 JSON artifact 归档。
- SLS/ARMS/OTLP 仪表盘、告警规则、联系人、一次真实告警演练。
- RDS 恢复点和隔离恢复演练、Tair 重建、10%→50%→100% 灰度、web/worker 回滚演练。
- 法务/运营签署的条款与隐私版本号、生效日期、个人信息清单和第三方处理说明。

本地已经证明生产形态变量可以正确进入构建产物，但测试备案号、测试 SHA 和本地实例身份仅用于验证传递链路，不代表真实域名已备案或阿里云已部署。

全部证据填写到 `docs/operations/release-evidence-template.md`；任何空项、示例值或“计划执行”都不能标记通过。

## 6. 自动化覆盖与最终复验

本轮已扩大 coverage 范围：

- `lib/client-ip.ts`、`lib/csrf.ts`、`lib/http.ts`、`lib/phone.ts`、`lib/seo.ts`
- `server/domain/**/*.ts`
- `server/jobs/job-policy.ts`
- `server/load-test-auth.ts`
- `server/media/upload-policy.ts`
- `server/oss-callback.ts`

新增负载测试入口的启用状态、同源校验、密钥校验、会话要求测试，以及 API 成功/错误响应和请求 ID 契约测试。Worker 的载荷校验、5 次死信阈值、指数退避上限和错误文本上限已拆成独立策略并纳入 coverage。迁移 `0014` 为任务增加唯一租约令牌；任务完成、重试和死信转换都必须匹配当前租约。PostgreSQL 集成测试已证明任务领取会生成租约、过期 Worker 无法写入通知或死信、重复完成不会产生第二次副作用。

发布配置质量门禁也已补强：所有 workflow 已使用 actionlint 1.7.12 校验通过；镜像发布、Terraform、压测和部署复验均按目标环境设置并发组，禁止同一环境的两次操作并行竞争。

最终 GitHub CI 结果：

| 命令 | 结果 |
| --- | --- |
| `pnpm typecheck` | 通过 |
| `pnpm lint` | 通过，0 warning |
| `pnpm test:coverage` | 66 通过、0 跳过；statements 95.86%、branches 95.95%、functions 100%、lines 97.47% |
| `pnpm build` | Next.js 16.3.2 production build 与 standalone 准备通过 |
| `pnpm test:e2e` | 68 通过、2 个真实 OSS 环境跳过、0 失败、0 flaky |
| `pnpm audit --prod` | 无已知生产依赖漏洞 |
| `infrastructure-and-images` | actionlint、Terraform、k6、web/worker 生产镜像全部通过 |

下一轮 coverage 优先顺序：其余关键 Server Actions、repository 查询过滤与事务计数、会话安全边界。数据库路径继续要求在 PostgreSQL 集成测试中执行，不能靠扩大 include 制造低价值数字。

## 最终放行标准

只有以下条件同时满足，才可把结论改为“全站生产验收通过”：

1. staging `/ready` 为 200，并在 staging 重新执行 13 项数据库集成测试和所有非暂缓业务 E2E。
2. 真实 OSS、内容安全、Worker 生命周期和权限边界通过。
3. 同一 40 位 SHA 的 CI、双镜像、Terraform、SAE、多实例验证全部可追溯。
4. 域名备案、压测、监控告警、恢复回滚和法务签署证据齐全。
5. 手机号/真实短信继续由产品负责人书面批准暂缓，或恢复范围后单独完成验收。
