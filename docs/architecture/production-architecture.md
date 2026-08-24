# 生产技术架构

## 1. 运行架构

```text
用户 → CDN/DCDN → WAF → ALB/SAE Ingress → SAE (Next.js standalone, ≥2 实例)
                                              ├─ RDS PostgreSQL 高可用版
                                              ├─ Tair Redis 高可用版
                                              ├─ OSS 私有原图 / 审核后派生文件
                                              ├─ SAE Worker / Outbox（可对接 MNS/RocketMQ）
                                              └─ SLS + ARMS/OpenTelemetry
```

应用采用模块化单体。Server Components 默认负责读取与 SEO，Client Components 只承载输入和即时交互；业务写入使用 Server Actions，短信、上传回调和健康检查使用 Route Handlers。页面不得直接访问数据库或阿里云 SDK。

## 2. 代码分层

- `app`：路由、布局、元数据、HTTP 边界。
- `features`：按城市、动态、活动、认证等业务组织用例。
- `server/domain`：状态机、权限、风控等纯领域规则。
- `server`：会话、Redis、OSS、短信等适配器。
- `db`：Drizzle schema、迁移和种子。
- `components`：无业务数据访问的共享 UI。
- `lib`：环境、加密和响应协议。

## 3. 安全边界

- SAE 只使用 RAM 角色或受限 RAM 用户；应用账号不得拥有资源创建权限。
- RDS、Tair 与 SAE 仅通过同地域 VPC 内网访问，不开公网白名单。
- OSS Bucket 私有；浏览器只获得 10 分钟、限定对象键和 MIME 的上传签名；OSS 回调必须 RSA-MD5 验签。
- WAF 限制认证、上传、举报和后台路径；源站只允许 ALB/WAF 回源地址。
- Cookie 为 `Secure + HttpOnly + SameSite=Lax`；服务端验证会话撤销状态和 CSRF 来源。
- 生产密钥进入 KMS/SAE Secret，不写入 Terraform state、镜像或仓库。

## 4. 缓存与一致性

- 会话、验证码、限流、一次性令牌和热门榜单使用 Tair。
- 用户权限、报名名额、内容状态以 PostgreSQL 为唯一事实来源。
- 公共内容可服务端缓存，发布、隐藏、评论和报名后按标签或路径失效。
- 计数更新、通知、媒体处理和统计进入具备幂等键、重试与死信记录的异步队列。

## 5. 服务目标

- 可用性 99.9%，RPO ≤ 15 分钟，RTO ≤ 2 小时。
- 首发 1,000–10,000 DAU；动态读取持续 100 RPS 15 分钟，错误率 < 1%。
- 读取 p95 < 500ms，写入 p95 < 800ms；LCP < 2.5s、INP < 200ms、CLS < 0.1。
