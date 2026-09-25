import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Dialog, Skeleton } from '#ds'
import { Empty } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { useTourPoll } from '#hooks/useTourPoll.js'
import { can } from '#lib/roles.js'
import { HUB_TABS, entriesOpen, hubChecklist } from '#lib/tournament/hub.js'
import { eventPlayers, eventTeams } from '#lib/tournament/pairing.js'
import { tournamentMoney } from '#lib/tournament/finance.js'
import { pathOf } from '#routes'
import { t } from '#i18n'
import TourHero from '#components/tournament/TourHero.jsx'
import LiveCourtsStrip from '#components/tournament/LiveCourtsStrip.jsx'
import EventBar from '#components/tournament/EventBar.jsx'
import TourStepper from '#components/tournament/TourStepper.jsx'
import OverviewTab from '#components/tournament/OverviewTab.jsx'
import InfoTab from '#components/tournament/InfoTab.jsx'
import PlayersTab from '#components/tournament/PlayersTab.jsx'
import FormatTab from '#components/tournament/FormatTab.jsx'
import PairingTab from '#components/tournament/PairingTab.jsx'
import { ScoreDialog } from '#components/tournament/MatchDialogs.jsx'
import { ruleLabel } from '#components/tournament/tourUtils.js'
import TourFormDialog from '#components/tournament/TourFormDialog.jsx'
import TourModuleNav from '#components/tournament/TourModuleNav.jsx'

/**
 * Hub một giải (chuẩn theo thiết kế TDMS Dark):
 * Top Header Nav & Action Buttons -> Hero -> Dải Sân Live -> Hàng thẻ nội dung -> Stepper -> Tab nội dung.
 */
