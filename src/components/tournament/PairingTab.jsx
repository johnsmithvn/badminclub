import { useState } from 'react'
import { Alert, Button, Card, Icon, IconButton } from '#ds'
import { Empty, GenderChip, Mono, Overline } from '#ui'
import { eligibleNotEntered, entriesOpen, regName } from '#lib/tournament/hub.js'
import { PAIR_MODES, balanceOf, chemistryOf, eventPlayers, eventTeams, lineupIssue, suggestSwap, teamInsights, vsAverage } from '#lib/tournament/pairing.js'
import cfg from '#config/app.json' with { type: 'json' }
import { t } from '#i18n'
import { Seg } from './TourBits.jsx'

const TONE = {
  ok: 'var(--status-delivered-fg)', warn: 'var(--status-delayed-fg)', bad: 'var(--status-incident-fg)', idle: 'var(--text-muted)',
}

/**
 * Ghép cặp (handoff `isPairing`): cột trái người chưa có cặp · giữa các cặp · phải độ cân bằng.
 * Đặt người: bấm chọn rồi bấm ô trống (chạm trên điện thoại) hoặc kéo thả (máy tính).
 */
export default function PairingTab({ tour, event, db, a, canEdit, isMobile }) {
  const [mode, setMode] = useState('balanced')
  const [picked, setPicked] = useState(null)

  const players = eventPlayers(tour, event.id)
  const teams = eventTeams(tour, event.id)
  const pool = players.filter((p) => !p.teamId)
  const editable = canEdit && entriesOpen(event)
  const hasSchedule = tour.stages.some((s) => s.eventId === event.id && s.status !== 'pending')
  const issue = lineupIssue(event, teams, players)
  // Gợi ý đổi người: chỉ khi còn sửa được đội hình (chưa chốt).
  const swap = editable && event.teamSize > 1 ? suggestSwap(teams, event.genderRule) : null
  const avgDiff = vsAverage(teams)
  const name = (r) => regName(tour, db, r)
  const evName = t('tournament.kind.' + event.kind)

  const place = (teamId) => {
    if (!picked) return
    a.tourPlace(event.id, picked, teamId)
    setPicked(null)
  }
  const drop = (teamId) => (e) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    if (teamId === 'pool') a.tourUnplace(event.id, id)
    else a.tourPlace(event.id, id, teamId)
    setPicked(null)
  }
  const dnd = (teamId) => (editable ? { onDragOver: (e) => e.preventDefault(), onDrop: drop(teamId) } : {})

  const lockBar = !entriesOpen(event) ? (
    <Alert tone="info" title={t('tournament.pairing.locked', { name: evName })}>
      {canEdit && !hasSchedule && (
        <Button size="sm" variant="secondary" icon="undo-2" onClick={() => a.tourUnlockLineup(event.id)}>
          {t('tournament.pairing.unlock')}
        </Button>
      )}
    </Alert>
  ) : null

  // Trống thường vì thí sinh đã vào giải nhưng chưa được đưa vào NỘI DUNG này: cho đưa hết người hợp giới một lần.
  if (!players.length) {
    const eligible = eligibleNotEntered(tour, event).length
    return (
      <Card>
        <Empty icon="users" title={t('tournament.pairing.noPlayers')}
          hint={eligible ? t('tournament.pairing.noPlayersHint', { n: eligible }) : t('tournament.players.emptyHint')} />
        {editable && eligible > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12 }}>
            <Button icon="user-round-plus" onClick={() => a.tourEnterAll(event.id)}>{t('tournament.pairing.enterAll', { n: eligible })}</Button>
          </div>
        )}
      </Card>
    )
  }

  if (event.teamSize === 1) {
    return (
      <Card title={evName} icon="users">
        <div style={{ display: 'grid', gap: 12 }}>
          {lockBar || <div style={{ font: 'var(--type-body)', color: 'var(--text-secondary)' }}>{t('tournament.pairing.singles', { name: evName })}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {players.map((p) => <PlayerChip key={p.id} name={name(p)} reg={p} />)}
          </div>
          {editable && (
            <div><Button icon="lock" disabled={Boolean(issue)} onClick={() => a.tourLockLineup(event.id)}>{t('tournament.pairing.lockSingles')}</Button></div>
          )}
        </div>
      </Card>
    )
  }

  const bal = balanceOf(teams)
  const maxSum = Math.max(1, ...teams.map((x) => x.sum))
  const cols = isMobile ? '1fr' : '250px minmax(0,1fr) 320px'

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {lockBar}
      {editable && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Overline>{t('tournament.pairing.modeLabel')}</Overline>
          <Seg options={PAIR_MODES.map((k) => ({ key: k, label: t('tournament.pairing.mode.' + k) }))} value={mode} onChange={setMode} />
          <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', flex: '1 1 200px' }}>{t('tournament.pairing.modeHint.' + mode)}</span>
          <Button size="sm" variant="secondary" onClick={() => a.tourClearPairs(event.id)}>{t('tournament.pairing.clear')}</Button>
          <Button size="sm" icon="wand-sparkles" onClick={() => a.tourAutoPair(event.id, mode)}>{t('tournament.pairing.auto')}</Button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, alignItems: 'start' }}>
        {/* CỘT 1: Khay chưa có cặp (250px) */}
        <Card title={t('tournament.pairing.pool')} actions={<Mono>{pool.length}</Mono>} padding="12px 14px" {...dnd('pool')}>
          <div style={{ display: 'grid', gap: 8 }}>
            {editable && <div style={{ font: '400 11.5px/1.35 var(--font-sans)', color: 'var(--text-muted)' }}>{t('tournament.pairing.poolHint')}</div>}
            {pool.length === 0 && <div style={{ font: '400 12.5px/1.4 var(--font-sans)', color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>{t('tournament.pairing.poolEmpty')}</div>}
            {pool.map((p) => (
              <PlayerChip key={p.id} name={name(p)} reg={p} block editable={editable} on={picked === p.id}
                onClick={() => setPicked((x) => (x === p.id ? null : p.id))} />
            ))}
          </div>
        </Card>

        {/* CỘT 2: Lưới các cặp đấu (trung tâm) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
          {teams.map((team, i) => (
            <TeamCard key={team.id} no={i + 1} team={team} size={event.teamSize} name={name} editable={editable}
              picked={picked && players.find((p) => p.id === picked)} pickedName={picked ? name(players.find((p) => p.id === picked)) : ''}
              onPlace={() => place(team.id)} onRemove={(regId) => a.tourUnplace(event.id, regId)}
              onPin={() => a.tourPin(team.id, !team.pinned)} dnd={dnd(team.id)} genderRule={event.genderRule}
              chem={team.full && team.players.length === 2 ? chemistryOf(db.matches, team.players[0], team.players[1]) : null}
              insights={team.full ? teamInsights(team, { genderRule: event.genderRule, history: db.matches }) : []} />
          ))}
          {editable && pool.length > 0 && (
            <TeamCard no={teams.length + 1} team={{ players: [], sum: 0 }} size={event.teamSize} name={name} editable isNew
              picked={Boolean(picked)} pickedName={picked ? name(players.find((p) => p.id === picked)) : ''}
              onPlace={() => place(null)} dnd={dnd(null)} />
          )}
        </div>

        {/* CỘT 3: Phân tích độ cân bằng giải & Biểu đồ thanh mini (320px) */}
        <Card title={t('tournament.pairing.balance')} padding="14px">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              {bal.spread != null && (
                <span style={{ font: '700 24px/1 var(--font-display)', color: TONE[bal.tone] }}>
                  {t('tournament.pairing.spread', { n: Math.round(bal.spread) })}
                </span>
              )}
              <span style={{ font: '600 12px/1.3 var(--font-sans)', color: TONE[bal.tone] }}>
                {t('tournament.pairing.tone.' + bal.tone)}
              </span>
            </div>

            {teams.some((x) => x.full) && (
              <div style={{ display: 'grid', gap: 6, paddingTop: 4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto 48px', gap: 8, font: '700 10.5px/1 var(--font-sans)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>#</span>
                  <span />
                  <span style={{ textAlign: 'right' }}>{t('tournament.overview.pairs')}</span>
                  <span style={{ textAlign: 'right' }}>{t('tournament.pairing.vsAvg')}</span>
                </div>
                {teams.filter((x) => x.full).map((team, i) => {
                  const d = avgDiff[team.id]
                  const pct = Math.min(100, Math.round((team.sum / maxSum) * 100))
                  return (
                    <div key={team.id} style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto 48px', alignItems: 'center', gap: 8 }}>
                      <Mono size={11} color="var(--text-muted)">{i + 1}</Mono>
                      <span style={{ height: 8, borderRadius: 4, background: 'var(--surface-sunken)', overflow: 'hidden', display: 'block' }}>
                        <span style={{
                          display: 'block', height: '100%', width: `${pct}%`, borderRadius: 4,
                          background: d?.warn ? 'var(--status-delayed-fg)' : 'var(--teal-500)',
                          transition: 'width var(--dur-fast)',
                        }} />
                      </span>
                      <Mono size={11.5} weight={600}>{Math.round(team.sum)}</Mono>
                      <Mono size={11} weight={600} color={d?.warn ? 'var(--status-delayed-fg)' : 'var(--text-muted)'} style={{ textAlign: 'right' }}>
                        {d ? (d.diff > 0 ? '+' + d.diff : d.diff) : ''}
                      </Mono>
                    </div>
                  )
                })}
              </div>
            )}

            {bal.avg != null && (
              <div style={{ display: 'grid', gap: 2, font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' }}>
                <div>{t('tournament.pairing.avg', { n: bal.avg })}</div>
                <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                  {t('tournament.pairing.avgHint', { n: 40 })}
                </div>
              </div>
            )}

            {/* Khối gợi ý đổi người tối ưu (Best Swap recommendation) 1-click */}
            {swap && (
              <div style={{
                display: 'grid',
                gap: 8,
                padding: '12px',
                borderRadius: 10,
                background: 'var(--surface-accent-soft)',
                border: '1px solid var(--teal-500)',
                boxShadow: 'var(--shadow-xs)',
              }}>
                <span style={{ font: '600 12.5px/1.4 var(--font-sans)', color: 'var(--text-primary)' }}>
                  {t('tournament.pairing.swapHint', { a: name(swap.regA), b: name(swap.regB), from: Math.round(swap.before), to: Math.round(swap.after) })}
                </span>
                <Button size="sm" icon="check" onClick={() => a.tourSwapPlayers(event.id, swap)}>
                  {t('tournament.pairing.swapApply')}
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {editable && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {issue && <span style={{ font: 'var(--type-caption)', color: 'var(--status-delayed-fg)' }}>{t(issue)}</span>}
          <Button icon="lock" disabled={Boolean(issue)} onClick={() => a.tourLockLineup(event.id)}>{t('tournament.pairing.lock')}</Button>
        </div>
      )}
    </div>
  )
}

function PlayerChip({ name, reg, block, editable, on, onClick }) {
  return (
    <span
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
      draggable={editable || undefined}
      onDragStart={editable ? (e) => e.dataTransfer.setData('text/plain', reg.id) : undefined}
      onClick={editable ? onClick : undefined}
      onKeyDown={editable ? (e) => e.key === 'Enter' && onClick() : undefined}
      style={{
        display: block ? 'flex' : 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '6px 10px', borderRadius: 8,
        cursor: editable ? 'grab' : 'default', userSelect: 'none',
        background: on ? 'var(--surface-accent-soft)' : 'var(--surface-inset)',
        border: `1px solid ${on ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
      }}
    >
      <GenderChip gender={reg.gender} />
      {/* Tên dài (biệt danh có emoji…): tối đa 2 dòng rồi "…", di chuột xem đủ — thẻ cặp không bị kéo cao. */}
      <span title={name} style={{
        flex: 1, font: '600 13px/1.25 var(--font-sans)', color: 'var(--text-primary)', minWidth: 0,
        display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere',
      }}>{name}</span>
      <Mono size={11} color="var(--text-muted)">{Math.round(reg.ratingSnapshot || 0)}</Mono>
    </span>
  )
}

const INS_COLOR = { bad: 'var(--status-incident-fg)', warn: 'var(--status-delayed-fg)', good: 'var(--status-delivered-fg)', info: 'var(--text-muted)' }

function TeamCard({ no, team, size, name, editable, isNew, picked, pickedName, onPlace, onRemove, onPin, dnd, chem, insights = [], genderRule }) {
  const empty = Math.max(0, size - team.players.length)
  // Ô trống nói rõ cần ai (handoff): nam nữ → thiếu nam hay thiếu nữ; còn lại → "Kéo người vào đây".
  const need = (i) => {
    if (genderRule !== 'mixed') return t('tournament.pairing.slotAny')
    const hasMan = team.players.some((p) => p.gender === 'nam')
    const hasWoman = team.players.some((p) => p.gender === 'nu')
    if (hasMan && !hasWoman) return t('tournament.pairing.slotWoman')
    if (hasWoman && !hasMan) return t('tournament.pairing.slotMan')
    return t(i === 0 ? 'tournament.pairing.slotMan' : 'tournament.pairing.slotWoman')
  }
  return (
    <div {...dnd} style={{
      display: 'grid', gap: 6, padding: 10, borderRadius: 10, alignContent: 'start',
      background: isNew ? 'transparent' : 'var(--surface-card)',
      border: `1px ${isNew ? 'dashed' : 'solid'} ${team.pinned ? 'var(--teal-500)' : 'var(--border-default)'}`,
      boxShadow: isNew ? 'none' : 'var(--shadow-xs)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 26 }}>
        <span style={{ font: '700 12.5px/1 var(--font-sans)', color: 'var(--text-primary)' }}>
          {isNew ? t('tournament.pairing.newTeam') : t('tournament.pairing.team', { n: no })}
        </span>
        {!isNew && <Mono size={11} color="var(--text-muted)">{Math.round(team.sum)}</Mono>}
        <span style={{ flex: 1 }} />
        {!isNew && editable && (
          <Button size="sm" variant={team.pinned ? 'secondary' : 'ghost'} onClick={onPin}>
            {t(team.pinned ? 'tournament.pairing.unpin' : 'tournament.pairing.pin')}
          </Button>
        )}
        {!isNew && !editable && team.pinned && <Icon name="lock" size={13} style={{ color: 'var(--text-muted)' }} />}
      </div>
      {chem && (
        <span style={{ font: 'var(--type-caption)', color: chem.known ? 'var(--status-transit-fg)' : 'var(--text-muted)' }}>
          {chem.known ? t('tournament.pairing.chem', { n: chem.games, pct: chem.winPct }) : t('tournament.pairing.chemNone')}
        </span>
      )}
      {/* "Chưa có dữ liệu đánh cùng" đã nói ở dòng trên — không lặp lại */}
      {insights.filter((x) => x.key !== 'tournament.pairing.insNoHistory').map((x) => (
        <span key={x.key} style={{ font: 'var(--type-caption)', color: INS_COLOR[x.tone] }}>{t(x.key, x.vars)}</span>
      ))}
      {team.players.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ flex: 1, minWidth: 0 }}><PlayerChip name={name(p)} reg={p} block editable={false} /></span>
          {editable && <IconButton icon="x" size="sm" label={t('tournament.pairing.remove')} onClick={() => onRemove(p.id)} />}
        </div>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <button
          key={i}
          type="button"
          disabled={!editable || !picked}
          onClick={onPlace}
          style={{
            minHeight: 40, borderRadius: 8, textAlign: 'left', padding: '0 10px', font: '500 12px/1 var(--font-sans)',
            cursor: editable && picked ? 'pointer' : 'default',
            background: picked ? 'var(--surface-accent-soft)' : 'transparent',
            color: picked ? 'var(--status-transit-fg)' : 'var(--text-muted)',
            border: `1px dashed ${picked ? 'var(--teal-500)' : 'var(--border-default)'}`,
          }}
        >
          {picked ? t('tournament.pairing.slotPick', { name: pickedName }) : need(i)}
        </button>
      ))}
    </div>
  )
}
