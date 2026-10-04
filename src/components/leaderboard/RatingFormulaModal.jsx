import { t } from '#i18n'
import { ModalOverlay } from '#ui'
import { useMobile } from '#hooks/useMobile.js'

// Hệ số biên thắng: [nhãn, độ dài thanh, màu thanh, hệ số cũ, hệ số mới]
const MOV_ROWS = [
  ['rating.le4Pts', '6%', '#00786F', '×1.05', '×1.02'],
  ['rating.pts5to8', '32%', '#00786F', '×1.20', '×1.10'],
  ['rating.pts9to13', '52%', '#00B2A9', '×1.40', '×1.15'],
  ['rating.ge14Pts', '76%', '#00B2A9', '×1.40', '×1.22'],
]

// Vai trò khi chia sân (tổng 100 điểm). `note` là chữ thô, `noteKey` là key i18n.
const ROLE_ROWS = [
  { label: 'rating.courtBalance', bar: '34%', barColor: '#00B2A9', note: '30 → 34', value: '34' },
  { label: 'rating.fairTurns', bar: '20%', barColor: '#00B2A9', note: '15 → 20', value: '20' },
  { label: 'rating.partnerOppDiversity', bar: '18%', barColor: '#3C74C4', noteKey: 'rating.combined2015', value: '18' },
  { label: 'rating.synergyNew', isNew: true, bar: '16%', barColor: '#00786F', noteKey: 'rating.onlyWhenR2', value: '16', valueColor: '#5FDBD3' },
  { label: 'rating.matchupNew', isNew: true, bar: '8%', barColor: '#00786F', noteKey: 'rating.onlyWhenR2', value: '8', valueColor: '#5FDBD3' },
  { raw: 'H2H', labelColor: '#A8B7CB', bar: '4%', barColor: '#2E3E5C', note: '20 → 4', noteColor: '#F0B75C', value: '4', valueColor: '#A8B7CB' },
]

// Ngưỡng mẫu R1–R4: [mã, nền mã, màu mã, key số trận, key luật, viền thẻ]
const THRESHOLDS = [
  ['R1 ●○○○', 'rgba(214,59,43,.18)', '#F09A8E', 'rating.r1Matches', 'rating.r1Rule', '#22304A'],
  ['R2 ●●○○', 'rgba(240,183,92,.16)', '#F0B75C', 'rating.r2Matches', 'rating.r2Rule', '#22304A'],
  ['R3 ●●●○', 'rgba(0,178,169,.16)', '#5FDBD3', 'rating.r3Matches', 'rating.r3Rule', '#22304A'],
  ['R4 ●●●●', 'rgba(0,178,169,.16)', '#5FDBD3', 'rating.r4Matches', 'rating.r4Rule', '#00786F'],
]

// Ví dụ đầu vào công thức: [key nhãn, giá trị, màu giá trị, chú thích, chú thích là key i18n?]
const INPUTS = [
  ['rating.rawSynergy', '+70', '#E9EFF7', 'Minh · Nam', false],
  ['rating.pairStrength', '1752 → 1822', '#E9EFF7', 'rating.expectedToActual', true],
  ['rating.synergyConvert', '×1.85', '#E9EFF7', 'rating.rawToSynergy91', true],
  ['rating.impactDisplay', '+17pp', '#5FDBD3', '55% → 72%', false],
]

/**
 * Popup "Công thức rating" (tab Cặp đôi). Desktop: hộp 820px giữa màn. Mobile: sheet dính đáy, bảng xếp 2 tầng
 * (thanh % xuống dòng riêng — cùng thứ tự DOM, chỉ đặt lại vị trí trên lưới), thẻ 2 cột thay vì 4.
 */
