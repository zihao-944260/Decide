# BaseActionSheet

底部操作菜单（长按块操作等场景；详情页走原生 `uni.showActionSheet`，不渲染本组件）。基于 `BasePopup`（fixed 遮罩+面板，#78），受控组件。动作超过一屏时内部普通 `scroll-view :scroll-y="true"` 滚动（max-height 50vh；WebView 页 `type="list"` 触摸滚动失效，#73/#78 同根因）。

## Props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `visible` | `boolean` | 必填 | 受控显隐，支持 `v-model:visible` |
| `actions` | `ActionSheetItem[]` | 必填 | `{ key?, text, desc?, disabled?, danger? }` |
| `title` | `string` | `''` | 顶部灰色说明文字 |
| `cancelText` | `string` | `'取消'` | 取消按钮文案 |

## Emits

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `update:visible` | `boolean` | v-model |
| `select` | `(action, index)` | 点击可用动作（不自动关闭，由调用方决定） |
| `cancel` | — | 取消按钮或蒙层关闭时触发 |

## 示例

```vue
<BaseActionSheet
  v-model:visible="sheetVisible"
  title="块操作"
  :actions="[{ key: 'up', text: '上移' }, { key: 'remove', text: '删除', danger: true }]"
  @select="onAction"
/>
```
