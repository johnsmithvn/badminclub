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
import EventBar from '#components/tournament/EventBar.jsx'
import TourStepper from '#components/tournament/TourStepper.jsx'
import OverviewTab from '#components/tournament/OverviewTab.jsx'
import InfoTab from '#components/tournament/InfoTab.jsx'
import PlayersTab from '#components/tournament/PlayersTab.jsx'
import FormatTab from '#components/tournament/FormatTab.jsx'
import PairingTab from '#components/tournament/PairingTab.jsx'
import { ruleLabel } from '#components/tournament/tourUtils.js'
import TourFormDialog from '#components/tournament/TourFormDialog.jsx'
import TourModuleNav from '#components/tournament/TourModuleNav.jsx'

/**
 * Hub một giải (handoff "Giải đấu · desktop v2"): hero · hàng nội dung · stepper · tab.
 * Dữ liệu giải ở state `tour` riêng, nạp khi vào trang và bỏ khi rời trang (plan §4.2).
 */
export default function TournamentHub() {
  const { id } = useParams()
  const { db, a, tour } = useApp()
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const canEdit = can(db.viewAs || 'owner', 'sessions')
  // Lưu ID giải không tìm thấy, không phải cờ true/false: đổi sang giải khác thì tự hết "thiếu" ngay,
  // không phải đặt lại trong effect (react-hooks/set-state-in-effect cấm setState đồng bộ ở đó).
  const [missingId, setMissingId] = useState(null)
  const missing = missingId === id
  const [tab, setTab] = useState('overview')
  const [eventId, setEventId] = useState(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  // Tổng quan hiện trận đang đánh → giữ tươi khi giải đã có lịch.
  useTourPoll(Boolean(tour && tour.id === id && tour.matches.length), a.tourPoll)

  const back = () => navigate(pathOf('tournaments'))
  const openBracket = (eid) => eid && navigate(pathOf('tournamentBracket', id, eid))

  if (missing) {
    return (
      <div style={{ borderRadius: 10, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', paddingBottom: 18 }}>
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

  const saveInfo = async (form) => {
    const ok = await a.tourUpdate(form)
    if (ok) setEditing(false)
    return ok
  }
  const remove = async () => {
    if (await a.tourDelete()) back()
  }

  return (
    <>
      <TourModuleNav active="hub" isMobile={isMobile} onHub={() => {}} onBracket={openBracket} events={scheduled}
        eventId={scheduled.some((e) => e.id === selected) ? selected : undefined} />
      <TourHero
        tour={tour} money={money} isMobile={isMobile} canEdit={canEdit}
        onBack={back} onEdit={() => setEditing(true)} onDelete={() => setDeleting(true)} onStatus={a.tourSetStatus}
      />
      <EventBar
        tour={tour} value={selected} onChange={setEventId} canEdit={canEdit} isMobile={isMobile}
        onAdd={a.tourAddEvent} onDelete={a.tourDeleteEvent}
      />
      <TourStepper items={HUB_TABS.map((k) => ({ key: k, sub: subs[k] }))} value={tab} onChange={setTab} isMobile={isMobile} />

      {tab === 'overview' && <OverviewTab tour={tour} db={db} onGo={setTab} canEdit={canEdit} onOpenBracket={openBracket} />}
      {tab === 'info' && <InfoTab tour={tour} canEdit={canEdit} isMobile={isMobile} a={a} onEdit={() => setEditing(true)} />}
      {tab === 'players' && <PlayersTab tour={tour} db={db} a={a} canEdit={canEdit} isMobile={isMobile} />}
      {(tab === 'format' || tab === 'pairing') && !event && <Empty icon="medal" title={t('tournament.pairing.noEvent')} />}
      {tab === 'format' && event && <FormatTab tour={tour} event={event} db={db} a={a} canEdit={canEdit} isMobile={isMobile} onOpenBracket={openBracket} />}
      {tab === 'pairing' && event && <PairingTab tour={tour} event={event} db={db} a={a} canEdit={canEdit} isMobile={isMobile} />}

      {editing && <TourFormDialog tour={tour} onClose={() => setEditing(false)} onSave={saveInfo} />}
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
    </>
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
