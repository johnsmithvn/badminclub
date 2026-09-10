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
  // Cho phép người dùng vừa nói vừa gõ tay vào ô để test (Sandbox)
  const [inputText, setInputText] = useState('')

  const handleSpeechResult = useCallback((text) => {
    setInputText(text)
  }, [])

  const {
    isListening,
    interimTranscript,
    error: voiceError,
    startListening,
    stopListening,
    setTranscript,
    resetTranscript,
    isSupported,
  } = useVoiceRecognition({
    onResult: handleSpeechResult,
  })

  // Dừng thu âm khi modal đóng
  useEffect(() => {
    if (!open) {
      stopListening()
    }
  }, [open, stopListening])

  const activeText = (inputText || interimTranscript || '').trim()

  // Phân tích câu nói theo thời gian thực
  const parsed = useMemo(() => {
    if (!activeText) return null
    return parseVoiceMatch({
      transcript: activeText,
      players,
    })
  }, [activeText, players])

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
      startListening()
    }
  }

  const handleClear = () => {
    resetTranscript()
    setInputText('')
  }

  // Bấm chọn ứng viên khi bị trùng tên
  const handleSelectCandidate = (candidate) => {
    if (!candidate || !parsed?.queryName) return
    const candName = candidate.name || candidate.fullName || ''
    // Thay thế tên bị trùng bằng tên cụ thể
    const regex = new RegExp(`\\b${parsed.queryName}\\b`, 'i')
    const updated = inputText.replace(regex, candName)
    setInputText(updated)
    setTranscript(updated)
  }

  // Áp dụng vào sân
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
    a.toast(t('voiceMatch.toastApplied'))
    onClose()
  }

  // Xác nhận lưu trực tiếp
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

  // Các câu mẫu để thử nghiệm nhanh
  const samplePhrases = [
    '21 19',
    t('voiceMatch.exTeamA'),
    t('voiceMatch.exTeamBLose'),
    players.length >= 2
      ? t('voiceMatch.exMatch', { p1: players[0].name || '', p2: players[1].name || '' })
      : null,
  ].filter(Boolean)

  const isOk = mapped?.status === 'ok'
  const isAmbiguous = mapped?.status === 'ambiguous'
  const isInvalidScore = mapped?.status === 'invalid_score'
  const isNotFound = mapped?.status === 'not_found'

  // Tên hiển thị của Team A & Team B trong bản xem trước
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
          width: 520,
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0' }}>
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
              transition: 'all 0.2s ease',
            }}
          >
            <Icon name="mic" size={32} />
          </button>
          <span style={{ font: '500 13px/1.4 var(--font-sans)', color: isListening ? 'var(--status-incident-fg, #ef4444)' : 'var(--text-secondary)' }}>
            {isListening ? t('voiceMatch.listening') : t('voiceMatch.clickToSpeak')}
          </span>
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

        {/* Ô nhập câu thoại (Sandbox: vừa nhận diện vừa gõ tay để test) */}
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ font: '600 12px/1.2 var(--font-sans)', color: 'var(--text-secondary)' }}>
              {t('voiceMatch.sandboxHint')}
            </span>
            {inputText && (
              <button
                type="button"
                onClick={handleClear}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', font: '500 11px var(--font-sans)' }}
              >
                ✕
              </button>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t('voiceMatch.inputPlaceholder')}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border-default)',
                background: 'var(--surface-sunken)',
                color: 'var(--text-primary)',
                font: '500 14px/1.4 var(--font-sans)',
                outline: 'none',
              }}
            />
          </div>

          {/* Các câu mẫu nhanh */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            <span style={{ font: '400 11px/1.4 var(--font-sans)', color: 'var(--text-muted)' }}>
              {t('voiceMatch.examplesTitle')}
            </span>
            {samplePhrases.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => {
                  setInputText(phrase)
                  setTranscript(phrase)
                }}
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-card)',
                  color: 'var(--text-secondary)',
                  font: '400 11.5px var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                {phrase}
              </button>
            ))}
          </div>
        </div>

        {/* Khối Xem trước kết quả nhận diện (Preview) */}
        {activeText && (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              border: '1px solid var(--border-default)',
              background: 'var(--surface-card)',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ font: '600 11px/1.2 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                {t('voiceMatch.previewTitle')}
              </span>

              {/* Status Badge */}
              {isOk && (
                <span style={{ font: '600 11.5px var(--font-sans)', color: 'var(--status-delivered-fg)', background: 'var(--status-delivered-bg, rgba(16, 185, 129, 0.15))', padding: '2px 8px', borderRadius: 999 }}>
                  ✓ {t('voiceMatch.statusOk')}
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
              {isNotFound && (
                <span style={{ font: '500 11.5px var(--font-sans)', color: 'var(--text-muted)' }}>
                  {t('voiceMatch.statusNotFound')}
                </span>
              )}
            </div>

            {/* Cảnh báo trùng tên: Danh sách chọn ứng viên */}
            {isAmbiguous && parsed?.candidates?.length > 0 && (
              <div style={{ display: 'grid', gap: 6, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-sunken)' }}>
                <span style={{ font: '500 12px var(--font-sans)', color: 'var(--text-primary)' }}>
                  {t('voiceMatch.selectCandidate')}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {parsed.candidates.map((cand) => (
                    <Button
                      key={cand.id || cand.key}
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSelectCandidate(cand)}
                    >
                      {cand.fullName || cand.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Chi tiết trận đấu nhận diện được */}
            {isOk && (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--surface-sunken)' }}>
                  {/* Cột Đội A */}
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ font: '600 13px/1.3 var(--font-sans)', color: mapped.winnerTeam === 'A' ? 'var(--status-delivered-fg)' : 'var(--text-primary)' }}>
                      {previewTeamANames}
                    </div>
                    <div style={{ font: '700 20px/1.2 "IBM Plex Mono", monospace', color: mapped.winnerTeam === 'A' ? 'var(--status-delivered-fg)' : 'var(--text-muted)' }}>
                      {mapped.scoreA}
                    </div>
                  </div>

                  <span style={{ font: '600 12px var(--font-sans)', color: 'var(--text-muted)', padding: '0 10px' }}>vs</span>

                  {/* Cột Đội B */}
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                    <div style={{ font: '600 13px/1.3 var(--font-sans)', color: mapped.winnerTeam === 'B' ? 'var(--status-delivered-fg)' : 'var(--text-primary)' }}>
                      {previewTeamBNames}
                    </div>
                    <div style={{ font: '700 20px/1.2 "IBM Plex Mono", monospace', color: mapped.winnerTeam === 'B' ? 'var(--status-delivered-fg)' : 'var(--text-muted)' }}>
                      {mapped.scoreB}
                    </div>
                  </div>
                </div>

                {/* Cảnh báo nếu người chơi không có trên sân hiện tại */}
                {mapped.warning === 'player_not_on_court' && (
                  <div style={{ font: '500 11.5px/1.4 var(--font-sans)', color: 'var(--status-delayed-fg)', padding: '4px 8px', borderRadius: 6, background: 'var(--surface-sunken)' }}>
                    ⚠ {t('voiceMatch.warningNotOnCourt')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
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
                {t('voiceMatch.applyToCourt')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveDirect}
              >
                {t('voiceMatch.saveDirect')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
