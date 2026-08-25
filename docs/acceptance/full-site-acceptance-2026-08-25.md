# 全站验收报告

验收日期：2026-08-25

验收环境：本地开发模式、本地 standalone 生产包；Node.js 24.19.0、pnpm 11.19.0

验收范围：首页、城市、动态、活动、机构、成员、知识、洞察、政策、帮助、法律页面、账号保护、后台保护、API 安全、SEO、数据库/Redis 就绪度、媒体链路、构建、测试和发布准备度。

范围约定：手机号登录和真实短信验证仍按产品要求暂缓，不作为本轮代码缺陷；但所有依赖登录态的业务仍需要通过测试账号或测试会话完成验收。

> 整改更新：F-05、F-06 已完成代码整改并通过本地复验；其余六项执行进度和最新测试数字见 `remediation-progress-2026-08-25.md`。本报告下方保留首次验收时的失败证据，便于追溯。

## 一、总体验收结论

**本地公开站点验收通过；全站生产上线验收未通过。**

当前版本可以正常编译、构建和启动。开发模式下的公开页面、响应式、无障碍、公开导航、404、访问控制和 sitemap 均通过。生产模式在没有 `DATABASE_URL`、`REDIS_URL` 等配置时只能启动进程，数据库驱动页面会进入错误页，`/ready` 返回 503；登录后业务、后台权限、真实 OSS、发布、压测、监控和灾备也没有真实环境证据。

此外发现两个需要代码整改的问题：

1. 多个页面错误继承首页 canonical，登录页缺少 `noindex`。
2. 未登录访问 `/admin` 虽然最终进入登录页，但页面并行渲染期间会抛出 `UNAUTHORIZED` 并记录为服务器错误。

在“未通过项”全部完成并复验前，不应把项目标记为可生产上线。

## 二、已验收通过

| 编号 | 验收项 | 结果与证据 |
| --- | --- | --- |
| P-01 | 本地工具基线 | `pnpm env:check` 通过；Node.js 24.19.0、pnpm 11.19.0 符合项目约束。 |
| P-02 | TypeScript | `pnpm typecheck` 退出码 0。 |
| P-03 | ESLint | `pnpm lint` 退出码 0，0 warning。 |
| P-04 | Git 差异格式 | `git diff --check` 通过，没有空白错误。 |
| P-05 | 生产依赖安全 | `pnpm audit --prod` 返回 `No known vulnerabilities found`。 |
| P-06 | 单元与领域测试 | 10 个测试文件通过、37 项测试通过；覆盖率 statements 84.78%、branches 84.61%、functions 100%、lines 84.21%，达到当前配置的 80% 阈值。 |
| P-07 | 数据库迁移契约 | 迁移连续性测试随 Vitest 通过；`0012`、`0013` 未发现误删历史 OPC/申请表的 SQL。真实数据库执行另见未通过项。 |
| P-08 | Next.js 生产构建 | Next.js 16.3.2 production build 通过，25 个静态页面生成完成，standalone 产物准备成功。 |
| P-09 | standalone 进程启动 | `pnpm start` 成功启动生产服务；首页和纯静态法律页正常。数据页面因缺少生产变量未通过，单独列为阻塞项。 |
| P-10 | 公开页面浏览器验收 | 30 个代表性路径均有有效内容、主标题和 `<main>`，无 Next.js 错误覆盖层、无横向溢出；包括首页、原型、城市五个标签、动态、活动、机构、成员、知识、洞察、政策、帮助、五个法律页、登录、404。 |
| P-11 | 公开页面 E2E | Playwright 共 66 项：50 项通过、16 项按环境跳过、0 项执行失败。公开浏览和保护测试在桌面端与移动端均通过。 |
| P-12 | 响应式 | 360、768、1280、1440 视口下，首页、城市、活动、机构、政策、帮助、登录页无横向溢出或主标题裁切。 |
| P-13 | 无障碍 | 首页、城市、活动、机构、知识、洞察、政策、帮助、登录页在桌面和移动端均无 axe serious/critical 问题。 |
| P-14 | sitemap 全量存活 | sitemap 共 716 个 URL，逐一请求结果为 716 个 HTTP 200、0 个失败。 |
| P-15 | robots 与基础 SEO 文件 | `/robots.txt` 和 `/sitemap.xml` 均返回 200；原型、后台、个人中心和 API 已设置爬虫限制。canonical 问题另列。 |
| P-16 | 公开详情 SEO | 城市、成员、动态、知识、洞察、政策详情页的标题、描述和显式 canonical 抽查通过。 |
| P-17 | 未登录访问保护 | `/me` 和 `/admin` 最终进入 `/login`；账号导出 API 返回 401，没有泄露账号数据。后台错误日志问题另列。 |
| P-18 | 请求来源防护 | 伪造 Origin 调用媒体预签名接口返回 403；E2E 中伪造 Origin 调用短信发送接口也返回 403。 |
| P-19 | 健康检查 | `/health` 返回 200，并包含服务、实例和请求 ID。发布 SHA 当前为 `unknown`，另列为部署阻塞项。 |
| P-20 | 政策外链 | 当前公开页面提取到的国务院政策原文链接以浏览器 User-Agent 请求返回 200。 |
| P-21 | 现有视觉风格 | 浏览器实测新增页面继续使用现有导航、字体、边框、色块和卡片体系，没有发现整体风格偏移。 |

