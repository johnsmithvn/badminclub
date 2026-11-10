import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Select, Skeleton } from '#ds'
import { Empty } from '#ui'
import { useMobile } from '#hooks/useMobile.js'
import { SCREENS } from '#components/games/screens.js'
import { HowTo } from '#components/games/GameInfo.jsx'
import { BOT_GAMES, BOT_PREFIX, gameOf } from '#lib/games/registry.js'
import { botToMove, fillLocal, flatFleet, levelsOf, think } from '#lib/games/bots/index.js'
import { engineMove } from '#lib/games/bots/engine.js'
import { pathOf } from '#routes'
import { t } from '#i18n'

// Chơi với máy (luyện tập): ván chạy hẳn trong trình duyệt — luật lib/games, máy lib/games/bots. Không gọi server,
// không lưu, không tính thống kê. Dùng lại đúng màn chơi của phòng thật (SCREENS); phần server điền (xúc xắc, tàu)
// do fillLocal làm thay. Máy nghĩ trong Web Worker; mức Cao thủ cờ vua / cờ tướng gọi engine nhúng (engine.js).

const KEY = 'gamebot:'
const MIN_THINK_MS = 450 // máy đi nhanh quá nhìn không kịp
const ENGINE_MS = { covua: 1000, cotuong: 1500 }

const setupFor = (game, n) => (game ? game.setup({ options: game.defaultOptions, seats: Array.from({ length: n }, (_, i) => i) }) : null)

function loadPrefs(id) {
  const base = { level: 'normal', side: 0, n: 2 }
  try { return { ...base, ...JSON.parse(localStorage.getItem(KEY + id) || '{}') } } catch { return base }
}
function savePrefs(id, p) {
  try { localStorage.setItem(KEY + id, JSON.stringify(p)) } catch { /* trình duyệt chặn lưu — bỏ qua */ }
}

/** Nghĩ ngay trên luồng chính (màn hình đứng trong lúc nghĩ) — nhường một nhịp cho dòng "Máy đang nghĩ" kịp hiện. */
const thinkHere = (gameId, state, seat, level) => new Promise((ok) => {
  setTimeout(() => {
    let move = null
    try { move = think(gameId, state, seat, level) } catch (err) { console.warn('[bot]', err) }
    ok(move)
  }, 30)
})

/**
 * Máy nghĩ trong Worker (một Worker cho cả trang). Trả hàm ask(gameId, state, seat, level) → Promise<move>.
 * Worker không chạy được (trang cách ly COEP mà file Worker thiếu header — vercel.json / vite.config.js; hoặc máy quá
 * cũ) thì KHÔNG được im lặng: trước đây không bắt onerror nên máy "đang nghĩ" mãi mãi. Giờ lùi về nghĩ trên luồng chính.
 */
function useWorker() {
  const ref = useRef(null)
  useEffect(() => () => ref.current?.w?.terminate(), [])
  return useCallback((gameId, state, seat, level) => {
    if (!ref.current) {
      const cur = { w: null, wait: new Map(), n: 0, dead: false }
      const fail = (e) => {
        console.warn('[bot] worker', e?.message || e)
        cur.dead = true
        cur.w?.terminate()
        for (const [, job] of cur.wait) thinkHere(...job.args).then(job.ok)
        cur.wait.clear()
      }
      try {
        cur.w = new Worker(new URL('../../lib/games/bots/worker.js', import.meta.url), { type: 'module' })
        cur.w.onmessage = (e) => { cur.wait.get(e.data.id)?.ok(e.data.move); cur.wait.delete(e.data.id) }
        cur.w.onerror = fail
      } catch (e) { fail(e) }
      ref.current = cur
    }
    const cur = ref.current
    const args = [gameId, state, seat, level]
    if (cur.dead) return thinkHere(...args)
    const id = ++cur.n
    return new Promise((ok) => { cur.wait.set(id, { ok, args }); cur.w.postMessage({ id, gameId, state, seat, level }) })
  }, [])
}

