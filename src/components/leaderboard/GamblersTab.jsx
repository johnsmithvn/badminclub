import { useMemo, useState } from 'react'
import { Avatar } from '#ds'
import { TabBar, Mono, Empty } from '#ui'
import { gamblerBoard } from '#lib/challenge.js'
import { shortName } from '#lib/money.js'
import cfg from '#config/app.json'
import { t } from '#i18n'

// [key, chỉ số lớn bên phải]. Thứ tự tab = thứ tự ở đây.
const BOARDS = [
  ['net', (r) => (r.net > 0 ? `+${r.net}` : String(r.net))],
  ['accuracy', (r) => `${r.winRate}%`],
  ['staked', (r) => String(r.staked)],
  ['tickets', (r) => String(r.tickets)],
  ['donor', (r) => String(r.net)],
]

/** BXH "Sòng bạc" — ai cược nhiều, trúng nhiều, lãi nhiều, thua nhiều trong mùa. */
export default function GamblersTab({ seasonRes, isMobile }) {
  const [by, setBy] = useState('net')
  const minTickets = cfg.challenge?.gamblerMinTickets ?? 5
  const rows = useMemo(() => gamblerBoard(seasonRes, by, minTickets), [seasonRes, by, minTickets])
  const metricOf = BOARDS.find(([k]) => k === by)[1]

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <TabBar
        isMobile={isMobile}
        value={by}
        onChange={setBy}
        items={BOARDS.map(([key]) => ({ key, label: t(`gamblers.${key}`), tone: 'violet' }))}
      />
      <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
        {t(`gamblers.${by}Hint`, { n: minTickets })}
      </div>

      {rows.length === 0 ? (
        <Empty icon="hand-coins" title={t(`gamblers.${by}Empty`, { n: minTickets })} hint={t('gamblers.emptyHint')} />
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {rows.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Mono weight={700} size={13} style={{ width: 24, textAlign: 'right', color: i < 3 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {i + 1}
              </Mono>
              <Avatar name={r.name} src={r.avatarUrl} size={34} />
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 3 }}>
                <div style={{ font: 'var(--type-label)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isMobile ? shortName(r.name) : r.name}
                </div>
                <Mono size={11.5} style={{ color: 'var(--text-muted)' }}>
                  {t('gamblers.rowMeta', { tickets: r.tickets, wins: r.wins, losses: r.losses, staked: r.staked })}
                </Mono>
              </div>
              <Mono
                weight={700}
                size={18}
                style={{
                  color: by === 'donor' || (by === 'net' && r.net < 0)
                    ? 'var(--status-incident-fg)'
                    : by === 'net' && r.net > 0
                      ? 'var(--status-delivered-fg)'
                      : 'var(--text-primary)',
                }}
              >
                {metricOf(r)}
              </Mono>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
