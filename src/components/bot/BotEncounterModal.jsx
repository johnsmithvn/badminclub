// src/components/bot/BotEncounterModal.jsx
// Modal tương tác cá nhân 1-1 với Bot (Personal Bot Encounter).
// Thiết kế cao cấp, mang lại cảm giác NPC đang chủ động tiến tới nói chuyện riêng với bạn.

import React from 'react'
import { Dialog, Button, Icon } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'

export default function BotEncounterModal({
  open = false,
  encounter = null,
  bot = null,
  onClose,
  onAction,
}) {
  const isMobile = useMobile()

  if (!open || !encounter?.scenario) return null

  const { scenario } = encounter
  const botName = bot?.name || 'Bot'
  const tone = scenario.tone || 'teasing'
  const action = scenario.action || null

  // Icon tương ứng cho nút hành động ngữ cảnh
  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'rank': return 'trophy'
      case 'challenge_rival': return 'swords'
      case 'arcade': return 'sparkles'
      case 'matches': return 'plus'
      default: return 'arrow-right'
    }
  }

  // Tông màu badge trạng thái cảm xúc của Bot
  const getToneStyle = (tName) => {
    switch (tName) {
      case 'supportive':
        return { bg: 'rgba(59, 130, 246, 0.12)', fg: '#3B82F6', icon: 'heart' }
      case 'competitive':
        return { bg: 'rgba(239, 68, 68, 0.12)', fg: '#EF4444', icon: 'flame' }
      case 'friendly':
        return { bg: 'rgba(16, 185, 129, 0.12)', fg: '#10B981', icon: 'smile' }
      case 'teasing':
      default:
        return { bg: 'rgba(168, 85, 247, 0.12)', fg: '#A855F7', icon: 'zap' }
    }
  }

  const toneStyle = getToneStyle(tone)

  return (
    <Dialog
      open={open}
      sheet={isMobile}
      title={t('bot.encounter.modalTitle', { bot: botName })}
      onClose={onClose}
      footer={
        <div style={S.footerRow}>
          <Button variant="secondary" onClick={onClose}>
            {t('bot.encounter.actionUnderstand')}
          </Button>
          {action && action.type !== 'dismiss' && (
            <Button
              variant="primary"
              icon={getActionIcon(action.type)}
              onClick={() => onAction && onAction(action, scenario)}
            >
              {t(action.labelKey)}
            </Button>
          )}
        </div>
      }
    >
      <div style={S.container}>
        {/* Khối danh tính Bot & Cảm xúc */}
        <div style={S.botProfileRow}>
          <div style={S.avatarWrapper}>
            {bot?.avatarUrl ? (
              <img src={bot.avatarUrl} alt="" style={S.avatar} />
            ) : (
              <span style={S.avatarFallback}>
                <Icon name="sparkles" size={24} style={{ color: '#A855F7' }} />
              </span>
            )}
            <span style={S.onlineDot} />
          </div>

          <div style={S.botMeta}>
            <div style={S.nameRow}>
              <span style={S.botNameText}>{botName}</span>
              <span style={{
                ...S.toneBadge,
                background: toneStyle.bg,
                color: toneStyle.fg,
              }}>
                <Icon name={toneStyle.icon} size={11} />
                <span>{t(`bot.tones.${tone}`)}</span>
              </span>
            </div>
            <div style={S.subPromptText}>{t('bot.encounter.modalSubtitle')}</div>
          </div>
        </div>

        {/* Bong bóng thoại NPC (Speech Bubble) */}
        <div style={S.speechBubble}>
          <div style={S.bubblePointer} />
          <div style={S.quoteIcon}>
            <Icon name="quote" size={18} style={{ opacity: 0.35, color: '#A855F7' }} />
          </div>
          <div style={S.dialogueText}>
            “{t(scenario.lineKey, scenario.params || {})}”
          </div>
        </div>
      </div>
    </Dialog>
  )
}

const S = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '8px 2px',
  },
  botProfileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrapper: {
    position: 'relative',
    width: 46,
    height: 46,
    flexShrink: 0,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
    boxShadow: '0 0 0 2px rgba(168, 85, 247, 0.4)',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: 'rgba(168, 85, 247, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 0 2px rgba(168, 85, 247, 0.4)',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: '50%',
    background: '#10B981',
    border: '2px solid var(--surface-card)',
  },
  botMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
    flex: 1,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  botNameText: {
    font: '600 15px/1.2 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  toneBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 7px',
    borderRadius: 99,
    font: '600 10.5px/1 var(--font-sans)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  subPromptText: {
    font: '400 12px/1.3 var(--font-sans)',
    color: 'var(--text-muted)',
  },
  speechBubble: {
    position: 'relative',
    marginTop: 6,
    padding: '16px 18px',
    borderRadius: 14,
    background: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-xs)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  bubblePointer: {
    position: 'absolute',
    top: -6,
    left: 20,
    width: 10,
    height: 10,
    background: 'var(--surface-sunken)',
    borderTop: '1px solid var(--border-subtle)',
    borderLeft: '1px solid var(--border-subtle)',
    transform: 'rotate(45deg)',
  },
  quoteIcon: {
    marginBottom: -4,
  },
  dialogueText: {
    font: '400 15.5px/1.65 var(--font-sans)',
    fontStyle: 'italic',
    color: 'var(--text-primary)',
    wordBreak: 'break-word',
  },
  footerRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
}
