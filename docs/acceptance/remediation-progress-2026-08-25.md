# 六项整改执行进度与下一步

更新日期：2026-08-25

结论：**第 1 项已完成并本地复验通过；第 2～5 项的仓库侧准备已完成或已具备，但真实 staging/阿里云/主体证据尚未执行；第 6 项首轮扩面已完成。当前仍不能判定生产上线验收通过。**

本文件只记录已经实际执行的结果。工作流、Terraform、脚本或文档存在，不代表阿里云环境已经验收通过。

## 状态总览

| 顺序 | 整改项 | 当前状态 | 本轮结果 | 尚欠的通过条件 |
| --- | --- | --- | --- | --- |
| 1 | canonical/noindex、后台未登录日志 | 已通过 | 路由级 SEO metadata、登录页 noindex、后台服务端 redirect 已完成；单元和 E2E 通过 | 无 |
| 2 | PostgreSQL/Redis/迁移/Worker 数据底座 | 仓库已准备，环境未通过 | 增加本地栈和依赖验证命令，迁移、种子、Worker 均支持 `.env.local` | 在隔离 staging 启动 PostgreSQL 16、Redis 7、web、Worker，并使 `/ready` 为 200 |
| 3 | 登录后业务、后台权限、真实 OSS | 自动化已准备，真实环境未通过 | 非短信业务不再被 Redis/SMS 开关阻塞；OSS 用例补齐私有原图、公开审核图、头像更新断言 | 在 staging 执行 13 项集成测试、非短信登录态 E2E、后台角色 E2E 和真实 OSS E2E |
| 4 | commit、CI、镜像、Terraform、SAE、单 SHA | 本地已提交，远端发布未通过 | 已核对单 SHA、双镜像、Trivy、Terraform 锁、30 次部署采样门禁；整改已提交到安全集成分支 | 使用有权限的 GitHub 身份推送分支；远端 CI 全绿；推送 ACR；Terraform apply；SAE 多实例同 SHA 验证 |
| 5 | 域名备案、压测、监控灾备、法务 | 未通过 | 仓库已有 k6、告警/恢复要求、发布证据模板 | 必须由阿里云账号和主体负责人执行并提供真实 ID、artifact、签署记录 |
| 6 | 关键模块自动化与全站复验 | 本地首轮已通过，云链路待补 | coverage 从领域层/手机号扩大到安全、HTTP、SEO、负载鉴权、媒体策略和 OSS 回调；全量浏览器回归通过 | staging 后把 actions、repositories、Worker 的数据库执行覆盖纳入正式报告并重新全站复验 |

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

当前未通过证据：

- 当前机器没有 Docker、PostgreSQL 或 Redis 服务。
- 没有 `.env.local`，`DATABASE_URL` 和 `REDIS_URL` 未配置。
- 因此当前不能证明 `/ready`、生产数据页和 Worker 在真实依赖下正常。

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

当前未通过证据：

- Vitest：52 项通过，13 项 PostgreSQL 集成测试跳过。
- Playwright：70 项中 54 项通过、16 项环境跳过、0 失败。16 项包含 desktop/mobile 重复执行的后台、登录后业务和 OSS；其中短信登录 2 项属于明确暂缓范围。

明确下一步：

1. 完成第 2 项后运行 `pnpm test:integration`，要求 13 项全部执行并通过。
2. 配置临时测试会话，运行 `pnpm test:e2e`；除明确暂缓短信和移动端重复 OSS 外不得再跳过。
3. 配置 staging OSS、内容安全和 Worker，运行 `pnpm test:staging:oss`。
4. 用普通用户、编辑、城市管理员、平台管理员复验城市作用域和后台模块边界；测试后撤销会话与测试数据。

## 4. 单一 SHA 发布

已核对的仓库能力：

- CI 包含迁移、种子、类型检查、Lint、coverage、build、E2E、生产依赖 audit、Terraform validate、k6 inspect 和 web/worker 镜像构建。
- release workflow 要求当前 SHA 的 CI 成功，双镜像使用完整 40 位 SHA，不可变推送前执行 Trivy HIGH/CRITICAL 阻断，并生成 SBOM/provenance。
- Terraform 强制 web/worker 镜像包含同一 `release_sha`，production 具备必需变量与资源 ID 门禁。
- 部署验证会采样 30 次 `/health`，同时检查 `/ready`、单一 SHA 和最少实例数。
- 镜像构建现在显式接收目标环境 `APP_URL`、备案号和备案链接；production 发布在构建前要求 HTTPS origin 和非空备案号，避免只在 SAE 运行时配置 `NEXT_PUBLIC_*` 导致客户端仍显示空值。
- Terraform production 运行变量门禁已加入 OSS、内容安全、公开媒体域名和备案变量；全部 workflow 通过 actionlint 1.7.12，Terraform 1.15.9 `fmt/init/validate` 通过。
- 使用生产形态变量构建 standalone 后，实测 robots Host/Sitemap、登录页 canonical/noindex、页脚备案号、`/health` 发布 SHA 和实例 ID 均与输入一致。

