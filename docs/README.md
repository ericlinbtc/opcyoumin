# OPC 文档导航与口径

- [首发产品规格](product/launch-spec.md)：范围、角色、状态机和业务规则。
- [全链路完成度审计](acceptance/full-stack-verification-2026-08-24.md)：当前完成度、实际证据和剩余事项的唯一状态源。
- [开发验收摘要](acceptance/development-acceptance.md)：面向交付的简版验收结论。
- [项目补充开发完成与验收清单](acceptance/project-completion-acceptance-2026-08-25.md)：逐项对应 2026-08-25 缺口清单的完成状态、入口和验证证据。
- [全站验收报告](acceptance/full-site-acceptance-2026-08-25.md)：本地、浏览器、生产包和发布准备度的通过项、未通过项、整改步骤与复验标准。
- [六项整改执行进度](acceptance/remediation-progress-2026-08-25.md)：六项整改的已完成内容、真实阻塞、当前证据和下一步执行顺序。
- [项目待开发与待补充清单](audit/project-development-gap-audit-2026-08-25.md)：本轮开发前的 24 项审计基线。
- [测试与验收策略](testing/test-strategy.md)：质量门禁和压测指标。
- [关键业务自动化](testing/critical-scenarios.md)：已有自动化、剩余测试和 staging OSS 操作。
- [环境就绪清单](operations/environment-readiness.md)：本机、CI、GitHub Environment 与真实云配置边界。
- [发布运行手册](operations/release-runbook.md)：镜像、Terraform、部署验证、压测、灰度和回滚步骤。
- [发布证据模板](operations/release-evidence-template.md)：每次发布必须填写的实际证据。
- [生产架构](architecture/production-architecture.md)：生产架构与服务目标。
- [缓存与一致性](architecture/cache-and-consistency.md)：多实例缓存边界、失效和一致性验收。
- [数据保留与账号注销](operations/data-retention-and-account-deletion.md)：数据保留矩阵、匿名化和清理流程。
- [可观测性与告警](operations/observability-and-alerting.md)：指标、SLO、告警和值班演练要求。

文档状态必须区分“代码已开发”“本地验证通过”“CI 通过”“staging 通过”和“production 已执行”。工作流、Terraform 模板或测试脚本存在，不等于真实环境已经通过。