export default function RatingFormulaModal({ onClose, totalMatches = 214, isMobile: isMobileProp }) {
  const isMobileHook = useMobile()
  const isMobile = isMobileProp !== undefined ? isMobileProp : isMobileHook
  // Giá trị riêng cho mobile; desktop nhận `undefined` → React bỏ qua, giữ nguyên style cũ.
  const mob = (v) => (isMobile ? v : undefined)
  const block = (gap, border = '#22304A') => ({
    background: '#141D2E',
    border: `1px solid ${border}`,
    borderRadius: 10,
    padding: isMobile ? 12 : 15,
    display: 'grid',
    gap,
    gridTemplateColumns: mob('minmax(0, 1fr)'),
  })
  const descFont = isMobile ? "400 14px/1.55 'IBM Plex Sans', sans-serif" : "400 12.5px/1.55 'IBM Plex Sans', sans-serif"
  const movCols = isMobile ? 'minmax(0,1fr) 56px 56px' : '126px minmax(0,1fr) 92px 92px'

  return (
    <ModalOverlay onClose={onClose} align={isMobile ? 'flex-end' : 'center'} padding={isMobile ? 0 : 16}>
      <div
        data-screen-label="EA2 Cai dat rating"
        style={{
          width: isMobile ? '100%' : 820,
          maxWidth: '100%',
          background: '#0B1220',
          border: '1px solid #22304A',
          borderRadius: isMobile ? '18px 18px 0 0' : 12,
          padding: isMobile ? '16px 14px calc(20px + env(safe-area-inset-bottom, 0px))' : 20,
          display: 'grid',
          gap: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,.60)',
          maxHeight: isMobile ? '88vh' : '90vh',
          overflowY: 'auto',
          gridTemplateColumns: mob('minmax(0, 1fr)'),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: isMobile ? 'center' : 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ font: '600 18px/1.25 Barlow, sans-serif', color: '#fff' }}>
            {t('rating.formulaTitle')}
          </div>
          <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
            {t('rating.formulaAdminOnly')}
          </div>
          <div style={{ flex: '1 1 0%' }} />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              font: "600 16px/1 'IBM Plex Mono', monospace",
              color: '#8494AA',
              padding: isMobile ? 0 : 4,
              width: mob(44),
              height: mob(44),
              display: mob('inline-flex'),
              alignItems: mob('center'),
              justifyContent: mob('center'),
              marginRight: mob(-10),
            }}
          >
            ✕
          </button>
        </div>

        {/* Khối 1: Biên thắng làm mềm */}
        <div style={block(12)}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", flex: 1, color: '#fff' }}>
              {t('rating.movMultiplier')}
            </span>
            <span
              style={{
                font: "600 10px/1 'IBM Plex Mono', monospace",
                padding: '4px 7px',
                borderRadius: 999,
                background: 'rgba(0,178,169,.16)',
                border: '1px solid #00786F',
                color: '#5FDBD3',
              }}
            >
              {t('rating.movSoftened')}
            </span>
          </div>
          <div style={{ font: descFont, color: '#A8B7CB' }}>
            {t('rating.movDesc')}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: movCols,
                gap: 10,
                alignItems: 'center',
                font: "600 11px/1.2 'IBM Plex Sans', sans-serif",
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: '#8494AA',
              }}
            >
              <span>{t('rating.pointsDiff')}</span>
              <span style={isMobile ? { display: 'none' } : undefined} />
              <span style={{ textAlign: 'right' }}>{t('rating.oldCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('rating.newCol')}</span>
            </div>

            {MOV_ROWS.map(([label, bar, barColor, oldX, newX]) => (
              <div
                key={label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: movCols,
                  gap: isMobile ? '6px 10px' : 10,
                  alignItems: 'center',
                  padding: '9px 0',
                  borderTop: '1px solid #22304A',
                }}
              >
                <span style={{ font: isMobile ? "400 14px/1.3 'IBM Plex Sans', sans-serif" : "400 12.5px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7', gridColumn: mob(1), gridRow: mob(1) }}>
                  {t(label)}
                </span>
                <span style={{ height: 8, borderRadius: 999, background: '#0B1220', overflow: 'hidden', display: 'flex', gridColumn: mob('1 / -1'), gridRow: mob(2) }}>
                  <span style={{ width: bar, background: barColor }} />
                </span>
                <span style={{ textAlign: 'right', font: "400 12px/1 'IBM Plex Mono', monospace", color: '#8494AA', gridColumn: mob(2), gridRow: mob(1) }}>
                  {oldX}
                </span>
                <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: '#5FDBD3', gridColumn: mob(3), gridRow: mob(1) }}>
                  {newX}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Khối 2: Vai trò khi chia sân */}
        <div style={block(12)}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", flex: 1, color: '#fff' }}>
              {t('rating.courtRoleTitle')}
            </span>
            <span style={{ font: "400 12px/1.2 'IBM Plex Mono', monospace", color: '#8494AA' }}>
              {t('rating.total100')}
            </span>
          </div>
          <div style={{ font: descFont, color: '#A8B7CB' }}>
            {t('rating.courtRoleDesc')}
          </div>
          <div style={{ display: 'grid', gap: isMobile ? 14 : 9 }}>
            {ROLE_ROWS.map((r) => (
              <div key={r.label || r.raw} style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0,1fr) 40px' : '150px minmax(0,1fr) 96px 40px', gap: isMobile ? '6px 10px' : 10, alignItems: 'center' }}>
                <span style={{ font: isMobile ? "600 14px/1.3 'IBM Plex Sans', sans-serif" : "600 12.5px/1.3 'IBM Plex Sans', sans-serif", color: r.labelColor || '#E9EFF7', gridColumn: mob(1), gridRow: mob(1) }}>
                  {r.raw || t(r.label)}{r.isNew ? ' ' : null}{r.isNew && <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>{t('rating.newBadge')}</span>}
                </span>
                <span style={{ height: 10, borderRadius: 999, background: '#0B1220', border: '1px solid #22304A', overflow: 'hidden', display: 'flex', gridColumn: mob('1 / -1'), gridRow: mob(2) }}>
                  <span style={{ width: r.bar, background: r.barColor }} />
                </span>
                <span style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: r.noteColor || '#8494AA', gridColumn: mob('1 / -1'), gridRow: mob(3) }}>{r.noteKey ? t(r.noteKey) : r.note}</span>
                <span style={{ textAlign: 'right', font: "600 13px/1 'IBM Plex Mono', monospace", color: r.valueColor || '#fff', gridColumn: mob(2), gridRow: mob(1) }}>{r.value}</span>
              </div>
            ))}
          </div>
          <div style={{ font: isMobile ? "400 13px/1.5 'IBM Plex Sans', sans-serif" : "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA', borderTop: '1px solid #22304A', paddingTop: 11 }}>
            {t('rating.h2hRoleNote')}
          </div>
        </div>

        {/* Khối 3: Ngưỡng mẫu */}
        <div style={block(11)}>
          <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#fff' }}>
            {t('rating.sampleThresholdTitle')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            {THRESHOLDS.map(([code, codeBg, codeColor, matchesKey, ruleKey, border]) => (
              <div key={code} style={{ padding: '11px 12px', borderRadius: 8, background: '#101927', border: `1px solid ${border}`, display: 'grid', gap: 4 }}>
                <span style={{ font: "600 10px/1 'IBM Plex Mono', monospace", padding: '4px 6px', borderRadius: 4, background: codeBg, color: codeColor, justifySelf: 'start' }}>
                  {code}
                </span>
                <span style={{ font: "600 15px/1.2 'IBM Plex Sans', sans-serif", color: '#fff' }}>{t(matchesKey)}</span>
                <span style={{ font: isMobile ? "400 12.5px/1.4 'IBM Plex Sans', sans-serif" : "400 11.5px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t(ruleKey)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Khối 4: Đầu vào công thức */}
        <div style={block(11, '#2E3E5C')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", flex: 1, color: '#fff' }}>
              {t('rating.formulaInputsTitle')}
            </span>
            <span
              style={{
                font: "600 10px/1 'IBM Plex Mono', monospace",
                padding: '4px 7px',
                borderRadius: 999,
                background: 'rgba(148,164,186,.16)',
                border: '1px solid #2E3E5C',
                color: '#A8B7CB',
              }}
            >
              {t('rating.formulaInputsAdminOnly')}
            </span>
          </div>
          <div style={{ font: descFont, color: '#A8B7CB' }}>
            {t('rating.formulaInputsDesc')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            {INPUTS.map(([labelKey, value, valueColor, sub, subIsKey]) => (
              <div key={labelKey} style={{ padding: '11px 12px', borderRadius: 8, background: '#101927', border: '1px solid #22304A', display: 'grid', gap: 4 }}>
                <span style={{ font: isMobile ? "400 12.5px/1.3 'IBM Plex Sans', sans-serif" : "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>{t(labelKey)}</span>
                <span style={{ font: "400 16px/1.2 'IBM Plex Mono', monospace", color: valueColor, overflowWrap: mob('anywhere') }}>{value}</span>
                <span style={{ font: "400 11px/1.4 'IBM Plex Sans', sans-serif", color: '#5B6B81' }}>{subIsKey ? t(sub) : sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Khối 5: Chưa bật */}
        <div
          style={{
            background: '#101927',
            border: '1px solid #22304A',
            borderRadius: 10,
            padding: isMobile ? 12 : 14,
            display: 'grid',
            gap: 9,
          }}
        >
          <div style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#fff' }}>
            {t('rating.notEnabledTitle')}
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {['rating.disabledGlicko', 'rating.disabledTrueSkill', 'rating.disabledGenderElo'].map((k) => (
              <span key={k} style={{ font: "400 12px/1.3 'IBM Plex Mono', monospace", color: '#8494AA', padding: '6px 10px', borderRadius: 6, background: '#0B1220', border: '1px solid #22304A' }}>
                {t(k)}
              </span>
            ))}
          </div>
          <div style={{ font: isMobile ? "400 13px/1.5 'IBM Plex Sans', sans-serif" : "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
            {t('rating.notEnabledNote', { count: totalMatches })}
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}
