/**
 * 空壳自定义 tabBar 组件（配合 `pages.json → tabBar.custom: true`）。
 * 本体导航在 Vue 侧 `src/components/base/BaseTabBar/index.vue`，这里必须存在但什么都不做：
 * 微信要求 custom 为 true 时产物根目录有 custom-tab-bar 组件，否则小程序直接起不来。
 * 为什么走这条路而不是 hideTabBar，见同目录 index.wxss 顶部注释。
 */
Component({})
