import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Icon, Select, Skeleton } from '#ds'
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
const TIMES = [0, 15, 30] // đồng hồ mỗi nước (giây); 0 = không giới hạn
const mmss = (sec) => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')

const setupFor = (game, n) => (game ? game.setup({ options: game.defaultOptions, seats: Array.from({ length: n }, (_, i) => i) }) : null)

function loadPrefs(id) {
  const base = { level: 'normal', side: 0, n: 2, time: 0 }
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
  const [gear, setGear] = useState(false)
  const [draft, setDraft] = useState(prefs)
  const multi = game?.maxPlayers > 2
  const human = multi ? 0 : prefs.side
  const n = multi ? prefs.n : 2
  const bots = useMemo(() => Array.from({ length: n }, (_, i) => i).filter((i) => i !== human), [n, human])

  // Ván = thế cờ + tàu của từng bên (Bắn tàu — thay game_hands của server) + số ván (đổi là dựng lại màn chơi)
  // + lỗi nước vừa đi (nằm chung để hàm cập nhật không phải gọi setState khác).
  // `past` = thế cờ ngay trước mỗi nước của người — nút Đi lại lùi về đó (bỏ luôn nước máy vừa đáp).
  // `timeout` = người để hết giờ của nước đang đi → thua (đồng hồ mỗi nước, prefs.time giây; 0 = tắt).
  const [g, setG] = useState(() => ({ s: setupFor(game, n), fleets: {}, round: 0, err: '', past: [], timeout: false }))
  const s = g.s
  const restart = (k = n) => setG((cur) => ({ s: setupFor(game, k), fleets: {}, round: cur.round + 1, err: '', past: [], timeout: false }))
  // Đổi round để Screen dựng lại và lượt máy đang nghĩ cho thế cũ bị bỏ.
  const undo = () => setG((cur) => (cur.past.length
    ? { ...cur, s: cur.past[cur.past.length - 1], past: cur.past.slice(0, -1), round: cur.round + 1, err: '', timeout: false }
    : cur))

  const play = useCallback((seat, move, at) => {
    setG((cur) => {
      if (cur.round !== at) return cur // nước nghĩ cho ván cũ
      const fleets = { ...cur.fleets }
      const logged = fillLocal(gameId, cur.s, seat, move, { fleets })
      const e = game.validate(cur.s, seat, logged)
      if (e) return { ...cur, err: t(e) }
      const past = seat === human ? [...cur.past, cur.s] : cur.past
      return { ...cur, s: game.apply(cur.s, seat, logged), fleets, err: '', past }
    })
  }, [game, gameId, human])

  // Trang cờ tướng được cách ly (COOP/COEP) để chạy engine. Rời trang bằng bất kỳ đường nào (nút Quay lại, menu, nút
  // lùi của trình duyệt) → tải lại trang mới cho hết cách ly, không thì video YouTube nhúng ở trang khác bị chặn.
  // StrictMode (dev) giả gỡ màn hình nhưng đường dẫn chưa đổi → bỏ qua.
  useEffect(() => () => {
    if (self.crossOriginIsolated && !window.location.pathname.endsWith(BOT_PREFIX + 'cotuong')) window.location.reload()
  }, [])

  const result = g.timeout ? { winners: bots, draw: false, timeout: true } : s && game ? game.result(s) : null
  const botSeat = s && game && !result ? botToMove(game, s, bots) : null
  const canMove = !!s && !result && botSeat == null && (gameId === 'bantau' && s.phase === 'place' ? false : s.turn === human)

  // Đồng hồ mỗi nước: chạy lại từ đầu mỗi khi tới lượt người (thế cờ đổi); hết giờ thì xử thua.
  const limit = prefs.time || 0
  // `clk` gắn với đúng thế cờ đang chờ người đi (đổi thế cờ = đồng hồ mới), cập nhật ngay lúc render như queueStates.
  const want = limit && canMove ? s : null
  const [clk, setClk] = useState(null) // { s, left }
  if ((clk?.s ?? null) !== want) setClk(want ? { s: want, left: limit } : null)
  useEffect(() => {
    if (!want) return undefined
    const end = Date.now() + limit * 1000
    const round = g.round
    const id = setInterval(() => {
      const sec = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setClk((cur) => (cur?.s === want ? { ...cur, left: sec } : cur))
      if (sec === 0) {
        clearInterval(id)
        setG((cur) => (cur.round === round ? { ...cur, timeout: true } : cur))
      }
    }, 250)
    return () => clearInterval(id)
  }, [want, limit, g.round])
  const left = clk?.s === want && want ? clk.left : null

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
  // Cài đặt trong popup ⚙ chỉ áp dụng khi bấm "Áp dụng · Ván mới".
  const apply = () => {
    const next = { ...prefs, ...draft }
    setPrefs(next)
    savePrefs(gameId, next)
    setNote('')
    setGear(false)
    restart(multi ? next.n : 2)
  }
  const back = () => navigate(pathOf('games'))
  const fleets = gameId === 'bantau'
    ? { [human]: flatFleet(g.fleets[human]), [1 - human]: result ? flatFleet(g.fleets[1 - human]) : null }
    : undefined
  const status = result
    ? result.timeout ? t('games.bot.timeoutLose') : (result.draw ? t('games.draw') : (result.winners || []).includes(human) ? t('games.youWin') : t('games.youLose'))
    : botSeat != null ? t('games.bot.thinking') : t('games.yourTurn')

  const levelLabel = t('games.bot.levelOpt.' + prefs.level)
  const sub = multi ? t('games.bot.playersOpt', { n: prefs.n, bots: prefs.n - 1 }) : t('games.bot.sideOpt' + prefs.side)
  const myTurn = !result && botSeat == null
  // Bắn tàu: tàu xếp nằm ngoài state (fleets) nên lùi thế cờ sẽ lệch tàu — không cho đi lại.
  const canUndo = gameId !== 'bantau' && g.past.length > 0

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Button size="sm" variant="secondary" icon="arrow-left" onClick={back}>{isMobile ? null : t('games.back')}</Button>
        <span style={{ ...S.title, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('games.' + gameId + '.name')}</span>
        {!isMobile && (
          <span style={S.pill}>
            {t('games.bot.pill', { level: levelLabel })} · {sub}{limit ? ' · ' + t('games.bot.timeOpt', { n: limit }) : ''}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" icon="book-open" aria-label={t('games.howto')} title={t('games.howto')} onClick={() => setHowto(true)} />
        <div style={{ position: 'relative' }}>
          <Button size="sm" variant={gear ? 'secondary' : 'ghost'} icon="settings" aria-label={t('games.bot.settings')} title={t('games.bot.settings')}
            aria-expanded={gear} onClick={() => { setDraft(prefs); setGear(!gear) }} />
          {gear && (
            <div style={S.pop}>
              <span style={S.label}>{t('games.bot.settings')}</span>
              <Select
                label={t('games.bot.level')}
                value={draft.level}
                onChange={(e) => setDraft({ ...draft, level: e.target.value })}
                options={levelsOf(gameId).map((v) => ({ value: v, label: t('games.bot.levelOpt.' + v) }))}
              />
              {multi
                ? (
                  <Select
                    label={t('games.bot.players')}
                    value={String(draft.n)}
                    onChange={(e) => setDraft({ ...draft, n: Number(e.target.value) })}
                    options={[2, 3, 4].map((k) => ({ value: String(k), label: t('games.bot.playersOpt', { n: k, bots: k - 1 }) }))}
                  />
                )
                : (
                  <Select
                    label={t('games.bot.side')}
                    value={String(draft.side)}
                    onChange={(e) => setDraft({ ...draft, side: Number(e.target.value) })}
                    options={[0, 1].map((k) => ({ value: String(k), label: t('games.bot.sideOpt' + k) }))}
                  />
                )}
              <Select
                label={t('games.bot.time')}
                value={String(draft.time || 0)}
                onChange={(e) => setDraft({ ...draft, time: Number(e.target.value) })}
                options={TIMES.map((k) => ({ value: String(k), label: k ? t('games.bot.timeOpt', { n: k }) : t('games.bot.timeNone') }))}
              />
              {draft.level === 'master' && <span style={S.caption}>{t('games.bot.masterHint.' + gameId)}</span>}
              <Button icon="refresh-cw" onClick={apply}>{t('games.bot.apply')}</Button>
            </div>
          )}
        </div>
      </div>

      {note && <Alert tone="warning">{note}</Alert>}
      {g.err && <Alert tone="danger">{g.err}</Alert>}

      <div style={{ width: '100%', maxWidth: 680, justifySelf: 'center', display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <PlayerCard mark="bot" name={multi ? t('games.bot.bots', { n: bots.length }) : t('games.bot.bot')} sub={levelLabel}
          line={botSeat != null ? t('games.bot.thinking') : ''} active={botSeat != null} />
        <Suspense fallback={<Skeleton height={320} />}>
          <Screen key={g.round} state={game.view(s, human)} mySeat={human} canMove={canMove} onMove={(m) => play(human, m, g.round)}
            roomId={'bot-' + gameId} result={result} hands={fleets} />
        </Suspense>
        <PlayerCard mark="you" name={t('games.bot.you')} sub={multi ? '' : t('games.bot.sideOpt' + human)} line={botSeat == null ? status : ''}
          active={myTurn} done={!!result} clock={limit ? { left: left ?? limit, limit, on: left != null } : null} />
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <Button variant="secondary" icon="undo-2" disabled={!canUndo} onClick={undo}>{t('games.bot.undo')}</Button>
          <Button icon="refresh-cw" onClick={() => restart()}>{t('games.bot.newGame')}</Button>
        </div>
        <span style={{ ...S.caption, textAlign: 'center' }}>{t('games.bot.practice')}</span>
      </div>

      {howto && <HowTo gameId={gameId} onClose={() => setHowto(false)} />}
    </div>
  )
}

/** Thẻ người chơi trên / dưới bàn (máy ở trên, bạn ở dưới); viền sáng khi tới lượt. */
function PlayerCard({ mark, name, sub, line, active, done, clock }) {
  const low = clock?.on && clock.left <= 5
  const tone = !clock?.on ? 'var(--text-muted)' : low ? 'var(--status-incident-fg)' : 'var(--status-transit-fg)'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, minWidth: 0,
      background: active ? 'var(--surface-accent-soft)' : done ? 'var(--status-delivered-bg)' : 'var(--surface-card)',
      border: '1px solid ' + (active ? 'var(--border-focus-color)' : 'var(--border-subtle)'),
    }} aria-live={mark === 'you' ? 'polite' : undefined}>
      <span style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: mark === 'you' ? 'var(--surface-accent-soft)' : 'var(--surface-inset)', color: mark === 'you' ? 'var(--status-transit-fg)' : 'var(--text-secondary)',
      }}>
        <Icon name={mark === 'you' ? 'user' : 'bot'} size={20} />
      </span>
      <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <span style={{ ...S.label, fontWeight: 700 }}>{name}{sub ? <span style={{ ...S.caption, fontWeight: 400 }}> · {sub}</span> : null}</span>
        {line && <span style={{ ...S.caption, fontWeight: 600, color: done ? 'var(--status-delivered-fg)' : active ? 'var(--status-transit-fg)' : 'var(--text-muted)' }}>{line}</span>}
      </div>
      {clock && (
        <div style={{ flexShrink: 0, display: 'grid', justifyItems: 'end', gap: 4 }} role="timer" aria-label={t('games.bot.time')}>
          <span style={{ ...S.clock, color: tone, background: low ? 'var(--status-incident-bg)' : 'var(--surface-inset)' }}>{mmss(clock.left)}</span>
          <div style={{ width: 72, height: 3, borderRadius: 2, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: (100 * clock.left) / clock.limit + '%', background: tone, transition: 'width 250ms linear' }} />
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  box: { borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)', minWidth: 0 },
  title: { font: '700 18px/1.2 var(--font-display)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  clock: { padding: '4px 10px', borderRadius: 8, font: '700 18px/1 var(--font-mono)' },
  pill: {
    flexShrink: 0, padding: '4px 10px', borderRadius: 99, background: 'var(--surface-inset)', color: 'var(--text-secondary)',
    font: '500 12px/1.2 var(--font-sans)', whiteSpace: 'nowrap',
  },
  pop: {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 20, width: 280, maxWidth: 'calc(100vw - 32px)', padding: 16,
    borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)',
    display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)',
  },
}
