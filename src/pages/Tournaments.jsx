import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Skeleton } from '#ds'
import { Empty, GRID_PAIR, PageHeader } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { tourErr } from '#contexts/tournamentActions.js'
import { useMobile } from '#hooks/useMobile.js'
import { can } from '#lib/roles.js'
import { fmtK } from '#lib/money.js'
import { pathOf } from '#routes'
import { t } from '#i18n'
import { TourPill } from '#components/tournament/TourBits.jsx'
import { tourMeta } from '#components/tournament/tourUtils.js'
import TourFormDialog from '#components/tournament/TourFormDialog.jsx'

/** Danh sách giải của CLB. Nạp riêng (không nằm trong `db`) — xem docs/TOURNAMENT_PLAN.md §4. */
export default function Tournaments() {
  const { db, a } = useApp()
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const canEdit = can(db.viewAs || 'owner', 'sessions')
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let alive = true
    a.tourList()
      .then((l) => { if (alive) setList(l) })
      .catch((e) => { if (alive) { setErr(tourErr(e)); setList([]) } })
    return () => { alive = false }
  }, [a, db.clubId])

  const create = async (form) => {
    const id = await a.tourCreate(form)
    if (id) navigate(pathOf('tournament', id))
    return Boolean(id)
  }

  return (
    <>
      <PageHeader
        isMobile={isMobile}
        title={t('pages.tournaments.title')}
        subtitle={t('pages.tournaments.desc')}
        actions={canEdit && <Button icon="plus" onClick={() => setCreating(true)}>{t('tournament.create')}</Button>}
      />
      {err && <Alert tone="danger">{err}</Alert>}
      {!list && <Skeleton height={140} />}
      {list && list.length === 0 && (
        <div style={{ borderRadius: 10, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <Empty icon="medal" title={t('tournament.list.emptyTitle')}
            hint={t(canEdit ? 'tournament.list.emptyHint' : 'tournament.list.emptyHintView')} />
        </div>
      )}
      {list && list.length > 0 && (
        <div style={isMobile ? { display: 'grid', gap: 10 } : GRID_PAIR}>
          {list.map((tr) => (
            <button
              key={tr.id}
              type="button"
              onClick={() => navigate(pathOf('tournament', tr.id))}
              style={{
                display: 'grid', gap: 10, textAlign: 'left', cursor: 'pointer', color: 'inherit',
                padding: isMobile ? 14 : '16px 18px', borderRadius: 10, minHeight: 56,
                background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TourPill status={tr.status} />
                <span style={{ flex: 1 }} />
                <span style={{ font: '400 11.5px/1 var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {fmtK(tr.feeMale)} / {fmtK(tr.feeFemale)}
                </span>
              </span>
              <span style={{ font: '700 18px/1.2 var(--font-display)', color: 'var(--text-primary)' }}>{tr.name}</span>
              <span style={{ font: '400 12px/1.4 var(--font-mono)', color: 'var(--text-muted)' }}>{tourMeta(tr)}</span>
            </button>
          ))}
        </div>
      )}
      {creating && <TourFormDialog onClose={() => setCreating(false)} onSave={create} />}
    </>
  )
}
