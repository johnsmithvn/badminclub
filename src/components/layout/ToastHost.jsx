// Toast: một dòng nổi ở đáy giữa, tự tắt sau cfg.toastMs. Nội dung do actions bắn ra.

import { useApp } from '#contexts/AppContext.jsx'

export default function ToastHost() {
  const { ui } = useApp()
  if (!ui.toast) return null
  return <div role="status" aria-live="polite" style={S.toast}>{ui.toast}</div>
}

const S = {
  toast: {
    position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 90,
    padding: '12px 20px', borderRadius: 8, background: 'var(--navy-800)', color: '#fff',
    font: 'var(--type-label)', boxShadow: 'var(--shadow-lg)',
  },
}
