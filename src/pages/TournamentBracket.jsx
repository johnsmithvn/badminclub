import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Skeleton } from '#ds'
import { Empty, Mono } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { can } from '#lib/roles.js'
import { koRounds, progressOf, queueOf, stageEditable, swapOrder } from '#lib/tournament/bracketView.js'
import { flowOf } from '#lib/tournament/flow.js'
import { pathOf } from '#routes'
import { t } from '#i18n'
import { useTourPoll } from '#hooks/useTourPoll.js'
import BracketBoard, { GroupBoard } from '#components/tournament/BracketBoard.jsx'
import { RuleField, Seg } from '#components/tournament/TourBits.jsx'
import { stageGroups } from '#lib/tournament/standings.js'
import TourModuleNav from '#components/tournament/TourModuleNav.jsx'
import { Pipeline } from '#pages/TournamentFlow.jsx'
import { EditScoreDialog, ScoreDialog, UndoDialog } from '#components/tournament/MatchDialogs.jsx'
import { draftKey, matchCode, ruleLabel, stageName, teamName } from '#components/tournament/tourUtils.js'

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
  // Giai đoạn đang xem: mở từ sơ đồ thì theo `?stage=`; không có → giai đoạn muộn nhất đã có lịch.
  const [params] = useSearchParams()
  const [pickedStageId, setPickedStageId] = useState(() => params.get('stage'))

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
  const evStages = event ? tour.stages.filter((x) => x.eventId === event.id) : []
  const stageLabel = (s) => stageName(s, evStages)
  const nav = (
    <TourModuleNav tour={tour} active="bracket" events={scheduled} eventId={eventId} isMobile={isMobile}
      onHub={toHub} onFlow={() => navigate(pathOf('tournamentFlow', id) + (eventId ? '?event=' + eventId : ''))}
      onBracket={(eid) => eid && navigate(pathOf('tournamentBracket', id, eid))} />
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
  // Nhánh chưa đấu trận nào → còn sửa thiết lập / đổi chỗ vòng đầu (xoá lịch rồi sinh lại). Đổi chỗ: chỉ nhánh xuất phát.
  const restageable = canEdit && !isRR && stageEditable(tour.matches, stage.id)
  const swappable = restageable && stage.seq === 1
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
  const flow = event ? flowOf(tour, event) : null

  return (
    <>
      {nav}

      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'flex-start',
        gap: 16,
        minHeight: 'calc(100vh - 120px)',
        width: '100%',
      }}>
        {/* Thiết lập nhánh (handoff) — CHỈ ĐỌC: đổi thể thức / bốc thăm / đổi chỗ ở tab Thể thức trước khi có lịch */}
        {!isRR && !isMobile && <BracketSetup key={stage.id} tour={tour} db={db} stage={stage} own={own} a={a} canEdit={canEdit} editable={restageable} />}

        {/* Khối chính hiển thị Header, Sơ đồ tiến trình và Nhánh đấu */}
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
                  stageLabel(stage),
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
                {next.map((m) => {
                  const label = `${teamName(tour, db, m.teamAId)} – ${teamName(tour, db, m.teamBId)}`
                  return (
                    <button key={m.id} type="button" title={label} disabled={!canEdit} onClick={() => setScoringId(m.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 99, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', maxWidth: 280, cursor: canEdit ? 'pointer' : 'default' }}>
                      <Mono size={11} weight={700} color="var(--text-primary)" style={{ flex: '0 0 auto' }}>{matchCode(m)}</Mono>
                      <span style={{ font: '500 11.5px/1.2 var(--font-sans)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* Sơ đồ thể thức · Tiến trình toàn giải cho nội dung này */}
          {flow && (
            <section style={{
              padding: '12px 16px', borderRadius: 12,
              background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)',
              display: 'grid', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ font: '700 11.5px/1 var(--font-sans)', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {t('tournament.module.flow')}
                </span>
                <Mono size={11} color="var(--teal-500)">
                  {stageLabel(stage)}
                </Mono>
              </div>
              <Pipeline
                flow={flow}
                tour={tour}
                db={db}
                isMobile={isMobile}
                onOpen={(stageId) => setPickedStageId(stageId)}
              />
            </section>
          )}

          {live.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Seg options={live.map((s) => ({ key: s.id, label: stageLabel(s) }))} value={stage.id} onChange={setPickedStageId} />
              {stage.status === 'done' && <Mono size={11} color="var(--text-muted)">{t('tournament.standings.closed')}</Mono>}
            </div>
          )}

          {isRR ? (
            <GroupBoard
              groups={groups} tour={tour} db={db} canEdit={canEdit} locked={stage.status === 'done'} isMobile={isMobile}
              stage={stage}
              onScore={(m) => setScoringId(m.id)} onEdit={(m) => setEditingId(m.id)} onUndo={(m) => setUndoingId(m.id)}
              onQuick={(m, sets, winner) => a.tourCommit(m.id, { sets, winner })}
            />
          ) : (
            <BracketBoard
              key={stage.id} view={view} tour={tour} db={db} canEdit={canEdit} isMobile={isMobile}
              onScore={(m) => setScoringId(m.id)} onEdit={(m) => setEditingId(m.id)} onUndo={(m) => setUndoingId(m.id)}
              onQuick={(m, sets, winner) => a.tourCommit(m.id, { sets, winner })}
              onSwap={swappable ? (x, y) => { const order = swapOrder(tour.matches, stage.id, x, y); if (order) a.tourRestage(stage.id, { order }) } : null}
            />
          )}
        </div>
      </div>

      {scoring && (
        <ScoreDialog key={scoring.id} match={scoring} tour={tour} db={db} onClose={() => setScoringId(null)}
          next={queueOf(own).find((m) => m.id !== scoring.id)} onNext={setScoringId}
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

/**
 * Thanh bên "Thiết lập nhánh" (handoff). Nhánh CHƯA đấu trận nào (và có quyền): sửa xếp hạt giống, tranh hạng 3, luật
 * vòng loại / chung kết → "Xong · tạo lại nhánh" (xoá lịch rồi sinh lại, `tourRestage`); kéo tên đội vòng đầu để đổi chỗ.
 * Đã có trận: chỉ đọc. Thêm / bớt đội = ghép cặp ở Hub (đội hình đã chốt khi tạo lịch).
 */
export function BracketSetup({ tour, db, stage, own, a, canEdit, editable }) {
  const [draft, setDraft] = useState(() => ({
    seeding: stage.config?.seeding || 'seed', thirdPlace: Boolean(stage.config?.thirdPlace), matchRule: stage.matchRule, final: stage.ruleOverrides?.final || null,
  }))
  const [busy, setBusy] = useState(false)
  const first = own.filter((m) => m.round === 0 && m.roundKind !== 'third').sort((a2, b) => a2.slot - b.slot)
  const tag = (src) => (src?.kind === 'seed' ? String(src.n) : src?.kind === 'draw' ? t('tournament.format.drawNo', { n: src.n }) : '')
  const seats = first.flatMap((m) => [[m.teamAId, m.sourceA], [m.teamBId, m.sourceB]])
  const label = (x) => <span style={{ font: '700 10.5px/1 var(--font-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{x}</span>
  const fromGroups = stage.config?.seeding === 'rank'
  // Bốc thăm cần mọi đội có số bốc thăm (bốc ở tab Thể thức); đội hình từ vòng bảng thì giữ "Từ vòng bảng".
  const teamsIn = seats.map(([id]) => id).filter(Boolean)
  const drawn = teamsIn.every((id) => Number.isInteger(tour.teams.find((x) => x.id === id)?.drawNo))
  const changed = draft.seeding !== (stage.config?.seeding || 'seed') || draft.thirdPlace !== Boolean(stage.config?.thirdPlace)
    || JSON.stringify(draft.matchRule) !== JSON.stringify(stage.matchRule) || JSON.stringify(draft.final) !== JSON.stringify(stage.ruleOverrides?.final || null)
  const restage = async () => {
    setBusy(true)
    await a.tourRestage(stage.id, {
      patch: {
        config: { seeding: draft.seeding, thirdPlace: draft.thirdPlace },
        matchRule: draft.matchRule,
        ruleOverrides: draft.final ? { ...stage.ruleOverrides, final: draft.final, third: draft.final } : stage.ruleOverrides,
      },
    })
    setBusy(false)
  }
  return (
    <aside style={{
      width: 270, flex: '0 0 270px', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden', display: 'grid', gap: 12, padding: 14, borderRadius: 12, height: 'fit-content',
      background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)',
    }}>
      <span style={{ font: '700 15px/1.2 var(--font-display)', color: 'var(--text-primary)' }}>{t('tournament.bracket.setupTitle')}</span>
      <div style={{ display: 'grid', gap: 6 }}>
        {label(t('tournament.bracket.setupSource'))}
        {editable && !fromGroups ? (
          <Seg options={['seed', 'slot'].map((k) => ({ key: k, label: t('tournament.format.seed.' + k) }))} value={draft.seeding}
            onChange={(k) => (k !== 'slot' || drawn) && setDraft((d) => ({ ...d, seeding: k }))} />
        ) : (
          <span style={{ font: '600 13px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.format.seed.' + (stage.config?.seeding || 'seed'))}</span>
        )}
        {editable && !fromGroups && !drawn && <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.format.needDraw')}</span>}
      </div>
      {editable ? (
        <>
          <div style={{ display: 'grid', gap: 6 }}>
            {label(t('tournament.format.thirdPlace'))}
            <Seg options={[{ key: 'on', label: t('tournament.format.on') }, { key: 'off', label: t('tournament.format.off') }]}
              value={draft.thirdPlace ? 'on' : 'off'} onChange={(k) => setDraft((d) => ({ ...d, thirdPlace: k === 'on' }))} />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {label(t('tournament.format.qualify'))}
            <RuleField value={draft.matchRule} onChange={(rule) => setDraft((d) => ({ ...d, matchRule: rule }))} />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {label(t('tournament.format.ranking'))}
            <RuleField value={draft.final} onChange={(rule) => setDraft((d) => ({ ...d, final: rule }))} />
          </div>
          <Button disabled={!changed || busy} loading={busy} onClick={restage}>{t('tournament.bracket.restage')}</Button>
        </>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {label(t('tournament.bracket.setupRule'))}
          <Mono size={11.5} color="var(--text-secondary)">{t('tournament.format.qualify')}: {ruleLabel(stage.matchRule)}</Mono>
          {stage.ruleOverrides?.final && <Mono size={11.5} color="var(--text-secondary)">{t('tournament.round.final')}: {ruleLabel(stage.ruleOverrides.final)}</Mono>}
        </div>
      )}
      <div style={{ display: 'grid', gap: 5 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}>
          {label(t('tournament.bracket.setupTeams'))}
          <Mono size={11} weight={600} color="var(--status-transit-fg)">{teamsIn.length}</Mono>
        </span>
        {seats.map(([id, src], i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 7, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
            <Mono size={10} weight={700} color="var(--text-muted)" style={{ minWidth: 22 }}>{tag(src)}</Mono>
            <span style={{ flex: 1, minWidth: 0, font: '500 11.5px/1.2 var(--font-sans)', color: id ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {id ? teamName(tour, db, id) : t('tournament.bracket.bye')}
            </span>
          </span>
        ))}
      </div>
      <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
        {t(editable && stage.seq === 1 ? 'tournament.bracket.dragHint' : canEdit && !editable ? 'tournament.bracket.restageBlocked' : 'tournament.bracket.setupHint')}
      </span>
    </aside>
  )
}
