# 云发布就绪审计

审计日期：2026-08-25  
仓库：`ericlinbtc/opcyoumin`  
分支：`codex/acceptance-remediation-20260825`  
审计提交：`5055357fc4123c5d0e5c1734945ef68cbe6f72fa`

## 结论

代码与 GitHub CI 已通过，但云发布配置尚未开始，当前不能触发有效的 ACR 发布、Terraform plan/apply、SAE 部署复验或负载测试。

远端只读审计结果：

| 项目 | 实际状态 |
| --- | --- |
| GitHub `staging` Environment | 不存在 |
| GitHub `production` Environment | 不存在 |
| Repository Actions secrets | 0 个 |
| Repository Actions variables | 0 个 |
| 当前分支 PR | 不存在 |
| 最新分支 CI | 通过：[run 32822571826](https://github.com/ericlinbtc/opcyoumin/actions/runs/32822571826) |
| 本机 `.env.local` | 不存在 |
| 本机 release 工具 | Node/pnpm 通过；Docker、Terraform、k6 未安装 |
| Terraform 离线 plan | staging/production 均通过：各 17 add、0 change、0 destroy |

Secrets 和 Variables 必须配置在各自的 GitHub Environment，不应写入仓库、remote URL、提交记录或普通日志。`staging` 与 `production` 必须使用独立凭据和独立 Terraform state；production 还必须配置 required reviewers。

离线 plan 已固化到 `scripts/validate-terraform-plans.sh` 和 CI。它会复制不含 HTTP backend 的临时配置，使用明确标注的 plan-only fixtures、假凭据和 `-refresh=false` 生成两套 plan，并拒绝任何 delete action。该结果只证明配置能形成 provider 执行计划，不证明阿里云账号权限、地域库存、价格、远端 state 或实际 apply 可用。

## 每个 Environment 必需配置

### Environment variables（3 个）

| 名称 | 用途与门禁 |
| --- | --- |
| `APP_URL` | 唯一公开 origin，必须是无路径 HTTPS URL |
| `NEXT_PUBLIC_ICP_RECORD` | staging 可按实际情况填写；production 必须是正式备案号且不能为空 |
| `NEXT_PUBLIC_ICP_LINK` | 必须是 HTTPS URL |

这些值在镜像构建时固化，不能只在 SAE 运行时补配。

### Environment secrets（19 个）

镜像发布：

- `ACR_REGISTRY`
- `ACR_USERNAME`
- `ACR_PASSWORD`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`：base64 编码的 16、24 或 32 字节 AES 密钥，同一版本所有实例必须一致

Terraform 与远端锁状态：

- `ALIBABA_CLOUD_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_ACCESS_KEY_SECRET`
- `TF_HTTP_ADDRESS`
- `TF_HTTP_LOCK_ADDRESS`
- `TF_HTTP_UNLOCK_ADDRESS`
- `TF_HTTP_USERNAME`
- `TF_HTTP_PASSWORD`
- `TF_VAR_RDS_PASSWORD`
- `TF_VAR_TAIR_PASSWORD`
- `TF_VAR_APP_ENVIRONMENT_JSON`
- `ENVIRONMENT_TFVARS_JSON`

部署复验：

- `DEPLOYMENT_BASE_URL`

批准窗口压测：

- `LOAD_TEST_BASE_URL`
- `LOAD_TEST_SECRET`
- `LOAD_PHONE_START`

## Terraform 输入必须具备的真实值

`ENVIRONMENT_TFVARS_JSON` 必须由对应环境的真实值生成，至少包括：

- `environment`、`region`、两个可用区
- 同一完整 40 位 SHA 的 web/worker ACR 镜像 URL
- 唯一 OSS Bucket、公开 HTTPS origins、唯一 SLS Project
- 当前地域真实可售的 RDS PostgreSQL 16 和 Tair 7 规格
- staging/production 独立资源命名和 tags

production 还必须提供非占位的：

- 正式域名、证书 ID、Ingress ID、WAF policy ID、CDN 域名
- 告警联系人组、成本告警 ID、最近隔离恢复演练证据 URI
- 已验证 OSS 私有回源的 `oss_private_origin_configured=true`
- `web_replicas >= 2`

`TF_VAR_APP_ENVIRONMENT_JSON` 是 SAE 环境变量数组。production 至少必须包含以下名称，值必须来自 Secret Manager 或等价受控来源：

- `APP_URL`
- `ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET`
- `ALIYUN_OSS_BUCKET`、`ALIYUN_OSS_REGION`
- `DATABASE_URL`、`REDIS_URL`
- `MEDIA_CONTENT_SAFETY_ENDPOINT`、`MEDIA_CONTENT_SAFETY_TOKEN`、`MEDIA_PUBLIC_BASE_URL`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- `NEXT_PUBLIC_ICP_LINK`、`NEXT_PUBLIC_ICP_RECORD`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `PHONE_ENCRYPTION_KEY`、`PHONE_HASH_PEPPER`
- `REQUEST_IP_HASH_PEPPER`、`SESSION_SIGNING_SECRET`
- `RELEASE_SHA`

## 可执行顺序

1. 创建 `staging` 与 `production` GitHub Environment；production 配置 required reviewers。
2. 由阿里云账号负责人准备 RAM 最小权限凭据、ACR、远端 Terraform state/lock 服务和目标域名资料。
3. 分别录入上述 19 个 Secret 与 3 个 Variable；录入后只核对名称和更新时间，不读取或输出值。
4. 从 `main` 或已批准的 staging 来源提交触发 `Release immutable image`。production 工作流只允许 `main`；两环境均要求当前 SHA 的 `verify` 与 `infrastructure-and-images` 成功。
5. 归档 web/worker Trivy artifact、SBOM/provenance 和 ACR digest；把 digest 回填发布证据记录。
6. 更新 `ENVIRONMENT_TFVARS_JSON` 中同一 SHA 的两个镜像 URL，先执行 `Terraform environment` 的 `plan`，人工复核资源数量、规格、费用和删除风险后再执行 `apply`。
7. 数据迁移、web 与 Worker 稳定后，运行 `Post-deploy verification`；要求 `/ready` 为 200、30 次样本全部为同一 SHA，并至少观察到两个 web 实例。
8. 在批准窗口临时开启负载入口，依次执行 smoke/release；随后关闭入口并执行真实 OSS E2E。
9. staging 全部证据通过后，才允许创建 production 变更单并进入 10%→50%→100% 灰度。

## 当前不可执行项

以下动作缺少真实账号、凭据、资源 ID、域名/备案或审批，不能由仓库状态替代：

- ACR 登录、扫描后推送与 digest 归档
- Terraform 远端 state 初始化、plan/apply
- SAE/RDS/Tair/OSS/SLS 实际创建或变更
- 正式短信、内容安全、OSS 私有回源验收
- 部署后多实例复验、真实压测、告警/恢复/回滚演练
- ICP/公安备案与法务签署

所有实际证据填写到 `docs/operations/release-evidence-template.md`；未执行项必须保留“未执行/阻塞”，不能用示例值或计划截图标记通过。
