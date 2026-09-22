// Thẻ "Bot nói riêng với bạn" ở màn hình cá nhân.
//
// Câu chữ được TÍNH LẠI mỗi lần mở app từ dữ liệu đã có (hạng, chuỗi thắng, biến động Elo) — không
// có dòng nào trong DB, không thông báo ai, và người khác không đọc được. Xem `lib/bot.js: getBotTaunt`.
//
// Component cố ý câm: nhận sẵn `taunt` đã tính, chỉ lo hiển thị.

import React from 'react'
import { Icon } from '#ds'
import { t } from '#i18n'

export default function BotTauntCard({ bot, taunt, isMobile = false }) {
  if (!bot || !taunt?.lineKey) return null

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        {bot.avatarUrl ? (
          <img src={bot.avatarUrl} alt="" style={S.avatar} />
        ) : (
          <span style={S.avatarFallback}>
            <Icon name="sparkles" size={14} style={{ color: 'var(--action-violet-fg)' }} />
          </span>
        )}
        <span style={S.title}>{bot.name || t('bot.cardTitle')}</span>
      </div>

      <div style={{ ...S.line, fontSize: isMobile ? 14 : 15 }}>
        “{t(taunt.lineKey, taunt.params)}”
      </div>
    </div>
  )
}

const S = {
  card: {
    padding: '14px 15px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },
  avatarFallback: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'var(--action-violet-bg)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    flex: 1,
    font: '600 11px/1 var(--font-sans)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  line: {
    font: '400 14px/1.55 var(--font-sans)',
    color: 'var(--text-primary)',
    fontStyle: 'italic',
  },
}
