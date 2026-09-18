// src/components/notification/NotificationItem.jsx
import React from 'react'
import { Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { myMember } from '#lib/money.js'
import { resolveNotificationPayload } from '#lib/activity.js'
import { t } from '#i18n'

function formatTime(rawTs) {
  if (!rawTs) return ''
  const d = new Date(rawTs)
  if (isNaN(d.getTime())) return String(rawTs)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${hours}:${minutes} · ${day}/${month}`
}

export default function NotificationItem({ item, onRead }) {
  const { db, a } = useApp()
  const isUnread = !item.readAt
  const myMem = myMember(db)
  const myId = myMem?.id || null

  const getIconAndColor = () => {
    switch (item.type) {
      case 'challenge_created':
      case 'challenge_accepted':
      case 'challenge_declined':
        return { icon: 'swords', color: '#00F5D4' }
      case 'challenge_cancelled':
      case 'session_cancelled':
        return { icon: 'x', color: '#EF4444' }
      case 'challenge_completed':
        return { icon: 'trophy', color: '#FFE24B' }
      case 'bounty_broken':
        return { icon: 'flame', color: '#FF2E7E' }
      case 'match_recorded':
      case 'match_edited':
        return { icon: 'activity', color: '#3B82F6' }
      case 'match_cancelled':
        return { icon: 'x', color: '#EF4444' }
      case 'claim_submitted':
        return { icon: 'banknote', color: '#F59E0B' }
      case 'claim_approved':
        return { icon: 'check', color: '#10B981' }
      case 'claim_rejected':
        return { icon: 'x', color: '#EF4444' }
      case 'refund_session':
      case 'refund_bulk':
        return { icon: 'banknote', color: '#10B981' }
      case 'join_approved':
      case 'join_rejected':
        return { icon: 'user', color: '#8B5CF6' }
      case 'member_change_requested':
        return { icon: 'user', color: '#F59E0B' }
      case 'member_change_approved':
        return { icon: 'check', color: '#10B981' }
      case 'member_change_rejected':
        return { icon: 'x', color: '#EF4444' }
      case 'session_rsvp_invite':
        return { icon: 'calendar', color: '#3B82F6' }
      case 'attendance_reported':
        return { icon: 'clipboard-check', color: '#10B981' }
      default:
        return { icon: 'bell', color: 'var(--teal-400)' }
    }
  }

  const { icon, color } = getIconAndColor()
  const payload = resolveNotificationPayload(item, db)
  const notifKey = item.type === 'attendance_reported' && payload.status
    ? `notification.attendance_reported_${payload.status}`
    : item.type === 'challenge_created' && !payload.creator
      ? 'notification.challenge_created_simple'
      : `notification.${item.type}`
  const content = t(notifKey, payload)

  // Kiểm tra trạng thái điểm danh hiện tại của mình nếu là session_rsvp_invite
  const isRsvpInvite = item.type === 'session_rsvp_invite'
  const currentAtt = isRsvpInvite && item.refId && myId ? db.attendance?.[item.refId]?.[myId] : undefined
  const hasResponded = currentAtt !== undefined

  return (
    <div
      onClick={() => onRead && onRead(item)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        backgroundColor: isUnread ? 'var(--surface-accent-soft, rgba(0, 178, 169, 0.06))' : 'transparent',
        borderBottom: '1px solid var(--border-subtle)',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: 'var(--surface-sunken)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={18} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.4,
            fontWeight: isUnread ? 600 : 400,
            color: 'var(--text-primary)',
            wordBreak: 'break-word',
          }}
        >
          {content}
        </div>

        {/* Nút bấm tương tác nhanh 1 chạm cho session_rsvp_invite */}
        {isRsvpInvite && item.refId && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              marginBottom: 4,
            }}
          >
            {!hasResponded ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    a.memberSelfCheckin(item.refId, 'present')
                    if (isUnread && onRead) onRead(item)
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: 'var(--surface-accent-soft, rgba(0, 178, 169, 0.12))',
                    color: 'var(--text-accent, #00786F)',
                    border: '1px solid var(--teal-400, rgba(0, 178, 169, 0.4))',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon name="check" size={13} />
                  {t('notification.rsvpPresent')}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    a.memberSelfCheckin(item.refId, 'absent')
                    if (isUnread && onRead) onRead(item)
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: 'var(--surface-sunken)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-default)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon name="x" size={13} />
                  {t('notification.rsvpAbsent')}
                </button>
              </>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  color: currentAtt === true ? 'var(--text-accent, #00786F)' : currentAtt === false ? 'var(--text-danger, #C42B1C)' : 'var(--text-accent, #00786F)',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                  backgroundColor: currentAtt === true ? 'var(--surface-accent-soft, rgba(0, 178, 169, 0.1))' : currentAtt === false ? 'var(--surface-danger-soft, rgba(239, 68, 68, 0.1))' : 'var(--surface-accent-soft, rgba(0, 178, 169, 0.1))',
                  border: `1px solid ${currentAtt === true ? 'rgba(0, 178, 169, 0.3)' : currentAtt === false ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 178, 169, 0.3)'}`,
                }}
              >
                <Icon name={currentAtt === true ? 'check' : 'x'} size={13} />
                {t('notification.rsvpDone', {
                  status: currentAtt === true ? t('attend.present') : currentAtt === false ? t('attend.absent') : t('attend.extra'),
                })}
              </span>
            )}
          </div>
        )}

        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginTop: 4,
          }}
        >
          {formatTime(item.createdAt)}
        </div>
      </div>

      {isUnread && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: 'var(--text-accent, #00B2A9)',
            marginTop: 6,
            flexShrink: 0,
          }}
        />
      )}
    </div>
  )
}
