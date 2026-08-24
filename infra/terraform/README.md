# 阿里云 Terraform

每个环境使用独立 state backend 与独立 `tfvars`。先在目标地域控制台确认 PostgreSQL/Tair 规格和两个可用区，再替换示例值。

```bash
terraform init
terraform validate
terraform plan -var-file=staging.tfvars
terraform apply -var-file=staging.tfvars
```

凭据通过 `ALIBABA_CLOUD_ACCESS_KEY_ID`、`ALIBABA_CLOUD_ACCESS_KEY_SECRET` 或 RAM Role/OIDC 提供。数据库密码、Redis 密码和 SAE 环境变量必须通过 `TF_VAR_*` 或远端密钥系统注入，禁止放入 `.tfvars` 或 CI 日志。

SAE 的 ALB/WAF/CDN、ACR EE 采购、域名证书和 ICP 具有账号与主体依赖，按 `docs/operations/release-runbook.md` 在账号开通后接入；源站访问控制必须在域名切流前完成。
