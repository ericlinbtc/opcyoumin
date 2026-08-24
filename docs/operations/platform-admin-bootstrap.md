# 首个平台管理员初始化

1. 在正式站点使用目标手机号完成一次登录，确认手机号归属和账号状态。
2. 在受审计的运维终端临时设置 `BOOTSTRAP_ADMIN_PHONE`。
3. 设置 `BOOTSTRAP_ADMIN_CONFIRM=promote-手机号后四位`，运行 `pnpm admin:bootstrap`。
4. 脚本会拒绝不存在、非 active 的账号；平台已存在管理员时也会默认拒绝。
5. 晋升后该账号全部既有会话会被撤销，操作者需要重新登录。
6. 检查 `audit_logs` 中的 `platform_admin.bootstrapped` 事件，然后立即清除临时环境变量。

只有经过双人复核且确需增加第二位平台管理员时，才可临时设置 `ALLOW_ADDITIONAL_PLATFORM_ADMIN=true`。日常角色变更应使用运营后台，不能重复运行初始化脚本。
