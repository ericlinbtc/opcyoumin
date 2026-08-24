# OPC 文档导航与口径

- [首发产品规格](product/launch-spec.md)：范围、角色、状态机和业务规则。
- [全链路完成度审计](acceptance/full-stack-verification-2026-08-24.md)：当前完成度、实际证据和剩余事项的唯一状态源。
- [开发验收摘要](acceptance/development-acceptance.md)：面向交付的简版验收结论。
- [测试与验收策略](testing/test-strategy.md)：质量门禁和压测指标。
- [关键业务自动化](testing/critical-scenarios.md)：已有自动化、剩余测试和 staging OSS 操作。
- [环境就绪清单](operations/environment-readiness.md)：本机、CI、GitHub Environment 与真实云配置边界。
- [发布运行手册](operations/release-runbook.md)：镜像、Terraform、部署验证、压测、灰度和回滚步骤。
- [发布证据模板](operations/release-evidence-template.md)：每次发布必须填写的实际证据。
- [生产架构](architecture/production-architecture.md)：生产架构与服务目标。

文档状态必须区分“代码已开发”“本地验证通过”“CI 通过”“staging 通过”和“production 已执行”。工作流、Terraform 模板或测试脚本存在，不等于真实环境已经通过。
