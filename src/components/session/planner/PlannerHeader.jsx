import { t } from '#i18n'
import { dd } from '#utils/dates.js'
import { Icon } from '#ds'

export default function PlannerHeader({
  session,
  viewMode = 'grid',
  onSetViewMode,
  onAutoPlan,
  onReset,
  isDirty = false,
  isSaving = false,
  onSave,
  onRevert,
  isFullscreen = false,
  onToggleFullscreen,
  roundsCount = 10,
  courtsCount = 2,
  playersCount = 16,
  startTime = '19:00',
  endTime = '22:00',
  roundMinutes = 18,
  onChangeRoundMinutes,
  onAddRound,
  onRemoveRound,
}) {
  return (
    <div style={S.headerWrap}>
      <div style={S.titleGroup}>
        <div style={S.mainTitle}>
          {t('planner.title', { date: dd(session?.date || '') })}
        </div>
        <div style={S.subTitle}>
          {t('planner.sub', {
            members: playersCount,
            courts: courtsCount,
            rounds: roundsCount,
            start: startTime,
            end: endTime,
          })}
        </div>
      </div>

      {/* Segmented Mode Switcher (1a Bảng vòng vs 1b Dòng thời gian) */}
      <div style={S.switchTrack}>
        <button
          type="button"
          onClick={() => onSetViewMode('grid')}
          style={{
            ...S.switchItem,
            ...(viewMode === 'grid' ? S.switchItemActive : {}),
          }}
        >
          {t('planner.modeGrid')}
        </button>
        <button
          type="button"
          onClick={() => onSetViewMode('timeline')}
          style={{
            ...S.switchItem,
            ...(viewMode === 'timeline' ? S.switchItemActive : {}),
          }}
        >
          {t('planner.modeTimeline')}
        </button>
      </div>

      {/* Bộ điều khiển thời lượng trận đấu (15p, 18p, 20p, 25p) */}
      <div style={S.durationTrack}>
        <span style={S.durationLabel}>{t('planner.matchDuration')}:</span>
        {[15, 18, 20, 25].map((mins) => (
          <button
            key={mins}
            type="button"
            onClick={() => onChangeRoundMinutes && onChangeRoundMinutes(mins)}
            style={{
              ...S.durationItem,
              ...(roundMinutes === mins ? S.durationItemActive : {}),
            }}
          >
            {mins + 'p'}
          </button>
        ))}
      </div>

      {/* Nút thêm / bớt vòng đấu */}
      <div style={S.roundBtnGroup}>
        <button
          type="button"
          onClick={onRemoveRound}
          disabled={roundsCount <= 1}
          style={{
            ...S.btnRoundAction,
            opacity: roundsCount <= 1 ? 0.35 : 1,
            cursor: roundsCount <= 1 ? 'not-allowed' : 'pointer',
          }}
          title={t('planner.removeRoundBtn')}
        >
          <Icon name="minus" size={12} color="#8494AA" />
          <span>{t('planner.removeRoundBtn')}</span>
        </button>
        <button
          type="button"
          onClick={onAddRound}
          style={S.btnRoundAction}
          title={t('planner.addRoundBtn')}
        >
          <Icon name="plus" size={12} color="#5FDBD3" />
          <span>{t('planner.addRoundBtn')}</span>
        </button>
      </div>

      {/* Action Buttons */}
      <div style={S.actionGroup}>
        {/* Nút Khôi phục bản đã lưu (nếu lỡ tay xếp nhầm) */}
        {isDirty && onRevert && (
          <button
            type="button"
            onClick={onRevert}
            style={S.btnRevert}
            title={t('planner.revertConfirm')}
          >
            <Icon name="undo-2" size={13} color="#F0B75C" />
            <span>{t('planner.revert')}</span>
          </button>
        )}

        {/* Nút Lưu kế hoạch */}
        <button
          type="button"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          style={{
            ...S.btnSave,
            ...(isDirty ? S.btnSaveDirty : S.btnSaveClean),
          }}
        >
          {isSaving ? (
            <>
              <Icon name="loader-circle" size={14} color="#8494AA" />
              <span>{t('planner.saving')}</span>
            </>
          ) : isDirty ? (
            <>
              <span style={S.dirtyDot} />
              <Icon name="save" size={14} color="#5FDBD3" />
              <span>{t('planner.savePlan')}</span>
            </>
          ) : (
            <>
              <Icon name="check" size={14} color="#2FCCC3" />
              <span>{t('planner.saved')}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onAutoPlan}
          style={S.btnAutoPlan}
        >
          <Icon name="sparkles" size={14} color="#5FDBD3" />
          <span>{t('planner.autoPlan')}</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          style={S.btnReset}
          title={t('planner.reset')}
        >
          <Icon name="eraser" size={13} color="#8494AA" />
          <span>{t('planner.reset')}</span>
        </button>

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            style={S.btnIcon}
            title={isFullscreen ? t('planner.exitFullscreen') : t('planner.fullscreen')}
          >
            <Icon name={isFullscreen ? 'minimize-2' : 'maximize-2'} size={15} color="#8494AA" />
          </button>
        )}
      </div>
    </div>
  )
}