## 三、未通过项及明确整改方案

### F-01　生产数据依赖未就绪（P0）

**状态：未通过。**

证据：

- 工作区没有 `.env.local`。
- `/ready` 返回 503，响应明确为 `database: false`、`redis: false`。
- standalone 生产模式访问城市、活动、机构、政策和帮助页时显示“页面暂时无法加载”，服务器记录 `Missing production environment variables: DATABASE_URL`。

怎么做：

1. 准备隔离的 staging PostgreSQL 16 和 Redis 7，不要直接使用生产库做首次验收。
2. 从 `.env.example` 建立 staging 环境变量，至少配置 `DATABASE_URL`、`REDIS_URL`、`SESSION_SIGNING_SECRET`、`PHONE_ENCRYPTION_KEY`、`PHONE_HASH_PEPPER`、`REQUEST_IP_HASH_PEPPER`、`APP_URL`。
3. 所有 secret 使用随机值并放入 GitHub Environment/SAE Secret，不写入仓库。
4. 执行 `pnpm db:migrate`、`pnpm db:seed`，再启动 web 和 worker。
5. 检查 `/ready`、城市列表、活动、机构、政策和帮助页。

复验通过标准：

- `/ready` 连续返回 200，database/redis 均为 true。
- production standalone 或 staging 上的数据页面全部正常展示，日志中没有缺失环境变量错误。
- 迁移前后表、索引、种子数据和计数抽样一致。

### F-02　登录后核心业务和后台权限没有执行（P0）

**状态：未通过/未具备条件。**

证据：

- 3 个 PostgreSQL 集成测试文件跳过，共 13 项测试未执行。
- E2E 中管理员权限 4 项、登录后社区业务 10 项均因没有 PostgreSQL/Redis 跳过。
- 未实际验收城市加入、发动态、编辑/删除、投票、分层评论、活动报名/取消、通知、会话撤销、注销申请、管理员角色和城市作用域。

怎么做：

1. 先完成 F-01。
2. 在 staging 使用隔离测试数据；手机号/真实短信仍可不纳入本轮，其他测试通过 `createAuthenticatedUser` 或受控测试会话完成。
3. 运行 `pnpm test:integration`。
4. 配置 `E2E_BASE_URL`；如使用预置会话，配置临时 `E2E_SESSION_COOKIE`，测试后立即撤销。
5. 运行 `pnpm test:e2e`，并分别用平台管理员、城市管理员、编辑和普通用户复验权限边界。

复验通过标准：

- 13 项数据库集成测试不再跳过并全部通过。
- 除明确暂缓的短信登录用例和移动端重复 OSS 用例外，其余 E2E 全部执行并通过。
- 城市管理员不能读取或操作非管理城市数据，普通用户不能进入后台。

### F-03　真实 OSS、内容安全和媒体生命周期未验收（P0）

**状态：未通过/未具备条件。**

证据：真实 staging 媒体 E2E 2 项均跳过；当前没有 OSS、内容安全、公开媒体域名和测试会话配置。

怎么做：

