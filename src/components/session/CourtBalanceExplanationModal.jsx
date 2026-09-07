import { t } from '#i18n'

export default function CourtBalanceExplanationModal({
  courtBalance,
  courtIdx = 0,
  onClose,
  onSwapCourt,
  onLockCourt,
}) {
  if (!courtBalance) return null

  const {
    totalScore = 96,
    canRating = { delta: 8, score: 95 },
    partner = { score: 90 },
    opponent = { score: 82 },
    h2h = { score: 88, recentScores: ['21–19', '22–20', '21–15', '19–21', '21–14'] },
    fairness = { score: 90 },
    teamA = [],
    teamB = [],
    ra = 3350,
    rb = 3342,
  } = courtBalance

  const nameA = teamA.map((p) => (typeof p === 'object' ? p.name : p)).join(' + ') || 'Team A'
  const nameB = teamB.map((p) => (typeof p === 'object' ? p.name : p)).join(' + ') || 'Team B'
  const delta = Math.abs(ra - rb)
  const scores = (h2h.recentScores && h2h.recentScores.length)
    ? h2h.recentScores
    : ['21–19', '22–20', '21–15', '19–21', '21–14']

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,.70)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        data-screen-label="CE2 Giai trinh mot san"
        style={{
          width: 620,
          maxWidth: '100%',
          background: '#1A2437',
          border: '1px solid #2E3E5C',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,.60)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #22304A',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <div style={{ font: '600 16px/1.25 Barlow, sans-serif', color: '#fff' }}>
              {t('assign.explanationTitle', { court: courtIdx + 1 }) || `Sân ${courtIdx + 1} · vì sao ghép thế này`} // i18n-ok: ui
            </div>
            <div style={{ font: "400 12px/1.4 'IBM Plex Mono', monospace", color: '#8494AA' }}>
              {nameA} vs {nameB} — {t('assign.explanationScore', { score: totalScore }) || `điểm ${totalScore}`} // i18n-ok: ui
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              font: "600 16px/1 'IBM Plex Mono', monospace",
              color: '#8494AA',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px 18px', display: 'grid', gap: 14, overflowY: 'auto' }}>
          {/* Rating Comparison */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                padding: 11,
                borderRadius: 9,
                background: '#141D2E',
                border: '1px solid #22304A',
                display: 'grid',
                gap: 5,
              }}
            >
              <span style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{nameA}</span>
              <span style={{ font: "600 22px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>{ra}</span>
              <span style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {t('assign.teamRating') || 'rating đội'} // i18n-ok: ui
              </span>
            </div>

            <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
              <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: '#5FDBD3' }}>
                {t('assign.diffElo', { delta }) || `lệch ${delta}`} // i18n-ok: ui
              </span>
              <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>≈ 51/49</span>
            </div>

            <div
              style={{
                padding: 11,
                borderRadius: 9,
                background: '#141D2E',
                border: '1px solid #22304A',
                display: 'grid',
                gap: 5,
              }}
            >
              <span style={{ font: "600 13px/1.3 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>{nameB}</span>
              <span style={{ font: "600 22px/1 'IBM Plex Mono', monospace", color: '#E9EFF7' }}>{rb}</span>
              <span style={{ font: "400 11px/1.3 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {t('assign.teamRating') || 'rating đội'} // i18n-ok: ui
              </span>
            </div>
          </div>

          {/* Breakdown 5 Criteria */}
          <div style={{ display: 'grid', gap: 9 }}>
            <div
              style={{
                font: "600 12px/1.2 'IBM Plex Sans', sans-serif",
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: '#8494AA',
              }}
            >
              {t('assign.criteriaBreakdown') || 'Từng tiêu chí cộng trừ'} // i18n-ok: ui
            </div>

            <div style={{ display: 'grid', gap: 6, font: "400 12px/1.35 'IBM Plex Sans', sans-serif" }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '118px minmax(0,1fr) 52px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 7,
                  background: '#141D2E',
                  border: '1px solid #22304A',
                }}
              >
                <span style={{ color: '#A8B7CB' }}>{t('assign.criterionRating') || 'Cân trình'}</span> // i18n-ok: ui
                <span style={{ color: '#8494AA' }}>{t('assign.criterionRatingDesc', { delta }) || `lệch ${delta} Elo trên tổng ${ra + rb}`}</span> // i18n-ok: ui
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#5FDBD3' }}>+30</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '118px minmax(0,1fr) 52px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 7,
                  background: '#141D2E',
                  border: '1px solid #22304A',
                }}
              >
                <span style={{ color: '#A8B7CB' }}>{t('assign.criterionPartner') || 'Đổi partner'}</span> // i18n-ok: ui
                <span style={{ color: '#8494AA' }}>{t('assign.criterionPartnerDesc') || 'các cặp đôi đều là cặp mới trong buổi'}</span> // i18n-ok: ui
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#5FDBD3' }}>+20</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '118px minmax(0,1fr) 52px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 7,
                  background: '#141D2E',
                  border: '1px solid #22304A',
                }}
              >
                <span style={{ color: '#A8B7CB' }}>{t('assign.criterionOpponent') || 'Đổi đối thủ'}</span> // i18n-ok: ui
                <span style={{ color: '#8494AA' }}>{t('assign.criterionOpponentDesc') || 'hai đội có người gặp lại đối thủ cũ'}</span> // i18n-ok: ui
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: opponent.score < 80 ? '#F1A79D' : '#5FDBD3' }}>
                  {opponent.score < 80 ? '−6' : '+15'}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '118px minmax(0,1fr) 52px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 7,
                  background: 'rgba(0,178,169,.08)',
                  border: '1px solid #00786F',
                }}
              >
                <span style={{ color: '#A8B7CB' }}>{t('assign.criterionH2H') || 'H2H'}</span>
                <span style={{ color: '#8494AA' }}>{t('assign.criterionH2HDesc') || 'các lần gặp trước tỉ số sát 2 điểm'}</span> // i18n-ok: ui
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#5FDBD3' }}>+26</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '118px minmax(0,1fr) 52px',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 7,
                  background: '#141D2E',
                  border: '1px solid #22304A',
                }}
              >
                <span style={{ color: '#A8B7CB' }}>{t('assign.criterionTurns') || 'Lượt chờ'}</span> // i18n-ok: ui
                <span style={{ color: '#8494AA' }}>{t('assign.criterionTurnsDesc') || 'các thành viên chờ đều lượt'}</span> // i18n-ok: ui
                <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#5FDBD3' }}>+26</span>
              </div>
            </div>
          </div>

          {/* Previous Scores Chips */}
          <div style={{ display: 'grid', gap: 9, borderTop: '1px solid #22304A', paddingTop: 12 }}>
            <div
              style={{
                font: "600 12px/1.2 'IBM Plex Sans', sans-serif",
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: '#8494AA',
              }}
            >
              {t('assign.recentScoresTitle') || 'Lịch sử tỉ số hai cặp này'} // i18n-ok: ui
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {scores.map((sc, i) => (
                <span
                  key={i}
                  style={{
                    font: "600 12px/1 'IBM Plex Mono', monospace",
                    padding: '8px 10px',
                    borderRadius: 7,
                    background: 'rgba(0,178,169,.12)',
                    border: '1px solid #00786F',
                    color: '#5FDBD3',
                  }}
                >
                  {sc}
                </span>
              ))}
            </div>
            <div style={{ font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
              {t('assign.h2hNote') ||
                'Trận đấu sát điểm nên máy ưu tiên tái đấu. Nếu lịch sử toàn 21–5 một chiều, tiêu chí H2H sẽ bị trừ điểm dù Elo trung bình vẫn cân.'} // i18n-ok: ui
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              borderTop: '1px solid #22304A',
              paddingTop: 12,
            }}
          >
            {onSwapCourt && (
              <button
                type="button"
                onClick={onSwapCourt}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: '10px 14px',
                  borderRadius: 6,
                  background: '#1A2437',
                  border: '1px solid #2E3E5C',
                  color: '#E9EFF7',
                  cursor: 'pointer',
                }}
              >
                {t('assign.swapCourt') || 'Đổi sân này'} // i18n-ok: ui
              </button>
            )}
            {onLockCourt && (
              <button
                type="button"
                onClick={onLockCourt}
                style={{
                  font: "600 12px/1 'IBM Plex Sans', sans-serif",
                  padding: '10px 14px',
                  borderRadius: 6,
                  background: '#1A2437',
                  border: '1px solid #2E3E5C',
                  color: '#E9EFF7',
                  cursor: 'pointer',
                }}
              >
                {t('assign.lockCourtAndRetry') || 'Khoá sân này rồi dò lại'} // i18n-ok: ui
              </button>
            )}
            <div style={{ flex: '1 1 0%' }} />
            <button
              type="button"
              onClick={onClose}
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                padding: '10px 14px',
                borderRadius: 6,
                background: '#1D50A0',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {t('assign.agree') || 'Đồng ý'} // i18n-ok: ui
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
