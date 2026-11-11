import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Icon, Skeleton } from '#ds'
import { Empty } from '#ui'
import { useMobile } from '#hooks/useMobile.js'
import { SCREENS } from '#components/games/screens.js'
import { HowTo } from '#components/games/GameInfo.jsx'
import { G, btn, card, mono, over, seg, segWrap } from '#components/games/stage.js'
import MoveList from '#components/games/MoveList.jsx'
import { SkinPicker } from '#components/games/ChessStage.jsx'
import { BOT_GAMES, BOT_PREFIX, gameOf, seatRange } from '#lib/games/registry.js'
import { acceptsDraw, botToMove, fillLocal, flatFleet, levelsOf, think } from '#lib/games/bots/index.js'
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
// Cờ vua / Cờ tướng (bản thiết kế "Co Vua" / "Co Tuong"): bàn tự vẽ thanh người chơi (ChessStage), đồng hồ là đồng hồ
// TỔNG mỗi bên (prefs.clock phút, luật ở chessClock.js — chạy từ nước đầu tiên), có cột Nước đi bên phải, chọn skin.
const CHESS = ['covua', 'cotuong']
const CLOCKS = [5, 10, 0] // phút mỗi bên; 0 = không giới hạn
// Gợi ý vẽ mũi tên trên bàn (bạn vẫn tự đi); các trò khác máy đi hộ một nước.
const ARROW = ['covua', 'cotuong', 'oanquan']
/** Lùi về thế cũ: đồng hồ của thế đó tính tiếp từ bây giờ; còn dưới 30 giây thì cho lại 30 giây để kịp đi. */
const rewind = (s) => (s?.clock?.since != null ? { ...s, clock: { left: s.clock.left.map((ms) => Math.max(ms, 30000)), since: Date.now() } } : s)
const mmss = (sec) => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')

