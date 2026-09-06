import { useMemo } from 'react'
import { Button, Dialog, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { playerName, courtOf } from '#lib/money.js'
import { matchCodeOf, getPlayerRating } from '#lib/rating.js'
import { dd } from '#utils/dates.js'
import { t } from '#i18n'

export default function MatchDetailModal({ match, onClose, onEdit }) {
  const { db } = useApp()

  const matchCode = useMemo(() => matchCodeOf(db, match), [db, match])

  const teamA = useMemo(() => match?.teamA || (match?.playerKeys ? match.playerKeys.slice(0, 2) : []), [match])
  const teamB = useMemo(() => match?.teamB || (match?.playerKeys ? match.playerKeys.slice(2, 4) : []), [match])

  const nameTeamA = teamA.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamA')
  const nameTeamB = teamB.map((id) => playerName(db, id)).join(' · ') || t('challenge.teamB')

  const aWon = match?.winnerTeam === 'A'
  const sets = useMemo(() => match?.sets || [], [match])

  // Tính số set thắng
  const setsWon = useMemo(() => {
    let wonA = 0
    let wonB = 0
    sets.forEach(([sa, sb]) => {
      if (sa > sb) wonA++
      else if (sb > sa) wonB++
    })
    return { wonA, wonB }
  }, [sets])

  const isMultiSet = sets.length > 1
  const displayScore = isMultiSet
    ? `${setsWon.wonA} – ${setsWon.wonB}`
    : sets.length === 1
      ? `${sets[0][0]} – ${sets[0][1]}`
      : '21 – 19'

  // Thông tin buổi và sân
  const s = useMemo(() => (db.sessions || []).find((x) => x.id === match?.sessionId), [db.sessions, match?.sessionId])
  const courtObj = s?.courts?.[match?.courtIdx]
  const venue = courtObj ? courtOf(db, courtObj.courtId) : null
  const courtLabel = courtObj?.label || (courtObj ? t('session.courtNum', { n: (match?.courtIdx ?? 0) + 1 }) : '')
  const dateStr = s?.date ? dd(s.date) : (match?.at ? new Date(match.at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '')
  const matchWhen = `${dateStr ? dateStr + ' · ' : ''}${venue?.name ? venue.name + ' · ' : ''}${courtLabel}`

  const delta = match?.eloDelta || 8
  const ra = match?.initialRatingA || 0
  const rb = match?.initialRatingB || 0
  const isUpset = Math.abs(ra - rb) > 100 && ((ra < rb && aWon) || (rb < ra && !aWon))
  const isClose = sets.some((sItem) => sItem && sItem[0] != null && sItem[1] != null && Math.abs(sItem[0] - sItem[1]) <= 3)

  // Danh sách lịch sửa trận (audit log)
  const auditLogs = useMemo(() => {
    const edits = db.matchEdits || []
    return edits.filter((e) => e.matchId === match?.id)
  }, [db.matchEdits, match?.id])

  // Tính rating từng người trước và sau trận
  const playerDeltas = useMemo(() => {
    const listA = teamA.map((id) => {
      const pr = getPlayerRating(db.playerRatings, id, null, db.levels)
      const baseRating = match?.initialRatingA ? Math.round(match.initialRatingA) : pr.rating
      const change = aWon ? delta : -delta
      return {
        id,
        name: playerName(db, id),
        before: baseRating,
        delta: change,
        after: baseRating + change,
      }
    })

    const listB = teamB.map((id) => {
      const pr = getPlayerRating(db.playerRatings, id, null, db.levels)
      const baseRating = match?.initialRatingB ? Math.round(match.initialRatingB) : pr.rating
      const change = !aWon ? delta : -delta
      return {
        id,
        name: playerName(db, id),
        before: baseRating,
        delta: change,
        after: baseRating + change,
      }
    })

    return { listA, listB }
  }, [teamA, teamB, match, db, aWon, delta])

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('matchDetail.matchCode', { code: matchCode })}
      description={matchWhen || t('matchDetail.title')}
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* THẺ TỔNG QUAN TỶ SỐ (Screen S3) */}
        <div style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          boxShadow: '0 1px 2px rgba(0,0,0,.25)',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{
              font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}>
              {matchWhen}
            </span>
            <span style={{
              font: '600 10px/1 "IBM Plex Sans", sans-serif',
              padding: '3px 8px',
              borderRadius: 999,
              background: 'rgba(0,178,169,.18)',
              color: '#5FDBD3',
              whiteSpace: 'nowrap',
            }}>
              {t('matchDetail.eloApplied')}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              flex: 1,
              minWidth: 0,
              font: '600 15px/1.3 "IBM Plex Sans", sans-serif',
              color: aWon ? '#5FD9A2' : 'var(--text-secondary)',
            }}>
              {nameTeamA}
            </span>
            <span style={{ font: '700 24px/1 Barlow, sans-serif', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              {displayScore}
            </span>
            <span style={{
              flex: 1,
              minWidth: 0,
              textAlign: 'right',
              font: '600 15px/1.3 "IBM Plex Sans", sans-serif',
              color: !aWon ? '#5FD9A2' : 'var(--text-secondary)',
            }}>
              {nameTeamB}
            </span>
          </div>

          {/* Bảng điểm từng set */}
          {sets.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--surface-inset)',
              border: '1px solid var(--border-subtle)',
            }}>
              {sets.map(([sa, sb], idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    font: '400 13px/1.4 "IBM Plex Mono", monospace',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{t('matchDetail.setNum', { n: idx + 1 })}</span>
                  <div style={{ display: 'flex', gap: 8, fontWeight: 600 }}>
                    <span style={{ color: sa > sb ? '#5FDBD3' : 'var(--text-secondary)' }}>{sa}</span>
                    <span style={{ color: 'var(--text-muted)' }}>–</span>
                    <span style={{ color: sb > sa ? '#5FDBD3' : 'var(--text-secondary)' }}>{sb}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            font: '400 12px/1.3 "IBM Plex Mono", monospace',
            color: 'var(--text-muted)',
          }}>
            <span>{isUpset ? t('leaderboard.predUpset') : isClose ? t('leaderboard.predClose') : t('leaderboard.predCorrect')}</span>
            <span>{isClose ? t('matchSearch.qualityClose') : isUpset ? t('matchSearch.qualityUpset') : t('matchSearch.qualityAll')}</span>
          </div>
        </div>

        {/* THẺ RATING SAU TRẬN */}
        <div style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          boxShadow: '0 1px 2px rgba(0,0,0,.25)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ font: '600 14px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
              {t('matchDetail.ratingAfter')}
            </span>
            <span style={{ font: '400 12px "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
              {t('matchDetail.ratingModel')}
            </span>
          </div>

          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[...playerDeltas.listA, ...playerDeltas.listB].map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  font: '400 13px/1.4 "IBM Plex Mono", monospace',
                }}
              >
                <span style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: p.delta >= 0 ? '#5FD9A2' : '#FF8578', fontWeight: 600 }}>
                    {p.delta >= 0 ? `+${p.delta}` : p.delta}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                    {p.after}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LỊCH SỬ SỬA TRẬN (AUDIT LOG) */}
        <div style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          boxShadow: '0 1px 2px rgba(0,0,0,.25)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ font: '600 14px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
              {t('matchDetail.editHistory')}
            </span>
            <span style={{
              font: '600 10px/1 "IBM Plex Sans", sans-serif',
              padding: '3px 8px',
              borderRadius: 999,
              background: auditLogs.length > 0 ? 'rgba(224,138,0,.18)' : 'var(--surface-inset)',
              color: auditLogs.length > 0 ? '#F0B75C' : 'var(--text-muted)',
            }}>
              {auditLogs.length > 0 ? t('matchDetail.hasEdits') : t('matchDetail.noEdits')}
            </span>
          </div>

          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {auditLogs.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {t('matchDetail.noEdits')}
              </span>
            ) : (
              auditLogs.map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '9px 11px',
                    borderRadius: 6,
                    background: 'var(--surface-inset)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ font: '600 13px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
                      {log.editorName || playerName(db, log.editorId) || t('matchDetail.editorFallback')}
                    </span>
                    <span style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
                      {log.at ? new Date(log.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''}
                    </span>
                  </div>
                  {log.reason && (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {log.reason}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* NÚT THAO TÁC */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 6 }}>
          <Button variant="ghost" onClick={onClose}>
            {t('matchDetail.btnClose')}
          </Button>
          {onEdit && (
            <Button
              variant="primary"
              onClick={() => {
                onClose()
                onEdit(match)
              }}
            >
              <Icon name="pencil" size={14} />
              <span>{t('matchDetail.btnEditScore')}</span>
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}
