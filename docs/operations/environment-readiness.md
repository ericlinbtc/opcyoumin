# 环境就绪与阻塞清单

## 本机与 CI 的职责

本机最小开发版本由 `.nvmrc`、`.tool-versions` 和 `packageManager` 固定为 Node.js 24、pnpm 11.19、Terraform 1.15.9、k6 2.2.0；应用依赖统一为 PostgreSQL 16、Redis 7。`pnpm env:check` 检查日常开发入口，`pnpm env:check:release` 额外要求 Docker、Terraform 和 k6。

本机没有 Docker、Terraform 或 k6 时，不再阻塞静态开发：CI 的 `infrastructure-and-images` job 会执行 Terraform init/validate、k6 inspect 和 web/worker 双镜像构建。但以下动作必须有真实环境，代码仓库无法替代：

- PostgreSQL/Redis 集成与迁移执行；
- ACR 推送与 Trivy 镜像扫描；
- 阿里云 RAM、VPC、RDS、Tair、OSS、SAE、SLS 的 plan/apply；
- staging 真实 OSS、短信供应商连通性、负载测试与部署后多实例采样；
- WAF/CDN/ALB、证书、告警联系人、成本告警和 RDS 恢复演练。

## 可重复的本地数据底座

本地安装 Docker 后，从 `.env.example` 复制 `.env.local`，保留 compose 中仅用于本机的 PostgreSQL/Redis 地址，并为所有签名、加密和 pepper 字段生成至少 32 字符的随机值。不要把 `.env.local` 提交到 Git。

```bash
pnpm stack:prepare
pnpm dev
pnpm worker
```

`stack:prepare` 会依次启动 PostgreSQL 16 与 Redis 7、等待健康检查、执行全部迁移、写入种子数据，再验证迁移表、城市种子和 Redis PING。数据库、种子或 Redis 任一环节不完整时命令会失败。单独复验可运行 `pnpm stack:verify`，结束后运行 `pnpm stack:down`；如需同时删除本地卷，必须由操作者明确执行 `docker compose down --volumes`。

数据库迁移、种子、Worker 和管理员初始化脚本均会自动读取存在的 `.env.local`，CI 中仍优先使用工作流显式注入的环境变量。

在连接依赖前先执行配置门禁。检查器只打印变量名和状态，不打印变量值：

- `pnpm config:check:core`：数据库、Redis、会话、手机号加密/哈希和请求 IP 哈希所需变量。
- `pnpm config:check:media`：在 core 基础上增加 OSS、公开媒体域名和内容安全变量。
- `pnpm config:check:production`：在 media 基础上增加 Server Actions 构建密钥、完整发布 SHA、SAE 实例身份和备案号，并要求所有公开 URL 使用 HTTPS。

`missing`、`placeholder`、`placeholder-host`、`too-short`、`invalid-url`、`invalid-sha`、`invalid-base64-key` 或 `https-required` 都必须修正后才能继续。production 会拒绝 localhost 和 `.example`、`.invalid`、`.localhost`、`.test` 保留域名。不要为了通过检查而把 secret 写入仓库；本地使用 `.env.local`，远端使用 GitHub Environment 和 SAE Secret。

### 2026-08-24 本机实况

- 系统 shell 默认没有 Node 命令；本轮通过 Codex 工作区 Node 24.19.0 完成验证。
- pnpm 11.19.0 可用。
- Docker 不可用；PostgreSQL/Redis 未启动；`.env.local` 不存在。
- Terraform 1.15.9 和 k6 2.2.0 使用官方临时二进制完成配置验证，不代表本机已永久安装。
- 因此 `/health` 为 200，而 `/ready` 正确返回 503；所有 PostgreSQL/Redis/真实 OSS 测试仍需 CI 或 staging。

## GitHub Environment 必需配置

staging 和 production 必须建立独立 GitHub Environment；production 开启 required reviewers。不要复用两套环境的密钥或 Terraform state。

镜像发布 secrets：`ACR_REGISTRY`、`ACR_USERNAME`、`ACR_PASSWORD`、`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`。后者必须是 base64 编码的 16/24/32 字节 AES 密钥，并在同一构建的所有实例间一致。

镜像发布 environment variables：`APP_URL`、`NEXT_PUBLIC_ICP_RECORD`、`NEXT_PUBLIC_ICP_LINK`。这些值会在 Next.js 构建时固化到 metadata、robots 或客户端页脚；不能只在 SAE 运行时补配。production 的 `APP_URL` 必须是唯一 HTTPS origin，备案号不能为空，备案链接必须是 HTTPS URL。

Terraform secrets：`ALIBABA_CLOUD_ACCESS_KEY_ID`、`ALIBABA_CLOUD_ACCESS_KEY_SECRET`、`TF_HTTP_ADDRESS`、`TF_HTTP_LOCK_ADDRESS`、`TF_HTTP_UNLOCK_ADDRESS`、`TF_HTTP_USERNAME`、`TF_HTTP_PASSWORD`、`TF_VAR_RDS_PASSWORD`、`TF_VAR_TAIR_PASSWORD`、`TF_VAR_APP_ENVIRONMENT_JSON`、`ENVIRONMENT_TFVARS_JSON`。HTTP backend 必须支持状态锁，禁止在临时 runner 使用 local state apply。

验证 secrets：`DEPLOYMENT_BASE_URL`；压测再加 `LOAD_TEST_BASE_URL`、`LOAD_TEST_SECRET`、`LOAD_PHONE_START`。staging 的 `LOAD_TEST_ENABLED` 平时也应关闭，仅在已审批窗口临时启用。

## 生产配置硬门禁

Terraform 会拒绝没有完整 SHA 镜像标签、少于两个 web 实例或缺失必要运行变量的生产 apply。生产还必须提供真实的域名/证书、Ingress、WAF、CDN、告警联系人、成本告警、RDS 恢复演练证据，并确认 OSS 私有回源已配置。示例中的 `REPLACE_ME` 不是完成状态。
