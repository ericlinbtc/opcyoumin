# OPC 全链路运行、完成度与剩余事项审计

审计日期：2026-08-24
最后同步：2026-08-24（完成 3.2、3.3、4.2、5.2、5.3、6.1、6.2 开发后）

审计范围：最终首页原型、正式产品路由、认证与业务写入、治理后台、测试、压测、本地运行、镜像、Terraform、发布与真实云环境。

状态口径：

- `✅ 已完成`：代码存在，且本轮有本地静态、测试、构建或浏览器证据。
- `🟡 已开发待环境验证`：代码和自动化入口已存在，但本轮缺少 PostgreSQL/Redis、Docker、云账号或环境密钥，不能声明真实链路通过。
- `⏸ 外部上线事项`：必须在真实 staging/production 或由运营、法务、云账号完成，仓库不能替代。
- `⚠ 明确保留例外`：产品已明确暂不开发或仅用于本地演示。

## 1. 当前结论

3.2、3.3、4.2、5.2 中记录的主要代码缺口已经补齐：最终首页能够读取真实城市、动态、活动、成员、机构与个人数据，并调用真实加入城市、发帖、评论、互动、关注、报名、申请、资料和帮助工单动作；政策、个人记录、活动、管理后台也有正式 URL。权限、治理、媒体、通知、死信、注销和平台管理员初始化已经形成业务闭环及自动化用例。

工程侧已经补齐 k6 写场景、版本统一、standalone 启动、环境诊断、镜像扫描、Terraform 远端状态流程、部署后多实例校验和发布证据模板。

当前仍不能标记为“正式上线”，原因已经从大面积代码缺口收敛为三类：

1. 首页手机号弹层仍是 `localStorage` 本地演示登录，这是此前明确排除的功能；正式 `/login` 才连接真实短信、Redis 和数据库会话。
2. 本机没有 `.env.local`、Docker、PostgreSQL/Redis 服务和真实阿里云配置，因此数据库相关测试、真实短信/OSS、Docker 镜像和完整压测没有在本机实跑。
3. 新增 CI、镜像、Terraform、部署校验和压测工作流尚无新的远端运行记录；真实云资源、备案、告警、恢复与灰度证据仍缺失。

## 2. 本轮实际证据

| 检查项 | 结果 | 本轮证据 |
|---|---|---|
| TypeScript | ✅ | `tsc --noEmit` 通过 |
| ESLint | ✅ | 0 warning |
| 单元测试与领域覆盖率 | ✅ | 10 个测试文件、37 项通过；statements 84.78%、branches 84.61% |
| 数据库相关 Vitest | 🟡 | 3 个文件、10 项因本机无 `DATABASE_URL` 按设计跳过 |
| 生产构建 | ✅ | Next.js 16.3.2 build 成功，24 个静态页面生成完成 |
| standalone | ✅ | `pnpm start` 已改为运行 `.next/standalone/server.js`；本轮实际启动成功 |
| `/health` | ✅ | 200，并返回 `x-release-sha`、`x-instance-id`、`cache-control: no-store` |
| `/ready` | 🟡 | 本机缺数据库/Redis时正确返回 503；真实环境待验证 200 |
| 浏览器公开页面 | ✅ | 应用内浏览器打开首页、`/cities`、`/policies`、`/help`、`/login`，无 console error/warning |
| 浏览器 E2E | ✅ / 🟡 | 32 passed、16 skipped；跳过项均需要 PostgreSQL/Redis 或真实 OSS |
| 生产依赖审计 | ✅ | `pnpm audit --audit-level high --prod` 未发现已知漏洞 |
| k6 脚本 | ✅ 配置验证 | k6 2.2.0 inspect 通过；release 为读取 100 RPS/15 分钟，登录、评论、报名各 5 RPS/5 分钟 |
| k6 真实结果 | ⏸ | 尚无 staging 100 RPS 报告 artifact |
| Terraform | ✅ 配置验证 | Terraform 1.15.9 init/validate 通过；AliCloud provider 锁定 1.285.0 |
| Terraform plan/apply | ⏸ | 没有真实账号、远端 state secrets 和环境 tfvars 的执行记录 |
| Docker 镜像 | 🟡 | CI 已配置双镜像构建；本机无 Docker，尚无本轮 ACR digest/Trivy artifact |
| 远端 GitHub Actions | ❌ 仍是旧记录 | 公开 API 只返回旧 CI run `32729229546`，结论为 failure；本轮工作流尚未提交并执行 |

覆盖率只统计 `server/domain/**/*.ts` 与 `lib/phone.ts`，84.78% 不能解释为全仓库覆盖率。

## 3. 3.2 可见业务功能同步

