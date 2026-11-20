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
  allowBreakingChanges: ['feat', 'fix']
}
