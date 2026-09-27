import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, Icon, Skeleton } from '#ds'
import { Empty, Mono } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { can } from '#lib/roles.js'
import { useTourPoll } from '#hooks/useTourPoll.js'
import { flowOf } from '#lib/tournament/flow.js'
import { pathOf } from '#routes'
import { t } from '#i18n'
import TourModuleNav from '#components/tournament/TourModuleNav.jsx'
import FlowCanvas from '#components/tournament/FlowCanvas.jsx'
import { rankLabel, ruleLabel, teamName } from '#components/tournament/tourUtils.js'

/**
 * Sơ đồ thi đấu (handoff "Giải đấu · sơ đồ tự do", plan Phase 6) — bản CHỈ XEM dạng pipeline:
 * mọi nội dung trên một màn, mỗi nội dung một hàng khối đội → giai đoạn → (hạng nào đi đâu) → người thắng.
 * Không có ô nhập nào; bấm khối đã có lịch là mở đúng giai đoạn đó ở trang nhánh.
 * "Sửa sơ đồ" (BTC, nội dung chưa có lịch, màn rộng) mở canvas kéo thả dựng thể thức tự do (`FlowCanvas`).
 */
export default function TournamentFlow() {
  const { id } = useParams()
  const { db, a, tour } = useApp()
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const canEdit = can(db.viewAs || 'owner', 'sessions')
  const [missingId, setMissingId] = useState(null)
  const [params] = useSearchParams()
  const currentEventId = params.get('event') || params.get('edit')

  useEffect(() => {
    let alive = true
    a.tourOpen(id)
      .then((d) => { if (alive && (!d || d.deletedAt || d.clubId !== db.clubId)) setMissingId(id) })
      .catch(() => { if (alive) setMissingId(id) })
    return () => { alive = false; a.tourOpen(null) }
  }, [id, a, db.clubId])

  const loaded = Boolean(tour && tour.id === id)
  useTourPoll(Boolean(loaded && tour.matches.length), a.tourPoll)

  const toHub = () => navigate(pathOf('tournament', id))
  if (missingId === id) {
    return (
      <div style={{ borderRadius: 10, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', paddingBottom: 18 }}>
        <Empty icon="medal" title={t('tournament.notFound')} />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button variant="secondary" icon="arrow-left" onClick={() => navigate(pathOf('tournaments'))}>{t('tournament.hero.back')}</Button>
        </div>
      </div>
    )
  }
  if (!loaded) return <Skeleton height={320} />

  const currentEvent = (currentEventId && tour.events.find((e) => e.id === currentEventId)) || tour.events[0] || null

  const nav = (
    <TourModuleNav
      tour={tour}
      active="flow"
      events={tour.events}
      eventId={currentEvent?.id}
      isMobile={isMobile}
      onHub={toHub}
      onFlow={(eid) => eid && navigate(pathOf('tournamentFlow', id) + '?event=' + eid)}
      onBracket={(eid) => eid && navigate(pathOf('tournamentBracket', id, eid))}
    />
  )

  if (!currentEvent) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        {nav}
        <Card><Empty icon="medal" title={t('tournament.event.emptyTitle')} hint={t('tournament.event.emptyHint')} /></Card>
      </div>
    )
  }

  // Trên Mobile: canvas tự do kéo thả không khả thi → hiển thị sơ đồ khối Pipeline
  if (isMobile) {
    const flow = flowOf(tour, currentEvent)
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        {nav}
        <Card title={t('tournament.kind.' + currentEvent.kind)} padding="12px 16px 16px">
          <Mono size={11} color="var(--text-muted)" style={{ display: 'block', marginBottom: 12 }}>
            {t('tournament.canvas.desktopOnly')}
          </Mono>
          {!flow ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.flow.noFormat')}</span>
              <Button size="sm" variant="secondary" iconAfter="arrow-right" onClick={toHub}>{t('tournament.bracket.openHub')}</Button>
            </div>
          ) : (
            <Pipeline
              flow={flow}
              tour={tour}
              db={db}
              isMobile={isMobile}
              onOpen={(stageId) => navigate(pathOf('tournamentBracket', id, currentEvent.id) + '?stage=' + stageId)}
            />
          )}
        </Card>
      </div>
    )
  }

  // Trên Desktop: mở THẲNG FlowCanvas theo đúng chuẩn Handoff "Giải đấu · sơ đồ tự do"!
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {nav}
      <FlowCanvas
        key={currentEvent.id}
        tour={tour}
        event={currentEvent}
        db={db}
        a={a}
        canEdit={canEdit}
        onBack={toHub}
        onOpenBracket={(eid) => navigate(pathOf('tournamentBracket', id, eid))}
      />
    </div>
  )
}

