import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Dialog, Input, Select, Skeleton, Switch } from '#ds'
import { Empty } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { gameErr } from '#contexts/gameActions.js'
import { useMobile } from '#hooks/useMobile.js'
import { useTourPoll } from '#hooks/useTourPoll.js'
import { GameArt, HowTo } from '#components/games/GameInfo.jsx'
import { myMember } from '#lib/money.js'
import { GAMES, GAME_IDS, gameOf, isStaleRoom, seatedOf, statsOf } from '#lib/games/registry.js'
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

  const refresh = useCallback(() => a.gameLobby()
    .then((r) => { setData({ ...r, now: Date.now() }); setErr('') })
    .catch((e) => { setErr(gameErr(e)); setData((d) => d || { rooms: [], finished: [], now: Date.now() }) }), [a])

  useEffect(() => { refresh() }, [refresh, db.clubId])
  useTourPoll(true, refresh, cfg.games.lobbyPollMs)

  const open = (id) => navigate(pathOf('gameRoom', id))
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
      {err && <Alert tone="danger">{err}</Alert>}

      <section style={S.col}>
        <span style={S.h}>{t('games.pick')}</span>
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

      {creating && <CreateRoom gameId={creating} onClose={() => setCreating(null)} onDone={(id) => { setCreating(null); open(id) }} />}
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
  return (
    <div style={{ ...S.box, padding: '10px 14px 10px 10px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <div style={{ width: 64, flexShrink: 0 }}><GameArt id={room.game} height={44} radius={8} /></div>
      <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ ...S.label, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={host?.name}>
            {t('games.' + room.game + '.name')} · {host?.name || t('games.host')}
          </span>
          <span style={{ ...S.pill, background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}>{t('games.status.' + room.status)}</span>
        </div>
        <span style={S.mono}>{room.code} · {t('games.seats', { n: seated.length, max: g.maxPlayers })}</span>
      </div>
      <Button size="sm" variant={canJoin || mine ? 'primary' : 'secondary'} onClick={onEnter}>
        {canJoin || mine ? t('games.enter') : t('games.watch')}
      </Button>
    </div>
  )
}

/** Form tạo phòng. Tuỳ chọn riêng từng game nằm ở đây — hiện có Caro và Chấm ô (cỡ bàn). */
function CreateRoom({ gameId, onClose, onDone }) {
  const { a } = useApp()
  const isMobile = useMobile(768)
  const g = gameOf(gameId)
  const [opts, setOpts] = useState(g.defaultOptions)
  const [priv, setPriv] = useState(false)
  const [busy, setBusy] = useState(false)

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
          <Button onClick={submit} disabled={busy}>{t('games.create')}</Button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {gameId === 'caro' && (
          <>
            <Select
              label={t('games.caro.size')}
              value={String(opts.size)}
              onChange={(e) => setOpts({ ...opts, size: Number(e.target.value) })}
              options={cfg.games.caroSizes.map((n) => ({ value: String(n), label: t('games.caro.sizeOpt', { n }) }))}
            />
            <Switch
              label={t('games.caro.blockedEnds')}
              description={t('games.caro.blockedEndsHint')}
              checked={!!opts.blockedEnds}
              onChange={(e) => setOpts({ ...opts, blockedEnds: e.target.checked })}
            />
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
