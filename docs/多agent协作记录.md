# 多 Agent 协作记录（2026-11-12 13:30 快照）

> 本文件是**跨窗口交接**用的唯一事实源。新开窗口继续开发时：先读本文件 + `docs/agent-prompts.md`，再 `git log` / `git status` 核对实际状态。
> 关键事实：**后台 agent 属于发起它的会话**。新窗口不会继承正在跑的 agent，也收不到它们的完成通知；若本窗口仍开着，结果会以通知形式回到本窗口，**不要在新窗口重复拉起同一 agent**。

## 1. 仓库状态

| 项 | 值 |
| --- | --- |
| 仓库 | `/Users/duan/Desktop/Decide`，分支 `main`（2026-11-12 初始化） |
| 基线提交 | `d5bb797` chore: 初始化仓库，纳入 T0 预研后的工程基线 |
| 契约提交 | `7b125a1` feat(contract): T1.1 冻结前后端接口契约与请求单一出口 |
| 工作区 | 快照时刻 `git status` 干净（agent 尚无落盘产出）；agent 产出**未提交、未验收** |
| 云环境 | `cloud1-d2g9acyyhb220d834`；AppID `wx93aa8833f25d90b0` |

## 2. 冻结文件（所有 agent 与我都不许改，改动需先裁决）

`package.json`、`tsconfig.json`、`src/pages.json`、`src/manifest.json`、`src/main.ts`、`src/App.vue`、`src/pages/**`、`src/api/request.ts`、`src/types/**`、`src/constants/**`、`src/stores/app.ts`、`src/utils/logger.ts`、`docs/**`、`技术方案.md`、`.gitignore`、`vite.config.ts`。

## 3. 四路 agent

| 代号 | agentId | 所有权 | 状态（快照时刻） |
| --- | --- | --- | --- |
| A 设计系统 | `ageneral-purpose-22b4454585f6e760` | `src/styles/**`、`src/uni.scss`、`src/components/base/**` | 运行中 |
| B 服务层 | `ageneral-purpose-5a6f57211438de0c` | `src/api/{user,plan,vote,comment,index}.ts`、`src/stores/{user,plan}.ts` | **已完成**，见 §4 |
| C 工具层 | `ageneral-purpose-da0f5be08897afee` | `src/utils/**`（logger 除外）、`src/composables/**`、`src/stores/feedback.ts` | 运行中 |
| D 云函数 | `ageneral-purpose-469e49d4d1d86a56` | `cloudfunctions/**` | 运行中 |

指令原文：`docs/agent-prompts.md`（四节，可原样重拉）。重拉前先看对应目录是否已有未验收产出。

## 4. B 的产出与决策（已完成，待我验收）

新建 7 个文件：`src/api/{user,plan,vote,comment,index}.ts`、`src/stores/{user,plan}.ts`。自报 `npm run type-check` 全绿。

- api 函数统一追加可选尾参 `options?: RequestOptions`（透传 `silent/noDedupe`），与冻结签名兼容。
- **votes 覆盖规则**：`applyVoteResult` 无条件覆盖 `voteCounts`（投票响应必然新于列表快照），列表写入只回填尚不存在的 planId，并 patch 已缓存 summary 的 `votes`。
- **1002 防循环**：模块级 `relogging` 守卫；重登进行中再遇 1002 直接 no-op，靠 request.ts「仅重试一次」终止。
- `refresh()` = 重放幂等的 `user.login`（契约无 getProfile）。
- storage key `decide:user`，TTL 7 天；`logout()` 同时 `planStore.clear()`。
- **待我裁决**：技术方案 §8.3 写过「取消投票 = `vote.submit` 带 `type: 0`」，但冻结契约 `VoteTypeValue` 只有 `1|2`。B 未实现取消入口，`applyVoteResult` 的 `myVote: null` 已预留删除语义。
  → **我的裁决：v1 不做取消投票**（原始需求只有赞同/反对，改票即投另一票）。契约不改；§8.3 的 `type: 0` 措辞在下次文档修订时删掉。

## 5. 我的串行工作与在途事项

- 已完成：git 基线；契约 8 文件（`src/types/{api,models,cloud}.ts`、`src/constants/{error-code,plan}.ts`、`src/utils/logger.ts`、`src/stores/app.ts`、`src/api/request.ts`）；任务表 #10–#14。
- 在途：**tabBar 图标**。ImageGen 生成的 PNG 无 alpha（把透明画成棋盘格像素），已弃用并删除 `vibe_images/`；改用手写 SVG + `qlmanage -t -s 162 -o <dir> <svg>` 栅格化，**已验通 `hasAlpha: yes`**。下一步：写 4 个 SVG（home/user × 未选中 `#8A8F99` / 选中 `#2B6DE8`）→ 栅格化 → `sips -z 81 81` → 放入 `src/static/tabbar/` → `src/pages.json` 加 `iconPath`/`selectedIconPath`（pages.json 是我所有，agent 不碰）。
- 刻意延后：**ESLint/Prettier/husky**（要动根 `package.json` 并 `npm install`，会与运行中 agent 的 type-check 抢 node_modules，等四路全部验收后再做）。

## 6. 集成验收清单（任务 #14，四路全完成后我做）

1. `git status` 逐文件过一遍，确认没有越界改动（对照 §2/§3 所有权）。
2. 读每个 agent 的实际 diff（不信自述），重点：B 的 votes 覆盖与 1002 守卫、C 的 ticker 单例与「不测视口外节点」、A 的 Skyline 禁用项、D 的游标编码与事务边界。
3. `npm run type-check` 全绿 → `npm run build:mp-weixin` → 产物只含 home/mine 两页。
4. 云函数逐个 `tsc -p tsconfig.json` 零错误，然后由我统一部署：`cli cloud functions deploy --env cloud1-d2g9acyyhb220d834 --paths <绝对路径> --remote-npm-install --project <dist>`（首次报 `Creating 状态` 失败，重试一次）。
5. 模拟器冒烟：`cli auto --auto-port 9420` + automator 调 `plan.list`/`vote.submit` 走一遍真实链路。
6. 每路一个 commit（Conventional Commits，带任务 ID）。

## 7. 仍等用户操作的事项（控制台，我做不了）

1. 确认云环境套餐/有效期（现标「微信体验版」，换正式环境 env ID 会变）。
2. T2.1：6 个集合的自定义安全规则「仅管理端可读写」+ 索引（`votes` 的 `planId+openId` 唯一、`plans` 的 `status+createdAt`、`participations` 的 `openId+lastActionAt`）+ 云函数超时从 3s 调高。
3. T4：消息推送 → 云函数（`mediaCheckAsync` 回调）。
4. M0：真机扫码复核（选择器、worklet、share-element、`chooseMedia`、头像昵称填写能力）。
5. T6.6：公众平台隐私保护指引。
