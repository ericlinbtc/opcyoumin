# 阿里云 Terraform

每个环境使用独立、支持锁的 HTTP state backend 与独立 `tfvars`。先在目标地域控制台确认 PostgreSQL/Tair 规格和两个可用区，再替换示例值。临时 runner 禁止使用 local state apply。

```bash
TF_HTTP_ADDRESS=... TF_HTTP_LOCK_ADDRESS=... TF_HTTP_UNLOCK_ADDRESS=... terraform init
terraform validate
terraform plan -var-file=staging.tfvars
terraform apply -var-file=staging.tfvars
```

凭据通过 `ALIBABA_CLOUD_ACCESS_KEY_ID`、`ALIBABA_CLOUD_ACCESS_KEY_SECRET` 或 RAM Role/OIDC 提供。数据库密码、Redis 密码和 SAE 环境变量必须通过 `TF_VAR_*` 或远端密钥系统注入，禁止放入 `.tfvars` 或 CI 日志。

`app_environment_json` 是 SAE 接收的 `[{"name":"KEY","value":"VALUE"}]` 数组。生产会校验数据库、Redis、会话/手机号/IP 密钥、OpenTelemetry、`RELEASE_SHA` 和 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 等变量名存在。OSS CORS 只接受显式 HTTPS origin。

SAE 的 ALB/WAF/CDN、ACR EE 采购、域名证书和 ICP 具有账号与主体依赖，按 `docs/operations/release-runbook.md` 在账号开通后接入。基础模块用真实资源 ID 和演练证据作为 production apply 硬门禁；源站访问控制必须在域名切流前完成。