export default function TournamentHub() {
  const { id } = useParams()
  const { db, a, tour } = useApp()
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const canEdit = can(db.viewAs || 'owner', 'sessions')

  const [missingId, setMissingId] = useState(null)
  const missing = missingId === id
  const [tab, setTab] = useState('overview')
  const [eventId, setEventId] = useState(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [scoringId, setScoringId] = useState(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showProjectionModal, setShowProjectionModal] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    a.tourOpen(id)
      .then((d) => {
        if (!alive) return
        if (!d || d.deletedAt || d.clubId !== db.clubId) setMissingId(id)
      })
      .catch(() => { if (alive) setMissingId(id) })
    return () => { alive = false; a.tourOpen(null) }
  }, [id, a, db.clubId])

  // Giữ tươi khi giải đã có lịch thi đấu
  useTourPoll(Boolean(tour && tour.id === id && tour.matches.length), a.tourPoll)

  const back = () => navigate(pathOf('tournaments'))
  const openBracket = (eid) => eid && navigate(pathOf('tournamentBracket', id, eid))

  if (missing) {
    return (
      <div style={{ borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', paddingBottom: 18 }}>
        <Empty icon="medal" title={t('tournament.notFound')} />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button variant="secondary" icon="arrow-left" onClick={back}>{t('tournament.hero.back')}</Button>
        </div>
      </div>
    )
  }
  if (!tour || tour.id !== id) return <Skeleton height={220} />

  const money = tournamentMoney({
    registrations: tour.registrations, prizes: tour.prizes, budgetLines: tour.budgetLines, eventCount: tour.events.length,
  })
  const checklist = hubChecklist(tour)
  const active = tour.registrations.filter((r) => r.status === 'registered')
  const selected = tour.events.some((e) => e.id === eventId) ? eventId : tour.events[0]?.id
  const event = tour.events.find((e) => e.id === selected) || null
  const scheduled = tour.events.filter((e) => tour.stages.some((st) => st.eventId === e.id && st.status !== 'pending'))

  const subs = {
    overview: t('tournament.sub.overview', { done: checklist.filter((c) => c.done).length, total: checklist.length }),
    info: t('tournament.sub.info'),
    players: t('tournament.sub.players', { n: active.length, unpaid: active.filter((r) => !r.paid).length }),
    format: formatSub(tour, event),
    pairing: pairingSub(tour, event),
  }

  const isDones = {
    overview: checklist.every((c) => c.done),
    info: tour.prizes.length > 0,
    players: active.length >= 2,
    format: tour.stages.some((s) => s.eventId === selected && s.status !== 'pending'),
    pairing: Boolean(event && event.status !== 'draft' && event.status !== 'pairing'),
  }

  const saveInfo = async (form) => {
    const ok = await a.tourUpdate(form)
    if (ok) setEditing(false)
    return ok
  }
  const remove = async () => {
    if (await a.tourDelete()) back()
  }

  // Hành động Nhập tỷ số nhanh từ thanh công cụ
  const handleQuickScore = () => {
    const liveMatch = tour.matches.find((m) => m.status === 'live')
    if (liveMatch) {
      setScoringId(liveMatch.id)
      return
    }
    const readyMatch = tour.matches.find((m) => m.status === 'ready')
    if (readyMatch) {
      setScoringId(readyMatch.id)
      return
    }
    // Nếu chưa có trận sẵn sàng, điều hướng đến nhánh hoặc thông báo
    if (selected) openBracket(selected)
  }

  // Sao chép link đăng ký
  const handleCopyLink = () => {
    const url = `${window.location.origin}/giai-dau/${tour.id}`
    try {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Bỏ qua lỗi clipboard
    }
    setShowShareModal(true)
  }

  const scoringMatch = scoringId ? tour.matches.find((m) => m.id === scoringId) : null

  return (
    <div style={{ display: 'grid', gap: 14, width: '100%', maxWidth: 1440, margin: '0 auto' }}>
      {/* 1. Thanh Module Nav & Action Header */}
      <TourModuleNav
        tour={tour}
        active="hub"
        isMobile={isMobile}
        events={scheduled}
        eventId={scheduled.some((e) => e.id === selected) ? selected : undefined}
        onSelectEvent={setEventId}
        onHub={() => setTab('overview')}
        onBracket={openBracket}
        onScheme={openBracket}
        onScore={handleQuickScore}
        onRegisterLink={handleCopyLink}
        onProjection={() => setShowProjectionModal(true)}
      />

      {/* 2. Hero Section */}
      <TourHero
        tour={tour}
        money={money}
        isMobile={isMobile}
        canEdit={canEdit}
        onBack={back}
        onEdit={() => setEditing(true)}
        onDelete={() => setDeleting(true)}
        onStatus={a.tourSetStatus}
      />

      {/* 3. Dải Sân Live (Live Courts Strip) */}
      <LiveCourtsStrip
        tour={tour}
        db={db}
        onScore={(m) => setScoringId(m.id)}
        onOpenBracket={openBracket}
        isMobile={isMobile}
      />

      {/* 4. Hàng Thẻ Nội Dung (Event Bar) */}
      <EventBar
        tour={tour}
        value={selected}
        onChange={setEventId}
        canEdit={canEdit}
        isMobile={isMobile}
        onAdd={a.tourAddEvent}
        onDelete={a.tourDeleteEvent}
      />

      {/* 5. Stepper 5 Tab */}
      <TourStepper
        items={HUB_TABS.map((k) => ({ key: k, sub: subs[k], isDone: isDones[k] }))}
        value={tab}
        onChange={setTab}
        isMobile={isMobile}
      />

      {/* 6. Nội Dung Tab Đang Chọn */}
      {tab === 'overview' && (
        <OverviewTab
          tour={tour}
          db={db}
          a={a}
          event={event}
          onGo={setTab}
          canEdit={canEdit}
          isMobile={isMobile}
          onOpenBracket={openBracket}
        />
      )}
      {tab === 'info' && <InfoTab tour={tour} canEdit={canEdit} isMobile={isMobile} a={a} onEdit={() => setEditing(true)} />}
      {tab === 'players' && <PlayersTab tour={tour} db={db} a={a} canEdit={canEdit} isMobile={isMobile} />}
      {(tab === 'format' || tab === 'pairing') && !event && <Empty icon="medal" title={t('tournament.pairing.noEvent')} />}
      {tab === 'format' && event && <FormatTab tour={tour} event={event} db={db} a={a} canEdit={canEdit} isMobile={isMobile} onOpenBracket={openBracket} />}
      {tab === 'pairing' && event && <PairingTab tour={tour} event={event} db={db} a={a} canEdit={canEdit} isMobile={isMobile} />}

      {/* Dialog Sửa Thông Tin Giải */}
      {editing && <TourFormDialog tour={tour} onClose={() => setEditing(false)} onSave={saveInfo} />}

      {/* Dialog Xoá Giải */}
      {deleting && (
        <Dialog
          open
          width={460}
          title={t('tournament.deleteTitle', { name: tour.name })}
          onClose={() => setDeleting(false)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setDeleting(false)}>{t('common.cancel')}</Button>
              <Button variant="danger" icon="trash-2" onClick={remove}>{t('tournament.delete')}</Button>
            </>
          )}
        >
          <div style={{ font: 'var(--type-body)', color: 'var(--text-secondary)' }}>{t('tournament.deleteBody')}</div>
        </Dialog>
      )}

      {/* Dialog Ghi Điểm / Nhập Tỷ Số Trận Đấu */}
      {scoringMatch && (
        <ScoreDialog
          match={scoringMatch}
          tour={tour}
          db={db}
          onClose={() => setScoringId(null)}
          onCommit={(p) => a.tourCommit(scoringMatch.id, p)}
          onCourt={(label) => a.tourSchedule(scoringMatch.id, scoringMatch.seqNo, label)}
          onStart={(m) => m.status === 'ready' && a.tourStartMatch(m.id, m.courtLabel)}
        />
      )}

      {/* Dialog Chia Sẻ Link Đăng Ký */}
      {showShareModal && (
        <Dialog
          open
          width={480}
          title={t('tournament.module.registerLink')}
          onClose={() => setShowShareModal(false)}
          footer={<Button variant="secondary" onClick={() => setShowShareModal(false)}>{t('common.close')}</Button>}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ font: 'var(--type-body)', color: 'var(--text-secondary)' }}>
              {t('tournament.module.registerLinkHint')}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--surface-inset)',
              border: '1px solid var(--border-subtle)',
            }}>
              <span style={{ font: '500 12.5px/1 var(--font-mono)', color: 'var(--teal-500)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {window.location.origin}/giai-dau/{tour.id}
              </span>
              <Button size="sm" onClick={handleCopyLink}>
                {copied ? t('tournament.module.copied') : t('tournament.module.copy')}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Dialog Màn Hình Trình Chiếu */}
      {showProjectionModal && (
        <Dialog
          open
          width={480}
          title={t('tournament.module.projection')}
          onClose={() => setShowProjectionModal(false)}
          footer={<Button variant="secondary" onClick={() => setShowProjectionModal(false)}>{t('common.close')}</Button>}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ font: 'var(--type-body)', color: 'var(--text-secondary)' }}>
              {t('tournament.module.projectionDesc')}
            </div>
            <div style={{ font: '400 12.5px/1.4 var(--font-sans)', color: 'var(--text-muted)' }}>
              {t('tournament.module.projectionNote')}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}

/** Dòng phụ bước ② Thể thức của nội dung đang chọn: 'Loại trực tiếp · 1 sec 30 · chạm'. */
function formatSub(tour, event) {
  const st = event && tour.stages.find((s) => s.eventId === event.id && s.seq === 1)
  if (!st) return t('tournament.sub.formatNone')
  return t('tournament.sub.format', { flow: t('tournament.format.tpl.ko') + ' · ' + ruleLabel(st.matchRule) })
}

/** Dòng phụ bước ③ Ghép cặp: số cặp đủ người / đơn / đã chốt. */
function pairingSub(tour, event) {
  if (!event) return ''
  const teams = eventTeams(tour, event.id)
  if (!entriesOpen(event)) return t('tournament.sub.pairingLocked', { n: teams.length })
  if (event.teamSize === 1) return t('tournament.sub.pairingSingles', { n: eventPlayers(tour, event.id).length })
  return t('tournament.sub.pairing', { full: teams.filter((x) => x.full).length, total: teams.length })
}
