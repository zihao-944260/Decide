type Level = 'debug' | 'info' | 'warn' | 'error'

const PREFIX = '[Decide]'

let enabled = true

export function setLogEnabled(value: boolean): void {
  enabled = value
}

function write(level: Level, tag: string, args: unknown[]): void {
  if (!enabled && level === 'debug') return
  const head = `${PREFIX}[${level}]${tag ? `[${tag}]` : ''}`
  if (level === 'error') console.error(head, ...args)
  else if (level === 'warn') console.warn(head, ...args)
  else console.log(head, ...args)
}

/** 规范禁止裸 console.log，统一走 logger（技术方案 §15） */
export const logger = {
  debug: (tag: string, ...args: unknown[]) => write('debug', tag, args),
  info: (tag: string, ...args: unknown[]) => write('info', tag, args),
  warn: (tag: string, ...args: unknown[]) => write('warn', tag, args),
  error: (tag: string, ...args: unknown[]) => write('error', tag, args)
}
