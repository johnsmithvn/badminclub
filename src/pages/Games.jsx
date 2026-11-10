import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Checkbox, Dialog, Input, Select, Skeleton, Switch } from '#ds'
import { Empty, TabBar } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { gameErr } from '#contexts/gameActions.js'
import { useMobile } from '#hooks/useMobile.js'
import { useTourPoll } from '#hooks/useTourPoll.js'
import { GameArt, HowTo } from '#components/games/GameInfo.jsx'
import GameBoard, { CoinBoard } from '#components/games/GameBoard.jsx'
import { myMember } from '#lib/money.js'
import { BOARD_POINTS, BOT_GAMES, BOT_PREFIX, COIN_START, GAMES, GAME_IDS, NO_STAKE, STAKES, gameOf, isStaleRoom, seatedOf, stakeOf, statsOf } from '#lib/games/registry.js'
import { DICTS as NOITU_DICTS, REPEATS as NOITU_REPEATS, TIMES as NOITU_TIMES } from '#lib/games/noitu.js'
import { SIZES as COVAY_SIZES } from '#lib/games/covay.js'
import { DAY_TIMES as MASOI_TIMES, REVEALS as MASOI_REVEALS, ROLE_IDS as MASOI_ROLE_IDS, SPECIALS as MASOI_SPECIALS, GUARD, SEER, WITCH, WOLF, isWolf, lineupOf, minPlayersOf } from '#lib/games/masoi.js'
import { TIMES as BAIBIP_TIMES } from '#lib/games/baibip.js'
import { LEADS as TIENLEN_LEADS, VARIANTS as TIENLEN_VARIANTS } from '#lib/games/tienlen.js'
import { LAPS as BAUCUA_LAPS, TIMES as BAUCUA_TIMES } from '#lib/games/baucua.js'
import { TIMES as LOTO_TIMES } from '#lib/games/loto.js'
import { LAPS as XIDACH_LAPS, TIMES as XIDACH_TIMES } from '#lib/games/xidach.js'

// Game có đồng hồ / số vòng chọn lúc tạo phòng: chữ ở games.<id>.time · timeOpt · timeNone (0 = tắt) · laps · lapsOpt.
const TIME_OPTS = { baucua: BAUCUA_TIMES, loto: LOTO_TIMES, xidach: XIDACH_TIMES }
const LAP_OPTS = { baucua: BAUCUA_LAPS, xidach: XIDACH_LAPS }
import { pathOf } from '#routes'
import { t } from '#i18n'
import cfg from '#config/app.js'