export default function BotRoom({ gameId }) {
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const game = gameOf(gameId)
  const ask = useWorker()
  const [prefs, setPrefs] = useState(() => loadPrefs(gameId))
  const [howto, setHowto] = useState(false)
  const [note, setNote] = useState('')
  const multi = game?.maxPlayers > 2
  const human = multi ? 0 : prefs.side
  const n = multi ? prefs.n : 2
  const bots = useMemo(() => Array.from({ length: n }, (_, i) => i).filter((i) => i !== human), [n, human])

  // Ván = thế cờ + tàu của từng bên (Bắn tàu — thay game_hands của server) + số ván (đổi là dựng lại màn chơi)
  // + lỗi nước vừa đi (nằm chung để hàm cập nhật không phải gọi setState khác).
  const [g, setG] = useState(() => ({ s: setupFor(game, n), fleets: {}, round: 0, err: '' }))
  const s = g.s
  const restart = (k = n) => setG((cur) => ({ s: setupFor(game, k), fleets: {}, round: cur.round + 1, err: '' }))

  const play = useCallback((seat, move, at) => {
    setG((cur) => {
      if (cur.round !== at) return cur // nước nghĩ cho ván cũ
      const fleets = { ...cur.fleets }
      const logged = fillLocal(gameId, cur.s, seat, move, { fleets })
      const e = game.validate(cur.s, seat, logged)
      if (e) return { ...cur, err: t(e) }
      return { ...cur, s: game.apply(cur.s, seat, logged), fleets, err: '' }
    })
  }, [game, gameId])

  // Trang cờ tướng được cách ly (COOP/COEP) để chạy engine. Rời trang bằng bất kỳ đường nào (nút Quay lại, menu, nút
  // lùi của trình duyệt) → tải lại trang mới cho hết cách ly, không thì video YouTube nhúng ở trang khác bị chặn.
  // StrictMode (dev) giả gỡ màn hình nhưng đường dẫn chưa đổi → bỏ qua.
  useEffect(() => () => {
    if (self.crossOriginIsolated && !window.location.pathname.endsWith(BOT_PREFIX + 'cotuong')) window.location.reload()
  }, [])

  const result = s && game ? game.result(s) : null
  const botSeat = s && game ? botToMove(game, s, bots) : null

  // Tới lượt máy: hỏi engine (Cao thủ) hoặc Worker, chờ tối thiểu một nhịp cho người kịp nhìn rồi đi.
  // Ván đổi (nước mới / ván mới) thì effect chạy lại, lượt nghĩ cũ bị bỏ (off).
  useEffect(() => {
    if (botSeat == null) return undefined
    let off = false
    const t0 = Date.now()
    const level = prefs.level
    const go = async () => {
      let move = null
      if (level === 'master' && ENGINE_MS[gameId]) {
        try {
          move = await engineMove(gameId, s, { ms: ENGINE_MS[gameId] })
          if (move && game.validate(s, botSeat, move)) move = null
        } catch (e) {
          console.warn('[bot] engine', e?.message || e)
        }
        if (!move && !off) setNote(t('games.bot.engineOff'))
      }
      if (!move) move = await ask(gameId, s, botSeat, level)
      if (off || !move) return
      setTimeout(() => { if (!off) play(botSeat, move, g.round) }, Math.max(0, MIN_THINK_MS - (Date.now() - t0)))
    }
    go()
    return () => { off = true }
  }, [s, g.round, botSeat, prefs.level, gameId, game, ask, play])

  if (!game || !BOT_GAMES.includes(gameId)) {
    return <Empty icon="gamepad-2" title={t('games.notFoundTitle')} hint={t('games.bot.notSupported')} />
  }

  const Screen = SCREENS[gameId]
  const change = (patch) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    savePrefs(gameId, next)
    if (patch.side !== undefined || patch.n !== undefined) restart(multi ? next.n : 2) // đổi bên / số người = ván mới
  }
  const back = () => navigate(pathOf('games'))
  const canMove = !result && botSeat == null && (gameId === 'bantau' && s.phase === 'place' ? false : s.turn === human)
  const fleets = gameId === 'bantau'
    ? { [human]: flatFleet(g.fleets[human]), [1 - human]: result ? flatFleet(g.fleets[1 - human]) : null }
    : undefined
  const status = result
    ? (result.draw ? t('games.draw') : (result.winners || []).includes(human) ? t('games.youWin') : t('games.youLose'))
    : botSeat != null ? t('games.bot.thinking') : t('games.yourTurn')

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
        <Button size="sm" variant="ghost" icon="arrow-left" onClick={back}>{isMobile ? null : t('games.back')}</Button>
        <span style={{ ...S.title, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t('games.bot.title', { game: t('games.' + gameId + '.name') })}
        </span>
        <Button size="sm" variant="ghost" icon="book-open" aria-label={t('games.howto')} onClick={() => setHowto(true)}>{isMobile ? null : t('games.howto')}</Button>
      </div>

      <div style={{ ...S.box, padding: 14, display: 'grid', gap: 10, gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'end' }}>
        <Select
          label={t('games.bot.level')}
          value={prefs.level}
          onChange={(e) => { setNote(''); change({ level: e.target.value }) }}
          options={levelsOf(gameId).map((v) => ({ value: v, label: t('games.bot.levelOpt.' + v) }))}
        />
        {multi
          ? (
            <Select
              label={t('games.bot.players')}
              value={String(prefs.n)}
              onChange={(e) => change({ n: Number(e.target.value) })}
              options={[2, 3, 4].map((k) => ({ value: String(k), label: t('games.bot.playersOpt', { n: k, bots: k - 1 }) }))}
            />
          )
          : (
            <Select
              label={t('games.bot.side')}
              value={String(prefs.side)}
              onChange={(e) => change({ side: Number(e.target.value) })}
              options={[0, 1].map((k) => ({ value: String(k), label: t('games.bot.sideOpt' + k) }))}
            />
          )}
        <Button icon="refresh-cw" variant="secondary" onClick={() => restart()}>{t('games.bot.newGame')}</Button>
      </div>
      <span style={S.caption}>
        {prefs.level === 'master' ? t('games.bot.masterHint.' + gameId) + ' ' : ''}{t('games.bot.practice')}
      </span>
      {note && <Alert tone="warning">{note}</Alert>}
      {g.err && <Alert tone="danger">{g.err}</Alert>}

      <div style={{ ...S.status, ...(result ? S.statusDone : null) }} aria-live="polite">{status}</div>
      <Suspense fallback={<Skeleton height={320} />}>
        <Screen key={g.round} state={game.view(s, human)} mySeat={human} canMove={canMove} onMove={(m) => play(human, m, g.round)}
          roomId={'bot-' + gameId} result={result} hands={fleets} />
      </Suspense>

      {howto && <HowTo gameId={gameId} onClose={() => setHowto(false)} />}
    </div>
  )
}

const S = {
  box: { borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)', minWidth: 0 },
  title: { font: '700 18px/1.2 var(--font-display)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  status: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderRadius: 10,
    background: 'var(--surface-inset)', font: 'var(--type-label)', color: 'var(--text-primary)',
  },
  statusDone: { background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)' },
}
