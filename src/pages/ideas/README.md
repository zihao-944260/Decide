# Great Ideas 页（`pages/ideas/index`）

底部导航中间那一项。**2026-11-17 用户口径：这一页目前什么都不放** —— 只把「三 tab + 滑块滑动」这条链路接上，
内容区是一块空白，等业务需求进来再按首页/我的页的规矩补（`PlanList` 三态、`usePageRefresh` 心跳、store 接线）。

## 结构

```
view.ideas（page-root：flex 纵向 + overflow hidden）
├─ BaseNavbar(title=Great Ideas, :backable=false)   tab 页没有返回箭头
├─ view.ideas__body（flex: 1）                      布局占位，不是内容
└─ BaseTabBar(active=ideas)                         fixed 悬浮层，不占这一列
```

`.ideas__body` 现在只负责把页面底色铺到窗口底（胶囊底下那条安全区由导航自己的底色补）。
它将来会被真正的内容（列表 / 骨架）替换掉。

## 为什么它是 tab 页而不是 navigateTo 页

`pages.json → tabBar.list` 把它排在中间，`switchTab` 才认它。tab 页常驻不销毁，
所以从这一页切走再切回来不会重跑 `onLoad` —— 这也是滑块能「从旧格滑到新格」的前提（见 `BaseTabBar` README）。

## 待补（等业务定）

1. 页面内容与其取数口径（现在零请求、零 store 接线）。
2. 是否注册 `usePageRefresh({ key })` —— 需要先在 `src/constants/pages.ts` 的 `PAGE_KEYS` 里补一项。