/** Sảnh mini-game: chọn game tạo phòng, vào bằng mã, danh sách phòng đang mở. Nạp riêng — xem gameActions.js. */
export default function Games() {
  const { db, a } = useApp()
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const me = myMember(db)?.id || null
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(null) // id game đang mở form tạo phòng
  const [howto, setHowto] = useState(null) // id game đang mở luật chơi
  const [tab, setTab] = useState('play') // play | board | coins
  const [wallets, setWallets] = useState(null) // ví xu cả CLB (0093) — nạp lúc mở sảnh và khi mở tab Ví xu

  // Thống kê thắng thua (tới statsLimit ván) chỉ nạp lúc mở sảnh; nhịp hỏi lại chỉ lấy danh sách phòng.
  const refresh = useCallback((withStats = false) => a.gameLobby(withStats)
    .then((r) => { setData((d) => ({ ...r, finished: r.finished ?? d?.finished ?? [], now: Date.now() })); setErr('') })
    .catch((e) => { setErr(gameErr(e)); setData((d) => d || { rooms: [], finished: [], now: Date.now() }) }), [a])
  const poll = useCallback(() => refresh(false), [refresh])

  const loadWallets = useCallback(() => a.gameWallets().then(setWallets).catch(() => setWallets((w) => w || [])), [a])
  useEffect(() => { refresh(true); loadWallets() }, [refresh, loadWallets, db.clubId])
  const coins = wallets?.find((w) => w.memberId === me)?.balance ?? COIN_START
  // Đang xem BXH thì thôi hỏi lại danh sách phòng; quay lại tab Chơi thì hỏi ngay một lần.
  useTourPoll(tab === 'play', poll, cfg.games.lobbyPollMs)

  const open = (id) => navigate(pathOf('gameRoom', id))
  // Cờ tướng với máy cần trang tải mới (header cách ly cho engine — vercel.json), nên không chuyển trang kiểu SPA.
  const vsBot = (id) => (id === 'cotuong' ? window.location.assign(pathOf('gameRoom', BOT_PREFIX + id)) : open(BOT_PREFIX + id))
  const enter = async (room) => {
    const mine = seatedOf(room.players).some((p) => p.memberId === me)
    if (room.status === 'waiting' && !mine && me && (await a.gameJoin(room)) == null) return
    open(room.id)
  }
  const byCode = async () => {
    const id = await a.gameFind(code)
    if (id) open(id)
  }

  const stats = statsOf(data?.finished)
  const rooms = (data?.rooms || []).filter((r) => gameOf(r.game)
    && !isStaleRoom(r, data.now, cfg.games.staleHours)
    && (!r.private || seatedOf(r.players).some((p) => p.memberId === me)))

  return (
    <>
      <TabBar
        isMobile={isMobile}
        value={tab}
        onChange={(k) => { setTab(k); if (k === 'play') poll(); if (k === 'coins') loadWallets() }}
        items={[
          { key: 'play', label: t('games.board.tabPlay'), icon: 'gamepad-2', tone: 'accent' },
          { key: 'board', label: t('games.board.tabBoard'), icon: 'trophy', tone: 'accent' },
          { key: 'coins', label: t('games.coins.tab'), icon: 'wallet', tone: 'accent' },
        ]}
      />

      {tab === 'board' && <GameBoard me={me} isMobile={isMobile} />}
      {tab === 'coins' && <CoinBoard me={me} wallets={wallets} />}

      {tab === 'play' && (<>
        {err && <Alert tone="danger">{err}</Alert>}

        <section style={S.col}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={S.h}>{t('games.pick')}</span>
            {me && (
              <span style={{ ...S.pill, font: '600 12px/1 var(--font-mono)', background: 'var(--surface-inset)', color: coins < 0 ? 'var(--status-incident-fg)' : 'var(--text-primary)' }}>
                {t('games.coins.mine', { n: coins.toLocaleString('vi-VN') })}
              </span>
            )}
          </div>
          <div style={{ ...S.grid, gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {GAME_IDS.map((id) => {
              const g = GAMES[id]
              const s = stats[id]
              return (
                <div key={id} style={{ ...S.box, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <GameArt id={id} />
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={S.title}>{t('games.' + id + '.name')}</span>
                    <span style={S.caption}>{t('games.' + id + '.desc')}</span>
                    <span style={S.mono}>
                      {t('games.playersRange', { min: g.minPlayers, max: g.maxPlayers })}
                      {s ? ' · ' + t('games.record', s) : ''}
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 4 }}>
                      <Button icon="plus" disabled={!me} onClick={() => setCreating(id)}>{t('games.create')}</Button>
                      {BOT_GAMES.includes(id) && <Button variant="secondary" icon="bot" onClick={() => vsBot(id)}>{t('games.bot.play')}</Button>}
                      <Button variant="ghost" icon="book-open" onClick={() => setHowto(id)}>{t('games.howto')}</Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Input
            icon="hash"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) byCode() }}
            placeholder={t('games.codePh')}
            aria-label={t('games.codePh')}
            containerStyle={{ flex: isMobile ? '1 1 0' : '0 0 220px', minWidth: 0 }}
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '.12em' }}
          />
          <Button variant="secondary" disabled={code.trim().length < 6} onClick={byCode}>{t('games.joinByCode')}</Button>
        </div>

        <section style={S.col}>
          <span style={S.h}>{t('games.openRooms')}</span>
          {!data && <Skeleton height={120} />}
          {data && rooms.length === 0 && (
            <div style={S.box}><Empty icon="gamepad-2" title={t('games.emptyTitle')} hint={t('games.emptyHint')} /></div>
          )}
          {rooms.map((r) => <RoomRow key={r.id} room={r} me={me} members={db.members} onEnter={() => enter(r)} />)}
        </section>
      </>)}

      {creating && <CreateRoom gameId={creating} coins={coins} onClose={() => setCreating(null)} onDone={(id) => { setCreating(null); open(id) }} />}
      {howto && <HowTo gameId={howto} onClose={() => setHowto(null)} />}
    </>
  )
}

function RoomRow({ room, me, members, onEnter }) {
  const g = gameOf(room.game)
  const seated = seatedOf(room.players)
  const host = members.find((m) => m.id === room.hostId)
  const mine = seated.some((p) => p.memberId === me)
  const canJoin = room.status === 'waiting' && seated.length < g.maxPlayers
  const tone = room.status === 'waiting' ? 'scheduled' : 'transit'
  const stake = stakeOf(room.options)
  return (
    <div style={{ ...S.box, padding: '10px 14px 10px 10px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <div style={{ width: 64, flexShrink: 0 }}><GameArt id={room.game} height={44} radius={8} /></div>
      <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ ...S.label, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={host?.name}>
            {t('games.' + room.game + '.name')} · {host?.name || t('games.host')}
          </span>
          <span style={{ ...S.pill, background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}>{t('games.status.' + room.status)}</span>
          {stake > 0 && <span style={{ ...S.pill, background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)' }}>{t('games.coins.stakePill', { n: stake })}</span>}
        </div>
        <span style={S.mono}>{room.code} · {t('games.seats', { n: seated.length, max: g.maxPlayers })}</span>
      </div>
      <Button size="sm" variant={canJoin || mine ? 'primary' : 'secondary'} onClick={onEnter}>
        {canJoin || mine ? t('games.enter') : t('games.watch')}
      </Button>
    </div>
  )
}

/** Bộ vai mặc định khi chủ phòng bật Tự chọn Ma sói — chỉ là điểm xuất phát để sửa. */
const MASOI_CUSTOM = [WOLF, WOLF, SEER, GUARD, WITCH]

/**
 * Form tạo phòng. Tuỳ chọn riêng từng game nằm ở đây — Caro, Chấm ô (cỡ bàn), Nối từ (ngôn ngữ, giờ),
 * Ma sói (lộ vai, bộ vai Tự động / Tự chọn — `options.roles`, lib/games/masoi.js deckOf).
 */
function CreateRoom({ gameId, coins, onClose, onDone }) {
  const { a } = useApp()
  const isMobile = useMobile(768)
  const g = gameOf(gameId)
  const [opts, setOpts] = useState(g.defaultOptions)
  const [priv, setPriv] = useState(false)
  const [busy, setBusy] = useState(false)

  // Ma sói tự chọn: số Sói thường + các vai đặc biệt đang bật. Không có Sói nào thì chưa cho tạo phòng.
  const roles = gameId === 'masoi' ? opts.roles || null : null
  const wolves = roles ? roles.filter((r) => r === WOLF).length : 0
  const specials = roles ? roles.filter((r) => r !== WOLF) : []
  const setRoles = (w, sp) => setOpts({ ...opts, roles: [...Array(w).fill(WOLF), ...sp].sort((x, y) => x - y) })
  const noWolf = !!roles && !roles.some(isWolf)
  // Xu ảo (0093): game kết quả do máy khách báo thì không cược; ví ít hơn mức cược thì server cũng chặn.
  const stake = stakeOf(opts)
  const broke = stake > coins

  const submit = async () => {
    setBusy(true)
    const id = await a.gameCreate(gameId, opts, priv)
    setBusy(false)
    if (id) onDone(id)
  }

  return (
    <Dialog
      open
      sheet={isMobile}
      title={t('games.createTitle', { game: t('games.' + gameId + '.name') })}
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} disabled={busy || noWolf || broke}>{t('games.create')}</Button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {gameId === 'caro' && (
          <>
            <Select
              label={t('games.caro.size')}
              value={String(opts.size)}
              // Bàn 3 × 3 là X-O cổ điển: 3 quân thắng, không có luật chặn hai đầu. Bàn lớn: 5 quân.
              onChange={(e) => {
                const size = Number(e.target.value)
                setOpts({ ...opts, size, win: size === 3 ? 3 : 5, blockedEnds: size === 3 ? false : !!opts.blockedEnds })
              }}
              options={cfg.games.caroSizes.map((n) => ({
                value: String(n), label: t(n === 3 ? 'games.caro.sizeOptClassic' : 'games.caro.sizeOpt', { n }),
              }))}
            />
            {opts.size !== 3 && (
              <Switch
                label={t('games.caro.blockedEnds')}
                description={t('games.caro.blockedEndsHint')}
                checked={!!opts.blockedEnds}
                onChange={(e) => setOpts({ ...opts, blockedEnds: e.target.checked })}
              />
            )}
          </>
        )}
        {gameId === 'chamo' && (
          <Select
            label={t('games.chamo.size')}
            value={String(opts.size)}
            onChange={(e) => setOpts({ ...opts, size: Number(e.target.value) })}
            options={cfg.games.chamoSizes.map((n) => ({ value: String(n), label: t('games.chamo.sizeOpt', { n, lines: 2 * n * (n + 1) }) }))}
          />
        )}
        {gameId === 'covay' && (
          <Select
            label={t('games.covay.size')}
            value={String(opts.size)}
            onChange={(e) => setOpts({ ...opts, size: Number(e.target.value) })}
            options={COVAY_SIZES.map((n) => ({ value: String(n), label: t('games.covay.sizeOpt.' + n) }))}
          />
        )}
        {gameId === 'noitu' && (
          <>
            <Select
              label={t('games.noitu.lang')}
              value={opts.lang}
              onChange={(e) => setOpts({ ...opts, lang: e.target.value })}
              options={['vi', 'en'].map((v) => ({ value: v, label: t(v === 'vi' ? 'games.noitu.langVi' : 'games.noitu.langEn') }))}
            />
            {opts.lang === 'en' && (
              <Select
                label={t('games.noitu.link')}
                value={String(opts.link)}
                onChange={(e) => setOpts({ ...opts, link: Number(e.target.value) })}
                options={[1, 2].map((n) => ({ value: String(n), label: t('games.noitu.linkOpt', { n }) }))}
              />
            )}
            <Select
              label={t('games.noitu.time')}
              value={String(opts.time)}
              onChange={(e) => setOpts({ ...opts, time: Number(e.target.value) })}
              options={NOITU_TIMES.map((n) => ({ value: String(n), label: t('games.noitu.timeOpt', { n }) }))}
            />
            {opts.lang !== 'en' && (
              <>
                <Select
                  label={t('games.noitu.dict')}
                  value={opts.dict}
                  onChange={(e) => setOpts({ ...opts, dict: e.target.value })}
                  options={NOITU_DICTS.map((v) => ({ value: v, label: t('games.noitu.dictOpt.' + v) }))}
                />
                {opts.dict !== 'vote' && (
                  <Switch
                    label={t('games.noitu.cut')}
                    description={t('games.noitu.cutHint')}
                    checked={!!opts.cut}
                    onChange={(e) => setOpts({ ...opts, cut: e.target.checked })}
                  />
                )}
                <Switch
                  label={t('games.noitu.flip')}
                  description={t('games.noitu.flipHint')}
                  checked={opts.flip !== false}
                  onChange={(e) => setOpts({ ...opts, flip: e.target.checked })}
                />
              </>
            )}
            <Select
              label={t('games.noitu.repeat')}
              value={String(opts.repeat)}
              onChange={(e) => setOpts({ ...opts, repeat: Number(e.target.value) })}
              options={NOITU_REPEATS.map((n) => ({ value: String(n), label: t('games.noitu.repeatOpt.' + n) }))}
            />
          </>
        )}
        {gameId === 'masoi' && (
          <>
            <Select
              label={t('games.masoi.reveal')}
              value={opts.reveal}
              onChange={(e) => setOpts({ ...opts, reveal: e.target.value })}
              options={MASOI_REVEALS.map((v) => ({ value: v, label: t('games.masoi.revealOpt.' + v) }))}
            />
            <Select
              label={t('games.masoi.time')}
              value={String(opts.time)}
              onChange={(e) => setOpts({ ...opts, time: Number(e.target.value) })}
              options={MASOI_TIMES.map((n) => ({ value: String(n), label: n ? t('games.masoi.timeOpt', { n }) : t('games.masoi.timeNone') }))}
            />
            <Select
              label={t('games.masoi.deck')}
              value={roles ? 'custom' : 'auto'}
              onChange={(e) => {
                if (e.target.value === 'custom') setOpts({ ...opts, roles: MASOI_CUSTOM })
                else { const { roles: _drop, ...rest } = opts; setOpts(rest) }
              }}
              options={[{ value: 'auto', label: t('games.masoi.deckAuto') }, { value: 'custom', label: t('games.masoi.deckCustom') }]}
            />
            {roles && (
              <>
                <Select
                  label={t('games.masoi.wolfCount')}
                  value={String(wolves)}
                  onChange={(e) => setRoles(Number(e.target.value), specials)}
                  options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: t('games.masoi.wolfCountOpt', { n }) }))}
                />
                <div style={S.col}>
                  <span style={S.label}>{t('games.masoi.specialsLabel')}</span>
                  {MASOI_SPECIALS.map((r) => (
                    <Checkbox
                      key={r}
                      label={t('games.masoi.role.' + MASOI_ROLE_IDS[r])}
                      description={t('games.masoi.roleDesc.' + MASOI_ROLE_IDS[r])}
                      checked={specials.includes(r)}
                      onChange={(e) => setRoles(wolves, e.target.checked ? [...specials, r] : specials.filter((x) => x !== r))}
                    />
                  ))}
                </div>
                {noWolf
                  ? <Alert tone="danger">{t('games.err.noWolf')}</Alert>
                  : (
                    <span style={S.caption}>
                      {t('games.masoi.customList', { list: lineupOf(roles) })} · {t('games.masoi.customHint', { n: minPlayersOf(roles) })}
                    </span>
                  )}
              </>
            )}
          </>
        )}
        {gameId === 'tienlen' && (
          <>
            <Select
              label={t('games.tienlen.variant')}
              value={opts.variant}
              onChange={(e) => setOpts({ ...opts, variant: e.target.value })}
              options={TIENLEN_VARIANTS.map((v) => ({ value: v, label: t('games.tienlen.variantOpt.' + v) }))}
            />
            <Select
              label={t('games.tienlen.lead')}
              value={opts.lead}
              onChange={(e) => setOpts({ ...opts, lead: e.target.value })}
              options={TIENLEN_LEADS.map((v) => ({ value: v, label: t('games.tienlen.leadOpt.' + v) }))}
            />
          </>
        )}
        {gameId === 'baibip' && (
          <Select
            label={t('games.baibip.time')}
            value={String(opts.time)}
            onChange={(e) => setOpts({ ...opts, time: Number(e.target.value) })}
            options={BAIBIP_TIMES.map((n) => ({ value: String(n), label: n ? t('games.baibip.timeOpt', { n }) : t('games.baibip.timeNone') }))}
          />
        )}
        {TIME_OPTS[gameId] && (
          <Select
            label={t('games.' + gameId + '.time')}
            value={String(opts.time)}
            onChange={(e) => setOpts({ ...opts, time: Number(e.target.value) })}
            options={TIME_OPTS[gameId].map((n) => ({ value: String(n), label: n ? t('games.' + gameId + '.timeOpt', { n }) : t('games.' + gameId + '.timeNone') }))}
          />
        )}
        {LAP_OPTS[gameId] && (
          <Select
            label={t('games.' + gameId + '.laps')}
            value={String(opts.laps)}
            onChange={(e) => setOpts({ ...opts, laps: Number(e.target.value) })}
            options={LAP_OPTS[gameId].map((n) => ({ value: String(n), label: t('games.' + gameId + '.lapsOpt', { n }) }))}
          />
        )}
        {!NO_STAKE.includes(gameId) && (
          <>
            <Select
              label={t('games.coins.stake')}
              value={String(stake)}
              onChange={(e) => setOpts({ ...opts, stake: Number(e.target.value) })}
              options={STAKES.map((n) => ({ value: String(n), label: n ? t('games.coins.stakeOpt', { n }) : t('games.coins.noStake') }))}
            />
            {stake > 0 && (
              <span style={{ ...S.caption, color: broke ? 'var(--status-incident-fg)' : undefined }}>
                {broke ? t('games.coins.broke', { n: coins.toLocaleString('vi-VN') })
                  : t(BOARD_POINTS.includes(gameId) ? 'games.coins.hintPoints' : 'games.coins.hintWin', { n: stake })}
              </span>
            )}
          </>
        )}
        <Switch
          label={t('games.private')}
          description={t('games.privateHint')}
          checked={priv}
          onChange={(e) => setPriv(e.target.checked)}
        />
      </div>
    </Dialog>
  )
}

const S = {
  col: { display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' },
  grid: { display: 'grid', gap: 12 },
  box: { borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)', minWidth: 0 },
  h: { font: '600 16px/1.2 var(--font-display)', color: 'var(--text-primary)' },
  title: { font: '700 18px/1.2 var(--font-display)', color: 'var(--text-primary)' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  pill: { flexShrink: 0, padding: '4px 8px', borderRadius: 99, font: '600 10.5px/1 var(--font-sans)' },
}
