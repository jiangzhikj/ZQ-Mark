type MessageType = 'success' | 'warning' | 'error' | 'info'

export interface ZqMessageAction {
  label: string
  onClick: () => void
}

export interface ZqMessageOptions {
  duration?: number
  action?: ZqMessageAction
}

const COLORS: Record<MessageType, { bg: string; border: string; text: string }> = {
  success: { bg: '#f0f9eb', border: '#e1f3d8', text: '#67c23a' },
  warning: { bg: '#fdf6ec', border: '#faecd8', text: '#e6a23c' },
  error: { bg: '#fef0f0', border: '#fde2e2', text: '#f56c6c' },
  info: { bg: '#f4f4f5', border: '#e9e9eb', text: '#909399' },
}

const DARK_COLORS: Record<MessageType, { bg: string; border: string; text: string }> = {
  success: { bg: '#1a2e1a', border: '#2d4a2d', text: '#67c23a' },
  warning: { bg: '#2e2a1a', border: '#4a3f2d', text: '#e6a23c' },
  error: { bg: '#2e1a1a', border: '#4a2d2d', text: '#f56c6c' },
  info: { bg: '#2a2a2a', border: '#3a3a3a', text: '#a0a0a0' },
}

function getColors(type: MessageType) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return isDark ? DARK_COLORS[type] : COLORS[type]
}

function show(message: string, type: MessageType, options: ZqMessageOptions = {}) {
  const colors = getColors(type)
  const duration = options.duration ?? (options.action ? 12000 : 3000)
  const el = document.createElement('div')
  Object.assign(el.style, {
    position: 'fixed',
    top: 'calc(var(--titlebar-height, 52px) + 12px)',
    left: '50%',
    transform: 'translateX(-50%) translateY(-10px)',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'inherit',
    zIndex: '10051',
    opacity: '0',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    color: colors.text,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    pointerEvents: options.action ? 'auto' : 'none',
    maxWidth: 'min(92vw, 480px)',
    lineHeight: '1.4',
  })

  if (options.action) {
    el.style.setProperty('-webkit-app-region', 'no-drag')
  }

  const content = document.createElement('span')
  content.textContent = message

  if (options.action) {
    content.appendChild(document.createTextNode(' · '))

    const link = document.createElement('span')
    link.textContent = options.action.label
    link.setAttribute('role', 'button')
    link.setAttribute('tabindex', '0')
    Object.assign(link.style, {
      cursor: 'pointer',
      color: colors.text,
      fontSize: 'inherit',
      fontFamily: 'inherit',
      fontWeight: 'inherit',
      textDecoration: 'none',
    })
    link.style.setProperty('-webkit-app-region', 'no-drag')

    const trigger = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      options.action?.onClick()
    }

    link.addEventListener('click', trigger)
    link.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') trigger(e)
    })

    content.appendChild(link)
  }

  el.appendChild(content)
  document.body.appendChild(el)

  requestAnimationFrame(() => {
    el.style.opacity = '1'
    el.style.transform = 'translateX(-50%) translateY(0)'
  })

  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateX(-50%) translateY(-10px)'
    setTimeout(() => el.remove(), 300)
  }, duration)
}

type ShowFn = (msg: string, options?: ZqMessageOptions) => void

export const ZqMessage = {
  success: ((msg, options) => show(msg, 'success', options)) as ShowFn,
  warning: ((msg, options) => show(msg, 'warning', options)) as ShowFn,
  error: ((msg, options) => show(msg, 'error', options)) as ShowFn,
  info: ((msg, options) => show(msg, 'info', options)) as ShowFn,
}
