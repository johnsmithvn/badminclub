import { useState } from 'react'
import cfg from '#config/app.json' with { type: 'json' }
import Sidebar from '#components/layout/Sidebar.jsx'
import AppHeader from '#components/layout/AppHeader.jsx'
import ToastHost from '#components/layout/ToastHost.jsx'
import Dialogs from '#pages/Dialogs.jsx'
import MobileFooterNav from '#components/layout/MobileFooterNav.jsx'
import MoreSheet from '#components/layout/MoreSheet.jsx'
import { useMobile } from '#hooks/useMobile.js'

export default function AppLayout({ route, children }) {
  const isMobile = useMobile(768)
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <div style={S.root}>
      {!isMobile && <Sidebar route={route} />}
      <div style={S.col}>
        <AppHeader route={route} />
        <main style={{ ...S.main, ...(isMobile ? S.mainMobile : {}) }}>
          <div style={{ ...S.wrap, ...(isMobile ? S.wrapMobile : {}) }}>{children}</div>
        </main>
      </div>

      {isMobile && (
        <>
          <MobileFooterNav
            route={route}
            isMoreOpen={moreOpen}
            onToggleMore={(val) => setMoreOpen((prev) => (val !== undefined ? val : !prev))}
          />
          <MoreSheet
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            route={route}
          />
        </>
      )}

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
  mainMobile: { padding: '14px', paddingBottom: '80px' },
  wrap: { maxWidth: cfg.ui.contentMaxWidth, margin: '0 auto', display: 'grid', gap: 16 },
  wrapMobile: { width: '100%', gridTemplateColumns: '1fr', gap: 12 },
}

