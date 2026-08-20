// Khung app: sidebar 248px + header + main scroll. Bố cục 1:1 theo DESIGN.md §5.

import cfg from '#config/app.json' with { type: 'json' }
import Sidebar from '#components/layout/Sidebar.jsx'
import AppHeader from '#components/layout/AppHeader.jsx'
import ToastHost from '#components/layout/ToastHost.jsx'
import Dialogs from '#pages/Dialogs.jsx'

export default function AppLayout({ route, children }) {
  return (
    <div style={S.root}>
      <Sidebar route={route} />
      <div style={S.col}>
        <AppHeader route={route} />
        <main style={S.main}>
          <div style={S.wrap}>{children}</div>
        </main>
      </div>
      <Dialogs />
      <ToastHost />
    </div>
  )
}

const S = {
  root: {
    display: 'flex', height: '100vh', overflow: 'hidden',
    background: 'var(--surface-page)', font: 'var(--type-body)', color: 'var(--text-primary)',
  },
  col: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  main: { flex: 1, overflowY: 'auto', padding: '20px 22px 60px' },
  wrap: { maxWidth: cfg.ui.contentMaxWidth, margin: '0 auto', display: 'grid', gap: 16 },
}
