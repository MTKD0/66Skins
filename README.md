# 66SKINS 旧版界面复原

一个根据网页存档与视觉参考重建的 66SKINS 旧版中文网站。项目包含完整的响应式界面、本地账号与背包、经典盲盒、幸运饰品以及多人对战流程。

> 本项目是非官方、非商业的界面复原，仅用于学习、展示与怀旧。它不提供充值、真实饰品交易、Steam 发货或提现服务。

## 功能

- 旧版首页、导航、活动入口与掉落展示
- 经典盲盒：盲盒列表、详情、开启动画与结果结算
- 幸运饰品：饰品搜索、分类、价格筛选、品质与概率选择
- 对战模式：创建房间、真人加入、机器人练习、回合同步与结算
- 本地账号、会话、模拟余额、背包与回收
- 市场饰品数据、价格同步脚本和 D1 数据库迁移

## 技术栈

- React 19 + TypeScript
- Vinext / Vite
- Cloudflare Workers + D1
- Drizzle ORM
- 原生 CSS 动画与响应式布局

## 本地运行

需要 Node.js 22.13 或更高版本，并安装 pnpm。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

打开 <http://localhost:3001/>。本地数据保存在项目的 Wrangler 开发状态目录中，该目录不会提交到 Git。

## 检查与构建

```bash
pnpm test
pnpm build
```

`pnpm test` 会先生成生产构建，再检查主要页面和饰品数据。

如需检查独立账号的在线对战流程，请先启动开发服务，然后运行：

```bash
node scripts/test-game-online.mjs
```

该脚本会创建临时测试账号。

## 项目结构

```text
app/          页面、界面组件和 API 路由
db/           数据库访问层
drizzle/      D1 数据库迁移
data/         饰品目录、市场价格与来源说明
lib/          价格和游戏经济规则
public/       图片、音效与其他静态资源
scripts/      数据准备、价格同步和集成检查脚本
tests/        页面渲染与数据测试
worker/       Cloudflare Worker 入口
```

## 数据与部署

- 生产环境需要名为 `DB` 的 D1 绑定。
- 数据库结构位于 `db/schema.ts`，迁移文件位于 `drizzle/`。
- `pnpm build` 会生成 Cloudflare Workers 兼容的输出。
- `.env*`、本地数据库、账号备份、构建结果和开发缓存均已排除在版本控制之外。

## 素材与声明

项目代码使用 [MIT License](LICENSE)。数据和素材的已知来源说明见 [`data/ATTRIBUTION.md`](data/ATTRIBUTION.md)。MIT 许可不代表对第三方品牌标识、图片、音效或数据授予额外权利；在再分发或用于其他项目前，请自行确认相关素材的使用权限。