1. 建立 staging OSS Bucket，配置最小权限 RAM、CORS、回调地址、生命周期和私有原图策略。
2. 配置 `ALIYUN_OSS_REGION`、`ALIYUN_OSS_BUCKET`、`ALIYUN_OSS_ENDPOINT`、`MEDIA_PUBLIC_BASE_URL`、`MEDIA_CONTENT_SAFETY_ENDPOINT`、`MEDIA_CONTENT_SAFETY_TOKEN`。
3. 启动 Worker，设置 `E2E_REAL_OSS=true`、`E2E_BASE_URL`、`E2E_SESSION_COOKIE` 和 `DATABASE_URL`。
4. 运行 `pnpm test:staging:oss`，再人工验证通过、拒绝、超时、重复回调和清理任务。

复验通过标准：上传成功后原图不公开；审核通过只展示 `publicKey`；拒绝状态可见；超时/注销对象能被 Worker 幂等清理；测试报告归档。

### F-04　生产发布环境与版本没有固化（P0）

**状态：未通过。**

证据：

- `pnpm env:check:release` 失败，Docker、Terraform、k6 均不可用。
- 部署验证脚本返回 `passed: false`；发布版本为 `unknown`，`/ready` 为 503。
- 当前 Git 工作区仍有大量未提交修改和新增文件，没有本轮远端 CI、镜像 digest 或云部署记录。

怎么做：

1. 先审阅并提交当前工作区变更，使用完整 40 位 commit SHA 作为唯一发布版本。
2. 推送分支并确保 CI 的类型检查、Lint、测试、Terraform validate、k6 inspect、web/worker 镜像构建和 Trivy 扫描全部通过。
3. 在 staging/production GitHub Environment 配置独立 secrets、reviewer 和远端 Terraform state。
4. 构建并推送同一 SHA 的 web/worker 镜像，设置 `RELEASE_SHA` 和 `SAE_INSTANCE_ID`。
5. 完成 Terraform plan/apply、SAE 部署，然后执行 `pnpm release:verify -- <URL> <SHA> <实例数> <证据文件>` 对应的脚本调用。

复验通过标准：生产至少两个 web 实例；30 次健康采样均为同一 SHA；`/ready` 为 200；web/worker 镜像 digest、Trivy、Terraform、部署验证 artifact 可追溯。

### F-05　canonical 和登录页索引策略错误（P1，代码问题）

**状态：未通过。**

证据：根布局在 `app/layout.tsx` 固定 `alternates.canonical: '/'`。本次检查的城市列表、活动列表/详情、机构列表/详情、知识/洞察/政策列表、帮助和五个法律页均错误输出 `https://opcyoumin.com`；登录页没有 `noindex`。

怎么做：

1. 移除根布局的全局 canonical，或确保所有可索引路由都在自己的 metadata 中覆盖。
2. 为 `/cities`、`/activities`、活动详情、`/organizations`、机构详情、`/knowledge`、`/insights`、`/policies`、`/help` 和法律页配置与当前路径一致的 canonical。
3. 给 `/login` 设置 `robots: { index: false, follow: false }`；根据运营决定帮助页是否索引。
4. 为活动和机构详情补充 canonical 回归测试，并增加列表页 SEO 自动化。

复验通过标准：每个公开页面 canonical 等于其生产 URL；登录、后台、个人中心、原型不进入索引；sitemap 中的 URL 与 canonical 一致。

### F-06　未登录访问后台产生错误日志（P1，代码问题）

**状态：未通过。**

证据：访问 `/admin` 最终进入登录页，但 `app/(product)/admin/page.tsx:16` 的 `requireSession` 与布局并行执行，先抛出 `UNAUTHORIZED`；服务器写入 `next_request_error`，原始 `/admin` 请求日志为 200。

怎么做：

1. 不要在后台页面把预期的未登录状态作为普通异常抛出。
2. 将页面中的 `requireSession` 改为 `readSession` 后使用 Next.js `redirect('/login')`，或建立专门的页面授权 helper，未登录/无权限分别执行服务端 redirect。
3. 保留 Server Action/API 中的异常式授权和审计，但页面导航应使用 redirect 语义。
4. 增加 `/admin` 未登录、普通用户、编辑、城市管理员、平台管理员的响应和日志测试。

复验通过标准：未登录访问 `/admin` 直接重定向登录页；服务器不再记录 `next_request_error`；后台内容不泄露；角色权限 E2E 全部通过。

### F-07　生产域名、备案和发布身份未配置（P1）

**状态：未通过/未具备条件。**

证据：本地 `robots.txt` 的 Host/Sitemap 指向 `http://localhost:3001`，`/health` 的 release 为 `unknown`，ICP备案字段为空。

