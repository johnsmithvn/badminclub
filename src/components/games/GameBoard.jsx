// Bảng xếp hạng mini-game (tab trong sảnh). Server cộng dồn sẵn (0091 game_board), xếp ở registry.boardOf.
// Tách hẳn khỏi BXH cầu lông: không Elo, không điểm mùa.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Avatar, Card, Skeleton } from '#ds'
import { Empty } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { gameErr } from '#contexts/gameActions.js'
import RankMedalIcon from '#components/leaderboard/RankMedalIcon.jsx'
import { GameArt } from '#components/games/GameInfo.jsx'
import cfg from '#config/app.js'
import { COIN_RELIEF, COIN_START, GAME_IDS, boardOf } from '#lib/games/registry.js'
import { pathOf } from '#routes'
import { addMonth, ddmy, isoOf, monthOf, todayISO } from '#utils/dates.js'
import { t } from '#i18n'

const PERIODS = ['this', 'last', 'all']

export default function GameBoard({ me, isMobile }) {
  const { db, a } = useApp()
  const [period, setPeriod] = useState('this')
  const [game, setGame] = useState('')
  const [data, setData] = useState(null) // { month, rows } của lần nạp gần nhất
  const [err, setErr] = useState('')

  const thisMonth = monthOf(todayISO())
  const month = period === 'all' ? null : period === 'last' ? addMonth(thisMonth, -1) : thisMonth

  useEffect(() => {
    let live = true
    a.gameBoard(month)
      .then((rows) => { if (live) { setData({ month, rows }); setErr('') } })
      .catch((e) => { if (live) { setErr(gameErr(e)); setData({ month, rows: [] }) } })
    return () => { live = false }
  }, [a, month, db.clubId])

  const loading = !data || data.month !== month
  const board = useMemo(() => boardOf(data?.rows, game || null), [data, game])
  const byId = useMemo(() => new Map(db.members.map((m) => [m.id, m])), [db.members])
  // Vua từng game: người đứng đầu bảng riêng của mỗi game có ván trong khoảng đang xem.
  const kings = useMemo(() => GAME_IDS.map((id) => ({ id, ...boardOf(data?.rows, id) }))
    .filter((b) => b.rows.length > 0).map((b) => ({ id: b.id, byPoints: b.byPoints, top: b.rows[0] })), [data])
  const nameOf = (id) => byId.get(id)?.name || t('games.unknownPlayer')
  const value = (r) => (board.byPoints ? signed(r.points) : r.won)
  const unit = t(board.byPoints ? 'games.board.points' : 'games.board.wins')

  // Vị trí của tôi + khoảng cách tới người ngay trên (hạng nhỏ hơn gần nhất).
  const mine = board.rows.find((r) => r.memberId === me) || null
  const above = mine ? [...board.rows].reverse().find((r) => r.rank < mine.rank) || null : null
  const chase = mine && above
    ? (board.byPoints ? above.points - mine.points : above.won - mine.won) + 1
    : 0
  const pct = mine && above
    ? Math.max(4, Math.min(100, Math.round(100 * (board.byPoints ? Math.max(0, mine.points) / Math.max(1, above.points) : mine.won / Math.max(1, above.won)))))
    : 100

  const podium = board.rows.slice(0, 3)
  const rest = board.rows.slice(3)
  const COLS = '48px minmax(0, 1.6fr) 110px minmax(0, 1.2fr) 80px'

  return (
    <section style={S.col}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', minWidth: 0, flex: '1 1 0', paddingBottom: 2 }}>
          {['', ...GAME_IDS].map((id) => (
            <button key={id || 'all'} type="button" onClick={() => setGame(id)} style={chip(game === id)}>
              {id ? t('games.' + id + '.name') : t('games.board.allGames')}
            </button>
          ))}
        </div>
        <div style={S.seg} role="group" aria-label={t('games.board.period')}>
          {PERIODS.map((p) => (
            <button key={p} type="button" onClick={() => setPeriod(p)} style={segBtn(period === p)}>{t('games.board.' + p)}</button>
          ))}
        </div>
      </div>
      <span style={S.caption}>{t(board.byPoints ? 'games.board.hintPoints' : 'games.board.hintWins')}</span>

      {err && <Alert tone="danger">{err}</Alert>}
      {loading && <Skeleton height={180} />}
      {!loading && board.rows.length === 0 && (
        <div style={S.box}><Empty icon="trophy" title={t('games.board.emptyTitle')} hint={t('games.board.emptyHint')} /></div>
      )}
      {!loading && board.rows.length > 0 && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 300px', alignItems: 'start' }}>
          <div style={S.col}>
            {/* Bục: hạng 2 · 1 · 3 */}
            <div style={{ display: 'grid', gap: isMobile ? 8 : 14, alignItems: 'end', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr) minmax(0, 1fr)' }}>
              {[podium[1], podium[0], podium[2]].map((r, k) => {
                if (!r) return <div key={'empty' + k} />
                const first = k === 1
                const name = nameOf(r.memberId)
                const m = byId.get(r.memberId)
                return (
                  <div key={r.memberId} style={{
                    ...S.box, padding: isMobile ? '12px 8px' : '18px 14px', display: 'grid', justifyItems: 'center', gap: 8,
                    gridTemplateColumns: 'minmax(0, 1fr)', minHeight: isMobile ? (first ? 180 : 156) : (first ? 236 : 204),
                    background: first ? 'var(--status-delayed-bg)' : 'var(--surface-card)', borderColor: first ? 'var(--status-delayed-fg)' : 'var(--border-subtle)',
                    outline: r.memberId === me ? '2px solid var(--border-focus-color)' : 'none',
                  }}>
                    <RankMedalIcon rank={r.rank} size={first ? 30 : 24} />
                    <Avatar name={name} src={m?.avatarUrl} size={isMobile ? (first ? 48 : 40) : (first ? 68 : 54)} />
                    <span style={{ ...S.label, fontWeight: 700, fontSize: isMobile ? 13 : 16, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</span>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <span><b style={{ ...S.big, color: board.byPoints ? signColor(r.points) : 'var(--text-primary)' }}>{value(r)}</b> <span style={S.unit}>{unit}</span></span>
                      {!isMobile && <span style={S.mono}>{r.rate}%</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            {rest.length > 0 && (
              <div style={{ ...S.box, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
                {!isMobile && (
                  <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={S.over}>{t('games.board.colRank')}</span>
                    <span style={S.over}>{t('games.board.colPlayer')}</span>
                    <span style={S.over}>{t('games.board.colRecord')}</span>
                    <span style={S.over}>{t('games.board.colRate')}</span>
                    <span style={{ ...S.over, textAlign: 'right' }}>{t(board.byPoints ? 'games.board.colPoints' : 'games.board.colWins')}</span>
                  </div>
                )}
                {rest.map((r, i) => {
                  const m = byId.get(r.memberId)
                  const name = nameOf(r.memberId)
                  const isMe = r.memberId === me
                  const rowBg = { background: isMe ? 'var(--surface-accent-soft)' : 'transparent', boxShadow: isMe ? 'inset 3px 0 0 var(--border-focus-color)' : 'none' }
                  const who = (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <Avatar name={name} src={m?.avatarUrl} size={28} />
                      <div style={{ display: 'grid', gap: 3, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                        <span style={{ ...S.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
                          {name}{isMe ? ' · ' + t('games.board.you') : ''}
                        </span>
                        {isMobile && <span style={S.mono}>{t('games.board.line', { n: r.played, w: r.won, d: r.drawn, l: r.lost, rate: r.rate })}</span>}
                      </div>
                    </div>
                  )
                  if (isMobile) {
                    return (
                      <div key={r.memberId} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, padding: '10px 14px 10px 10px', borderTop: i ? '1px solid var(--border-subtle)' : 'none', ...rowBg }}>
                        <span style={{ ...S.rank, width: 30, flexShrink: 0, textAlign: 'center' }}>{r.rank}</span>
                        {who}
                        <div style={{ flexShrink: 0, display: 'grid', justifyItems: 'end', gap: 2 }}>
                          <span style={{ ...S.big, color: board.byPoints ? signColor(r.points) : 'var(--text-primary)' }}>{value(r)}</span>
                          <span style={S.unit}>{unit}</span>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={r.memberId} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: i ? '1px solid var(--border-subtle)' : 'none', ...rowBg }}>
                      <span style={S.rank}>#{r.rank}</span>
                      {who}
                      <span style={{ font: '500 13px/1 var(--font-mono)' }}>
                        <span style={{ color: 'var(--status-delivered-fg)' }}>{r.won}</span> · <span style={{ color: 'var(--text-muted)' }}>{r.drawn}</span> · <span style={{ color: 'var(--status-incident-fg)' }}>{r.lost}</span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={S.track}><div style={{ ...S.fill, width: r.rate + '%' }} /></div>
                        <span style={{ ...S.mono, width: 36, textAlign: 'right', flexShrink: 0 }}>{r.rate}%</span>
                      </div>
                      <span style={{ ...S.big, fontSize: 15, textAlign: 'right', color: board.byPoints ? signColor(r.points) : 'var(--text-primary)' }}>{value(r)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={S.col}>
            {me && (
              <div style={{ ...S.box, padding: 16, display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)', background: 'var(--status-delayed-bg)', borderColor: 'var(--status-delayed-fg)' }}>
                <span style={{ ...S.over, color: 'var(--status-delayed-fg)' }}>{t('games.board.myPos')}</span>
                {mine
                  ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ font: '800 36px/1 var(--font-display)', color: 'var(--text-primary)' }}>#{mine.rank}</span>
                        <span style={S.mono}>{t('games.board.line', { n: mine.played, w: mine.won, d: mine.drawn, l: mine.lost, rate: mine.rate })}</span>
                      </div>
                      <span style={{ font: 'var(--type-body)', color: 'var(--text-primary)' }}>
                        {above
                          ? t(board.byPoints ? 'games.board.chasePoints' : 'games.board.chaseWins', { n: chase, name: nameOf(above.memberId), rank: above.rank })
                          : t('games.board.lead')}
                      </span>
                      <div style={S.track}><div style={{ ...S.fill, width: pct + '%', background: 'var(--status-delayed-fg)' }} /></div>
                    </>
                  )
                  : <span style={S.caption}>{t('games.board.notRanked')}</span>}
              </div>
            )}
            {!game && kings.length > 0 && (
              <div style={{ ...S.box, padding: '14px 16px', display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <span style={{ ...S.over, marginBottom: 6 }}>{t('games.board.kings')}</span>
                {kings.map((k) => {
                  const name = nameOf(k.top.memberId)
                  return (
                    <button key={k.id} type="button" onClick={() => setGame(k.id)} style={S.king}>
                      <div style={{ width: 28, flexShrink: 0 }}><GameArt id={k.id} height={28} radius={7} /></div>
                      <span style={{ ...S.caption, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{t('games.' + k.id + '.name')}</span>
                      <span style={{ ...S.label, minWidth: 0, maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</span>
                      <span style={{ font: '600 12px/1 var(--font-mono)', color: 'var(--status-transit-fg)', flexShrink: 0, minWidth: 36, textAlign: 'right' }}>
                        {k.byPoints ? signed(k.top.points) : t('games.lobby.wins', { n: k.top.won })}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

const chip = (on) => ({
  padding: '6px 12px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, font: '600 12.5px/1 var(--font-sans)',
  background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)', color: on ? 'var(--status-transit-fg)' : 'var(--text-secondary)',
  border: '1px solid ' + (on ? 'var(--border-focus-color)' : 'var(--border-subtle)'),
})
const segBtn = (on) => ({
  padding: '6px 12px', borderRadius: 7, border: 0, cursor: 'pointer', whiteSpace: 'nowrap', font: '600 12.5px/1 var(--font-sans)',
  background: on ? 'var(--surface-accent-soft)' : 'transparent', color: on ? 'var(--status-transit-fg)' : 'var(--text-muted)',
})

/**
 * Ví xu (0093): ai đang giàu nhất. `wallets` = dòng game_wallets — chỉ người đã chơi phòng có cược; null = đang nạp.
 * Cùng số xu thì cùng hạng.
 */
export function CoinBoard({ me, wallets }) {
  const { db } = useApp()
  const byId = useMemo(() => new Map(db.members.map((m) => [m.id, m])), [db.members])
  const rows = useMemo(() => {
    const list = (wallets || []).filter((w) => w.played > 0).sort((x, y) => y.balance - x.balance || String(x.memberId).localeCompare(String(y.memberId)))
    // Danh sách đã xếp: hạng = vị trí người đầu tiên có cùng số xu.
    return list.map((w) => ({ ...w, rank: list.findIndex((x) => x.balance === w.balance) + 1 }))
  }, [wallets])

  return (
    <section style={S.col}>
      <span style={S.caption}>{t('games.coins.boardHint', { n: COIN_START.toLocaleString('vi-VN'), relief: COIN_RELIEF })}</span>
      {!wallets && <Skeleton height={180} />}
      {wallets && rows.length === 0 && (
        <div style={S.box}><Empty icon="wallet" title={t('games.coins.emptyTitle')} hint={t('games.coins.emptyHint')} /></div>
      )}
      {rows.length > 0 && (
        <div style={{ ...S.box, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {rows.map((r, i) => {
            const m = byId.get(r.memberId)
            const name = m?.name || t('games.unknownPlayer')
            const isMe = r.memberId === me
            const net = r.balance - COIN_START
            return (
              <div key={r.memberId} style={{
                display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, padding: '10px 14px 10px 10px',
                borderTop: i ? '1px solid var(--border-subtle)' : 'none', background: isMe ? 'var(--surface-inset)' : 'transparent',
              }}>
                <div style={{ width: 30, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                  {r.rank <= 3 ? <RankMedalIcon rank={r.rank} size={26} /> : <span style={S.rank}>{r.rank}</span>}
                </div>
                <Avatar name={name} src={m?.avatarUrl} size={32} />
                <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                  <span style={{ ...S.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
                    {name}{isMe ? ' · ' + t('games.board.you') : ''}
                  </span>
                  <span style={S.mono}>{t('games.coins.line', { n: r.played, w: r.won, l: r.lost, net: signed(net) })}</span>
                </div>
                <div style={{ flexShrink: 0, display: 'grid', justifyItems: 'end', gap: 2 }}>
                  <span style={{ ...S.big, color: r.balance < 0 ? 'var(--status-incident-fg)' : 'var(--text-primary)' }}>{r.balance.toLocaleString('vi-VN')}</span>
                  <span style={S.unit}>{t('games.coins.unit')}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/**
 * Thẻ "Xu trò chơi" ở Hồ sơ: ví của tôi + những dòng sổ gần nhất (0101 game_coin_tx: mở ví, mang vào bàn, nhận về,
 * trả lại, cứu trợ…), dòng có phòng thì bấm → mở lại phòng đó. Số dư từ game_my_wallet (mở ví + cứu trợ như sảnh);
 * số ván / thắng / thua từ game_wallets. Danh sách chỉ `cfg.games.coinHistory` dòng mới nhất.
 * Profile tải lười thẻ này (lazy) — import thẳng sẽ kéo cả registry game vào gói chung của app.
 */
export function MyCoinsCard({ memberId }) {
  const { db, a } = useApp()
  const navigate = useNavigate()
  const [data, setData] = useState(null) // { wallet, balance, rows }; null = đang nạp
  const [err, setErr] = useState('')

  useEffect(() => {
    let live = true
    Promise.all([a.gameMyWallet(), a.gameWallets(), a.gameMemberCoins(memberId, cfg.games.coinHistory)])
      .then(([balance, ws, rows]) => {
        if (live) { setData({ balance, wallet: ws.find((w) => w.memberId === memberId) || null, rows }); setErr('') }
      })
      .catch((e) => { if (live) { setErr(gameErr(e)); setData({ balance: null, wallet: null, rows: [] }) } })
    return () => { live = false }
  }, [a, memberId, db.clubId])

  const w = data?.wallet
  const balance = data?.balance ?? w?.balance ?? COIN_START
  return (
    <Card title={t('games.coins.profileTitle')} subtitle={t('games.coins.profileSub')} icon="wallet" padding="16px 18px">
      <div style={S.col}>
        {err && <Alert tone="danger">{err}</Alert>}
        {!data && <Skeleton height={120} />}
        {data && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ font: '700 28px/1 var(--font-mono)', color: balance < 0 ? 'var(--status-incident-fg)' : 'var(--text-primary)' }}>
                {balance.toLocaleString('vi-VN')}
              </span>
              <span style={S.unit}>{t('games.coins.unit')}</span>
            </div>
            <span style={S.mono}>
              {w && w.played > 0
                ? t('games.coins.line', { n: w.played, w: w.won, l: w.lost, net: signed(balance - COIN_START) })
                : t('games.coins.profileNone', { n: COIN_START.toLocaleString('vi-VN') })}
            </span>
            {data.rows.length > 0 && (
              <div style={{ ...S.box, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
                {data.rows.map((r, i) => {
                  const kind = t('games.coins.kind.' + r.kind)
                  const name = r.roomId ? (GAME_IDS.includes(r.game) ? t('games.' + r.game + '.name') : r.game || '—') + ' · ' + kind : kind
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={!r.roomId}
                      onClick={() => r.roomId && navigate(pathOf('gameRoom', r.roomId))}
                      title={r.roomId ? t('games.coins.openRoom') : undefined}
                      style={{
                        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', alignItems: 'center', gap: 10,
                        padding: '9px 12px', border: 0, borderTop: i ? '1px solid var(--border-subtle)' : 'none',
                        background: 'transparent', cursor: r.roomId ? 'pointer' : 'default', textAlign: 'left', minWidth: 0, color: 'inherit',
                      }}
                    >
                      <span style={{ ...S.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      <span style={S.mono}>{r.at ? ddmy(isoOf(new Date(r.at))) : ''}</span>
                      <span style={{ font: '600 13px/1 var(--font-mono)', color: signColor(r.delta), minWidth: 64, textAlign: 'right' }}>
                        {t('games.coins.delta', { n: signed(r.delta) })}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

const signed = (n) => (n > 0 ? '+' + n : String(n))
const signColor = (n) => (n > 0 ? 'var(--status-delivered-fg)' : n < 0 ? 'var(--status-incident-fg)' : 'var(--text-muted)')

const S = {
  col: { display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' },
  box: { borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)', minWidth: 0, overflow: 'hidden' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  rank: { font: '600 13px/1 var(--font-mono)', color: 'var(--text-muted)' },
  big: { font: '700 18px/1 var(--font-mono)' },
  unit: { font: '500 10.5px/1 var(--font-sans)', color: 'var(--text-muted)' },
  over: { font: '600 11px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-muted)' },
  seg: { display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', flexShrink: 0 },
  track: { flex: 1, height: 6, borderRadius: 3, background: 'var(--surface-sunken)', overflow: 'hidden', minWidth: 0 },
  fill: { height: '100%', borderRadius: 3, background: 'var(--status-transit-fg)' },
  king: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', minWidth: 0, border: 0, borderTop: '1px solid var(--border-subtle)',
    background: 'transparent', cursor: 'pointer', color: 'inherit',
  },
}
