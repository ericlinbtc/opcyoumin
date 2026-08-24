# 发布、灰度、回滚与恢复手册

## 发布前门禁

1. ICP 已通过，域名实名、HTTPS、WAF、CDN/DCDN 和公安备案流程已完成或满足上线条件。
2. CI 的 typecheck、lint、unit、integration、E2E、build、生产依赖 audit 全部通过。
3. 数据库迁移在 staging 和生产快照副本演练通过；确认迁移向后兼容。
4. ACR 镜像使用提交 SHA 的不可变标签并完成漏洞扫描。
5. SLS/ARMS 告警、值班联系人、RDS 恢复点、上一版本镜像均已确认。

每次发布复制 `release-evidence-template.md` 建立独立记录。可执行顺序为：

1. 主分支 CI 全绿；运行 `Release immutable image`，输入目标环境并原样确认。工作流先本地构建、Trivy 阻断 HIGH/CRITICAL，再推送完整 SHA 标签和 SBOM/provenance。
2. 更新该环境 `ENVIRONMENT_TFVARS_JSON` 的两个镜像 URL；运行 `Terraform environment` 的 plan。复核后再以 apply 和完整 `environment/apply/SHA` 确认触发。production 必须经过 GitHub Environment 审批。
3. 迁移完成且 SAE 稳定后运行 `Post-deploy verification`。生产至少观察到两个不同实例、全部 30 个样本为同一 SHA 且 `/ready` 为 200。
4. staging 临时开启压测路由，运行 `Approved load test` 的 smoke 和 release，归档 JSON 后立即关闭路由；再运行真实 OSS E2E。
5. 只有上述 artifact、真实云控制 ID 和恢复演练证据齐全，才进入生产灰度。

## 灰度步骤

1. 生产内部账号验证 48 小时。
2. 在已绑定的 ALB/SAE Ingress 创建新 SHA 的金丝雀版本并承接 10% 流量，核对 5xx、登录成功率、p95、数据库连接与内容风险；记录实际规则/版本 ID。
3. 扩到 50% 并观察至少 24 小时，再运行一次部署多实例采样，确认无版本混跑。
4. 切到 100%，保留上一镜像、旧 Ingress 规则和发布前恢复点至少 7 天。

## 自动停止/回滚条件

- 5xx 连续 5 分钟 > 2%。
- 登录成功率 < 95%。
- 核心接口 p95 连续 10 分钟 > 2 秒。
- 任一越权、数据错写或不可恢复数据异常。

触发后停止扩流，SAE 切回上一不可变镜像；若迁移为向后兼容则保留数据库，否则先隔离写流量并按演练步骤恢复到发布前时间点。禁止在未确认写入影响时直接回滚数据库。

## 备份与恢复

- RDS 自动备份和日志备份满足 15 分钟恢复点；OSS 开启版本控制和生命周期。
- 每季度从备份恢复到隔离 VPC，执行表数量、关键外键、随机内容、登录与报名闭环校验。
- 目标：15 分钟内确认故障范围，30 分钟内完成流量回退，2 小时内恢复核心服务。

## 上线后

首周每日检查错误、延迟、发布失败率、报名失败率、审核队列和用户反馈；前四周稳定性与风控优先。每两周一个可验收版本，每月复盘注册转化、发布成功率、互动率、报名率和留存。
