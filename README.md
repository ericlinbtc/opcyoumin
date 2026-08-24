# 游民 OPC 社区

面向中国内地阿里云部署的 Next.js 模块化单体。当前仓库同时保留首页原型，并已建立可上线工程基线、真实产品路由、PostgreSQL 数据模型、手机号验证码认证、OSS 直传边界和阿里云基础设施模板。

## 本地启动

要求 Node.js 24、pnpm 11.19、PostgreSQL 16 和 Redis 7；版本与 CI、Terraform 模板一致。先运行 `pnpm env:check` 可以看到本机缺少的组件，发布工具链用 `pnpm env:check:release` 检查。

```bash
cp .env.example .env.local
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm build && pnpm start` 启动 Next.js standalone 产物，与生产镜像入口一致，不再使用不匹配的 `next start`。如果本机没有 Docker、Terraform 或 k6，基础设施校验、镜像构建和压测脚本语法仍由 CI 执行；真实云资源和 staging 压测需要对应环境密钥，不能由仓库假装完成。

开发环境可在 `.env.local` 配置 `SMS_DEV_CODE=246810`。生产环境禁止设置该变量。

## 质量门禁

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm audit --audit-level high --prod
```

生产镜像使用 `Dockerfile` 构建，健康检查为 `/health`，依赖就绪检查为 `/ready`。产品规格见 [docs/product/launch-spec.md](docs/product/launch-spec.md)，当前完成度与剩余事项见 [docs/acceptance/full-stack-verification-2026-08-24.md](docs/acceptance/full-stack-verification-2026-08-24.md)，架构和阿里云交付见 [docs/architecture/production-architecture.md](docs/architecture/production-architecture.md)。

## 环境边界

- staging 与 production 使用独立 VPC、RDS、Tair、OSS Bucket、SAE Namespace 和密钥。
- `.openai/hosting.json` 与 `vite.config.ts` 只用于追溯旧原型；生产构建不再依赖 Vinext、Cloudflare、D1 或 R2。
- `prototype-baseline-20260824` 标签是迁移前可回滚基线。
