import { useState } from 'react'
import { Button, Dialog } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { playerName } from '#lib/money.js'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import { parseVideoProvider } from '#utils/videoUtils.js'

export function MatchVideoInlineExpander({
  match,
  matchCode,
  timeStr,
  courtVenueStr,
  teamText,
  scoreText,
  onSave,
  onCancel,
}) {
  const [url, setUrl] = useState(match?.videoUrl || '')
  const [timestamp, setTimestamp] = useState(match?.videoTimestamp || '00:00')
  const [note, setNote] = useState(match?.videoNote || '')

  const provider = parseVideoProvider(url)

  const handleSave = () => {
    onSave({
      videoUrl: url.trim(),
      videoTimestamp: timestamp.trim(),
      videoNote: note.trim(),
    })
  }

  return (
    <div
      style={{
        background: 'var(--surface-sunken)',
        border: '1px solid var(--teal-500)',
        borderRadius: 10,
        padding: '13px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        margin: '6px 12px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ font: '600 12px/1 "IBM Plex Mono", monospace', color: 'var(--teal-500)' }}>
          {matchCode || match?.id?.slice(0, 6)}
        </div>
        <div style={{ font: '600 13px/1 "IBM Plex Mono", monospace', color: 'var(--text-primary)' }}>
          {timeStr || '19:00'}
        </div>
        {courtVenueStr && (
          <div style={{ font: '400 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
            {courtVenueStr}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 160, font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
          {teamText}
          {scoreText && (
            <span style={{ font: '600 14px/1 "IBM Plex Mono", monospace', color: 'var(--text-primary)', padding: '0 6px' }}>
              {scoreText}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 130px 150px', gap: 10, alignItems: 'end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ font: '600 10.5px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{t('matchVideo.fieldUrl')}</span>
            {provider === 'youtube' && <span style={{ color: '#FF4E45', font: '600 10px/1 "IBM Plex Sans", sans-serif' }}>● YouTube</span>}
            {provider === 'drive' && <span style={{ color: '#0F9D58', font: '600 10px/1 "IBM Plex Sans", sans-serif' }}>● Google Drive</span>}
            {provider === 'icloud' && <span style={{ color: '#AF52DE', font: '600 10px/1 "IBM Plex Sans", sans-serif' }}>● iCloud Photos</span>}
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('matchVideo.urlPlaceholder')}
            style={{
              height: 36,
              padding: '0 11px',
              borderRadius: 7,
              background: 'var(--field-bg)',
              border: '1px solid var(--border-subtle)',
              font: '400 12.5px/1 "IBM Plex Mono", monospace',
              color: 'var(--text-primary)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ font: '600 10.5px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {t('matchVideo.fieldTimestamp')}
          </div>
          <input
            type="text"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            placeholder="00:00"
            style={{
              height: 36,
              padding: '0 11px',
              borderRadius: 7,
              background: 'var(--field-bg)',
              border: '1px solid var(--border-subtle)',
              font: '400 12.5px/1 "IBM Plex Mono", monospace',
              color: 'var(--text-primary)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ font: '600 10.5px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {t('matchVideo.fieldNote')}
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('matchVideo.notePlaceholder')}
            style={{
              height: 36,
              padding: '0 11px',
              borderRadius: 7,
              background: 'var(--field-bg)',
              border: '1px solid var(--border-subtle)',
              font: '400 12px/1 "IBM Plex Sans", sans-serif',
              color: 'var(--text-primary)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240, font: '400 12px/1.5 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
          {t('matchVideo.storageNotice')}
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 32,
            padding: '0 12px',
            borderRadius: 7,
            border: 'none',
            background: 'transparent',
            font: '600 12.5px/1 "IBM Plex Sans", sans-serif',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={{
            height: 32,
            padding: '0 14px',
            borderRadius: 7,
            border: 'none',
            background: 'var(--teal-500)',
            font: '600 12.5px/1 "IBM Plex Sans", sans-serif',
            color: 'var(--navy-900, #04302C)',
            cursor: 'pointer',
          }}
        >
          {t('matchVideo.saveLink')}
        </button>
      </div>
    </div>
  )
}

/**
 * Modal / Bottom Sheet gắn link YouTube / Google Drive / iCloud cho trận đấu
 * Thiết kế chuẩn V3 từ mockup giao diện
 */
export default function AttachVideoModal({ match, matchCode, onClose, onSave, onSaved }) {
  const { db, a } = useApp()
  const isMobile = useMobile()
  const [url, setUrl] = useState(match?.videoUrl || '')
  const [timestamp, setTimestamp] = useState(match?.videoTimestamp || '00:00')
  const [note, setNote] = useState(match?.videoNote || '')
  const [copiedHint, setCopiedHint] = useState(false)

  const provider = parseVideoProvider(url)

  // Thông tin 2 đội & tỷ số trận đấu để render preview box chuẩn V3
  const teamA = match?.teamA || []
  const teamB = match?.teamB || []
  const aWon = match?.winnerTeam === 'A'
  const winnerTeam = aWon ? teamA : teamB
  const loserTeam = aWon ? teamB : teamA
  const winnerNames = winnerTeam.map((id) => playerName(db, id)).join(' · ') || (aWon ? 'A' : 'B')
  const loserNames = loserTeam.map((id) => playerName(db, id)).join(' · ') || (aWon ? 'B' : 'A')

  const scoreSets = (match?.sets || []).map(([a, b]) => ({
    winPts: aWon ? a : b,
    losePts: aWon ? b : a,
  }))
  const isMultiSet = scoreSets.length > 1
  const winSetsCount = isMultiSet ? scoreSets.filter((s) => s.winPts > s.losePts).length : 0
  const loseSetsCount = isMultiSet ? scoreSets.filter((s) => s.losePts > s.winPts).length : 0

  const timeStr = match?.at
    ? new Date(match.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : ''
  const codeStr = matchCode || (match?.id ? `M-${String(match.id).slice(-4)}` : '')
  const subDesc = timeStr ? `${codeStr} · ${timeStr}` : codeStr

  const handlePaste = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText()
        if (text) {
          setUrl(text)
          setCopiedHint(true)
          setTimeout(() => setCopiedHint(false), 2000)
        }
      }
    } catch {
      // clipboard access not permitted
    }
  }

  const handleSave = () => {
    const data = {
      videoUrl: url.trim(),
      videoTimestamp: timestamp.trim(),
      videoNote: note.trim(),
    }
    if (onSave) {
      onSave(data)
    } else if (a?.attachMatchVideo && match?.id) {
      a.attachMatchVideo(match.id, data)
    }
    if (onSaved) onSaved(data)
    onClose()
  }

  const handleRemove = () => {
    const data = {
      videoUrl: null,
      videoTimestamp: null,
      videoNote: null,
    }
    if (onSave) {
      onSave(data)
    } else if (a?.attachMatchVideo && match?.id) {
      a.attachMatchVideo(match.id, data)
    }
    if (onSaved) onSaved(data)
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      sheet={isMobile}
      width={460}
      title={t('matchVideo.sheetTitle')}
      description={subDesc}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
          {match?.videoUrl ? (
            <Button variant="danger" onClick={handleRemove}>
              {t('matchVideo.removeLink')}
            </Button>
          ) : (
            <div />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 44,
                padding: '0 18px',
                borderRadius: 10,
                background: 'var(--surface-raised, #101927)',
                border: '1px solid var(--border-default, #2E3E5C)',
                font: "600 13.5px/1 'IBM Plex Sans', sans-serif",
                color: 'var(--text-secondary, #A8B7CB)',
                cursor: 'pointer',
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                height: 44,
                padding: '0 24px',
                borderRadius: 10,
                background: 'var(--teal-500, #00B2A9)',
                border: 'none',
                font: "600 14px/1 'IBM Plex Sans', sans-serif",
                color: '#04302C',
                cursor: 'pointer',
              }}
            >
              {t('matchVideo.saveLink')}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13, padding: '4px 0' }}>
        {/* Preview box: 2 đội và điểm số chuẩn V3 */}
        <div
          style={{
            background: 'var(--surface-sunken, #101927)',
            border: '1px solid var(--border-subtle, #22304A)',
            borderRadius: 10,
            padding: '11px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0, font: "600 14px/1.25 'IBM Plex Sans', sans-serif", color: '#5FDBD3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {winnerNames}
            </span>
            <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: '#8BEDE6' }}>
              {isMultiSet ? winSetsCount : (scoreSets[0]?.winPts ?? '—')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0, font: "500 13.5px/1.25 'IBM Plex Sans', sans-serif", color: '#BFCDDE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {loserNames}
            </span>
            <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: '#B3C2D6' }}>
              {isMultiSet ? loseSetsCount : (scoreSets[0]?.losePts ?? '—')}
            </span>
          </div>
        </div>

        {/* Ô nhập Link Video */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted, #8494AA)' }}>
              {t('matchVideo.fieldUrl')}
            </div>
            {provider === 'youtube' && <span style={{ color: '#FF4E45', font: "600 10.5px/1 'IBM Plex Sans', sans-serif" }}>● YouTube</span>}
            {provider === 'drive' && <span style={{ color: '#0F9D58', font: "600 10.5px/1 'IBM Plex Sans', sans-serif" }}>● Google Drive</span>}
            {provider === 'icloud' && <span style={{ color: '#AF52DE', font: "600 10.5px/1 'IBM Plex Sans', sans-serif" }}>● iCloud Photos</span>}
          </div>

          <div
            style={{
              height: 46,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 12px',
              borderRadius: 10,
              background: 'var(--field-bg, #0E1726)',
              border: url ? '1px solid var(--teal-500, #00B2A9)' : '1px solid var(--border-default, #2E3E5C)',
              transition: 'border 0.2s ease',
            }}
          >
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="youtu.be/..."
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                font: "400 13px/1 'IBM Plex Mono', monospace",
                color: 'var(--text-primary, #E9EFF7)',
              }}
            />
            <button
              type="button"
              onClick={handlePaste}
              style={{
                border: 'none',
                background: 'transparent',
                font: "600 11.5px/1 'IBM Plex Sans', sans-serif",
                color: copiedHint ? '#8BEDE6' : '#5FDBD3',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: 4,
              }}
            >
              {copiedHint ? t('matchVideo.pastedSuccess') : t('matchVideo.pasteBtn')}
            </button>
          </div>

          <div style={{ font: "400 11.5px/1.45 'IBM Plex Sans', sans-serif", color: 'var(--text-muted, #8494AA)' }}>
            {t('matchVideo.storageNotice')}
          </div>
        </div>

        {/* Hàng 2 cột: Bắt đầu từ & Ghi chú */}
        <div style={{ display: 'flex', gap: 9 }}>
          <div style={{ width: 124, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted, #8494AA)' }}>
              {t('matchVideo.fieldTimestamp')}
            </div>
            <div
              style={{
                height: 46,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                borderRadius: 10,
                background: 'var(--field-bg, #0E1726)',
                border: '1px solid var(--border-default, #2E3E5C)',
              }}
            >
              <input
                type="text"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                placeholder="00:00"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  font: "400 13px/1 'IBM Plex Mono', monospace",
                  color: 'var(--text-primary, #A8B7CB)',
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted, #8494AA)' }}>
              {t('matchVideo.fieldNote')}
            </div>
            <div
              style={{
                height: 46,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                borderRadius: 10,
                background: 'var(--field-bg, #0E1726)',
                border: '1px solid var(--border-default, #2E3E5C)',
              }}
            >
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('matchVideo.notePlaceholder')}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  font: "400 13px/1 'IBM Plex Sans', sans-serif",
                  color: 'var(--text-primary, #E9EFF7)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Banner chú ý */}
        <div
          style={{
            padding: '11px 12px',
            borderRadius: 9,
            background: 'rgba(0,178,169,.10)',
            border: '1px solid rgba(0,178,169,.35)',
            font: "400 12px/1.5 'IBM Plex Sans', sans-serif",
            color: '#A8B7CB',
          }}
        >
          {t('matchVideo.sessionVideosSub')}
        </div>
      </div>
    </Dialog>
  )
}
