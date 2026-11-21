# SwipeDelete

列表卡片「左滑出操作按钮条」容器（WBS 追加项，配套我的页 T5.6 左滑管理）。
只负责手势与开合：点按钮只 emit `action(key)`（不带数据），点的是哪颗、删哪条归外层 `PlanList`
（带 planId 上抛），动作执行与收敛归页面（编辑 goEdit / 提前截止 closeEarly / 删除 removeFlow，
与原长按菜单同一套写穿路径）。

## 契约

| 类型 | 名称 | 说明 |
| --- | --- | --- |
| prop | `actions: SwipeAction[]` | 按钮条内容：`{ key, label, danger? }` 逐条给。行末排 N 颗 140rpx 等宽按钮，展开位移 = N × 140rpx。`danger` 决定配色（删除红底，其余中性灰） |
| emit | `action(key: string)` | 某颗按钮被点（卡片展开态），带回那颗按钮的 key |
| emit | `swiping-change(swiping: boolean)` | 横向接管 true / 手势结束（end、cancel、卸载兜底）false；PlanList 据此在横滑期间关 scroll-view 竖向滚动。**外层重渲染时本组件 props 必须保持引用稳定**（actions 换新数组会被重渲染、掐断在途手势） |
| slot | 默认 | 卡片本体（`PlanCard`） |

按钮按条目算（外层 PlanList 用「条目 → 动作列表」的函数逐卡给）：我的页「我发起的」桶
未截止给 编辑计划 / 提前截止 / 删除计划 三颗、已截止只给 删除计划 一颗
（编辑与改期对已截止计划会被云端 `assertPlanUpdatable` 回 3002，摆进按钮条等于用报错当交互）。

## 结构

全程零 absolute、**行级与组级都不上 overflow hidden**（三处 Skyline 实测坑，2026-11-21 依次改结构）：

- 容器 `display: flex`（行级）——**不上 overflow hidden**：行级裁切会把入场上升
  （`__wrap` 上 `translateY(64rpx)`）裁成「每张卡在自己的盒子内上滑」（open-container 内部
  位移的旧坑，PlanCard README），我的页真机复现后移除；裁切统一落在列表容器层。
- 卡片：`z-index: 1`、`flex: 0 0 100%`（宽 = 容器宽），行内第一个。
- 按钮组：行内第二个，纯 `display: flex`（**无 overflow、无圆角**——组上一旦 overflow hidden，
  Skyline 下 stretch 高度塌成内容高，按钮不可见，2026-11-21 三键版真机「滑开但无按钮」后移除）。
  组里 N 颗按钮 `flex: 0 0 140rpx` 并排：圆角只落**两头**——单颗全圆（`--only`），多颗时
  首颗左边圆（`--first`）、末颗右边圆（`--last`）、中间直角相邻无缝拼接。整组排满卡片后
  **溢出到 `.plan-list` 右缘外，由容器裁掉**（收起态完全不可见）；按钮高度走 flex stretch
  自动等于卡高，永远不错位（absolute 双锚点跟卡高在 Skyline 不可靠，旧版红块/红角漏出即此因）。
- 展开：卡片与按钮组共用同一 `transform: translateX(offset)`（0 → -N×140rpx），同步左移
  让出按钮；卡片左缘探出部分由列表容器裁掉。
- 配色：`danger`（删除）`$color-danger` 红底，其余中性灰 `$color-text-2`，文字白。

## 手势口径

- 方向判定（不提前锁死，解决「斜着滑有时触发不了」）：
  - 「横向意图明确」接管：`|dx| > 8px` 且 `|dx| >= 0.8|dy|`（近 45° 斜滑也优先横滑）；
  - 「竖向意图明确」放行：`|dy| > 8px` 且 `|dy| > 1.5|dx|`（留给 scroll-view 竖滚）；
  - 中间斜滑不判定、持续观察，本次按压直到定方向前都可翻转。
- 跟手期间 `transition: none`；松手后开 250ms transition（`cubic-bezier(0.22, 0.61, 0.36, 1)`）吸附：
  快左甩（> 0.4px/ms）张开、快右甩收起，慢放按位移（按钮组宽一半）决断。
- `touchcancel`（scroll-view 接管/系统打断）走同一就近吸附口径，卡片不会卡在中间位移。
- 横竖手势冲突（「左右滑容易带着列表上下滚」）：原生竖向滚动的接管阈值 JS 侧拦不住。
  已试 `min-drag-distance=50`（我的页 created 桶）——真机未生效（设备基库/Skyline type=list 不认，
  兼容清单 §2.3 有记录）。现役方案：横向接管时 emit `swiping-change(true)`，PlanList 把 scroll-view
  的 `scroll-y` 动态切 false（计数制，多卡互不干扰；end/cancel/卸载兜底扣回），竖滚整段关断、松手恢复，
  单键版真机验证过。
  **前提（2026-11-21 三键版踩坑）**：切换会触发 PlanList 重渲染，重渲染时流进本组件的 `actions`
  必须是同一个数组引用（PlanList `rowActions` 按条目对象身份缓存）——新数组会让子组件跟着重渲染，
  Skyline 掐断在途手势，左滑整体失效。
  worklet 手势组件（pan-gesture-handler 等）是 Nightly 专属，生产不可用，不作后备。
- 每个实例独立记开合状态，不强制「同一时刻只开一张」；滚动列表不自动收起（后续口径再议）。
- 展开后点卡片正文走 open-container 进详情，同时卡片平滑收起（转场从原位开始，
  避免放大转场起点漂移在移位的卡片上）；删除成功时列表项被 `removeItem` 摘除，组件随之卸载。