export function Pipeline({ flow, tour, db, isMobile, onOpen }) {
  const row = { display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 8 }
  const endOf = (node) => <WinnerBlock node={node} tour={tour} db={db} />
  return (
    <div style={{ overflowX: isMobile ? 'visible' : 'auto' }}>
      <div style={{ ...row, minWidth: isMobile ? 0 : 'min-content' }}>
        <Block title={t('tournament.flow.teams')} lines={[t('tournament.bracket.slotsN', { n: flow.teams })]} />
        <Arrow isMobile={isMobile} />
        <StageBlock node={flow.first} onOpen={onOpen} />
        {flow.next.length === 0 ? (
          <><Arrow isMobile={isMobile} />{endOf(flow.first)}</>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {flow.next.map((n) => (
              <div key={n.id} style={row}>
                <Arrow isMobile={isMobile} label={rankLabel(n.ranks)} />
                <StageBlock node={n} onOpen={onOpen} />
                <Arrow isMobile={isMobile} />
                {endOf(n)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Arrow({ isMobile, label }) {
  return (
    <span style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: 4, flex: '0 0 auto', padding: isMobile ? '0 12px' : 0 }}>
      {label && <Mono size={10.5} weight={600} color="var(--status-transit-fg)" style={{ whiteSpace: 'nowrap' }}>{label}</Mono>}
      <Icon name={isMobile ? 'chevron-down' : 'arrow-right'} size={16} style={{ color: 'var(--text-muted)' }} />
    </span>
  )
}

const BOX = { display: 'grid', gap: 5, minWidth: 170, padding: '10px 12px', borderRadius: 10, textAlign: 'left', color: 'inherit' }

function Block({ title, lines }) {
  return (
    <div style={{ ...BOX, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
      <span style={{ font: '700 13px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{title}</span>
      {lines.map((l) => <Mono key={l} size={11} color="var(--text-muted)">{l}</Mono>)}
    </div>
  )
}

const TONE = {
  pending: { key: 'tournament.overview.stagePending', fg: 'var(--text-muted)', bg: 'var(--surface-inset)' },
  running: { key: 'tournament.overview.stageRunning', fg: 'var(--status-transit-fg)', bg: 'var(--surface-accent-soft)' },
  done: { key: 'tournament.overview.stageDone', fg: 'var(--status-delivered-fg)', bg: 'var(--status-delivered-bg)' },
}

/** Khối giai đoạn. Chưa có lịch: viền đứt, số đội là DỰ KIẾN, không bấm được (trang nhánh chưa có gì để xem). */
function StageBlock({ node, onOpen }) {
  const tone = TONE[node.status] || TONE.pending
  const pending = node.status === 'pending'
  const lines = [
    node.type === 'round_robin' && node.groups > 1 ? t('tournament.format.groupCount', { n: node.groups }) : null,
    t(pending ? 'tournament.flow.teamsExpected' : 'tournament.bracket.slotsN', { n: node.teams }),
    node.matches.total ? t('tournament.overview.matchesCount', { done: node.matches.done, total: node.matches.total }) : null,
    node.rule ? ruleLabel(node.rule) : null,
  ].filter(Boolean)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={pending ? undefined : () => onOpen(node.id)}
      style={{
        ...BOX, cursor: pending ? 'default' : 'pointer', background: 'var(--surface-card)',
        border: `1px ${pending ? 'dashed' : 'solid'} ${node.status === 'running' ? 'var(--teal-500)' : 'var(--border-default)'}`,
        boxShadow: pending ? 'none' : 'var(--shadow-xs)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ font: '700 13px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{node.title || t(node.labelKey)}</span>
        <span style={{ padding: '2px 6px', borderRadius: 4, font: '700 9.5px/1 var(--font-sans)', color: tone.fg, background: tone.bg, whiteSpace: 'nowrap' }}>{t(tone.key)}</span>
      </span>
      {lines.map((l) => <Mono key={l} size={11} color="var(--text-muted)">{l}</Mono>)}
      {node.matches.total > 0 && (
        <span style={{ height: 4, borderRadius: 99, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: Math.round((node.matches.done / node.matches.total) * 100) + '%', background: 'var(--teal-500)' }} />
        </span>
      )}
    </button>
  )
}

/** Cuối hàng: nhà vô địch (nhánh chính / loại trực tiếp), nhất nhánh phụ, hoặc nhất bảng (vòng tròn). */
function WinnerBlock({ node, tour, db }) {
  const titleKey = node.type === 'round_robin' ? 'tournament.flow.groupWinner'
    : node.labelKey === 'tournament.stage.plate' ? 'tournament.flow.plateWinner' : 'tournament.bracket.champ'
  const gold = node.winner && titleKey === 'tournament.bracket.champ'
  return (
    <div style={{
      ...BOX, minWidth: 150,
      background: gold ? 'var(--status-delayed-bg)' : 'var(--surface-inset)',
      border: `1px ${node.winner ? 'solid' : 'dashed'} ${gold ? 'var(--podium-gold)' : 'var(--border-default)'}`,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '700 12px/1.2 var(--font-sans)', color: 'var(--text-secondary)' }}>
        <Icon name="trophy" size={14} style={{ color: gold ? 'var(--podium-gold)' : 'var(--text-muted)' }} />
        {t(titleKey)}
      </span>
      <span style={{ font: '600 12.5px/1.3 var(--font-sans)', color: node.winner ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {node.winner ? teamName(tour, db, node.winner)
          // Vòng tròn nhiều bảng kết thúc tại đây: mỗi bảng một thứ hạng, không có "một người thắng".
          : t(node.type === 'round_robin' && node.groups > 1 ? 'tournament.flow.perGroup' : 'tournament.flow.waiting')}
      </span>
    </div>
  )
}
