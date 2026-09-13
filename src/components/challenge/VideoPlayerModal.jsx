import { Dialog, Button, Icon } from '#ds'
import {
  parseVideoProvider,
  buildPlayableVideoUrl,
  buildEmbedVideoUrl,
  formatVideoDisplayLabel,
} from '#utils/videoUtils.js'
import { t } from '#i18n'
import { useMobile } from '#hooks/useMobile.js'

/**
 * Modal phát video nhúng trực tiếp trên app (YouTube iframe, Google Drive preview, Direct video)
 * @param {{
 *   match: object|null,
 *   matchCode?: string,
 *   onClose: () => void,
 * }} props
 */
export function VideoPlayerModal({ match, matchCode, onClose }) {
  const isMobile = useMobile()
  if (!match || !match.videoUrl) return null

  const videoUrl = match.videoUrl
  const timestamp = match.videoTimestamp || ''
  const provider = parseVideoProvider(videoUrl)
  const embedUrl = buildEmbedVideoUrl(videoUrl, timestamp)
  const playUrl = buildPlayableVideoUrl(videoUrl, timestamp)
  const displayLabel = formatVideoDisplayLabel(videoUrl, timestamp)

  const providerLabel = provider === 'youtube'
    ? 'YouTube'
    : provider === 'drive'
      ? 'Google Drive'
      : provider === 'icloud'
        ? 'iCloud'
        : 'Video'

  const codeStr = matchCode || match.code || (match.id ? `M-${String(match.id).slice(-4)}` : '')
  const title = t('matchVideo.playerModalTitle', { code: codeStr })

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={displayLabel}
      width={780}
      sheet={isMobile}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                font: "600 11px/1 'IBM Plex Sans', sans-serif",
                padding: '4px 9px',
                borderRadius: 999,
                background: provider === 'youtube'
                  ? 'rgba(225,68,52,.18)'
                  : provider === 'drive'
                    ? 'rgba(0,178,169,.18)'
                    : 'var(--surface-brand-soft)',
                color: provider === 'youtube'
                  ? '#FF8578'
                  : provider === 'drive'
                    ? 'var(--teal-500)'
                    : 'var(--text-secondary)',
              }}
            >
              {providerLabel}
            </span>
            {timestamp && (
              <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>
                ⏱ {t('matchVideo.fieldTimestamp')}: <strong style={{ color: 'var(--text-primary)' }}>{timestamp}</strong>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href={playUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px',
                borderRadius: 'var(--radius-control)',
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                textDecoration: 'none',
                cursor: 'pointer',
              }}
              title={playUrl}
            >
              <Icon name="arrow-up-right" size={13} />
              <span>{t('matchVideo.openExternal')}</span>
            </a>
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ padding: '0 0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Khung Video Player 16:9 */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            background: '#000000',
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {embedUrl && provider !== 'direct' ? (
            <iframe
              src={embedUrl}
              title={title}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : embedUrl && provider === 'direct' ? (
            <video
              src={embedUrl}
              controls
              autoPlay
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          ) : (
            /* Fallback cho iCloud hoặc URL không nhúng được */
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: 24,
                textAlign: 'center',
                background: 'var(--surface-inset)',
                color: 'var(--text-secondary)',
              }}
            >
              <Icon name="play" size={36} style={{ color: 'var(--teal-500)', opacity: 0.8 }} />
              <div style={{ font: "600 14px/1.4 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', maxWidth: 440 }}>
                {provider === 'icloud'
                  ? t('matchVideo.icloudNotice')
                  : t('matchVideo.openDirect')}
              </div>
              <a
                href={playUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  height: 34,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 16px',
                  borderRadius: 'var(--radius-control)',
                  background: 'var(--action-primary-bg)',
                  color: 'var(--action-primary-fg)',
                  font: "600 13px/1 'IBM Plex Sans', sans-serif",
                  textDecoration: 'none',
                  marginTop: 6,
                }}
              >
                <span>{provider === 'icloud' ? t('matchVideo.openIcloud') : t('matchVideo.openDirect')}</span>
                <Icon name="arrow-up-right" size={14} />
              </a>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
