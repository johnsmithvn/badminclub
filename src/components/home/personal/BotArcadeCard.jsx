// Sòng của Bot — ván cược tay đôi, ăn thua bằng ĐIỂM MÙA.
//
// Không có đồng tiền riêng: thắng thua chuyển thẳng SP giữa bạn và bot, `season.js` cộng trừ khi
// dựng lại bảng. Mức cược do `getBotArcadeOffer` quyết, KHÔNG do màn hình này chọn — xem
// `appActions: A.playArcade`.
//
// Kết quả do server quyết. Màn hình chỉ hiển thị thứ RPC trả về.

import React, { useState } from 'react'
import { Button, Icon } from '#ds'
import { t } from '#i18n'
import { getArcadeResultLine } from '#lib/bot.js'

export default function BotArcadeCard({ bot, offer, balance, onPlay }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  if (!bot || !offer) return null

  const handlePlay = async (choice) => {
    if (busy) return
    setBusy(true)
    try {
      const round = await onPlay(choice)
      // RPC trả về nước của BOT (thứ client không biết trước); nước của mình thì ghép lại ở đây
      // thay vì bắt server gửi ngược một thứ vừa nhận.
      if (round) setResult({ ...round, choice })
    } finally {
      setBusy(false)
    }
  }

  const resultLine = result ? getArcadeResultLine(result) : null

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <span style={S.avatarFallback}>
          <Icon name="sparkles" size={14} style={{ color: 'var(--action-violet-fg)' }} />
        </span>
        <span style={S.title}>{t('arcade.title')}</span>
        <span style={S.balance}>{t('arcade.balance', { n: balance })}</span>
      </div>

      {/* Hết lượt hôm nay hoặc một trong hai bên hết điểm: chỉ còn câu nói, không có nút. */}
      {offer.blocked ? (
        <div style={S.line}>“{t(offer.lineKey, offer.params)}”</div>
      ) : result ? (
        <>
          <div style={S.line}>“{t(resultLine.lineKey, resultLine.params)}”</div>
          <div style={S.meta}>
            {t('arcade.youChose', {
              a: t('arcade.choice.' + result.choice),
              b: t('arcade.choice.' + result.oppChoice),
            })}
          </div>
          <Button variant="secondary" onClick={() => setResult(null)}>
            {t('arcade.again')}
          </Button>
        </>
      ) : (
        <>
          <div style={S.line}>“{t(offer.lineKey, offer.params)}”</div>
          <div style={S.meta}>
            {t('arcade.game.' + offer.game)} · {t('arcade.stake', { n: offer.stake })}
          </div>
          <div style={S.choiceRow}>
            {offer.choices.map((choice) => (
              <Button
                key={choice}
                variant="secondary"
                disabled={busy}
                onClick={() => handlePlay(choice)}
              >
                {t('arcade.choice.' + choice)}
              </Button>
            ))}
          </div>
        </>
      )}
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
  },
  balance: {
    font: '500 12px/1 var(--font-sans)',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
  },
  line: {
    font: '400 14px/1.55 var(--font-sans)',
    fontStyle: 'italic',
    color: 'var(--text-primary)',
  },
  meta: {
    font: '500 12px/1.4 var(--font-sans)',
    color: 'var(--text-secondary)',
  },
  choiceRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
}
