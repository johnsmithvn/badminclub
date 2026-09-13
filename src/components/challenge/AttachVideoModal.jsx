import { useState } from 'react'
import { Button, Dialog, Input, Icon } from '#ds'
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
        <div style={{ font: '400 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
          {courtVenueStr}
        </div>
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

export default function AttachVideoModal({ match, matchCode, onClose, onSave }) {
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
    onClose()
  }

  const handleRemove = () => {
    onSave({
      videoUrl: null,
      videoTimestamp: null,
      videoNote: null,
    })
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('matchVideo.modalTitle', { code: matchCode || match?.id?.slice(0, 6) })}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
          {match?.videoUrl ? (
            <Button variant="danger" onClick={handleRemove}>
              {t('matchVideo.removeLink')}
            </Button>
          ) : (
            <div />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {t('matchVideo.saveLink')}
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 14, padding: '4px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ font: '600 12px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>
            {t('matchVideo.fieldUrl')}
          </label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('matchVideo.urlPlaceholder')}
          />
          {provider === 'youtube' && (
            <div style={{ fontSize: 11.5, color: '#FF4E45' }}>
              ✓ {t('matchVideo.detectedYoutube')}
            </div>
          )}
          {provider === 'drive' && (
            <div style={{ fontSize: 11.5, color: '#0F9D58' }}>
              ✓ {t('matchVideo.detectedDrive')}
            </div>
          )}
          {provider === 'icloud' && (
            <div style={{ fontSize: 11.5, color: '#AF52DE' }}>
              ✓ {t('matchVideo.detectedICloud')}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ font: '600 12px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>
              {t('matchVideo.fieldTimestamp')}
            </label>
            <Input
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              placeholder="00:00"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ font: '600 12px/1.2 "IBM Plex Sans", sans-serif', color: 'var(--text-secondary)' }}>
              {t('matchVideo.fieldNote')}
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('matchVideo.notePlaceholder')}
            />
          </div>
        </div>

        <div style={{ font: '400 12px/1.5 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
          {t('matchVideo.storageNotice')}
        </div>
      </div>
    </Dialog>
  )
}
