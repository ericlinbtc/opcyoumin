# 首发产品规格

## 1. 首发范围

首发完成手机号注册登录、城市、动态、评论、互动、关注、活动、机构申请、政策与来源追溯、个人中心、知识、AI 洞察、举报审核和运营后台。支付、即时聊天与推荐系统不进入首发。

## 2. 角色与权限

| 能力 | 游客 | 注册用户 | 内容编辑 | 城市管理员 | 平台管理员 |
|---|---:|---:|---:|---:|---:|
| 浏览公开内容 | 是 | 是 | 是 | 是 | 是 |
| 发布动态/评论 | 否 | 是 | 是 | 是 | 是 |
| 编辑知识/洞察 | 否 | 否 | 是 | 否 | 是 |
| 创建活动 | 否 | 审核后 | 是 | 是 | 是 |
| 城市管理 | 否 | 否 | 否 | 所属城市 | 全部 |
| 审核举报 | 否 | 否 | 否 | 所属城市 | 全部 |
| 角色与平台配置 | 否 | 否 | 否 | 否 | 是 |

页面是否显示按钮不构成授权。每个 Server Action 和 Route Handler 必须重新校验会话、角色、资源归属与目标状态。

## 3. 页面地图

- 公开：`/`、`/cities`、`/cities/[citySlug]`、`/posts/[postId]`、`/members/[userId]`、`/activities`、`/activities/[activityId]`、`/policies`、`/policies/[policyId]`、`/knowledge/[slug]`、`/insights/[slug]`。
- 账号：`/login`、`/me`、`/me/posts`、`/me/saves`、`/me/follows`、`/me/activities`、`/me/applications`、`/me/notifications`、`/me/sessions`、`/me/appeals`。
- 运营：`/admin/users`、`/admin/posts`、`/admin/activities`、`/admin/content`、`/admin/cities`、`/admin/audit`。
- 原型基线：`/prototype`，禁止搜索引擎收录，不承载生产数据与正式业务入口。

## 4. 状态机

- 内容：`draft → pending → published → hidden → deleted`；`hidden` 可恢复为 `published`，`deleted` 为软删除并只能先恢复为 `hidden`。
- 活动：`draft → pending → published → cancelled | ended`；结束与取消均不可直接重开。
- 举报：`open → reviewing → approved | rejected → appealed → reviewing → closed`。
- 报名：`registered ↔ cancelled`，活动结束后可标记 `attended | no_show`。

状态转换集中在 `server/domain/state-machines.ts`，不得在页面内自行判断。

## 5. 核心业务规则

- 同一手机号 60 秒仅发送一次验证码；手机号每日 10 次、IP 每日 30 次；连续失败递增冷却。
- 新账号前 24 小时最多 3 条动态、20 条评论。
- 图片仅 JPG/PNG/WebP，单张 10MB，单条动态最多 9 张；视频 MP4/WebM，单个 200MB。
- 明显违规同步拒绝，可疑内容进入 `pending`，其他内容直接发布。举报数量不直接触发删除。
- 活动报名通过事务更新，唯一键防止重复报名，条件更新防止超卖。
- 手机号以 HMAC 哈希唯一检索，以 AES-256-GCM 加密保存；公开资料与私密账号表分离。

## 6. 数据字典

核心表定义在 `db/schema.ts`：

- 身份：`users`、`profiles`、`sessions`。
- 城市：`cities`、`city_memberships`。
- 社区：`posts`、`media`、`comments`、`reactions`、`saves`、`follows`、`user_blocks`、`polls`、`poll_votes`、`post_shares`。
- 活动与机构：`activities`、`registrations`、`organizations`、`organization_applications`。
- 内容：`knowledge_articles`、`insights`、`policies`。
- 治理：`reports`、`moderation_cases`、`moderation_appeals`、`notifications`、`audit_logs`、`outbox_jobs`、`dead_letter_jobs`。

所有业务主键使用 UUID；所有时间使用带时区 UTC；计数列是事务维护的读优化副本；删除用户前必须执行内容与法定义务评估。

## 7. 稳定错误协议

HTTP API 返回 `{ ok, data | error, requestId }`，并在 `x-request-id` 响应头回传请求 ID。客户端只依赖稳定错误码，不解析后端错误文本。日志禁止输出手机号、验证码、Cookie、访问密钥和上传签名 URL。
