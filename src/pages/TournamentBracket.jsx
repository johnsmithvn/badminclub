import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Skeleton } from '#ds'
import { Empty, Mono } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { can } from '#lib/roles.js'
import { koRounds, progressOf, queueOf } from '#lib/tournament/bracketView.js'
import { pathOf } from '#routes'
import { t } from '#i18n'
import { useTourPoll } from '#hooks/useTourPoll.js'
import BracketBoard, { GroupBoard } from '#components/tournament/BracketBoard.jsx'
import { Seg } from '#components/tournament/TourBits.jsx'
import { stageGroups } from '#lib/tournament/standings.js'
import TourModuleNav from '#components/tournament/TourModuleNav.jsx'
import { EditScoreDialog, ScoreDialog, UndoDialog } from '#components/tournament/MatchDialogs.jsx'
import { draftKey, matchCode, ruleLabel, teamName } from '#components/tournament/tourUtils.js'

/**
 * Nhánh đấu trực tiếp của một nội dung (handoff "Nhánh đấu trực tiếp"). Ghi điểm / hoàn tác / sửa điểm
 * qua RPC; máy khác thấy kết quả qua poll `pollMs` (dừng khi tab ẩn — Supabase free, plan §4.4).
 */
export default function TournamentBracket() {
  const { id, eventId } = useParams()
  const { db, a, tour } = useApp()
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const canEdit = can(db.viewAs || 'owner', 'sessions')
  const [missingId, setMissingId] = useState(null)
  // Giữ ID chứ không giữ bản chụp trận: poll / ghi xong thì hộp thoại đọc bản mới nhất.
  const [scoringId, setScoringId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [undoingId, setUndoingId] = useState(null)
  const [pickedStageId, setPickedStageId] = useState(null) // null = giai đoạn muộn nhất đã có lịch

  useEffect(() => {
    let alive = true
    a.tourOpen(id)
      .then((d) => { if (alive && (!d || d.deletedAt || d.clubId !== db.clubId)) setMissingId(id) })
      .catch(() => { if (alive) setMissingId(id) })
    return () => { alive = false; a.tourOpen(null) }
  }, [id, a, db.clubId])

  const loaded = Boolean(tour && tour.id === id)
  useTourPoll(loaded, a.tourPoll)

  // Nháp bảng điểm của trận đã chốt ở máy khác / đã bị làm lại lịch: xoá, không thì mở lại thấy điểm cũ.
  useEffect(() => {
    if (!loaded) return
    try {
      const open = new Set(tour.matches.filter((m) => m.status === 'ready' || m.status === 'live').map((m) => draftKey(m.id)))
      Object.keys(localStorage).filter((k) => k.startsWith(draftKey('')) && !open.has(k)).forEach((k) => localStorage.removeItem(k))
    } catch { /* localStorage bị chặn — không có nháp để dọn */ }
  }, [loaded, tour])

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

  const scheduled = tour.events.filter((e) => tour.stages.some((s) => s.eventId === e.id && s.status !== 'pending'))
  const event = tour.events.find((e) => e.id === eventId)
  // Nội dung nhiều giai đoạn (vòng bảng → nhánh chính / nhánh phụ): chỉ giai đoạn đã sinh trận mới xem được.
  const live = event ? tour.stages.filter((s) => s.eventId === event.id && s.status !== 'pending').sort((x, y) => x.seq - y.seq) : []
  const stage = live.find((s) => s.id === pickedStageId) || live[live.length - 1] || null
  const hasPlate = Boolean(event) && tour.stages.some((x) => x.eventId === event.id && x.seq === 3)
  const stageLabel = (s) => t(s.type === 'round_robin' ? 'tournament.stage.groups'
    : !hasPlate ? 'tournament.format.koStage' : s.seq === 3 ? 'tournament.stage.plate' : 'tournament.stage.main')
  const nav = (
    <TourModuleNav tour={tour} active="bracket" events={scheduled} eventId={eventId} isMobile={isMobile}
      onHub={toHub} onBracket={(eid) => eid && navigate(pathOf('tournamentBracket', id, eid))} />
  )

  if (!event || !stage) {
    return (
      <>
        {nav}
        <div style={{ borderRadius: 10, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', paddingBottom: 18 }}>
          <Empty icon="medal"
            title={event ? t('tournament.bracket.noSchedule', { name: t('tournament.kind.' + event.kind) }) : t('tournament.bracket.noEvents')}
            hint={t('tournament.bracket.noScheduleHint')} />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button variant="secondary" icon="arrow-left" onClick={toHub}>{t('tournament.bracket.openHub')}</Button>
          </div>
        </div>
      </>
    )
  }

  const isRR = stage.type === 'round_robin'
  const own = tour.matches.filter((m) => m.stageId === stage.id)
  const view = isRR ? null : koRounds(tour.matches, stage.id)
  const groups = isRR ? stageGroups(tour, stage.id) : []
  const prog = progressOf(own)
  const teamsN = isRR
    ? groups.reduce((n, g) => n + g.teams.length, 0)
    : new Set(own.flatMap((m) => (m.round === 0 ? [m.teamAId, m.teamBId] : [])).filter(Boolean)).size
  const next = queueOf(own).slice(0, 3)
  const byId = (mid) => (mid ? own.find((m) => m.id === mid) || null : null)
  const scoring = byId(scoringId)
  const editing = byId(editingId)
  const undoing = byId(undoingId)

  return (
    <>
      {nav}

      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'flex-start',
        gap: 16,
      }}>
        {/* Khối chính hiển thị Header và Nhánh đấu */}
        <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'grid', gap: 14 }}>
          {/* Header Nhánh đấu */}
          <section style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
            gap: isMobile ? 12 : 16, padding: isMobile ? 14 : '14px 18px', borderRadius: 12,
            background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)',
          }}>
            <div style={{ display: 'grid', gap: 6, minWidth: 0, flex: '1 1 280px' }}>
              <span style={{ font: `700 ${isMobile ? 18 : 22}px/1.2 var(--font-display)`, color: 'var(--text-primary)' }}>
                {tour.name} · {t('tournament.kind.' + event.kind)}
              </span>
              <span style={{ font: '400 12px/1.4 var(--font-sans)', color: 'var(--text-muted)' }}>
                {[
                  t(isRR ? 'tournament.format.groupStage' : 'tournament.format.koStage'),
                  t('tournament.bracket.slotsN', { n: teamsN }),
                  !isRR && stage.config?.seeding ? t('tournament.format.seed.' + stage.config.seeding) : null,
                  stage.config?.thirdPlace ? t('tournament.round.third') : null,
                  stage.matchRule ? ruleLabel(stage.matchRule) : null,
                ].filter(Boolean).join(' · ')}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                borderRadius: 99, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
              }}>
                <span style={{ font: '600 11px/1 var(--font-sans)', color: 'var(--text-muted)' }}>
                  {t('tournament.bracket.progress')}:
                </span>
                <Mono size={11.5} weight={700} color="var(--teal-500)">
                  {t('tournament.bracket.progressVal', prog)}
                </Mono>
              </div>

            </div>

            {next.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: '1 1 100%', paddingTop: 4 }}>
                <span style={{ font: '600 11px/1 var(--font-sans)', color: 'var(--text-muted)' }}>{t('tournament.bracket.next')}</span>
                {next.map((m) => (
                  <span key={m.id} style={{ display: 'inline-flex', gap: 6, padding: '4px 9px', borderRadius: 99, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
                    <Mono size={11} weight={700} color="var(--text-primary)">{matchCode(m)}</Mono>
                    <span style={{ font: '500 11.5px/1.2 var(--font-sans)', color: 'var(--text-secondary)' }}>
                      {teamName(tour, db, m.teamAId)} – {teamName(tour, db, m.teamBId)}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </section>

          {live.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Seg options={live.map((s) => ({ key: s.id, label: stageLabel(s) }))} value={stage.id} onChange={setPickedStageId} />
              {stage.status === 'done' && <Mono size={11} color="var(--text-muted)">{t('tournament.standings.closed')}</Mono>}
            </div>
          )}

          {isRR ? (
            <GroupBoard
              groups={groups} tour={tour} db={db} canEdit={canEdit} locked={stage.status === 'done'} isMobile={isMobile}
              onScore={(m) => setScoringId(m.id)} onEdit={(m) => setEditingId(m.id)} onUndo={(m) => setUndoingId(m.id)}
              onQuick={(m, sets, winner) => a.tourCommit(m.id, { sets, winner })}
            />
          ) : (
            <BracketBoard
              key={stage.id} view={view} tour={tour} db={db} canEdit={canEdit} isMobile={isMobile}
              onScore={(m) => setScoringId(m.id)} onEdit={(m) => setEditingId(m.id)} onUndo={(m) => setUndoingId(m.id)}
              onQuick={(m, sets, winner) => a.tourCommit(m.id, { sets, winner })}
            />
          )}
        </div>
      </div>

      {scoring && (
        <ScoreDialog match={scoring} tour={tour} db={db} onClose={() => setScoringId(null)}
          onCommit={(p) => a.tourCommit(scoring.id, p)}
          onCourt={(label) => a.tourSchedule(scoring.id, scoring.seqNo, label)}
          onStart={(m) => m.status === 'ready' && a.tourStartMatch(m.id, m.courtLabel)} />
      )}
      {editing && (
        <EditScoreDialog match={editing} tour={tour} db={db} onClose={() => setEditingId(null)}
          onSave={(sets, reason) => a.tourEditScore(editing.id, sets, reason)} />
      )}
      {undoing && <UndoDialog match={undoing} onClose={() => setUndoingId(null)} onUndo={(reason) => a.tourUndo(undoing.id, reason)} />}
    </>
  )
}