怎么做：设置生产 `APP_URL`、`RELEASE_SHA`、`SAE_INSTANCE_ID`、`NEXT_PUBLIC_ICP_RECORD` 和备案链接；配置正式域名、DNS、HTTPS 证书、ALB/Ingress、WAF、CDN/DCDN 和 OSS 私有回源。

复验通过标准：robots、sitemap、canonical、Open Graph 均使用唯一 HTTPS 生产域名；健康检查返回实际 SHA 和实例 ID；页面展示有效备案号且链接正确。

### F-08　压测、监控、告警、备份和回滚没有真实证据（P1）

**状态：未通过/未具备条件。**

怎么做：

1. 安装 k6 2.2.0 或在 CI 使用固定版本，按批准窗口执行读 100 RPS、写 5 RPS 和持续 15 分钟的 release profile。
2. 接入 SLS/ARMS/OTLP，建立 HTTP、数据库、Redis、短信、OSS、Worker、队列/死信和业务转化指标。
3. 配置告警联系人、SLO、成本告警，实际触发一次告警演练。
4. 执行 RDS 隔离恢复、Tair 恢复/重建、10%→50%→100% 灰度和 web/worker 回滚演练。

复验通过标准：k6 阈值全部通过；告警能在约定时间送达；恢复达到已批准 RPO/RTO；灰度和回滚有时间、指标、负责人和 artifact。

### F-09　全仓库自动化覆盖率尚不足以代表“全站”（P2）

**状态：未通过（质量完整性）。**

证据：`vitest.config.ts` 的 coverage 只统计 `server/domain/**/*.ts` 和 `lib/phone.ts`。84.78% 是该小范围覆盖率，不是 actions、repositories、API、Worker 和页面的全仓库覆盖率。

怎么做：逐步把 `server/services`、关键 repositories、Server Actions、API routes 和 Worker 纳入 coverage；优先覆盖授权、IDOR、事务计数、重试/死信、请求体上限和账号注销。对纯页面渲染继续使用 Playwright/axe，不盲目追求单元覆盖数字。

复验通过标准：发布清单中的核心业务模块全部有自动化；coverage 报告明确统计范围且核心服务达到团队批准阈值；不能再用领域层覆盖率代表全仓库。

### F-10　手机号登录与真实短信验收仍暂缓（范围外）

**状态：按产品要求未验收，不计为本轮代码缺陷。**

恢复该项时需要配置短信签名、模板、AccessKey、Redis 限流，验证发送、校验、过期、重放、错误次数、手机号/IP 配额和供应商故障降级。正式通过标准是生产短信模板审核完成，staging/production 均有脱敏日志和限流证据，且验证码不出现在生产响应或日志中。

### F-11　法务与运营签署未完成（外部门禁）

**状态：未通过/未具备条件。**

现有服务条款、隐私政策、风险提示、注销和数据保留文档可以展示，但还需要法务确认个人信息清单、处理目的、第三方服务、保存期限、未成年人规则、用户权利、客服时限和版本生效流程。

复验通过标准：法务/运营负责人签署版本号与生效日期；网站展示版本与归档版本一致；变更有通知和历史记录。

## 四、建议整改顺序

1. **先修代码问题**：F-05 canonical/noindex、F-06 后台未登录错误日志。
2. **建立 staging 数据底座**：F-01 PostgreSQL/Redis/环境变量/迁移/Worker。
3. **执行完整业务验收**：F-02 登录后业务与后台权限、F-03 OSS 媒体链路。
4. **固化发布版本**：F-04 commit、CI、镜像、Terraform、SAE、单一 SHA 验证。
5. **完成上线保障**：F-07 域名备案、F-08 压测监控灾备、F-11 法务签署。
6. **持续补强质量**：F-09 扩大关键模块自动化覆盖；手机号/短信在产品恢复范围后执行 F-10。

## 五、复验命令清单

```bash
pnpm env:check:release
pnpm typecheck
pnpm lint
pnpm test:coverage
pnpm build
pnpm test:integration
pnpm test:e2e
pnpm test:staging:oss
```

真实部署后还必须运行 deployment verification、k6 release profile、真实 OSS E2E，并填写 `docs/operations/release-evidence-template.md`。只有本报告 F-01～F-09、F-11 全部复验通过，且 F-10 继续被正式批准为暂缓项时，才可给出“全站生产验收通过”的结论。
