# 开发与工程质量验收记录

验收日期：2026-08-24
详细缺口与证据以[全链路完成度审计](full-stack-verification-2026-08-24.md)为准。

## 已完成的产品代码

- 最终首页保持原视觉基线，并在 database-connected mode 读取真实城市、动态、活动、机构、成员和个人记录。
- 正式 `/login` 提供短信验证码、Redis 限流、数据库账号/会话、Cookie 和撤销能力。
- 城市加入/退出、动态/评论、媒体、投票、互动、关注/屏蔽、举报/申诉和通知。
- 活动发起资格申请、活动创建/审核/报名/取消、容量并发保护和个人记录。
- 个人资料、头像、会话、通知、申请进度、注销申请与后台匿名化完成流程。
- OPC 认证、机构申请、帮助工单、政策与来源追溯，以及对应后台处理入口。
- 用户/角色、城市作用域、内容治理、活动、媒体、申请、工单、死信、审计后台。
- Outbox Worker、幂等领取、指数重试、死信、管理员告警和媒体内容安全接入。

首页手机号弹层仍是明确的本地演示例外，使用 `localStorage`，不属于真实认证；生产认证只验收 `/login`。

## 本轮已通过的本地门禁

- TypeScript、ESLint、Next.js 16.3.2 production build、standalone 启动。
- 10 个 Vitest 文件、37 项测试通过；领域覆盖率 statements 84.78%、branches 84.61%。
- 32 项公开/响应式/可访问性浏览器 E2E 通过。
- 生产依赖 audit 未发现已知漏洞。
- 应用内浏览器实际打开首页、城市、政策、帮助和登录页面，console 无 error/warning。
- k6 2.2.0 release profile inspect 通过。
- Terraform 1.15.9 init/validate 与 fmt check 通过。
- GitHub Actions YAML、JavaScript 语法和 git diff check 通过。

## 已开发但尚未获得真实环境证据

- 3 个 PostgreSQL/Redis Vitest 文件和数据库认证 E2E 在本机按设计跳过。
- 真实阿里云短信发送、OSS 上传/回调/内容安全、Worker 常驻运行。
- Docker web/worker 镜像构建、Trivy artifact 与 ACR digest。
- staging/production Terraform plan/apply、SAE 部署和多实例单 SHA 验证。
- k6 100 RPS / 15 分钟实际报告。

这些入口均已进入 CI 或环境工作流，但工作流文件存在不等于执行成功。

## 仍需外部环境完成的上线门禁

1. 新代码推送后的 CI 全绿记录。
2. staging/production GitHub Environment、reviewer、secrets 和远端 Terraform state。
3. ICP/公安备案、短信签名模板、域名证书、WAF、CDN/DCDN、ALB/Ingress、OSS 私有回源。
4. SLS/ARMS/OTLP、告警联系人、费用预算与实际告警演练。
5. RDS 隔离恢复、staging 压测、10%→50%→100% 灰度和回滚演练。
6. 隐私政策、服务条款、风险提示和运营审核流程的最终签署。

任何一项未完成，都不能将生产状态标记为“正式上线”。