| 功能 | 当前状态 | 说明 |
|---|---|---|
| 首页手机号弹层 | ⚠ 保留例外 | 仍使用 `localStorage` 和任意验证码，仅用于本地演示；真实入口是 `/login` |
| 加入/退出城市 | ✅ 已接入 | 数据库模式调用城市 membership action；本地无数据库时使用演示回退 |
| 发布动态和媒体 | ✅ / 🟡 | 动态调用真实 action；媒体使用 OSS 预签名、回调与审核，真实 OSS 待 staging |
| 回复、点赞、收藏、分享、投票 | ✅ 已接入 | 统一校验会话和目标状态，并维护数据库计数 |
| 关注成员与屏蔽 | ✅ 已接入 | 写入 follows/blocks，并有通知与集成场景 |
| 活动报名与取消 | ✅ 已接入 | 复用事务服务，唯一键和条件更新防止重复与超卖 |
| 个人资料与头像 | ✅ / 🟡 | 资料持久化；头像真实 OSS 发布待 staging |
| OPC 认证申请 | ✅ 已接入 | 有数据表、提交 action、个人进度和后台审批 |
| 机构申请 | ✅ 已接入 | 有机构目录、申请记录、个人进度和后台审批 |
| 帮助工单 | ✅ 已接入 | `/help` 和首页均写入 help tickets，后台可处理 |

## 4. 3.3 原型入口同步

- 政策卡片已进入 `/policies/[policyId]`，展示发布机关、文号、日期、解读与官方来源。
- “我的动态/收藏/申请”管理入口已进入正式 `/me/*` 路由；活动记录进入正式活动详情。
- 首页状态通过 URL query 与 `popstate` 恢复，支持刷新、前进/后退和分享当前视图；正式内容仍使用独立 App Router URL。
- 数据库模式下首页从 `/api/prototype/*` 读取真实城市统计、动态、活动、机构、成员和个人记录；本地无数据库时保留明确的演示数据。
- ICP 由部署环境变量控制；条款、隐私、风险和商务说明已形成页面，但最终法务定稿与备案号仍是外部上线事项。

## 5. 4.2 业务逻辑缺口同步

以下旧缺口已完成：

- 发帖要求城市成员资格；城市管理员操作受城市作用域约束。
- 普通用户可申请活动发起资格，后台审批后创建活动。
- 互动、投票与举报统一验证目标存在和可操作状态。
- 动态读取返回真实互动计数。
- 举报、moderation case、申诉、内容隐藏与恢复形成状态机，并记录审计与通知。
- 运行时权限从 roles 表加载，后台权限配置能够生效。
- 死信有后台查看、重放/忽略、审计和管理员告警。
- 注销有申请、会话撤销、后台保留评估、匿名化和完成状态。
- 平台管理员有一次性安全初始化脚本和操作手册。
- Worker 已覆盖治理、媒体、账号与活动通知；媒体可对接真实内容安全服务。
- OPC 申请、机构申请、帮助工单和政策来源追溯已经开发。

仍需继续关注的代码/产品事项：

1. 首页本地手机号弹层与真实 `/login` 并存，容易让验收人员误把演示登录当生产登录。若继续保留，必须始终显示“本地登录/不会发送短信”；生产可考虑直接跳转正式登录。
2. 首页无数据库时会显示完整静态演示内容和个人记录，验收文档必须区分 demo mode 与 database-connected mode。
3. 应用、工单、注销完成、死信后台操作虽然已有实现，但缺少覆盖这些后台闭环的独立 E2E。
4. 多实例共享缓存未引入自定义远端 cache handler；当前代码没有使用 `use cache`，上线后若引入 ISR/Cache Components，必须先补 Tair/远端缓存与跨实例失效测试。

## 6. 5.2 自动化覆盖同步

已补自动化：

- 管理员角色修改、城市作用域与平台模块越权。
- 动态编辑/软删除、评论回复、IDOR、XSS、投票与互动计数。
- 活动创建/审核/取消、报名取消和最后名额并发。
- 举报、审核、申诉、moderation case 与内容恢复。
- 会话撤销、通知已读、注销申请。
- Worker 正常处理、重试、死信与管理员告警。
- 媒体大小/MIME/对象键、回调幂等、自动审核和头像发布替身链路。
- 短信验证码错误、同源校验、OSS 回调攻击边界和迁移契约。
- 360、768、1280、1440 视口回归，以及桌面/手机公开路由和 axe 扫描。

仍缺或只部分覆盖：

