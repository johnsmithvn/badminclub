import { useState, useEffect } from 'react'
import { Dialog, Button, Icon } from '#ds'
import {
  parseVideoProvider,
  buildPlayableVideoUrl,
  buildEmbedVideoUrl,
} from '#utils/videoUtils.js'
import { t } from '#i18n'
import { useMobile } from '#hooks/useMobile.js'
import { useApp } from '#contexts/AppContext.jsx'
import { playerName, myMember } from '#lib/money.js'
import AttachVideoModal from './AttachVideoModal.jsx'

// Set lưu các matchId đã tính lượt xem trong phiên làm việc hiện tại để tránh spam
const viewedMatchIdsInSession = new Set()

/**
 * Modal phát video nhúng trực tiếp trên app (YouTube iframe, Google Drive preview, Direct video)
 * @param {{
 *   match: object|null,
 *   matchCode?: string,
 *   onClose: () => void,
 * }} props
 */
export function VideoPlayerModal({ match, matchCode, onClose }) {
  const { db, a } = useApp()
  const isMobile = useMobile()
  const [editingVideo, setEditingVideo] = useState(false)
  const [showViewersList, setShowViewersList] = useState(false)
  const [copied, setCopied] = useState(false)

  // Lấy match trực tiếp từ db để đồng bộ tức thời khi sửa hoặc tăng view
  const liveMatch = (db.matches || []).find((m) => m.id === match?.id) || match

  // Tăng lượt xem 1 lần trong phiên khi mở player
  useEffect(() => {
    if (liveMatch?.id && !viewedMatchIdsInSession.has(liveMatch.id)) {
      viewedMatchIdsInSession.add(liveMatch.id)
      if (a?.incrementMatchVideoViews) {
        a.incrementMatchVideoViews(liveMatch.id)
      }
    }
  }, [liveMatch?.id, a])

  if (!liveMatch || !liveMatch.videoUrl) return null

  const myMem = myMember(db)
  const role = db.viewAs || myMem?.role || 'member'
  const isAdmin = role === 'owner' || role === 'treasurer'

  const videoUrl = liveMatch.videoUrl
  const timestamp = liveMatch.videoTimestamp || ''
  const provider = parseVideoProvider(videoUrl)
  const embedUrl = buildEmbedVideoUrl(videoUrl, timestamp)
  const playUrl = buildPlayableVideoUrl(videoUrl, timestamp)

  const providerLabel = provider === 'youtube'
    ? 'YouTube'
    : provider === 'drive'
      ? 'Google Drive'
      : provider === 'icloud'
        ? 'iCloud'
        : 'Video'

  const codeStr = matchCode || liveMatch.code || (liveMatch.id ? `M-${String(liveMatch.id).slice(-4)}` : '')
  const titleText = t('matchVideo.playerModalTitle', { code: codeStr })

  const handleCopyLink = async () => {
    try {
      const targetUrl = playUrl || videoUrl
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(targetUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // clipboard fallback
    }
  }

  const iconBtnStyle = {
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-control, 6px)',
    background: 'var(--surface-raised)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'all 0.15s ease',
    padding: 0,
    flexShrink: 0,
  }

  const titleNode = (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ font: "600 18px/1.2 'IBM Plex Mono', monospace", color: '#5FDBD3', letterSpacing: 0.3 }}>
          {codeStr}
        </span>
        {timestamp && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ font: "400 12px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
              {t('matchVideo.fieldTimestamp')}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(0, 178, 169, 0.16)',
                border: '1px solid var(--teal-500)',
                color: 'var(--teal-400, #5FDBD3)',
                font: "600 11.5px/1 'IBM Plex Mono', monospace",
                boxShadow: '0 0 8px rgba(0, 178, 169, 0.25)',
              }}
            >
              {timestamp}
            </span>
          </div>
        )}
      </div>

      {/* Cụm icon thao tác trên đầu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {/* Nút sửa video */}
        <button
          type="button"
          onClick={() => setEditingVideo(true)}
          title={t('matchVideo.editVideo')}
          aria-label={t('matchVideo.editVideo')}
          style={iconBtnStyle}
        >
          <Icon name="pencil" size={14} />
        </button>

        {/* Nút icon sao chép link */}
        <button
          type="button"
          onClick={handleCopyLink}
          title={copied ? t('matchVideo.copiedLink') : t('matchVideo.copyLink')}
          aria-label={t('matchVideo.copyLink')}
          style={{
            ...iconBtnStyle,
            ...(copied ? { color: 'var(--teal-500)', borderColor: 'var(--teal-500)', background: 'rgba(0, 178, 169, 0.18)' } : {}),
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={14} />
        </button>

        {/* Nút icon mở trang gốc (redirect icon) */}
        <a
          href={playUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={t('matchVideo.openExternal')}
          aria-label={t('matchVideo.openExternal')}
          style={iconBtnStyle}
        >
          <Icon name="arrow-up-right" size={14} />
        </a>

        {/* Nút đóng dấu X trên mobile sheet */}
        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            title={t('common.close')}
            aria-label={t('common.close')}
            style={iconBtnStyle}
          >
            <Icon name="x" size={16} />
          </button>
        )}
      </div>
    </div>
  )

  const views = Number(liveMatch.videoViews || 0)
  const viewers = liveMatch.videoViewers || {}
  const viewerEntries = Object.entries(viewers).sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={titleNode}
        width={780}
        sheet={isMobile}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}>
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

            {/* Badge lượt xem */}
            <button
              type="button"
              onClick={() => isAdmin && setShowViewersList(!showViewersList)}
              title={isAdmin ? t('matchVideo.viewersBreakdown') : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 999,
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                font: "500 11.5px/1 'IBM Plex Sans', sans-serif",
                color: 'var(--text-secondary)',
                cursor: isAdmin ? 'pointer' : 'default',
                transition: 'background 0.15s ease',
              }}
            >
              <Icon name="eye" size={13} style={{ opacity: 0.8 }} />
              <span>{t('matchVideo.viewsCount', { n: views })}</span>
              {isAdmin && viewerEntries.length > 0 && (
                <Icon name={showViewersList ? 'chevron-up' : 'chevron-down'} size={12} style={{ color: 'var(--text-muted)' }} />
              )}
            </button>
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
                title={titleText}
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

          {/* Chi tiết người xem cho Admin/Owner */}
          {isAdmin && showViewersList && (
            <div
              style={{
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: "600 12px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="users" size={13} style={{ color: 'var(--teal-500)' }} />
                  {t('matchVideo.viewersBreakdown')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowViewersList(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: 4,
                  }}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>

              {viewerEntries.length === 0 ? (
                <span style={{ font: "400 12px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)' }}>
                  {t('common.empty')}
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                  {viewerEntries.map(([mid, count]) => {
                    const name = mid === 'guest' ? t('matchVideo.guestViewer') : (playerName(db, mid) || mid)
                    return (
                      <div
                        key={mid}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: 'var(--surface-raised)',
                          font: "400 12px/1 'IBM Plex Sans', sans-serif",
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
                        <span style={{ font: "600 11.5px/1 'IBM Plex Mono', monospace", color: 'var(--teal-500)' }}>
                          {t('matchVideo.viewsCount', { n: count })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </Dialog>

      {/* Modal chỉnh sửa video khi bấm Sửa video */}
      {editingVideo && (
        <AttachVideoModal
          match={liveMatch}
          matchCode={codeStr}
          onClose={() => setEditingVideo(false)}
          onSaved={() => setEditingVideo(false)}
        />
      )}
    </>
  )
}
