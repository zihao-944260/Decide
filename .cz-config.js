module.exports = {
  types: [
    { value: 'feat', name: 'feat:   新功能' },
    { value: 'fix', name: 'fix:    修复 bug' },
    { value: 'docs', name: 'docs:   文档变更' },
    { value: 'style', name: 'style:  代码格式（不影响代码运行）' },
    { value: 'refactor', name: 'refactor: 重构' },
    { value: 'perf', name: 'perf:   性能优化' },
    { value: 'test', name: 'test:   测试相关' },
    { value: 'chore', name: 'chore:  构建/工具链/依赖' }
  ],
  scopes: [],
  allowCustomScopes: false,
  allowBreakingChanges: ['feat', 'fix'],
  messages: {
    type: '请选择要提交的变更类型：',
    scope: '\n请选择本次变更的影响范围（可直接输入自定义范围，或按 ↑↓ 选择已有范围）：',
    customScope: '请输入自定义的影响范围：',
    subject: '\n请简要描述本次变更（简短、祈使语气，不超过100字）：',
    body: '\n详细描述本次变更（可选，按 | 换行）：\n',
    breaking: '列出破坏性变更（可选）：',
    footer: '关联关闭的问题（可选，如 #31, #34）：',
    confirmCommit: '\n确认使用以上信息提交？(y/N/n)↑→取消 ←返回空格=多选'
  }
}
