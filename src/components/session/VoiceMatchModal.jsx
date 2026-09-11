import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button, Icon, IconButton } from '#ds'
import { useVoiceRecognition } from '#hooks/useVoiceRecognition.js'
import { parseVoiceMatch, mapVoiceResultToCourt } from '#utils/voiceMatchParser.js'
import { playerName } from '#lib/money.js'
import { useApp } from '#contexts/AppContext.jsx'
import { t } from '#i18n'

export default function VoiceMatchModal({
  open,
  onClose,
  players = [],
  courtIdx = 0,
  currentTeamA = [],
  currentTeamB = [],
  onApplyResult,
  onDirectSave,
}) {
  const { db, a } = useApp()
  const [lastTranscript, setLastTranscript] = useState('')

  const handleSpeechResult = useCallback((text) => {
    setLastTranscript(text)
  }, [])

  const {
    isListening,
    interimTranscript,
    error: voiceError,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
  } = useVoiceRecognition({
    onResult: handleSpeechResult,
  })

  // Dừng thu âm và dọn dẹp khi modal đóng
  useEffect(() => {
    if (!open) {
      stopListening()
      resetTranscript()
    }
  }, [open, stopListening, resetTranscript])

  const activeText = (lastTranscript || interimTranscript || '').trim()

  // Lọc 4 người đang có mặt trên sân hiện tại
  const courtPlayers = useMemo(() => {
    const activeIds = new Set([...currentTeamA, ...currentTeamB])
    return players.filter((p) => activeIds.has(p.id || p.key))
  }, [players, currentTeamA, currentTeamB])

  // Phân tích câu nói theo thời gian thực với Grammar chuẩn 1 khuôn mẫu
  const parsed = useMemo(() => {
    if (!activeText) return null
    return parseVoiceMatch({
      transcript: activeText,
      players,
      courtPlayers,
      currentCourt: { teamA: currentTeamA, teamB: currentTeamB },
    })
  }, [activeText, players, courtPlayers, currentTeamA, currentTeamB])

  // Ánh xạ lên sân hiện tại
  const mapped = useMemo(() => {
    if (!parsed) return null
    return mapVoiceResultToCourt({
      parsedResult: parsed,
      courtIdx,
      currentTeamA,
      currentTeamB,
      players,
    })
  }, [parsed, courtIdx, currentTeamA, currentTeamB, players])

  if (!open) return null

  const handleMicToggle = () => {
    if (isListening) {
      stopListening()
    } else {
      resetTranscript()
      setLastTranscript('')
      startListening()
    }
  }

  const handleClear = () => {
    stopListening()
    resetTranscript()
    setLastTranscript('')
  }

  // Áp dụng tỷ số vào sân để xem trước trên giao diện chính
  const handleApply = () => {
    if (!mapped || mapped.status !== 'ok') return
    const finalTeamA = mapped.proposedTeamA?.length ? mapped.proposedTeamA : currentTeamA
    const finalTeamB = mapped.proposedTeamB?.length ? mapped.proposedTeamB : currentTeamB

    onApplyResult?.({
      teamA: finalTeamA,
      teamB: finalTeamB,
      scoreA: mapped.scoreA,
      scoreB: mapped.scoreB,
      winnerTeam: mapped.winnerTeam,
    })

    if (mapped.intent === 'assign_court') {
      a.toast(t('voiceMatch.toastAssigned', { n: mapped.matchedPlayers?.length || 0 }))
    } else {
      a.toast(t('voiceMatch.toastApplied'))
    }
    onClose()
  }

  // Xác nhận lưu thẳng kết quả trận đấu (chỉ khi người dùng chủ động bấm)
  const handleSaveDirect = () => {
    if (!mapped || mapped.status !== 'ok') return
    const finalTeamA = mapped.proposedTeamA?.length ? mapped.proposedTeamA : currentTeamA
    const finalTeamB = mapped.proposedTeamB?.length ? mapped.proposedTeamB : currentTeamB

    onDirectSave?.({
      teamA: finalTeamA,
      teamB: finalTeamB,
      scoreA: mapped.scoreA,
      scoreB: mapped.scoreB,
      winnerTeam: mapped.winnerTeam,
    })
    onClose()
  }

  const isOk = mapped?.status === 'ok'
  const isAmbiguous = mapped?.status === 'ambiguous'
  const isInvalidScore = mapped?.status === 'invalid_score'
  const isInvalidSyntax = mapped?.status === 'invalid_syntax'
  const isNotFound = mapped?.status === 'not_found'
  const isNotOnCourt = mapped?.warning === 'player_not_on_court'

  // Tên hiển thị người chơi đội A & B trên sân
  const previewTeamANames = (mapped?.proposedTeamA?.length ? mapped.proposedTeamA : currentTeamA)
    .map((k) => playerName(db, k))
    .join(' · ') || t('quickMatch.teamA')

  const previewTeamBNames = (mapped?.proposedTeamB?.length ? mapped.proposedTeamB : currentTeamB)
    .map((k) => playerName(db, k))
    .join(' · ') || t('quickMatch.teamB')

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 500,
          maxWidth: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-default)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-overlay)',
          padding: 20,
          display: 'grid',
          gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: isListening ? 'var(--status-incident-bg, rgba(239, 68, 68, 0.15))' : 'var(--teal-100, rgba(0, 178, 169, 0.15))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isListening ? 'var(--status-incident-fg, #ef4444)' : 'var(--teal-600, #00b2a9)',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon name="mic" size={20} />
            </span>
            <div>
              <div style={{ font: '600 16px/1.3 var(--font-sans)', color: 'var(--text-primary)' }}>
                {t('voiceMatch.modalTitle')}
              </div>
              <div style={{ font: '400 12px/1.3 var(--font-sans)', color: 'var(--text-muted)' }}>
                {t('session.courtNum', { n: courtIdx + 1 })}
              </div>
            </div>
          </div>
          <IconButton
            icon="x"
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>

        {/* Nút Micro to & Trạng thái thu âm */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '8px 0' }}>
          <button
            type="button"
            onClick={handleMicToggle}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: isListening ? '4px solid var(--status-incident-fg, #ef4444)' : '3px solid var(--teal-600, #00b2a9)',
              background: isListening ? 'var(--status-incident-fg, #ef4444)' : 'var(--action-accent-bg, #00b2a9)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isListening ? '0 0 20px rgba(239, 68, 68, 0.5)' : 'var(--shadow-sm)',
              transform: isListening ? 'scale(1.06)' : 'scale(1)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            aria-label={isListening ? t('voiceMatch.stopListening') : t('voiceMatch.clickToSpeak')}
          >
            <Icon name={isListening ? 'pause' : 'mic'} size={28} />
          </button>

          <div style={{ font: '600 13px/1.4 var(--font-sans)', color: isListening ? 'var(--status-incident-fg)' : 'var(--text-secondary)' }}>
            {isListening ? t('voiceMatch.listening') : t('voiceMatch.clickToSpeak')}
          </div>

          {/* Gợi ý cú pháp chuẩn Grammar */}
          <div style={{ textAlign: 'center', maxWidth: 380, display: 'grid', gap: 3 }}>
            <div style={{ font: '500 12px/1.4 var(--font-sans)', color: 'var(--teal-600)' }}>
              {t('voiceMatch.grammarHint')}
            </div>
            {courtPlayers.length > 0 && (
              <div style={{ font: '400 11.5px/1.3 var(--font-sans)', color: 'var(--text-muted)' }}>
                {t('voiceMatch.courtQuickHint')}
              </div>
            )}
          </div>

          {voiceError === 'not_supported' && !isSupported && (
            <span style={{ font: '400 11.5px/1.3 var(--font-sans)', color: 'var(--status-delayed-fg)', textAlign: 'center' }}>
              {t('voiceMatch.notSupported')}
            </span>
          )}
          {voiceError === 'not-allowed' && (
            <span style={{ font: '400 11.5px/1.3 var(--font-sans)', color: 'var(--status-incident-fg)', textAlign: 'center' }}>
              {t('voiceMatch.permissionDenied')}
            </span>
          )}
        </div>

        {/* Khối hiển thị đối chiếu: TẦNG 1 (Nghe được) & TẦNG 2 (Hiểu là) */}
        {activeText && (
          <div
            style={{
              display: 'grid',
              gap: 12,
              padding: 14,
              borderRadius: 12,
              border: '1px solid var(--border-default)',
              background: 'var(--surface-sunken)',
            }}
          >
            {/* Tầng 1: Nghe được */}
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: '600 11px/1.2 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  {t('voiceMatch.heardRaw')}
                </span>
                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    font: '500 11.5px var(--font-sans)',
                    padding: 0,
                  }}
                >
                  {t('voiceMatch.resetMic')}
                </button>
              </div>
              <div style={{ font: '500 14px/1.4 var(--font-sans)', color: 'var(--text-primary)', wordBreak: 'break-word', fontStyle: 'italic' }}>
                "{activeText}"
              </div>
            </div>

            {/* Đường kẻ phân cách */}
            <div style={{ height: 1, background: 'var(--border-subtle)' }} />

            {/* Tầng 2: Hiểu là */}
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: '600 11px/1.2 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  {t('voiceMatch.understoodAs')}
                </span>

                {/* Status Badges */}
                {isOk && (
                  <span style={{ font: '600 11.5px var(--font-sans)', color: 'var(--status-delivered-fg)', background: 'var(--status-delivered-bg, rgba(16, 185, 129, 0.15))', padding: '2px 8px', borderRadius: 999 }}>
                    ✓ {t('voiceMatch.statusOk')}
                  </span>
                )}
                {isNotOnCourt && (
                  <span style={{ font: '600 11.5px var(--font-sans)', color: 'var(--status-incident-fg)', background: 'var(--status-incident-bg, rgba(239, 68, 68, 0.15))', padding: '2px 8px', borderRadius: 999 }}>
                    ! {t('voiceMatch.warningNotOnCourt')}
                  </span>
                )}
                {isAmbiguous && (
                  <span style={{ font: '600 11.5px var(--font-sans)', color: 'var(--status-delayed-fg)', background: 'var(--status-delayed-bg, rgba(245, 158, 11, 0.15))', padding: '2px 8px', borderRadius: 999 }}>
                    ! {t('voiceMatch.statusAmbiguous')}
                  </span>
                )}
                {isInvalidScore && (
                  <span style={{ font: '600 11.5px var(--font-sans)', color: 'var(--status-incident-fg)', background: 'var(--status-incident-bg, rgba(239, 68, 68, 0.15))', padding: '2px 8px', borderRadius: 999 }}>
                    ✕ {t('voiceMatch.statusInvalidScore')}
                  </span>
                )}
                {isInvalidSyntax && (
                  <span style={{ font: '600 11.5px var(--font-sans)', color: 'var(--status-delayed-fg)', background: 'var(--status-delayed-bg, rgba(245, 158, 11, 0.15))', padding: '2px 8px', borderRadius: 999 }}>
                    ! {t('voiceMatch.statusNotFound')}
                  </span>
                )}
                {isNotFound && !isNotOnCourt && (
                  <span style={{ font: '500 11.5px var(--font-sans)', color: 'var(--text-muted)' }}>
                    {t('voiceMatch.statusNotFound')}
                  </span>
                )}
              </div>

              {/* Hướng dẫn khi bị trùng tên: Nói rõ hơn tên đầy đủ */}
              {isAmbiguous && parsed?.candidates?.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-subtle)',
                    font: '500 12px/1.4 var(--font-sans)',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {t('voiceMatch.sayMoreClearlyHint')}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {parsed.candidates.map((cand) => cand.fullName || cand.name).join(` ${t('voiceMatch.or')} `)}
                  </span>
                </div>
              )}

              {/* Kết quả nhận diện thành công: Card trực quan đối chiếu */}
              {isOk && (
                <div
                  style={{
                    display: 'grid',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Cột Đội A */}
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ font: '700 11px/1.2 var(--font-sans)', color: mapped.winnerTeam === 'A' ? 'var(--status-delivered-fg)' : 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
                        {mapped.winnerTeam === 'A' ? `✓ ${t('voiceMatch.winningTeamLabel')}` : t('voiceMatch.losingTeamLabel')}
                      </div>
                      <div style={{ font: '600 13.5px/1.3 var(--font-sans)', color: mapped.winnerTeam === 'A' ? 'var(--status-delivered-fg)' : 'var(--text-primary)' }}>
                        {previewTeamANames}
                      </div>
                      <div style={{ font: '700 24px/1.1 "IBM Plex Mono", monospace', color: mapped.winnerTeam === 'A' ? 'var(--status-delivered-fg)' : 'var(--text-muted)' }}>
                        {mapped.scoreA}
                      </div>
                    </div>

                    <span style={{ font: '700 14px var(--font-sans)', color: 'var(--text-muted)', padding: '0 12px' }}>
                      -
                    </span>

                    {/* Cột Đội B */}
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                      <div style={{ font: '700 11px/1.2 var(--font-sans)', color: mapped.winnerTeam === 'B' ? 'var(--status-delivered-fg)' : 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
                        {mapped.winnerTeam === 'B' ? `✓ ${t('voiceMatch.winningTeamLabel')}` : t('voiceMatch.losingTeamLabel')}
                      </div>
                      <div style={{ font: '600 13.5px/1.3 var(--font-sans)', color: mapped.winnerTeam === 'B' ? 'var(--status-delivered-fg)' : 'var(--text-primary)' }}>
                        {previewTeamBNames}
                      </div>
                      <div style={{ font: '700 24px/1.1 "IBM Plex Mono", monospace', color: mapped.winnerTeam === 'B' ? 'var(--status-delivered-fg)' : 'var(--text-muted)' }}>
                        {mapped.scoreB}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions: Luôn yêu cầu người dùng xác nhận */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <Button
            variant="secondary"
            onClick={onClose}
          >
            {t('common.cancel')}
          </Button>

          {isOk && (
            <>
              <Button
                variant="secondary"
                onClick={handleApply}
              >
                {mapped.intent === 'assign_court' ? t('voiceMatch.btnAssignToCourt') : t('voiceMatch.applyToCourt')}
              </Button>
              {mapped.intent === 'record_score' && (
                <Button
                  variant="primary"
                  onClick={handleSaveDirect}
                >
                  {t('voiceMatch.saveDirect')}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
