type MessageType = 'success' | 'warning' | 'error' | 'info'

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

function show(message: string, type: MessageType, duration = 3000) {
  const colors = getColors(type)
  const el = document.createElement('div')
  el.textContent = message
  Object.assign(el.style, {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%) translateY(-10px)',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'inherit',
    zIndex: '9999',
    opacity: '0',
    transition: 'all 0.3s ease',
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    color: colors.text,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    pointerEvents: 'none',
  })

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

export const ZqMessage = {
  success: (msg: string) => show(msg, 'success'),
  warning: (msg: string) => show(msg, 'warning'),
  error: (msg: string) => show(msg, 'error'),
  info: (msg: string) => show(msg, 'info'),
}