const setupFor = (game, n, opts) => (game ? game.setup({ options: { ...game.defaultOptions, ...opts }, seats: Array.from({ length: n }, (_, i) => i) }) : null)
// Ô ăn quan: chọn kiểu bàn ngay trong ⚙ (prefs.oq). Đồng hồ phòng máy là prefs.time (đếm ở đây), không dùng options.time.
const OQ = { quans: [2, 3], rows: [5, 6, 7], stones: [5, 6, 7] }
const variantOf = (gameId, p) => (gameId === 'oanquan' ? { ...p.oq, time: 0 } : CHESS.includes(gameId) ? { clock: p.clock ?? 10 } : undefined)
/** Số người của ván máy: game tự nói theo tuỳ chọn (Ô ăn quan 3 quan = bạn + 2 máy) · game nhiều người: chọn · còn lại 2. */
function seatsFor(gameId, p) {
  const game = gameOf(gameId)
  if (game?.players) return seatRange(game, variantOf(gameId, p))[0]
  return game?.maxPlayers > 2 ? p.n : 2
}

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
  const [hinting, setHinting] = useState(false) // đang hỏi máy nước gợi ý
  const [tip, setTip] = useState(null) // { s, move } — nước gợi ý đang vẽ mũi tên, chỉ đúng với thế cờ `s`
  const chess = CHESS.includes(gameId)
  const multi = game?.maxPlayers > 2 && !game.players
  const nOf = (p) => seatsFor(gameId, p)
  const n = nOf(prefs)
  const human = multi || prefs.side >= n ? 0 : prefs.side
  const bots = useMemo(() => Array.from({ length: n }, (_, i) => i).filter((i) => i !== human), [n, human])

  // Ván = thế cờ + tàu của từng bên (Bắn tàu — thay game_hands của server) + số ván (đổi là dựng lại màn chơi)
  // + lỗi nước vừa đi (nằm chung để hàm cập nhật không phải gọi setState khác).
  // `past` = thế cờ ngay trước mỗi nước của người — nút Đi lại lùi về đó (bỏ luôn nước máy vừa đáp).
  // `timeout` = người để hết giờ của nước đang đi → thua (đồng hồ mỗi nước, prefs.time giây; 0 = tắt).
  // `log` = ký hiệu từng nước (game có `notate`) cho cột Nước đi.
  const [g, setG] = useState(() => ({ s: setupFor(game, n, variantOf(gameId, prefs)), fleets: {}, round: 0, err: '', past: [], timeout: false, resign: false, draw: false, info: '', log: [] }))
  const s = g.s
  const restart = (p = prefs) => setG((cur) => ({ s: setupFor(game, nOf(p), variantOf(gameId, p)), fleets: {}, round: cur.round + 1, err: '', past: [], timeout: false, resign: false, draw: false, info: '', log: [] }))
  // Đổi round để Screen dựng lại và lượt máy đang nghĩ cho thế cũ bị bỏ.
  const undo = () => setG((cur) => (cur.past.length
    ? { ...cur, s: rewind(cur.past[cur.past.length - 1]), past: cur.past.slice(0, -1), round: cur.round + 1, err: '', info: '', timeout: false, resign: false, draw: false, log: cur.log.slice(0, cur.past[cur.past.length - 1].ply ?? 0) }
    : cur))

  const play = useCallback((seat, move, at) => {
    setG((cur) => {
      if (cur.round !== at) return cur // nước nghĩ cho ván cũ
      const fleets = { ...cur.fleets }
      // Giờ của nước này — đồng hồ tổng (Cờ vua / Cờ tướng) tính theo nó, như giờ server ở phòng thật.
      const meta = { at: new Date().toISOString() }
      let s0 = cur.s
      // Đồng hồ tổng bắt đầu chạy từ nước đầu tiên của ván (phòng thật: server ghi { start } lúc bắt đầu).
      if (s0.clock && s0.clock.since == null && game.validate(s0, 0, { start: true }) == null) s0 = game.apply(s0, 0, { start: true }, meta)
      const logged = fillLocal(gameId, s0, seat, move, { fleets })
      const e = game.validate(s0, seat, logged)
      if (e) return { ...cur, err: t(e) }
      const next = game.apply(s0, seat, logged, meta)
      const text = game.notate?.(s0, logged, next)
      const past = seat === human && !logged?.timeout ? [...cur.past, cur.s] : cur.past
      return { ...cur, s: next, fleets, err: '', info: seat === human ? '' : cur.info, past, log: text ? [...cur.log, text] : cur.log }
    })
  }, [game, gameId, human])

  // Trang cờ tướng được cách ly (COOP/COEP) để chạy engine. Rời trang bằng bất kỳ đường nào (nút Quay lại, menu, nút
  // lùi của trình duyệt) → tải lại trang mới cho hết cách ly, không thì video YouTube nhúng ở trang khác bị chặn.
  // StrictMode (dev) giả gỡ màn hình nhưng đường dẫn chưa đổi → bỏ qua.
  useEffect(() => () => {
    if (self.crossOriginIsolated && !window.location.pathname.endsWith(BOT_PREFIX + 'cotuong')) window.location.reload()
  }, [])

  const result = g.draw ? { winners: [], draw: true } : g.timeout || g.resign ? { winners: bots, draw: false, timeout: g.timeout, resign: g.resign } : s && game ? game.result(s) : null
  const botSeat = s && game && !result ? botToMove(game, s, bots) : null
  const canMove = !!s && !result && botSeat == null && (gameId === 'bantau' && s.phase === 'place' ? false : s.turn === human)

  // Đồng hồ mỗi nước: chạy lại từ đầu mỗi khi tới lượt người (thế cờ đổi); hết giờ thì xử thua.
  const limit = chess ? 0 : prefs.time || 0
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
    restart(next)
  }
  const back = () => navigate(pathOf('games'))
  const resign = () => setG((cur) => ({ ...cur, resign: true }))
  // Gợi ý = hỏi máy (mức Khó) một nước. Cờ vua / Cờ tướng / Ô ăn quan: vẽ mũi tên trên bàn, bạn tự đi. Trò khác: máy
  // đi hộ một nước; muốn tự đi thì bấm Đi lại.
  const hint = async () => {
    const round = g.round
    const s0 = s
    setHinting(true)
    const m = await ask(gameId, s0, human, 'hard')
    setHinting(false)
    if (!m) return
    if (ARROW.includes(gameId)) setTip({ s: s0, move: m })
    else play(human, m, round)
  }
  const tipMove = tip && tip.s === s ? tip.move : null
  // Xin hoà: máy nhận khi thế cờ không nghiêng về nó (bots acceptsDraw); một máy từ chối là thôi.
  const offerDraw = () => setG((cur) => (bots.every((b) => acceptsDraw(gameId, cur.s, b))
    ? { ...cur, draw: true, info: '' }
    : { ...cur, info: t('games.bot.drawNo') }))
  const fleets = gameId === 'bantau'
    ? { [human]: flatFleet(g.fleets[human]), [1 - human]: result ? flatFleet(g.fleets[1 - human]) : null }
    : undefined
  const status = result
    ? result.timeout ? t('games.bot.timeoutLose') : (result.draw ? t('games.draw') : (result.winners || []).includes(human) ? t('games.youWin') : t('games.youLose'))
    : botSeat != null ? t('games.bot.thinking') : t('games.yourTurn')

  const levelLabel = t('games.bot.levelOpt.' + prefs.level)
  const sub = multi ? t('games.bot.playersOpt', { n: prefs.n, bots: prefs.n - 1 }) : t('games.bot.sideOpt' + human)
  const mins = chess ? prefs.clock ?? 10 : 0
  const myTurn = !result && botSeat == null
  // Bắn tàu: tàu xếp nằm ngoài state (fleets) nên lùi thế cờ sẽ lệch tàu — không cho đi lại.
  const canUndo = gameId !== 'bantau' && g.past.length > 0

  // Ô ăn quan tự vẽ thẻ Máy / Bạn, đồng hồ và nút ngay trong khung sơn mài (bản 1c) — không lặp thẻ ở ngoài.
  // Cờ vua / Cờ tướng cũng vậy (ChessStage) — thêm cột Nước đi bên phải, nút Ván mới nằm ở đó.
  const inFrame = gameId === 'oanquan' || chess
  const clock = limit ? { left: left ?? limit, limit, on: left != null } : null
  const actions = [
    { key: 'undo', icon: 'undo-2', label: t('games.bot.undo'), on: undo, off: !canUndo },
    { key: 'hint', icon: 'lightbulb', label: t('games.bot.hint'), on: hint, off: !canMove || hinting, soft: true },
    { key: 'draw', icon: 'handshake', label: t('games.bot.drawOffer'), on: offerDraw, off: !canMove },
    ...(chess ? [] : [{ key: 'new', icon: 'refresh-cw', label: t('games.bot.newGame'), on: () => restart() }]),
    { key: 'resign', icon: 'flag', label: t('games.bot.resign'), on: resign, off: !!result, danger: true },
  ]
  const segRow = (label, items, value, set) => (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={over}>{label}</span>
      <div style={{ ...segWrap, display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, background: G.inset }}>
        {items.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => set(v)} style={{ ...seg(value === v), padding: '7px 4px' }}>{l}</button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <button type="button" onClick={back} style={btn('ghost', { sm: true })}>
          <Icon name="arrow-left" size={15} />{!isMobile && t('games.lobbyShort')}
        </button>
        <span style={{ font: `800 ${isMobile ? 17 : 20}px/1.2 var(--font-display)`, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('games.' + gameId + '.name')}</span>
        {!isMobile && (
          <span style={S.pill}>
            {t('games.bot.pill', { level: levelLabel })} · {sub}{limit ? ' · ' + t('games.bot.timeOpt', { n: limit }) : ''}{mins ? ' · ' + t('games.clockOpt', { n: mins }) : ''}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {chess && <SkinPicker kind={gameId} />}
        <button type="button" aria-label={t('games.howto')} title={t('games.howto')} onClick={() => setHowto(true)} style={S.sq(false)}>
          <Icon name="book-open" size={17} />
        </button>
        <div style={{ position: 'relative' }}>
          <button type="button" aria-label={t('games.bot.settings')} title={t('games.bot.settings')} aria-expanded={gear}
            onClick={() => { setDraft(prefs); setGear(!gear) }} style={S.sq(gear)}>
            <Icon name="settings" size={18} />
          </button>
          {gear && (
            <div style={S.pop}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: '700 14px/1 var(--font-sans)' }}>{t('games.bot.settings')}</span>
                <button type="button" aria-label={t('common.close')} onClick={() => setGear(false)} style={{ border: 0, background: 'none', color: G.muted, cursor: 'pointer', display: 'grid' }}>
                  <Icon name="x" size={16} />
                </button>
              </div>
              {segRow(t('games.bot.level'), levelsOf(gameId).map((v) => [v, t('games.bot.levelShort.' + v)]), draft.level, (v) => setDraft({ ...draft, level: v }))}
              {multi
                ? segRow(t('games.bot.players'), [2, 3, 4].map((k) => [k, String(k)]), draft.n, (v) => setDraft({ ...draft, n: v }))
                : segRow(t('games.bot.side'), Array.from({ length: nOf(draft) }, (_, k) => [k, t('games.bot.sideOpt' + k)]), draft.side < nOf(draft) ? draft.side : 0, (v) => setDraft({ ...draft, side: v }))}
              {gameId === 'oanquan' && (() => {
                const oq = { ...game.defaultOptions, ...draft.oq }
                const set = (k) => (v) => setDraft({ ...draft, oq: { ...oq, [k]: v } })
                return (
                  <>
                    {segRow(t('games.oanquan.quans'), OQ.quans.map((k) => [k, t('games.oanquan.quansShort', { n: k })]), oq.quans, set('quans'))}
                    {segRow(t('games.oanquan.rows'), OQ.rows.map((k) => [k, String(k)]), oq.rows, set('rows'))}
                    {segRow(t('games.oanquan.stones'), OQ.stones.map((k) => [k, String(k)]), oq.stones, set('stones'))}
                    {segRow(t('games.oanquan.nhon'), [[true, t('games.oanquan.nhonOn')], [false, t('games.oanquan.nhonOff')]], !!oq.nhon, set('nhon'))}
                  </>
                )
              })()}
              {chess
                ? segRow(t('games.clock'), CLOCKS.map((k) => [k, k ? t('games.clockOpt', { n: k }) : t('games.bot.timeShortNone')]), draft.clock ?? 10, (v) => setDraft({ ...draft, clock: v }))
                : segRow(t('games.bot.time'), [...TIMES.filter(Boolean), 0].map((k) => [k, k ? k + 's' : t('games.bot.timeShortNone')]), draft.time || 0, (v) => setDraft({ ...draft, time: v }))}
              {draft.level === 'master' && <span style={S.caption}>{t('games.bot.masterHint.' + gameId)}</span>}
              <button type="button" onClick={apply} style={btn('primary', { block: true })}>{t('games.bot.apply')}</button>
            </div>
          )}
        </div>
      </div>

      {note && <Alert tone="warning">{note}</Alert>}
      {g.err && <Alert tone="danger">{g.err}</Alert>}
      {g.info && <Alert tone="info">{g.info}</Alert>}

      <div style={chess ? { display: 'grid', gap: 18, alignItems: 'start', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 320px' } : { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ width: '100%', maxWidth: chess ? undefined : inFrame ? 960 : 600, justifySelf: 'center', display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0 }}>
        {!inFrame && (
          <PlayerCard mark="bot" name={multi ? t('games.bot.bots', { n: bots.length }) : t('games.bot.bot')} sub={t('games.bot.levelLine', { level: levelLabel })}
            line={botSeat != null ? t('games.bot.thinking') : ''} active={botSeat != null} clock={clock && { ...clock, on: false, left: limit }} />
        )}
        <Suspense fallback={<Skeleton height={320} />}>
          <Screen key={g.round} state={game.view(s, human)} mySeat={human} canMove={canMove} onMove={(m) => play(human, m, g.round)}
            roomId={'bot-' + gameId} result={result} hands={fleets}
            {...(chess ? {
              names: { [human]: t('games.bot.you'), [bots[0]]: t('games.bot.bot') },
              tags: { [human]: '', [bots[0]]: '· ' + t('games.bot.levelLine', { level: levelLabel }) },
              actions, hint: tipMove,
              overActions: [{ key: 'new', label: t('games.bot.newGame'), on: () => restart() }, ...(canUndo ? [{ key: 'undo', label: t('games.bot.undo'), on: undo }] : [])],
            } : inFrame ? {
              names: { [human]: t('games.bot.you'), ...Object.fromEntries(bots.map((b, j) => [b, t('games.bot.bot') + (bots.length > 1 ? ' ' + (j + 1) : '')])) },
              note: { [human]: botSeat == null ? status : '', ...Object.fromEntries(bots.map((b) => [b, b === botSeat ? t('games.bot.thinking') : t('games.bot.levelLine', { level: levelLabel })])) },
              clock: clock && { seat: human, ...clock },
              actions, hint: tipMove,
            } : {})} />
        </Suspense>
        {!inFrame && (
          <>
            <PlayerCard mark="you" name={t('games.bot.you')} sub={multi ? '' : t('games.bot.sideOpt' + human)} line={botSeat == null ? status : ''}
              active={myTurn} done={!!result} clock={clock} />
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))`, marginTop: 2 }}>
              {actions.map((x) => (
                <button key={x.key} type="button" disabled={x.off} onClick={x.on} title={x.label} aria-label={x.label} style={{ ...btn(x.danger ? 'danger' : 'ghost'), padding: '10px 8px', font: '600 13px/1 var(--font-sans)', opacity: x.off ? 0.45 : 1, cursor: x.off ? 'default' : 'pointer' }}>
                  <Icon name={x.icon} size={15} />{!isMobile && x.label}
                </button>
              ))}
            </div>
          </>
        )}
        <span style={{ ...S.caption, textAlign: 'center' }}>{t('games.bot.practice')}</span>
      </div>
      {chess && (
        <div style={{ ...card, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, height: isMobile ? 320 : 640 }}>
          <span style={{ font: '700 13px/1 var(--font-sans)', paddingBottom: 10, borderBottom: '1px solid ' + G.line }}>{t('games.room.moves')} · {g.log.length}</span>
          <MoveList list={g.log} />
          <span style={{ flex: g.log.length ? 0 : 1 }} />
          <button type="button" onClick={() => restart()} style={btn('primary', { block: true })}>{t('games.bot.newGame')}</button>
        </div>
      )}
      </div>

      {howto && <HowTo gameId={gameId} onClose={() => setHowto(false)} />}
    </div>
  )
}

/** Thẻ người chơi trên / dưới bàn (máy ở trên, bạn ở dưới) — bản 3a: ô ký hiệu, tên, đồng hồ to; viền ngọc khi tới lượt. */
function PlayerCard({ mark, name, sub, line, active, done, clock }) {
  const you = mark === 'you'
  const low = clock?.on && clock.left <= 5
  return (
    <div style={{
      ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      background: active ? G.tealA(0.08) : G.card, borderColor: active ? G.tealA(0.45) : G.line,
    }} aria-live={you ? 'polite' : undefined}>
      <span style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: you ? G.tealA(0.16) : G.redA(0.14), color: you ? G.tealHi : G.red,
      }}>
        <Icon name={you ? 'user' : 'bot'} size={20} />
      </span>
      <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <span style={{ font: '700 15px/1.2 var(--font-sans)' }}>{name}{sub ? <span style={{ ...mono, fontSize: 11 }}> · {sub}</span> : null}</span>
        {line && <span style={{ font: '600 12px/1.2 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: done ? 'var(--status-delivered-fg)' : active ? G.tealHi : G.muted }}>{line}</span>}
      </div>
      {clock && (
        <div style={{ flexShrink: 0, display: 'grid', justifyItems: 'end', gap: 4 }} role="timer" aria-label={t('games.bot.time')}>
          <span style={{
            padding: '5px 14px', borderRadius: 8, font: '700 22px/1 var(--font-mono)',
            background: !clock.on ? G.inset : low ? G.red : G.teal, color: !clock.on ? G.muted : low ? '#fff' : G.tealInk,
          }}>{mmss(clock.left)}</span>
          <div style={{ width: 84, height: 3, borderRadius: 2, background: G.line, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: (100 * clock.left) / clock.limit + '%', background: !clock.on ? G.muted : low ? G.red : G.teal, transition: 'width 250ms linear' }} />
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  pill: {
    flexShrink: 0, padding: '4px 10px', borderRadius: 99, background: G.inset, color: G.soft, border: '1px solid ' + G.line,
    font: '500 12px/1.2 var(--font-sans)', whiteSpace: 'nowrap',
  },
  sq: (on) => ({
    width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0,
    background: on ? G.tealA(0.14) : 'transparent', color: on ? G.tealHi : G.soft, border: '1px solid ' + (on ? G.tealA(0.45) : G.lineHi),
  }),
  pop: {
    position: 'absolute', top: 46, right: 0, zIndex: 20, width: 280, maxWidth: 'calc(100vw - 32px)', padding: 16,
    borderRadius: 14, background: 'var(--surface-overlay)', border: '1px solid ' + G.lineHi, boxShadow: 'var(--shadow-lg)',
    display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)',
  },
}
