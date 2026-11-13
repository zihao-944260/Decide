// 众议 Decide · iOS 扁平化改版设计稿 v1
// 色值/字号/圆角 = 将来 tokens.scss 的落地值，直接当规范读。
import type { CSSProperties, ReactNode } from 'react'

const C = {
  primary: '#007AFF',
  primaryLight: '#E5F1FF',
  agree: '#34C759',
  agreeLight: '#E9F9EE',
  danger: '#FF3B30',
  dangerLight: '#FFEBEA',
  text1: '#1C1C1E',
  text2: '#78787D',
  text3: '#AEAEB2',
  border: '#E5E5EA',
  page: '#F2F2F7',
  card: '#FFFFFF',
  fill: '#E9E9EB',
  fillDeep: '#DFDFE4',
  separator: 'rgba(60,60,67,0.29)',
} as const

const F = 'system-ui, -apple-system, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif'

// ---------- 图标（内联 SVG，无外部资源） ----------

type IconName = 'house' | 'person' | 'chevronL' | 'chevronR' | 'clock' | 'chat' | 'check' | 'image' | 'plus' | 'quote' | 'bars' | 'minus'

function Icon({ name, size = 16, color }: { name: IconName; size?: number; color: string }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const }
  switch (name) {
    case 'house':
      return (
        <svg {...common}>
          <path d="M4 11.5 12 4l8 7.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 10.5V20h11v-9.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'person':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.6" stroke={color} strokeWidth="2" />
          <path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'chevronL':
      return (
        <svg {...common}>
          <path d="M14.5 5 8 12l6.5 7" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'chevronR':
      return (
        <svg {...common}>
          <path d="M9.5 5 16 12l-6.5 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="2" />
          <path d="M12 8v4.4l3 1.8" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'chat':
      return (
        <svg {...common}>
          <path d="M4 6.8C4 5.2 5.2 4 6.8 4h10.4C18.8 4 20 5.2 20 6.8v7.4c0 1.6-1.2 2.8-2.8 2.8H10l-4.2 3.4c-.6.5-1.4 0-1.4-.8L4 6.8Z" fill={color} />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="M5.5 12.5 10 17l8.5-9.5" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'image':
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke={color} strokeWidth="2" />
          <circle cx="9" cy="10" r="1.6" fill={color} />
          <path d="M5 17.5 10.5 12l4 4 2-2 2.5 2.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      )
    case 'quote':
      return (
        <svg {...common}>
          <path d="M6 16c-1.2 0-2-1-2-2.4C4 10.8 6 8.4 9 7.4l.6 1.4c-1.6.6-2.6 1.7-2.8 3 .2-.1.5-.2.9-.2 1.3 0 2.2.9 2.2 2.2S8.9 16 7.6 16H6Zm8 0c-1.2 0-2-1-2-2.4 0-2.8 2-5.2 5-6.2l.6 1.4c-1.6.6-2.6 1.7-2.8 3 .2-.1.5-.2.9-.2 1.3 0 2.2.9 2.2 2.2S16.9 16 15.6 16H14Z" fill={color} />
        </svg>
      )
    case 'bars':
      return (
        <svg {...common}>
          <path d="M5 15.5 12 9l7 6.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'minus':
      return (
        <svg {...common}>
          <path d="M5 12h14" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      )
  }
}

// ---------- 手机框 ----------

function StatusBar() {
  const glyph = C.text1
  return (
    <div style={{ height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 22px 6px' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: glyph, letterSpacing: 0.2 }}>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="16" height="10" viewBox="0 0 16 10">
          <rect x="0" y="6" width="3" height="4" rx="0.8" fill={glyph} />
          <rect x="4.5" y="4" width="3" height="6" rx="0.8" fill={glyph} />
          <rect x="9" y="2" width="3" height="8" rx="0.8" fill={glyph} />
          <rect x="13.5" y="0" width="2.5" height="10" rx="0.8" fill={glyph} opacity="0.35" />
        </svg>
        <svg width="22" height="11" viewBox="0 0 22 11">
          <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke={glyph} opacity="0.4" fill="none" />
          <rect x="2" y="2" width="12" height="7" rx="1.5" fill={glyph} />
          <path d="M20.5 3.5v4a2 2 0 0 0 0-4Z" fill={glyph} opacity="0.4" />
        </svg>
      </div>
    </div>
  )
}

function Capsule() {
  return (
    <div
      style={{
        position: 'absolute', top: 50, right: 8, width: 87, height: 32,
        borderRadius: 16, border: `0.5px solid ${C.separator}`,
        background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'space-evenly',
      }}
    >
      <div style={{ display: 'flex', gap: 3 }}>
        <span style={{ width: 3.2, height: 3.2, borderRadius: 3, background: C.text1 }} />
        <span style={{ width: 3.2, height: 3.2, borderRadius: 3, background: C.text1 }} />
        <span style={{ width: 3.2, height: 3.2, borderRadius: 3, background: C.text1 }} />
      </div>
      <span style={{ width: 0.5, height: 16, background: C.separator }} />
      <svg width="13" height="13" viewBox="0 0 13 13">
        <circle cx="6.5" cy="6.5" r="5.4" stroke={C.text1} strokeWidth="1.1" fill="none" />
        <circle cx="6.5" cy="6.5" r="2.1" fill={C.text1} />
      </svg>
    </div>
  )
}

function Phone({ children, tab }: { children: ReactNode; tab?: 'home' | 'mine' }) {
  return (
    <div style={{ width: 300, height: 650, overflow: 'hidden', borderRadius: 28, border: '1px solid rgba(0,0,0,0.08)', background: C.page, fontFamily: F, position: 'relative', flexShrink: 0 }}>
      <div style={{ width: 375, height: 812, transform: 'scale(0.8)', transformOrigin: 'top left', display: 'flex', flexDirection: 'column' }}>
        <StatusBar />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</div>
        {/* tabBar（仅 tab 页） */}
        {tab && (
          <div style={{ height: 49, background: 'rgba(255,255,255,0.96)', borderTop: `0.5px solid ${C.border}`, display: 'flex' }}>
            {(['home', 'mine'] as const).map((k) => {
              const active = k === tab
              const color = active ? C.primary : C.text3
              return (
                <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <Icon name={k === 'home' ? 'house' : 'person'} size={22} color={color} />
                  <span style={{ fontSize: 10, color, fontWeight: active ? 600 : 400 }}>{k === 'home' ? '首页' : '我的'}</span>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ height: 24, background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 120, height: 5, borderRadius: 3, background: C.text1 }} />
        </div>
      </div>
      <Capsule />
    </div>
  )
}

function Navbar({ title, back }: { title: string; back?: boolean }) {
  return (
    <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
      {back && (
        <span style={{ position: 'absolute', left: 10, display: 'flex', alignItems: 'center' }}>
          <Icon name="chevronL" size={22} color={C.primary} />
        </span>
      )}
      <span style={{ fontSize: 17, fontWeight: 600, color: C.text1 }}>{title}</span>
    </div>
  )
}

// ---------- 通用小件 ----------

function Chip({ text, tone }: { text: string; tone: 'green' | 'blue' | 'gray' | 'red' }) {
  const map = {
    green: { bg: C.agreeLight, fg: '#248A3D' },
    blue: { bg: C.primaryLight, fg: C.primary },
    gray: { bg: C.fill, fg: C.text2 },
    red: { bg: C.dangerLight, fg: C.danger },
  } as const
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: map[tone].fg, background: map[tone].bg, borderRadius: 999, padding: '3px 9px', lineHeight: 1.3 }}>{text}</span>
  )
}

function Avatar({ size = 32, tint }: { size?: number; tint: string }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size, background: tint, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name="person" size={size * 0.55} color="rgba(255,255,255,0.95)" />
    </span>
  )
}

function RatioBar({ agree, disagree }: { agree: number; disagree: number }) {
  const total = agree + disagree
  const ap = total ? (agree / total) * 100 : 50
  return (
    <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 999, overflow: 'hidden' }}>
      <span style={{ width: `${ap}%`, background: C.agree, borderRadius: 999 }} />
      <span style={{ flex: 1, background: C.danger, borderRadius: 999 }} />
    </div>
  )
}

function Segmented({ items, active }: { items: string[]; active: number }) {
  return (
    <div style={{ display: 'flex', background: C.fill, borderRadius: 9, padding: 2 }}>
      {items.map((label, i) => (
        <span
          key={label}
          style={{
            flex: 1, textAlign: 'center', padding: '5px 0', borderRadius: 7, fontSize: 13,
            fontWeight: 600, color: i === active ? C.text1 : C.text2,
            background: i === active ? C.card : 'transparent',
            boxShadow: i === active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

function Switch({ on }: { on: boolean }) {
  return (
    <span style={{ width: 44, height: 26, borderRadius: 999, background: on ? C.agree : C.fill, position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 22, height: 22, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
    </span>
  )
}

const card: CSSProperties = { background: C.card, borderRadius: 10, padding: 14, margin: '0 16px' }
const cardGap: React.CSSProperties = { marginTop: 10 }

// ---------- ① 首页 ----------

function PlanCardDemo({ title, tone, deadline, agree, disagree, extra }: { title: string; tone: 'green' | 'gray'; deadline?: string; agree: number; disagree: number; extra: string }) {
  return (
    <div style={{ ...card, ...cardGap }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 600, color: C.text1, lineHeight: 1.35 }}>{title}</span>
        <Chip text={tone === 'green' ? '进行中' : '已截止'} tone={tone} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <Avatar size={20} tint="#B9C2CF" />
        <span style={{ fontSize: 13, color: C.text2 }}>阿黄 · 3小时前</span>
      </div>
      <div style={{ marginTop: 12 }}>
        <RatioBar agree={agree} disagree={disagree} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        {deadline && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: C.primary, fontSize: 12, fontWeight: 600, background: C.primaryLight, borderRadius: 999, padding: '3px 8px' }}>
            <Icon name="clock" size={12} color={C.primary} />
            {deadline}
          </span>
        )}
        <span style={{ fontSize: 12, color: C.text3, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Icon name="check" size={12} color={C.text3} />
          {agree + disagree} 票
        </span>
        <span style={{ fontSize: 12, color: C.text3, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Icon name="chat" size={12} color={C.text3} />
          {extra}
        </span>
      </div>
    </div>
  )
}

function HomeScreen() {
  return (
    <>
      <Navbar title="众议" />
      <div style={{ flex: 1, overflow: 'hidden', paddingTop: 2 }}>
        <PlanCardDemo title="周末团建地点投票" tone="green" deadline="23小时12分" agree={12} disagree={4} extra="8 评论" />
        <PlanCardDemo title="周五聚餐要不要去" tone="green" deadline="2天08小时" agree={5} disagree={9} extra="3 评论" />
        <PlanCardDemo title="年会节目单排序" tone="gray" agree={21} disagree={2} extra="14 评论" />
        <div style={{ textAlign: 'center', fontSize: 12, color: C.text3, marginTop: 14 }}>没有更多了</div>
      </div>
    </>
  )
}

// ---------- ② 计划详情 ----------

function DetailScreen() {
  return (
    <>
      <Navbar title="计划详情" back />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {/* 头部 */}
        <div style={{ ...card, marginTop: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text1, lineHeight: 1.35 }}>周末团建地点投票</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar size={30} tint="#B9C2CF" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>阿黄</span>
                <span style={{ fontSize: 11, color: C.text3 }}>3小时前发起</span>
              </div>
            </div>
            <Chip text="23小时12分后截止" tone="blue" />
          </div>
        </div>

        {/* 正文（mp-html 渲染区） */}
        <div style={{ ...card, ...cardGap }}>
          <div style={{ fontSize: 15, color: C.text1, lineHeight: 1.6 }}>本周六下午 2:00 出发，地点三选一，投完即止。带好防晒和水。</div>
          <div style={{ marginTop: 10, background: C.fill, borderRadius: 8, borderLeft: `3px solid ${C.primary}`, padding: '8px 12px', fontSize: 13, color: C.text2, lineHeight: 1.55 }}>
            引用：上次去滨江公园人少树多，适合团建游戏。
          </div>
          <div style={{ marginTop: 10, height: 110, borderRadius: 8, background: C.fillDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="image" size={26} color={C.text3} />
          </div>
          <div style={{ marginTop: 12, borderTop: `0.5px solid ${C.border}` }} />
          <div style={{ fontSize: 15, color: C.text1, lineHeight: 1.6, marginTop: 12 }}>截止后我们按票数订大巴。</div>
        </div>

        {/* 表决 */}
        <div style={{ ...card, ...cardGap }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text2, letterSpacing: 0.5 }}>表 决</div>
          {['滨江公园（已投）', '植物园', '室内运动馆'].map((opt, i) => (
            <div key={opt} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < 2 ? `0.5px solid ${C.border}` : 'none' }}>
              <span style={{ fontSize: 15, color: C.text1, fontWeight: i === 0 ? 600 : 400 }}>{opt}</span>
              {i === 0 ? (
                <span style={{ width: 20, height: 20, borderRadius: 999, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={12} color="#fff" />
                </span>
              ) : (
                <span style={{ width: 20, height: 20, borderRadius: 999, border: `1.5px solid ${C.border}` }} />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <span style={{ flex: 1, height: 44, borderRadius: 12, background: C.primary, color: '#fff', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>赞同</span>
            <span style={{ flex: 1, height: 44, borderRadius: 12, background: C.danger, color: '#fff', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>反对</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <RatioBar agree={12} disagree={4} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: C.text3 }}>
            <span style={{ color: '#248A3D', fontWeight: 600 }}>赞同 12</span>
            <span style={{ color: C.danger, fontWeight: 600 }}>反对 4</span>
          </div>
        </div>

        {/* 评论 */}
        <div style={{ ...card, ...cardGap }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text2, letterSpacing: 0.5 }}>评 论 2</div>
          {[
            { name: '小林', text: '投了滨江公园，带狗子去！', time: '1小时前', tint: '#A8C7E8' },
            { name: 'Mia', text: '室内运动馆有空调，举手', time: '26分钟前', tint: '#E8C7A8' },
          ].map((cm, i) => (
            <div key={cm.name} style={{ display: 'flex', gap: 8, marginTop: i === 0 ? 12 : 10 }}>
              <Avatar size={26} tint={cm.tint} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text2 }}>{cm.name}</span>
                  <span style={{ fontSize: 11, color: C.text3 }}>{cm.time}</span>
                </div>
                <div style={{ fontSize: 14, color: C.text1, lineHeight: 1.5, marginTop: 2 }}>{cm.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: 56 }} />
      </div>
      {/* 底部评论输入 */}
      <div style={{ flexShrink: 0, background: 'rgba(255,255,255,0.96)', borderTop: `0.5px solid ${C.border}`, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, height: 34, borderRadius: 999, background: C.fill, fontSize: 14, color: C.text3, display: 'flex', alignItems: 'center', paddingLeft: 14 }}>说点什么…</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.text3 }}>发送</span>
      </div>
    </>
  )
}

// ---------- ③ 发布计划（对齐掘金参考样式的编辑器形制） ----------

function ToolbarBars({ align, on }: { align: 'left' | 'center' | 'right'; on?: boolean }) {
  const color = on ? C.primary : C.text2
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end', gap: 3, width: 18 }}>
      {[18, 11, 18].map((w, i) => (
        <span key={i} style={{ width: w, height: 2, borderRadius: 1, background: color }} />
      ))}
    </span>
  )
}

function EditToolbar() {
  const dots: (string | undefined)[] = [undefined, '#1A1D24', C.primary, C.danger]
  return (
    <div style={{ flexShrink: 0, background: C.card, borderTop: `0.5px solid ${C.border}` }}>
      <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 10px' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.primary }}>B</span>
        <ToolbarBars align="left" />
        <ToolbarBars align="center" on />
        <ToolbarBars align="right" />
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text2 }}>H1</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>H2</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text2 }}>正文</span>
      </div>
      <div style={{ height: 44, borderTop: `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 14 }}>
        {dots.map((d, i) => (
          <span
            key={i}
            style={{
              width: 16, height: 16, borderRadius: 8, flexShrink: 0,
              background: d ?? C.card,
              border: d ? 'none' : `1.5px solid ${C.text3}`,
              boxShadow: i === 2 ? `0 0 0 2px ${C.card}, 0 0 0 3.5px ${C.primary}` : 'none',
            }}
          />
        ))}
        <span style={{ width: 1, height: 18, background: C.border, margin: '0 2px' }} />
        {['引用', '分割线', '图片', '删除'].map((t) => (
          <span key={t} style={{ fontSize: 13, color: C.text2 }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

function EditScreen() {
  return (
    <>
      <Navbar title="发布计划" back />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {/* 表单卡：标题 / 创建人 / 详情 同卡三段 */}
          <div style={{ ...card, marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>标题</span>
              <span style={{ fontSize: 11, color: C.text3 }}>9 / 40</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: C.text1, marginTop: 6 }}>周六下午去哪儿玩？</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <span style={{ fontSize: 15, color: C.text1 }}>创建人</span>
              <span style={{ fontSize: 15, color: C.text2 }}>我</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginTop: 16 }}>详情</div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.text1, textAlign: 'center', lineHeight: 1.4 }}>本周六下午 2:00 出发</div>
              <div style={{ fontSize: 15, color: C.text1, lineHeight: 1.7 }}>地点三选一：滨江公园 / 植物园 / 室内运动馆，投票决定，得票最高者出发。</div>
              <div style={{ borderLeft: `3px solid ${C.border}`, paddingLeft: 10, fontSize: 14, color: C.text2, lineHeight: 1.6 }}>记得带水和防晒，穿运动鞋。</div>
              <div style={{ borderTop: `0.5px solid ${C.border}`, margin: '2px 0' }} />
            </div>
          </div>

          {/* 截止时间 */}
          <div style={{ ...card, ...cardGap, padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px' }}>
              <span style={{ fontSize: 15, color: C.text1 }}>截止时间</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 15, color: C.primary }}>明天 18:00</span>
                <Icon name="chevronR" size={14} color={C.text3} />
              </span>
            </div>
            <div style={{ borderTop: `0.5px solid ${C.border}` }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px' }}>
              <span style={{ fontSize: 15, color: C.text1 }}>
                开启选项表决<span style={{ fontSize: 12, color: C.text3, marginLeft: 6 }}>最多 6 项</span>
              </span>
              <Switch on />
            </div>
          </div>

          {/* 选项 */}
          <div style={{ ...card, ...cardGap, padding: 0 }}>
            {['滨江公园', '植物园', '室内运动馆'].map((opt, i) => (
              <div key={opt}>
                {i > 0 && <div style={{ borderTop: `0.5px solid ${C.border}` }} />}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
                  <span style={{ fontSize: 15, color: C.text1 }}>{opt}</span>
                  <span style={{ fontSize: 18, color: C.text3, fontWeight: 500 }}>⋮⋮</span>
                </div>
              </div>
            ))}
            <div style={{ borderTop: `0.5px solid ${C.border}` }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 14px', color: C.primary, fontSize: 15, fontWeight: 500 }}>
              <Icon name="plus" size={15} color={C.primary} />
              添加选项
            </div>
          </div>

          <div style={{ ...card, ...cardGap, padding: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px' }}>
              <span style={{ fontSize: 15, color: C.text1 }}>仅限指定成员可见</span>
              <Switch on={false} />
            </div>
          </div>

          <div style={{ margin: '18px 16px 0', height: 48, borderRadius: 14, background: C.primary, color: '#fff', fontSize: 17, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            发布计划
          </div>
          <div style={{ height: 20 }} />
        </div>
        <EditToolbar />
      </div>
    </>
  )
}

// ---------- ④ 我的 ----------

function MineScreen() {
  return (
    <>
      <Navbar title="我的" />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {/* 个人卡 */}
        <div style={{ ...card, marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size={56} tint="#B9C2CF" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text1 }}>阿黄</div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>众议用户 · 2026-11-12 加入</div>
          </div>
          <Chip text="编辑资料" tone="blue" />
        </div>

        {/* 统计 */}
        <div style={{ ...card, ...cardGap, display: 'flex', padding: '12px 0' }}>
          {[
            { n: '5', l: '发起' },
            { n: '12', l: '参与' },
            { n: '1', l: '进行中' },
          ].map((s, i) => (
            <div key={s.l} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? `0.5px solid ${C.border}` : 'none' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.text1 }}>{s.n}</div>
              <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* 分段筛选 */}
        <div style={{ margin: '12px 16px 0' }}>
          <Segmented items={['发起', '参与', '进行中', '已截止']} active={0} />
        </div>

        {/* 计划列表 */}
        <div style={{ ...card, marginTop: 10, padding: 0 }}>
          {[
            { t: '周末团建地点投票', tone: 'green' as const, tag: '进行中', sub: '12 赞同 · 4 反对' },
            { t: '周五聚餐要不要去', tone: 'green' as const, tag: '进行中', sub: '5 赞同 · 9 反对' },
            { t: '年会节目单排序', tone: 'gray' as const, tag: '已截止', sub: '21 赞同 · 2 反对' },
          ].map((row, i) => (
            <div key={row.t}>
              {i > 0 && <div style={{ borderTop: `0.5px solid ${C.border}`, marginLeft: 14 }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: C.text1 }}>{row.t}</span>
                    <Chip text={row.tag} tone={row.tone} />
                  </div>
                  <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{row.sub}</div>
                </div>
                <Icon name="chevronR" size={14} color={C.text3} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: C.text3, marginTop: 12 }}>没有更多了</div>

        {/* 登出 */}
        <div style={{ ...card, marginTop: 14, padding: 0 }}>
          <div style={{ textAlign: 'center', padding: '13px 0', fontSize: 16, fontWeight: 500, color: C.danger }}>退出登录</div>
        </div>
      </div>
    </>
  )
}

// ---------- 规范表 ----------

function Swatch({ name, hex, dark }: { name: string; hex: string; dark?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 26, height: 26, borderRadius: 7, background: hex, border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }} />
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: dark ? '#fff' : C.text1 }}>{name}</div>
        <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.7)' : C.text3, fontFamily: 'ui-monospace, monospace' }}>{hex}</div>
      </div>
    </div>
  )
}

function SpecRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '12px 0', borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
      <span style={{ width: 96, flexShrink: 0, fontSize: 12, fontWeight: 600, color: C.text2 }}>{title}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

// ---------- 页面 ----------

export default function DecideIOSDesign() {
  return (
    <div style={{ fontFamily: F, color: C.text1, maxWidth: 1280, margin: '0 auto', padding: '28px 24px 48px' }}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>众议 Decide · iOS 扁平化改版设计稿</div>
      <div style={{ fontSize: 14, color: C.text2, marginTop: 8, lineHeight: 1.6 }}>
        扁平三原则：<b>无卡片阴影</b>（灰底白卡 inset grouped）、<b>iOS 系统色 + 10% 淡底徽标</b>、<b>胶囊/分段控件</b>。
        下方所有色值、字号、圆角即将来 tokens.scss 的落地值，设计稿 = 实现规范。
      </div>

      {/* 页面稿 */}
      <div style={{ fontSize: 17, fontWeight: 700, margin: '26px 0 4px' }}>一、页面设计稿（375 逻辑宽 ×0.8）</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, marginTop: 12 }}>
        <div>
          <Phone tab="home"><HomeScreen /></Phone>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>① 首页 · 计划流</div>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 4, lineHeight: 1.6, width: 300 }}>
            灰底白卡、系统绿「进行中」徽标、蓝底倒计时胶囊、绿红双色扁平比例条、票数/评论弱化为三级灰。
          </div>
        </div>
        <div>
          <Phone><DetailScreen /></Phone>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>② 计划详情 · 表决</div>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 4, lineHeight: 1.6, width: 300 }}>
            正文由 mp-html 渲染（引用=灰底蓝边、图片圆角块）；选项=圆形单选 cell；赞同/反对=系统蓝/红填充按钮；底部 iMessage 式胶囊输入条。
          </div>
        </div>
        <div>
          <Phone><EditScreen /></Phone>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>③ 发布计划 · 参考样式编辑器</div>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 4, lineHeight: 1.6, width: 300 }}>
            标题/创建人/详情 同卡三段；详情=块级 WYSIWYG（居中加粗 H2 + 正文 + 引用条 + 分割线）；底部固定两行工具栏：行1 字重 B/对齐三条横线/H1·H2·正文，行2 四色板+引用/分割线/图片/删除；蓝色=当前聚焦激活态。
          </div>
        </div>
        <div>
          <Phone tab="mine"><MineScreen /></Phone>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>④ 我的 · 个人与筛选</div>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 4, lineHeight: 1.6, width: 300 }}>
            个人卡+三列统计（细线分隔）；FilterTabs 改 <b>iOS 分段控件</b>（白钮+极淡投影）；列表行=分隔线 inset 14；登出=红色文字行。
          </div>
        </div>
      </div>

      {/* 令牌 */}
      <div style={{ fontSize: 17, fontWeight: 700, margin: '30px 0 4px' }}>二、设计令牌（tokens.scss 落地值）</div>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 12, background: C.card, borderRadius: 12, padding: 18, border: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 2, minWidth: 380 }}>
          <Swatch name="$color-primary" hex={C.primary} />
          <Swatch name="$color-primary-light" hex={C.primaryLight} />
          <Swatch name="$color-agree" hex={C.agree} />
          <Swatch name="$color-agree-light" hex={C.agreeLight} />
          <Swatch name="$color-danger / disagree" hex={C.danger} />
          <Swatch name="$color-danger-light" hex={C.dangerLight} />
          <Swatch name="$color-text-1" hex={C.text1} />
          <Swatch name="$color-text-2" hex={C.text2} />
          <Swatch name="$color-text-3" hex={C.text3} />
          <Swatch name="$color-bg-page" hex={C.page} />
          <Swatch name="$color-fill（分段/引用/输入底）" hex={C.fill} />
          <Swatch name="$color-border" hex={C.border} />
        </div>
        <div style={{ flex: 1, minWidth: 260, fontSize: 13, color: C.text2, lineHeight: 2 }}>
          <div><b style={{ color: C.text1 }}>字号（rpx）</b>：22 / 26 / 30 / 34 / 40（原体系不变）</div>
          <div><b style={{ color: C.text1 }}>字重</b>：标题 600–700，正文 400（iOS 语义）</div>
          <div><b style={{ color: C.text1 }}>圆角（rpx）</b>：sm 12 · md 20 · lg 28 · round 999</div>
          <div><b style={{ color: C.text1 }}>阴影</b>：卡片一律无；仅分段控件白钮留极淡投影</div>
          <div><b style={{ color: C.text1 }}>卡片</b>：白底 radius 20，页面底色 #F2F2F7</div>
          <div><b style={{ color: C.text1 }}>分隔线</b>：0.5pt 物理 px，inset 左 28rpx</div>
        </div>
      </div>

      {/* 组件规范 */}
      <div style={{ fontSize: 17, fontWeight: 700, margin: '30px 0 4px' }}>三、组件规范</div>
      <div style={{ background: C.card, borderRadius: 12, padding: '4px 18px', border: '1px solid rgba(0,0,0,0.06)' }}>
        <SpecRow title="分段控件">
          <div style={{ width: 260 }}><Segmented items={['发起', '参与', '进行中', '已截止']} active={0} /></div>
          <span style={{ fontSize: 12, color: C.text3 }}>轨道 #E9E9EB · 白钮 r7 + 0.1 投影 · 13/600</span>
        </SpecRow>
        <SpecRow title="按钮">
          <span style={{ padding: '9px 22px', borderRadius: 12, background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600 }}>填充蓝（主操作）</span>
          <span style={{ padding: '9px 22px', borderRadius: 12, background: C.danger, color: '#fff', fontSize: 14, fontWeight: 600 }}>填充红（反对）</span>
          <span style={{ padding: '9px 22px', borderRadius: 12, background: C.primaryLight, color: C.primary, fontSize: 14, fontWeight: 600 }}>淡底（次操作）</span>
          <span style={{ padding: '9px 22px', borderRadius: 12, background: C.fill, color: C.text1, fontSize: 14, fontWeight: 600 }}>灰底（中性）</span>
        </SpecRow>
        <SpecRow title="徽标 Chip">
          <Chip text="进行中" tone="green" />
          <Chip text="已截止" tone="gray" />
          <Chip text="23小时12分" tone="blue" />
          <Chip text="表决中" tone="red" />
          <span style={{ fontSize: 12, color: C.text3 }}>系统色 10% 淡底 · 前景用加深一档的系统色</span>
        </SpecRow>
        <SpecRow title="比例条">
          <div style={{ width: 200 }}><RatioBar agree={12} disagree={4} /></div>
          <span style={{ fontSize: 12, color: C.text3 }}>高 16rpx · 全圆角 · 中缝 4rpx 白</span>
        </SpecRow>
        <SpecRow title="列表 Cell">
          <div style={{ width: 260, background: C.card, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px' }}>
              <span style={{ fontSize: 14, color: C.text1 }}>截止时间</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 14, color: C.text2 }}>明天 18:00</span>
                <Icon name="chevronR" size={13} color={C.text3} />
              </span>
            </div>
            <div style={{ borderTop: `0.5px solid ${C.border}`, margin: '0 0 0 14px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px' }}>
              <span style={{ fontSize: 14, color: C.text1 }}>开启选项表决</span>
              <Switch on />
            </div>
          </div>
          <span style={{ fontSize: 12, color: C.text3 }}>高 ≥ 88rpx · 值=次级灰 · 箭头=三级灰 · 分隔线 inset</span>
        </SpecRow>
        <SpecRow title="引用块 / 分割线">
          <div style={{ width: 220, background: C.fill, borderLeft: `3px solid ${C.primary}`, borderRadius: 8, padding: '7px 11px', fontSize: 12.5, color: C.text2 }}>
            引用文本：灰底 + 蓝左边线 + 圆角 16rpx
          </div>
          <div style={{ width: 90, borderTop: `1px solid ${C.border}` }} />
          <span style={{ fontSize: 12, color: C.text3 }}>分割线保持 hairline-top mixin</span>
        </SpecRow>
        <SpecRow title="评论输入条">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.page, borderRadius: 10, padding: 8, width: 300 }}>
            <span style={{ flex: 1, height: 30, borderRadius: 999, background: C.fill, fontSize: 13, color: C.text3, display: 'flex', alignItems: 'center', paddingLeft: 12 }}>说点什么…</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>发送</span>
          </div>
          <span style={{ fontSize: 12, color: C.text3 }}>iMessage 式：胶囊输入 + 蓝色文字钮</span>
        </SpecRow>
      </div>

      <div style={{ fontSize: 13, color: C.text3, marginTop: 22, lineHeight: 1.7 }}>
        落地路径：tokens.scss / mixins.scss 换上面的值 → FilterTabs（分段控件）/ VoteActions / OptionCard / CommentInput / BaseCell / PlanCard / StatCards / UserHeader 按本稿调整 → 每页模拟器截图对照验收。Skyline 不支持的能力（毛玻璃、阴影滥用、伪元素）已全部规避。
      </div>
    </div>
  )
}
