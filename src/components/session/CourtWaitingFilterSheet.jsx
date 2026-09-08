import { useMemo } from 'react'
import { t } from '#i18n'

export default function CourtWaitingFilterSheet({
  open,
  onClose,
  sortOption = 'fewest',
  onSelectSort,
  filters = {},
  onToggleFilter,
  onResetDefault,
  onAutoPickFewest,
  fewestCandidates = [],
  courtLabel = '',
  playerOnCourtName = '',
}) {
  const sortItems = [
    {
      id: 'fewest',
      title: t('assign.sortFewestTitle'),
      desc: t('assign.sortFewestDesc'),
    },
    {
      id: 'wait',
      title: t('assign.sortWaitTitle'),
      desc: t('assign.sortWaitDesc'),
    },
    {
      id: 'level',
      title: t('assign.sortLevelTitle'),
      desc: t('assign.sortLevelDesc'),
    },
    {
      id: 'az',
      title: t('assign.sortAzTitle'),
      desc: t('assign.sortAzDesc'),
    },
  ]

  // Tên 4 người ít trận nhất cho preview
  const previewNames = useMemo(() => {
    if (!fewestCandidates.length) return ''
    return fewestCandidates.slice(0, 4).map((c) => c.name).join(' · ')
  }, [fewestCandidates])

  if (!open) return null

  return (
    <div
      style={S.backdrop}
      onClick={onClose}
    >
      <div
        style={S.sheet}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thanh kéo trên cùng */}
        <div style={S.dragHandle} />

        {/* Header sheet */}
        <div style={S.headerRow}>
          <div style={S.title}>
            {t('assign.sortSheetTitle')}
          </div>
          <button
            type="button"
            onClick={onResetDefault}
            style={S.resetBtn}
          >
            {t('assign.setDefault')}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={S.closeBtn}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        {/* Danh sách tiêu chí Sắp xếp (Radio-style) */}
        <div style={S.sortList}>
          {sortItems.map((item) => {
            const isSelected = sortOption === item.id
            return (
              <div
                key={item.id}
                onClick={() => onSelectSort(item.id)}
                style={{
                  ...S.sortOptionCard,
                  ...(isSelected ? S.sortOptionCardActive : {}),
                }}
                role="button"
                tabIndex={0}
              >
                <div style={isSelected ? S.radioActive : S.radioInactive} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...S.sortOptionTitle, color: isSelected ? '#E9EFF7' : '#A8B7CB' }}>
                    {item.title}
                  </div>
                  <div style={S.sortOptionDesc}>
                    {item.desc}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Lọc nhanh · cộng dồn */}
        <div style={S.filterSection}>
          <div style={S.filterSectionTitle}>
            {t('assign.quickFilterTitle')}
          </div>
          <div style={S.filterChipGroup}>
            {/* Chip Lọc Nữ */}
            <button
              type="button"
              onClick={() => onToggleFilter('gender', (filters.gender === 'female' || filters.gender === 'nu') ? null : 'female')}
              style={{
                ...S.filterChip,
                ...((filters.gender === 'female' || filters.gender === 'nu') ? S.filterChipFemaleActive : S.filterChipFemale),
              }}
            >
              {t('assign.filterFemaleTag', { n: filters.femaleCount ?? 0 })}
            </button>

            {/* Chip Lọc Nam */}
            <button
              type="button"
              onClick={() => onToggleFilter('gender', (filters.gender === 'male' || filters.gender === 'nam') ? null : 'male')}
              style={{
                ...S.filterChip,
                ...((filters.gender === 'male' || filters.gender === 'nam') ? S.filterChipMaleActive : S.filterChipMale),
              }}
            >
              {t('assign.filterMaleTag', { n: filters.maleCount ?? 0 })}
            </button>

            {/* Chip Cùng trình ô đang xếp */}
            {filters.refLevel ? (
              <button
                type="button"
                onClick={() => onToggleFilter('sameLevel', !filters.sameLevel)}
                style={{
                  ...S.filterChip,
                  ...(filters.sameLevel ? S.filterChipActive : S.filterChipDefault),
                }}
                title={t('assign.sameLevelSlot')}
              >
                {`${t('assign.sameLevelSlot')} (${filters.refLevel} · ${filters.sameLevelCount ?? 0})`}
              </button>
            ) : (
              <button
                type="button"
                disabled
                style={{
                  ...S.filterChip,
                  ...S.filterChipDefault,
                  opacity: 0.5,
                  cursor: 'not-allowed',
                }}
                title={t('assign.sameLevelNoPlayer')}
              >
                {t('assign.sameLevelNoPlayer')}
              </button>
            )}

            {/* Chip Chưa đánh cùng (nếu trên sân đã có người) */}
            {playerOnCourtName ? (
              <button
                type="button"
                onClick={() => onToggleFilter('notPlayedWith', !filters.notPlayedWith)}
                style={{
                  ...S.filterChip,
                  ...(filters.notPlayedWith ? S.filterChipActive : S.filterChipDefault),
                }}
                title={t('assign.notPlayedWithTeam', { name: playerOnCourtName })}
              >
                {`${t('assign.notPlayedWithTeam', { name: playerOnCourtName })} (${filters.notPlayedWithCount ?? 0})`}
              </button>
            ) : (
              <button
                type="button"
                disabled
                style={{
                  ...S.filterChip,
                  ...S.filterChipDefault,
                  opacity: 0.5,
                  cursor: 'not-allowed',
                }}
                title={t('assign.notPlayedNoPlayer')}
              >
                {t('assign.notPlayedNoPlayer')}
              </button>
            )}

            {/* Chip Chưa nghỉ quả nào */}
            <button
              type="button"
              onClick={() => onToggleFilter('noRest', !filters.noRest)}
              style={{
                ...S.filterChip,
                ...(filters.noRest ? S.filterChipActive : S.filterChipDefault),
                ...(filters.noRestCount === 0 && !filters.noRest ? { opacity: 0.6 } : {}),
              }}
              title={t('assign.noRestYet')}
            >
              {`${t('assign.noRestYet')} (${filters.noRestCount ?? 0})`}
            </button>
          </div>
          <div style={S.filterHint}>
            {t('assign.filterNote')}
          </div>
        </div>

        {/* Khối gợi ý Tự xếp 4 người ít trận nhất */}
        {fewestCandidates.length >= 4 && (
          <div style={S.autoPickBox}>
            <div style={S.autoPickTitle}>
              {t('assign.autoPickFourTitle')}
            </div>
            <div style={S.autoPickDesc}>
              {previewNames} — {t('assign.autoPickExplain')}
            </div>
            <button
              type="button"
              onClick={() => {
                onAutoPickFewest()
                onClose()
              }}
              style={S.autoPickBtn}
            >
              {t('assign.testAssignToCourt', { n: courtLabel || 1 })}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(3,8,17,.68)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    width: 480,
    maxWidth: '100%',
    background: '#141D2E',
    borderTop: '1px solid #2E3E5C',
    borderRadius: '18px 18px 0 0',
    padding: '12px 16px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    boxShadow: '0 -12px 30px rgba(0,0,0,.45)',
    maxHeight: '85vh',
    overflowY: 'auto',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    background: '#2E3E5C',
    alignSelf: 'center',
    marginBottom: 4,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flex: 1,
    minWidth: 0,
    font: '600 17px/1.2 Barlow, sans-serif',
    color: '#E9EFF7',
  },
  resetBtn: {
    font: '600 12px/1 "IBM Plex Sans", sans-serif',
    color: '#5FDBD3',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    padding: '4px 6px',
  },
  closeBtn: {
    font: '600 14px/1 "IBM Plex Mono", monospace',
    color: '#8494AA',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 6px',
  },
  sortList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  sortOptionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid #22304A',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  sortOptionCardActive: {
    background: 'rgba(0,178,169,.14)',
    border: '1px solid #00B2A9',
  },
  radioActive: {
    width: 18,
    height: 18,
    flex: '0 0 auto',
    borderRadius: 999,
    border: '5px solid #00B2A9',
    background: '#0B1220',
  },
  radioInactive: {
    width: 18,
    height: 18,
    flex: '0 0 auto',
    borderRadius: 999,
    border: '1.5px solid #2E3E5C',
    background: 'transparent',
  },
  sortOptionTitle: {
    font: '600 13px/1.2 "IBM Plex Sans", sans-serif',
  },
  sortOptionDesc: {
    font: '400 11px/1.3 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
    marginTop: 2,
  },
  filterSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
  },
  filterSectionTitle: {
    font: '600 11px/1.2 "IBM Plex Sans", sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#8494AA',
  },
  filterChipGroup: {
    display: 'flex',
    gap: 7,
    flexWrap: 'wrap',
  },
  filterChip: {
    minHeight: 36,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 13px',
    borderRadius: 999,
    font: '600 12px/1 "IBM Plex Sans", sans-serif',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  filterChipDefault: {
    background: 'transparent',
    border: '1px solid #22304A',
    color: '#A8B7CB',
  },
  filterChipActive: {
    background: 'rgba(0,178,169,.18)',
    border: '1px solid #00B2A9',
    color: '#5FDBD3',
  },
  filterChipFemale: {
    background: 'transparent',
    border: '1px solid rgba(232,107,168,.45)',
    color: '#E86BA8',
  },
  filterChipFemaleActive: {
    background: 'rgba(232,107,168,.20)',
    border: '1px solid #E86BA8',
    color: '#F48CBF',
  },
  filterChipMale: {
    background: 'transparent',
    border: '1px solid #2E3E5C',
    color: '#A8B7CB',
  },
  filterChipMaleActive: {
    background: 'rgba(60,116,196,.20)',
    border: '1px solid #3C74C4',
    color: '#9FC0EA',
  },
  filterHint: {
    font: '400 12px/1.45 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
  },
  autoPickBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    background: 'rgba(60,116,196,.12)',
    border: '1px solid rgba(60,116,196,.40)',
  },
  autoPickTitle: {
    font: '600 13px/1.25 "IBM Plex Sans", sans-serif',
    color: '#9FC0EA',
  },
  autoPickDesc: {
    font: '400 12px/1.45 "IBM Plex Sans", sans-serif',
    color: '#A8B7CB',
  },
  autoPickBtn: {
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    background: '#1A2437',
    border: '1px solid #3C74C4',
    font: '700 13px/1 "IBM Plex Sans", sans-serif',
    color: '#9FC0EA',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
}
