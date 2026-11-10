// Bảng xếp hạng mini-game (tab trong sảnh). Server cộng dồn sẵn (0091 game_board), xếp ở registry.boardOf.
// Tách hẳn khỏi BXH cầu lông: không Elo, không điểm mùa.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Avatar, Card, Select, Skeleton } from '#ds'
import { Empty } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { gameErr } from '#contexts/gameActions.js'
import RankMedalIcon from '#components/leaderboard/RankMedalIcon.jsx'
import cfg from '#config/app.js'
import { COIN_START, GAME_IDS, boardOf } from '#lib/games/registry.js'
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

  return (
    <section style={S.col}>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'repeat(2, minmax(0, 240px))' }}>
        <Select
          label={t('games.board.game')}
          value={game}
          onChange={(e) => setGame(e.target.value)}
          options={[{ value: '', label: t('games.board.allGames') }, ...GAME_IDS.map((id) => ({ value: id, label: t('games.' + id + '.name') }))]}
        />
        <Select
          label={t('games.board.period')}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          options={PERIODS.map((p) => ({ value: p, label: t('games.board.' + p) }))}
        />
      </div>
      <span style={S.caption}>{t(board.byPoints ? 'games.board.hintPoints' : 'games.board.hintWins')}</span>

      {err && <Alert tone="danger">{err}</Alert>}
      {loading && <Skeleton height={180} />}
      {!loading && board.rows.length === 0 && (
        <div style={S.box}><Empty icon="trophy" title={t('games.board.emptyTitle')} hint={t('games.board.emptyHint')} /></div>
      )}
      {!loading && board.rows.length > 0 && (
        <div style={{ ...S.box, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {board.rows.map((r, i) => {
            const m = byId.get(r.memberId)
            const name = m?.name || t('games.unknownPlayer')
            const isMe = r.memberId === me
            return (
              <div
                key={r.memberId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, padding: '10px 14px 10px 10px',
                  borderTop: i ? '1px solid var(--border-subtle)' : 'none',
                  background: isMe ? 'var(--surface-inset)' : 'transparent',
                }}
              >
                <div style={{ width: 30, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                  {r.rank <= 3 ? <RankMedalIcon rank={r.rank} size={26} /> : <span style={S.rank}>{r.rank}</span>}
                </div>
                <Avatar name={name} src={m?.avatarUrl} size={32} />
                <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                  <span style={{ ...S.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
                    {name}{isMe ? ' · ' + t('games.board.you') : ''}
                  </span>
                  <span style={S.mono}>{t('games.board.line', { n: r.played, w: r.won, d: r.drawn, l: r.lost, rate: r.rate })}</span>
                </div>
                <div style={{ flexShrink: 0, display: 'grid', justifyItems: 'end', gap: 2 }}>
                  <span style={{ ...S.big, color: board.byPoints ? signColor(r.points) : 'var(--text-primary)' }}>
                    {board.byPoints ? signed(r.points) : r.won}
                  </span>
                  <span style={S.unit}>{t(board.byPoints ? 'games.board.points' : 'games.board.wins')}</span>
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
      <span style={S.caption}>{t('games.coins.boardHint', { n: COIN_START.toLocaleString('vi-VN') })}</span>
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
}
