import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { HowTo } from '#components/games/GameInfo.jsx'
import { G, btn, card, mono, over } from '#components/games/stage.js'
import { botDelay, claim, HINT_MS, MODES, N, outcome, start, tap } from '#lib/games/timso.js'
import { pathOf } from '#routes'
import { t } from '#i18n'

// Tìm số (/tro-choi/may-timso) theo bản thiết kế "Tìm số" (2026-11-12): bàn tối rải 40 số, chạm đúng thứ tự 1 → 40.
// Đua với máy (ai chạm trước ăn số) hoặc một mình bấm giờ (kỷ lục lưu trên máy). Chạy hẳn trong trình duyệt — luật ở
// lib/games/timso.js. Bàn là "vật" nên màu viết cứng (DESIGN.md §2.4); thẻ, nút quanh bàn dùng token.

const KEY = 'timso:best' // kỷ lục một mình (giây)
const ME = '#00B2A9'
const BOT = '#ff7a1a'
const readBest = () => {
  try { const v = Number(localStorage.getItem(KEY)); return v > 0 ? v : null } catch { return null }
}
const mmss = (sec) => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')

export default function TimSoGame() {
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const wide = !useMobile(1024)
  const [mode, setMode] = useState('race')
  const [g, setG] = useState(() => start('race'))
  const [run, setRun] = useState(null) // { t0, end } — đồng hồ ván đang chơi (end khi xong)
  const [now, setNow] = useState(0)
  const [wrong, setWrong] = useState({ n: null, k: 0 })
  const [pop, setPop] = useState(null) // { n, who, k } — số vừa ăn
  const [hintAt, setHintAt] = useState(0) // số đang phát sáng gợi ý
  const [best, setBest] = useState(readBest)
  const [howto, setHowto] = useState(false)
  const playing = run && !g.over

  /** Ghi thế mới; xong ván thì chốt giờ và (một mình) kỷ lục. */
  const commit = (next, who, n) => {
    setG(next)
    setPop((p) => ({ n, who, k: (p?.k || 0) + 1 }))
    if (!next.over) return
    const end = Date.now()
    setRun((r) => ({ ...r, end }))
    if (next.mode === 'solo') {
      const sec = Math.floor((end - run.t0) / 1000)
      if (best == null || sec < best) {
        try { localStorage.setItem(KEY, String(sec)) } catch { /* trình duyệt chặn lưu — bỏ qua */ }
        setBest(sec)
      }
    }
  }

  // Đồng hồ ván.
  useEffect(() => {
    if (!playing) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [playing])
  // Máy đua: tới số mới thì hẹn giờ máy "tìm ra" số đó. Gợi ý: để lâu thì số cần tìm phát sáng.
  // Hẹn giờ đọc thế + hàm ghi mới nhất qua ref (đồng hồ vẽ lại mỗi 250ms — không được làm hẹn giờ chạy lại).
  const latest = useRef(null)
  useEffect(() => { latest.current = { g, commit } })
  useEffect(() => {
    if (!playing) return undefined
    const want = g.next
    const hint = setTimeout(() => setHintAt(want), HINT_MS)
    const bot = g.mode === 'race' ? setTimeout(() => {
      const cur = latest.current
      cur.commit(claim(cur.g, want, 'bot'), 'bot', want)
    }, botDelay()) : null
    return () => { clearTimeout(hint); clearTimeout(bot) }
  }, [playing, g.next, g.mode])

  const begin = () => {
    const s = start(mode)
    setG(s)
    setRun({ t0: Date.now(), end: null })
    setNow(Date.now())
    setPop(null)
    setHintAt(0)
  }
  const press = (n) => {
    if (!playing) return
    const r = tap(g, n)
    if (r.wrong) setWrong((w) => ({ n, k: w.k + 1 }))
    else if (r.s !== g) commit(r.s, 'me', n)
  }

  const sec = run ? Math.max(0, Math.floor(((run.end ?? now) - run.t0) / 1000)) : 0
  const res = outcome(g)
  const race = g.mode === 'race'
  const endTitle = res === 'done' ? t('games.timso.doneIn', { time: mmss(sec) })
    : res === 'win' ? t('games.timso.win', { a: g.me, b: g.bot }) : res === 'lose' ? t('games.timso.lose', { a: g.bot, b: g.me }) : t('games.timso.draw', { a: g.me, b: g.bot })
  const endSub = race ? t('games.timso.foundIn', { n: N, time: mmss(sec) }) : best != null ? t('games.timso.best', { time: mmss(best) }) : ''
  const endC = res === 'lose' ? BOT : ME
  const k = isMobile ? 0.72 : 1 // co chữ số trên điện thoại

  const board = (
    <div data-game-fx style={{
      position: 'relative', height: isMobile ? 470 : 640, borderRadius: 22, overflow: 'hidden', border: '1px solid #22304A',
      background: 'radial-gradient(circle at 50% 0%,rgba(155,225,93,.08),transparent 60%),#0c1426',
    }}>
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(148,163,184,.14) 1px,transparent 1.2px)', backgroundSize: '18px 18px' }} />
      {g.nums.map((o) => {
        const own = g.owner[o.n]
        const isNext = playing && o.n === g.next
        const anim = pop?.n === o.n ? 'tsPop .45s cubic-bezier(.2,1.4,.4,1)'
          : wrong.n === o.n ? `${wrong.k % 2 ? 'tsNoA' : 'tsNoB'} .35s ease-in-out`
            : isNext && hintAt === o.n ? 'tsHint 1s ease-in-out infinite' : undefined
        return (
          <button key={o.n} type="button" onClick={() => press(o.n)} aria-label={t('games.timso.numAria', { n: o.n })} style={{
            position: 'absolute', left: o.x + '%', top: o.y + '%', width: 62 * k, height: 62 * k, transform: 'translate(-50%,-50%)', borderRadius: '50%',
            display: 'grid', placeItems: 'center', padding: 0, border: 0, cursor: playing && !own ? 'pointer' : 'default', opacity: own ? 0.92 : 1,
            background: own === 'me' ? `radial-gradient(circle at 35% 30%,#7ff3e9,${ME})` : own === 'bot' ? `radial-gradient(circle at 35% 30%,#ffc08a,${BOT})` : 'transparent',
            boxShadow: wrong.n === o.n ? '0 0 0 2px #FF9A8F' : 'none', animation: anim, transition: 'background .25s',
          }}>
            <span style={{ display: 'block', rotate: o.rot + 'deg', font: `800 ${Math.round(o.fs * k)}px/1 var(--font-display)`, color: own ? '#06202a' : o.ink, textShadow: '0 1px 2px rgba(0,0,0,.35)' }}>{o.n}</span>
          </button>
        )
      })}
      {!run && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,18,.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center', color: '#E9EFF7' }}>
          <div style={{ font: `800 ${isMobile ? 26 : 34}px/1.2 var(--font-display)` }}>{t('games.timso.title', { n: N })}</div>
          <div style={{ font: '400 15px/1.55 var(--font-sans)', color: '#A8B7CB', maxWidth: 440 }}>{t('games.timso.intro')}</div>
          <div role="radiogroup" aria-label={t('games.timso.mode')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {MODES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => { setMode(m); setG(start(m)) }} style={{
                minHeight: 42, padding: '0 16px', borderRadius: 99, cursor: 'pointer', font: '700 14px/1 var(--font-sans)',
                background: mode === m ? 'rgba(0,178,169,.18)' : 'transparent', color: mode === m ? '#2FCCC3' : '#A8B7CB', border: '1px solid ' + (mode === m ? 'rgba(0,178,169,.5)' : '#22304A'),
              }}>{t('games.timso.modeOpt.' + m)}</button>
            ))}
          </div>
          <button type="button" onClick={begin} style={{ ...btn('primary'), minHeight: 52, padding: '0 34px', fontSize: 17 }}>{t('games.timso.start')}</button>
        </div>
      )}
      {g.over && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,18,.6)' }} />
          <div role="status" style={{
            position: 'absolute', left: '50%', top: '50%', width: 'min(340px, 86%)', padding: 24, borderRadius: 20, textAlign: 'center', color: '#E9EFF7',
            background: 'rgba(12,20,38,.96)', border: '2px solid ' + endC, boxShadow: '0 0 50px ' + endC, transform: 'translate(-50%,-50%)', animation: 'tsIn .45s cubic-bezier(.2,1.4,.4,1) both',
          }}>
            <div style={{ font: '800 30px/1.2 var(--font-display)' }}>{endTitle}</div>
            {endSub && <div style={{ font: '400 14px/1.4 var(--font-sans)', color: '#A8B7CB', marginTop: 6 }}>{endSub}</div>}
            <button type="button" onClick={begin} style={{ ...btn('primary'), marginTop: 16, minHeight: 46, padding: '0 26px', fontSize: 15 }}>{t('games.timso.again')}</button>
          </div>
        </>
      )}
    </div>
  )

  const target = (
    <div style={{ ...card, position: 'relative', padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        flex: 'none', width: 104, height: 104, borderRadius: 26, display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg,#9be15d,#3f8f2b)',
        boxShadow: 'inset 0 -6px 0 rgba(0,0,0,.22),inset 0 2px 0 rgba(255,255,255,.35),0 12px 30px -10px #9be15d',
      }}>
        <span role="status" aria-label={t('games.timso.find')} style={{ font: '800 56px/1 var(--font-display)', color: '#fff', textShadow: '0 2px 3px rgba(0,0,0,.3)' }}>{g.over ? '—' : g.next}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 8 }}>
        <span style={over}>{t('games.timso.find')}</span>
        <span style={{ ...mono, fontSize: 13 }}>{g.next < N ? t('games.timso.nextUp', { n: g.next + 1 }) : t('games.timso.lastOne')}</span>
        <span style={{ font: '700 22px/1 var(--font-mono)' }}>{mmss(sec)}</span>
      </div>
      {pop && (
        <span key={pop.k} aria-hidden="true" style={{
          position: 'absolute', left: 64, top: 6, padding: '3px 10px', borderRadius: 99, background: pop.who === 'me' ? ME : BOT, color: '#fff',
          font: '800 14px/1.2 var(--font-sans)', opacity: 0, animation: 'tsFloat .9s ease-out both',
        }}>{pop.who === 'me' ? '+1' : t('games.timso.botPlus')}</span>
      )}
    </div>
  )
  const progress = (
    <div style={{ ...card, padding: '14px 16px', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={over}>{t('games.timso.progress')}</span><span style={{ ...mono }}>{g.next - 1}/{N}</span></div>
      <div style={{ height: 10, borderRadius: 99, background: G.inset, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: ((g.next - 1) / N) * 100 + '%', borderRadius: 99, background: `linear-gradient(90deg,${ME},#9be15d)`, transition: 'width .3s' }} />
      </div>
    </div>
  )
  const scores = (
    <div style={{ ...card, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
      {[['me', t('games.timso.you'), g.me, ME, '#2FCCC3'], ['bot', t('games.timso.bot'), race ? g.bot : '—', BOT, '#ff9a5a']].map(([who, name, n, ring, ink], j) => (
        <div key={who} style={{
          padding: '14px 16px', display: 'grid', gap: 6, justifyItems: j ? 'end' : 'start', borderRight: j ? 'none' : '1px solid ' + G.line,
          background: pop?.who === who ? (who === 'me' ? 'rgba(0,178,169,.14)' : 'rgba(255,122,26,.14)') : 'transparent', transition: 'background .3s',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: j ? 'row-reverse' : 'row' }}>
            <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: j ? '#2a3550' : '#3b7a7a', color: j ? '#ff9a5a' : '#fff', boxShadow: '0 0 0 2px ' + ring }}>
              <Icon name={j ? 'bot' : 'user'} size={15} />
            </span>
            <span style={{ font: '700 14px/1.2 var(--font-sans)' }}>{name}</span>
          </span>
          <span style={{ font: '800 40px/1 var(--font-display)', color: ink }}>{n}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr)', color: G.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => navigate(pathOf('games'))} style={btn('ghost', { sm: true })}><Icon name="arrow-left" size={15} />{!isMobile && t('games.lobbyShort')}</button>
        <span style={{ font: `800 ${isMobile ? 18 : 24}px/1.2 var(--font-display)` }}>{t('games.timso.name')}</span>
        <span style={{ padding: '4px 10px', borderRadius: 99, background: G.inset, font: '400 12px/1.2 var(--font-sans)', color: G.soft }}>{t('games.timso.modeOpt.' + g.mode)}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setHowto(true)} style={btn('ghost', { sm: true })} aria-label={t('games.howto')}><Icon name="book-open" size={15} />{!isMobile && t('games.howto')}</button>
      </div>
      <div style={{ display: 'grid', gap: 20, alignItems: 'start', gridTemplateColumns: wide ? 'minmax(0, 1fr) 320px' : 'minmax(0, 1fr)' }}>
        {wide ? board : <>{target}{board}</>}
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {wide && target}
          {progress}
          {scores}
          <div style={{ ...card, padding: '14px 16px', display: 'grid', gap: 6 }}>
            <span style={over}>{t('games.timso.tipTitle')}</span>
            <span style={{ font: '400 13px/1.55 var(--font-sans)', color: G.soft }}>{t('games.timso.tip')}</span>
          </div>
        </div>
      </div>
      {howto && <HowTo gameId="timso" onClose={() => setHowto(false)} />}
    </div>
  )
}