- OPC/机构申请、帮助工单、后台处理和通知的完整 E2E。
- 注销后台完成与匿名化结果、死信重放/忽略的 E2E。
- 真实阿里云短信成功链路、真实 OSS 内容安全与公开读取。
- 完整 SQL 注入/对象注入字典、超大请求体和高频验证码滥用的独立安全扫描。
- 390px 精确视口项目；当前有 360、Pixel 7、768、1280、1440。
- 数据库迁移回滚演练；当前只验证迁移连续性和向后兼容契约，不执行破坏性 rollback。

## 7. 5.3 压测同步

`tests/load/community-smoke.js` 与测试策略现已一致：

- 公共页面、城市动态流、动态评论流：release 100 RPS / 15 分钟。
- 登录后账号/会话事务：5 RPS / 5 分钟。
- 评论写入：5 RPS / 5 分钟。
- 活动报名与取消：5 RPS / 5 分钟。
- 读取 p95 < 500ms；登录和写入 p95 < 800ms；失败率 < 1%；checks > 99%。
- 执行前校验 `/ready` 和目标完整 SHA，结果写入带环境、SHA 和完整指标的 JSON artifact。
- 写接口默认 404，仅在审批窗口启用，并要求同源、32 位密钥与真实会话。

尚未完成的是“真实执行证据”，不是脚本：需要 staging 数据、审批窗口和 GitHub Environment secrets 后运行 `Approved load test`，并归档 smoke/release 两份报告。

## 8. 6.1 当前环境状态

- 系统 shell 默认找不到 Node；本轮使用 Codex 工作区 Node 24.19.0 完成验证。
- pnpm 11.19.0 可用。
- 本机没有 Docker，也没有长期安装的 PostgreSQL/Redis 服务。
- 本机没有 `.env.local`，因此短信、OSS、OTLP、数据库和 Redis 均未连接。
- Terraform 1.15.9 与 k6 2.2.0 使用官方临时二进制完成 `validate/inspect`，但这不等于安装完成或真实环境执行。

这些限制不再阻塞静态开发和配置验证；数据库集成、镜像和云验证由 CI/环境工作流承担。没有 artifact 时仍必须保持“未验证”状态。

## 9. 6.2 配置和发布同步

已完成：

- README、compose、CI、Terraform 统一为 PostgreSQL 16 + Redis 7。
- Node 24、pnpm 11.19、Terraform 1.15.9、k6 2.2.0 固定在工具版本文件。
- 本地与容器都启动 Next.js standalone；静态资源自动复制到产物。
- GitHub Actions 升级到当前 Node 运行时版本，并新增 Terraform、k6 和双镜像 CI job。
- 镜像发布要求当前 SHA 的 CI 成功，生产只允许 main，Trivy 阻断 HIGH/CRITICAL，输出 SBOM/provenance 和扫描 artifact。
- Terraform 使用带锁 HTTP backend，plan/apply 要求环境审批、完整 SHA 与明确确认文本。
- OSS private ACL、CORS、版本控制和生命周期已配置；生产 apply 对域名、证书、Ingress、WAF、CDN、告警、成本、恢复演练与私有回源设硬门禁。
- Next.js 配置 deployment ID 和稳定 Server Action encryption key；部署后采样 30 次实例与 SHA，并检查 `/ready`。
- 已建立发布证据模板、灰度和回滚手册。

仍未完成：

1. 当前改动尚未提交/推送，远端 CI 没有新成功记录。
2. GitHub staging/production Environment、reviewer 与全部 secrets 尚无可验证证据。
3. ACR 镜像 digest、Trivy 报告、Terraform plan/apply、SAE 部署和多实例报告尚未产生。
4. ALB/Ingress、WAF、CDN/DCDN、域名证书、OSS 私有回源、SLS/ARMS 联系人和成本告警仍需真实账号配置。
5. RDS 隔离恢复、10%→50%→100% 灰度和实际回滚尚未演练。

## 10. 下一步顺序

### P0：先获得可信 CI 和 staging 证据

1. 提交并推送当前变更，等待 `CI / verify` 和 `infrastructure-and-images` 全绿。
2. 配置 staging GitHub Environment 和远端 state，运行镜像发布、Terraform plan/apply、迁移与部署后验证。
3. 在 staging 运行数据库/Redis 集成 E2E、真实 OSS E2E、k6 smoke/release，并归档 artifact。

### P1：补剩余自动化与产品边界

1. 为 OPC/机构申请、帮助工单、注销完成和死信操作增加独立集成/E2E。
2. 增加 390px 精确视口和更系统的安全负载测试。
3. 决定生产首页登录按钮是跳转 `/login`，还是保留明确隔离的 demo 弹层；不得让假登录进入生产验收口径。

### 上线前外部事项

完成备案、短信签名/模板、域名证书、内容安全、告警联系人、成本预算、备份恢复、灰度和法务定稿。以上缺一项，生产状态不得标记为“正式上线”。