当前未通过证据：

- 本轮改动已审阅并提交到 `codex/acceptance-remediation-20260825`，工作区干净，可形成可追溯的本地完整 SHA。
- 原本地 `main` 与 GitHub `main` 因相同代码被不同作者身份重写而形成 21/7 历史分叉；树内容核对为完全一致。集成分支直接基于 GitHub `main`，不会要求强推主分支。
- 本机没有 `gh`，HTTPS remote 也没有可用 GitHub 凭据；分支推送明确失败，远端没有发生变化。因此本轮 SHA 尚无远端 CI 结果。
- `pnpm env:check:release` 显示 Docker、Terraform、k6 未安装。
- 没有远端 CI run、ACR digest、Terraform state/apply 或 SAE 部署 artifact。

明确下一步：

1. 使用已授权的 GitHub 身份推送 `codex/acceptance-remediation-20260825`；不要强推 `main`，也不要把访问令牌写入 remote URL 或仓库。
2. 等待同一 commit SHA 的 `verify` 和 `infrastructure-and-images` 两个 CI job 全绿。
3. 在 GitHub `staging` Environment 配置 reviewer 和 secrets，触发 immutable image、Terraform plan/apply。
4. 部署后运行 `Post-deploy verification`，staging/production 按要求观察至少两个 web 实例。
5. 把 CI、镜像 digest、Trivy、Terraform 和 deployment JSON 填入发布证据记录。

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

## 6. 自动化覆盖与本地最终复验

本轮已扩大 coverage 范围：

- `lib/client-ip.ts`、`lib/csrf.ts`、`lib/http.ts`、`lib/phone.ts`、`lib/seo.ts`
- `server/domain/**/*.ts`
- `server/jobs/job-policy.ts`
- `server/load-test-auth.ts`
- `server/media/upload-policy.ts`
- `server/oss-callback.ts`

新增负载测试入口的启用状态、同源校验、密钥校验、会话要求测试，以及 API 成功/错误响应和请求 ID 契约测试。Worker 的载荷校验、5 次死信阈值、指数退避上限和错误文本上限已拆成独立策略并纳入 coverage；数据库中的任务领取、幂等写入和死信落库继续由 staging 集成测试验证。

发布配置质量门禁也已补强：所有 workflow 已使用 actionlint 1.7.12 校验通过；镜像发布、Terraform、压测和部署复验均按目标环境设置并发组，禁止同一环境的两次操作并行竞争。

本地最终结果：

| 命令 | 结果 |
| --- | --- |
| `pnpm typecheck` | 通过 |
| `pnpm lint` | 通过，0 warning |
| `pnpm test:coverage` | 52 通过、13 跳过；statements 95.86%、branches 95.95%、functions 100%、lines 97.47% |
| `pnpm build` | Next.js 16.3.2 production build 与 standalone 准备通过 |
| `pnpm test:e2e` | 54 通过、16 环境跳过、0 失败 |
| `pnpm audit --prod` | 无已知生产依赖漏洞 |
| `git diff --check` | 通过 |

下一轮 coverage 优先顺序：授权与城市 IDOR、关键 Server Actions、repository 事务和计数、Worker 任务领取/死信落库/幂等、账号注销。只有 staging 数据测试真正执行后，才能把这些数据库路径计入验收，而不是靠扩大 include 制造低价值数字。

## 最终放行标准

只有以下条件同时满足，才可把结论改为“全站生产验收通过”：

1. staging `/ready` 为 200，13 项数据库集成测试和所有非暂缓业务 E2E 执行通过。
2. 真实 OSS、内容安全、Worker 生命周期和权限边界通过。
3. 同一 40 位 SHA 的 CI、双镜像、Terraform、SAE、多实例验证全部可追溯。
4. 域名备案、压测、监控告警、恢复回滚和法务签署证据齐全。
5. 手机号/真实短信继续由产品负责人书面批准暂缓，或恢复范围后单独完成验收。
