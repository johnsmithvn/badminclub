import { useState } from 'react'
import { t } from '#i18n'
import { playerName } from '#lib/money.js'
import {
  SCORE_PRESETS, SUB_PRESETS, editCustom, pickPreset, pickSubPreset, pickWinner, stepScore, swapScores, typeScore,
} from '#lib/scorePicker.js'

/**
 * Chọn tỉ số 1 set: 2 thẻ đội (chạm = đội thắng) · preset nhanh · ô "Khác" (−/+, gõ số, ⇄, tỷ số nhanh)
 * · hộp biến động Elo / điểm mùa (thu gọn). Dùng chung cho modal Ghi kết quả và khối ghi kết quả ở Chia sân.
 * `value` / `onChange`: trạng thái của #lib/scorePicker.js — logic chuyển trạng thái nằm hết ở đó.
 */
export default function ScorePicker({
  db, teamA, teamB, ratingA, ratingB, ratingEnabled, playerDeltas, seasonDeltas, isMobile, value, onChange,
}) {
  const { winnerTeam, presetScore, scoreA, scoreB } = value
  const [showChangesBox, setShowChangesBox] = useState(false)
  const act = (fn, ...args) => onChange(fn(value, ...args))
  const namesOf = (team) => (team === 'A' ? teamA : teamB).map((k) => playerName(db, k)).join(' · ')

  const teamCard = (team, rating, score) => (
    <div
      key={team}
      onClick={() => act(pickWinner, team)}
      style={{
        ...S.teamChoiceCard,
        ...(winnerTeam === team ? S.teamChoiceCardWon : {}),
      }}
    >
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div
          style={{
            font: '600 15px/1.25 "IBM Plex Sans", sans-serif',
            color: winnerTeam === team ? 'var(--text-primary)' : 'var(--text-secondary)',
            whiteSpace: isMobile ? 'nowrap' : 'normal',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={namesOf(team)}
        >
          {namesOf(team)}
        </div>
        <div style={{ font: '400 12px/1.3 "IBM Plex Mono", monospace', color: winnerTeam === team ? 'var(--status-transit-fg)' : 'var(--text-muted)' }}>
          {t('scoreModal.teamAvg', { t: team, r: rating })}
        </div>
      </div>
      <div
        onClick={(e) => {
          e.stopPropagation()
          act(editCustom)
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        title={t('scoreModal.customScoreTitle')}
      >
        {winnerTeam === team && <span style={S.wonBadge}>{t('scoreModal.winnerTag')}</span>}
        <div style={winnerTeam === team ? S.bigScoreWon : S.bigScoreLost}>
          {score}
        </div>
      </div>
    </div>
  )

  const customCol = (team, score) => (
    <div style={S.customTeamCol}>
      <span
        style={{ ...S.customTeamName, fontSize: isMobile ? 12 : 13 }}
        title={namesOf(team)}
      >
        {namesOf(team)}
      </span>
      <div style={S.stepperBox}>
        <button
          type="button"
          onClick={() => act(stepScore, team, -1)}
          style={{ ...S.stepBtn, ...(isMobile ? S.stepBtnMobile : {}) }}
          title="-1"
        >−</button>
        <input
          type="number"
          min={0}
          max={30}
          value={score}
          onChange={(e) => act(typeScore, team, e.target.value)}
          style={{
            ...S.scoreBox,
            ...(isMobile ? S.scoreBoxMobile : {}),
            borderColor: winnerTeam === team ? 'var(--teal-700)' : 'var(--border-default)',
            color: winnerTeam === team ? 'var(--status-transit-fg)' : 'var(--text-primary)',
          }}
        />
        <button
          type="button"
          onClick={() => act(stepScore, team, 1)}
          style={{ ...S.stepBtn, ...(isMobile ? S.stepBtnMobile : {}) }}
          title="+1"
        >+</button>
      </div>
    </div>
  )

  return (
    <>
      {/* 2 Thẻ Đội A và Đội B */}
      <div style={{ ...S.teamsChoiceGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {teamCard('A', ratingA, scoreA)}
        {teamCard('B', ratingB, scoreB)}
      </div>

      {/* 4 Nút preset tỷ số nhanh */}
      <div style={S.presetRow}>
        {SCORE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => act(pickPreset, p)}
            style={{
              ...S.presetBtn,
              ...(presetScore === p ? S.presetBtnActive : {}),
            }}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => act(pickPreset, 'custom')}
          style={{
            ...S.presetBtn,
            ...(presetScore === 'custom' ? S.presetBtnActive : {}),
          }}
        >
          {t('scoreModal.presetOther')}
        </button>
      </div>

      {/* Bộ nhập tỷ số tùy chỉnh khi bấm "Khác" hoặc bấm ô điểm */}
      {presetScore === 'custom' && (
        <div style={{ ...S.customScoreBox, padding: isMobile ? '10px 8px' : '12px' }}>
          <div style={S.customScoreHeader}>
            <span style={{ font: '600 12px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>
              {t('scoreModal.customScoreTitle')}
            </span>
            {Number(scoreA) === Number(scoreB) && (
              <span style={{ color: 'var(--status-delayed-fg)', fontSize: 11.5, fontWeight: 500 }}>
                {t('quickMatch.errTie')}
              </span>
            )}
          </div>

          <div style={{ ...S.customScoreRow, gap: isMobile ? 6 : 12 }}>
            {customCol('A', scoreA)}

            {/* Nút đổi điểm */}
            <button
              type="button"
              title={t('scoreModal.swapScore')}
              onClick={() => act(swapScores)}
              style={{ ...S.swapBtn, ...(isMobile ? S.swapBtnMobile : {}) }}
            >
              ⇄
            </button>

            {customCol('B', scoreB)}
          </div>

          {/* Preset điểm bổ sung */}
          <div style={S.subPresetRow}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t('scoreModal.quickPresets')}:
            </span>
            {SUB_PRESETS.map(([pa, pb]) => (
              <button
                key={`${pa}-${pb}`}
                type="button"
                onClick={() => act(pickSubPreset, [pa, pb])}
                style={S.subPresetBtn}
              >
                {winnerTeam === 'B' ? `${pb}–${pa}` : `${pa}–${pb}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Box thay đổi Elo & SP - Dạng Collapsible Accordion (mặc định đóng) */}
      <div style={S.changesBox}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowChangesBox((prev) => !prev)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowChangesBox((prev) => !prev) }}
          style={S.changesToggleHeader}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            <span style={{ font: '600 11px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              {t('scoreModal.postMatchChanges')}
            </span>
            <span style={{ font: '500 11px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
              · {ratingEnabled ? t('scoreModal.changesPreviewTag') : t('scoreModal.unratedChange')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, font: '600 12px/1 "IBM Plex Sans", sans-serif', color: 'var(--teal-600, #00B2A9)' }}>
            <span>{showChangesBox ? t('scoreModal.collapseChanges') : t('scoreModal.expandChanges')}</span>
            <span style={{ fontSize: 13, transform: showChangesBox ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>▾</span>
          </div>
        </div>

        {showChangesBox && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              {[...teamA, ...teamB].map((k) => {
                const inA = teamA.includes(k)
                const isWon = (inA && winnerTeam === 'A') || (!inA && winnerTeam === 'B')
                const dVal = playerDeltas[k]
                const deltaTxt = dVal != null ? (dVal > 0 ? `+${dVal}` : `${dVal}`) : '—'
                const sVal = seasonDeltas[k]
                const seasonTxt = sVal != null ? (sVal > 0 ? `+${sVal}` : `${sVal}`) : '—'
                return (
                  <div key={k} style={S.changeRow}>
                    <span style={{ font: '600 14px "IBM Plex Sans", sans-serif', color: isWon ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {playerName(db, k)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {ratingEnabled ? (
                        <span style={{ font: '600 12.5px "IBM Plex Mono", monospace', color: isWon ? 'var(--status-delivered-fg)' : 'var(--status-incident-fg)' }}>
                          {t('scoreModal.ratingChange', { d: deltaTxt })}
                        </span>
                      ) : (
                        <span style={{ font: '500 12px "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
                          {t('scoreModal.unratedChange')}
                        </span>
                      )}
                      {ratingEnabled && (
                        <span style={{ font: '600 12.5px "IBM Plex Mono", monospace', color: sVal > 0 ? 'var(--status-delivered-fg)' : 'var(--status-incident-fg)' }}>
                          {t('scoreModal.seasonPointChange', { pts: seasonTxt })}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ font: '400 12px/1.45 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)', marginTop: 6 }}>
              {ratingEnabled ? t('scoreModal.seasonPointExplain') : t('scoreModal.unratedExplain')}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

const S = {
  teamsChoiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
    gap: 10,
    width: '100%',
    minWidth: 0,
  },
  teamChoiceCard: {
    borderRadius: 10,
    padding: '12px',
    background: 'var(--surface-sunken)',
    border: '1.5px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: 0,
    overflow: 'hidden',
  },
  teamChoiceCardWon: {
    background: 'var(--status-transit-bg)',
    borderColor: 'var(--status-transit-fg)',
  },
  wonBadge: {
    font: '600 11px/1 "IBM Plex Sans", sans-serif',
    padding: '4px 8px',
    borderRadius: 999,
    background: 'var(--action-accent-bg, #00B2A9)',
    color: 'var(--action-accent-fg, #04302C)',
  },
  bigScoreWon: {
    minWidth: 48,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1.5px solid var(--action-accent-bg, #00B2A9)',
    font: '700 24px/1 Barlow, sans-serif',
    color: 'var(--status-transit-fg)',
  },
  bigScoreLost: {
    minWidth: 48,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    font: '700 24px/1 Barlow, sans-serif',
    color: 'var(--text-muted)',
  },
  presetRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  presetBtn: {
    minHeight: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    font: '600 13px/1 "IBM Plex Mono", monospace',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  presetBtnActive: {
    background: 'var(--action-primary-bg)',
    borderColor: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
  },
  customScoreBox: {
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflow: 'hidden',
  },
  customScoreHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  customScoreRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    minWidth: 0,
  },
  customTeamCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  customTeamName: {
    font: '600 13px/1.2 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    width: '100%',
    display: 'block',
  },
  stepperBox: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--surface-card)',
    borderRadius: 'var(--radius-md)',
    padding: 2,
    border: '1px solid var(--border-subtle)',
    gap: 2,
  },
  stepBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
  },
  stepBtnMobile: {
    width: 32,
    height: 34,
    fontSize: 16,
  },
  scoreBox: {
    width: 52,
    height: 38,
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-card)',
    fontFamily: 'var(--font-mono)',
    fontSize: 20,
    fontWeight: 700,
    textAlign: 'center',
    padding: 0,
    outline: 'none',
  },
  scoreBoxMobile: {
    width: 40,
    height: 34,
    fontSize: 18,
  },
  swapBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
    fontSize: 16,
    cursor: 'pointer',
    flexShrink: 0,
    marginTop: 20,
  },
  swapBtnMobile: {
    width: 30,
    height: 30,
    fontSize: 13,
    marginTop: 18,
  },
  subPresetRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    paddingTop: 4,
    borderTop: '1px solid var(--border-subtle)',
  },
  subPresetBtn: {
    padding: '3px 8px',
    borderRadius: 4,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    font: '600 12px/1 "IBM Plex Mono", monospace',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  changesBox: {
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  changesToggleHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none',
    gap: 8,
    minHeight: 26,
  },
  changeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 6,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
  },
}