const S = {
  headerWrap: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    padding: '12px 18px',
    background: '#141D2E',
    borderBottom: '1px solid #22304A',
    borderRadius: '12px 12px 0 0',
    flexWrap: 'wrap',
  },
  titleGroup: {
    display: 'grid',
    gap: 2,
    flex: '1 1 240px',
    minWidth: 0,
  },
  mainTitle: {
    font: '600 18px/1.25 Barlow, sans-serif',
    color: '#fff',
    letterSpacing: '-0.01em',
  },
  subTitle: {
    font: '400 12px/1.35 "IBM Plex Mono", monospace',
    color: '#8494AA',
  },
  switchTrack: {
    display: 'flex',
    padding: 3,
    borderRadius: 8,
    background: '#101927',
    border: '1px solid #22304A',
  },
  switchItem: {
    display: 'flex',
    alignItems: 'center',
    height: 30,
    padding: '0 13px',
    borderRadius: 6,
    font: '600 12.5px/1 "IBM Plex Sans", sans-serif',
    color: 'rgba(233, 239, 247, 0.6)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
  switchItemActive: {
    background: '#1A2437',
    border: '1px solid #2E3E5C',
    color: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  durationTrack: {
    display: 'flex',
    alignItems: 'center',
    background: '#0B111D',
    border: '1px solid #22304A',
    borderRadius: 6,
    padding: '2px 4px',
    gap: 3,
  },
  durationLabel: {
    font: '500 11px/1 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
    padding: '0 4px',
  },
  durationItem: {
    background: 'transparent',
    border: 'none',
    color: '#8494AA',
    font: '600 11.5px/1 "IBM Plex Sans", sans-serif',
    padding: '5px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
  durationItemActive: {
    background: '#1A2437',
    color: '#5FDBD3',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
  },
  roundBtnGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  btnRoundAction: {
    height: 34,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 9px',
    borderRadius: 6,
    background: '#141D2E',
    border: '1px solid #22304A',
    font: '600 12px/1 "IBM Plex Sans", sans-serif',
    color: '#E9EFF7',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  btnSave: {
    height: 34,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '0 13px',
    borderRadius: 6,
    font: '600 12.5px/1 "IBM Plex Sans", sans-serif',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
  btnSaveDirty: {
    background: '#04302C',
    border: '1px solid #00B2A9',
    color: '#5FDBD3',
    boxShadow: '0 0 10px rgba(0, 178, 169, 0.25)',
  },
  btnSaveClean: {
    background: 'transparent',
    border: '1px solid #22304A',
    color: '#8494AA',
    cursor: 'default',
  },
  dirtyDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#F0B75C',
    boxShadow: '0 0 6px #F0B75C',
  },
  btnRevert: {
    height: 34,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 11px',
    borderRadius: 6,
    background: 'rgba(240, 183, 92, 0.1)',
    border: '1px solid rgba(240, 183, 92, 0.3)',
    font: '600 12px/1 "IBM Plex Sans", sans-serif',
    color: '#F0B75C',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
  btnAutoPlan: {
    height: 34,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '0 13px',
    borderRadius: 6,
    background: '#1A2437',
    border: '1px solid #2E3E5C',
    font: '600 12.5px/1 "IBM Plex Sans", sans-serif',
    color: '#E9EFF7',
    cursor: 'pointer',
    transition: 'background 120ms ease',
  },
  btnReset: {
    height: 34,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 11px',
    borderRadius: 6,
    background: 'transparent',
    border: '1px solid #22304A',
    font: '500 12px/1 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
    cursor: 'pointer',
  },
  btnIcon: {
    height: 34,
    width: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'transparent',
    border: '1px solid #22304A',
    cursor: 'pointer',
  },
}
