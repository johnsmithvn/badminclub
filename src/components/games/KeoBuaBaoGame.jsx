import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { HowTo } from '#components/games/GameInfo.jsx'
import { G, btn, card, mono, over } from '#components/games/stage.js'
import { BESTS, botPick, needOf, PICKS, play, start } from '#lib/games/keobuabao.js'
import { pathOf } from '#routes'
import { t } from '#i18n'

// Kéo búa bao đấu với máy (/tro-choi/may-keobuabao) theo bản thiết kế "Kéo búa bao" (2026-11-12): hai bàn tay đối mặt,
// chọn tay → hai tay lắc ba nhịp "Kéo… Búa… Bao!" → lật tay, tay thắng nổi lên, tay thua xám đi. Thể thức chạm 2 /
// chạm 3. Chạy hẳn trong trình duyệt — luật + máy ở lib/games/keobuabao.js. Sân là "vật" nên màu viết cứng.

const ME = '#00B2A9'
const BOT = '#ff7a1a'
const BEAT_MS = 420 // một nhịp lắc
const SHOW_MS = 1700 // xem kết quả ván rồi sang ván mới
const CONF = ['#00B2A9', '#F0B75C', '#ff6fa8', '#7cc4ff', '#ffffff', '#9be15d']

/** Bàn tay (bản thiết kế), khung 100 × 110, cổ tay áo màu `sleeve`. */
function Hand({ pick, sleeve, size }) {
  const skin = { fill: '#ffd2a6' }
  return (
    <svg aria-hidden="true" viewBox="0 0 100 110" width={size} height={size ? size * 1.1 : '100%'} style={{ display: 'block', overflow: 'visible' }}>
      <g stroke="#5a3418" strokeWidth="3.6" strokeLinejoin="round" strokeLinecap="round">
        {pick === 'rock' && (
          <>
            <path d="M24 50 Q22 34 36 32 L66 32 Q80 34 79 50 L78 74 Q76 92 54 93 L44 93 Q26 92 25 74 Z" {...skin} />
            <path d="M26 46 Q26 32 34 32 Q42 32 42 46" {...skin} />
            <path d="M40 46 Q40 32 48 32 Q56 32 56 46" {...skin} />
            <path d="M54 46 Q54 32 62 32 Q70 32 70 46" {...skin} />
            <path d="M66 46 Q66 32 74 32 Q82 32 82 46" {...skin} />
            <path d="M30 46 L78 46" strokeWidth="2.6" opacity=".55" />
            <path d="M22 58 Q20 50 30 50 L52 52 Q60 54 58 62 Q56 68 48 67 L30 66 Q22 66 22 58 Z" {...skin} />
            <path d="M34 79 Q52 84 70 76" fill="none" strokeWidth="2.4" opacity=".45" />
          </>
        )}
        {pick === 'paper' && (
          <>
            <path d="M28 58 L28 76 Q30 92 50 93 Q70 92 72 76 L74 54 Z" {...skin} />
            <rect x="28" y="26" width="13" height="38" rx="6.5" {...skin} />
            <rect x="41" y="12" width="13" height="48" rx="6.5" {...skin} />
            <rect x="54" y="14" width="13" height="46" rx="6.5" {...skin} />
            <rect x="66" y="26" width="12" height="36" rx="6" {...skin} />
            <path d="M30 70 Q16 60 14 50 Q13 44 19 44 Q24 44 28 52 L34 62" {...skin} />
            <path d="M28 58 L74 58 L74 76 Q72 92 50 93 Q30 92 28 76 Z" {...skin} stroke="none" />
            <path d="M28 58 L28 76 Q30 92 50 93 Q70 92 72 76 L74 56" fill="none" />
            <path d="M40 74 Q52 80 62 72" fill="none" strokeWidth="2.4" opacity=".45" />
          </>
        )}
        {pick === 'sc' && (
          <>
            <path d="M24 56 Q22 46 34 45 L68 45 Q80 46 79 58 L78 76 Q76 92 54 93 L44 93 Q26 92 25 76 Z" {...skin} />
            <rect x="31" y="10" width="13" height="46" rx="6.5" {...skin} transform="rotate(-14 37 50)" />
            <rect x="49" y="10" width="13" height="46" rx="6.5" {...skin} transform="rotate(12 55 50)" />
            <path d="M52 58 Q52 46 59 46 Q66 46 66 58" {...skin} />
            <path d="M64 58 Q64 46 71 46 Q78 46 78 58" {...skin} />
            <path d="M22 64 Q20 56 30 56 L48 58 Q56 60 54 67 Q52 72 45 71 L30 70 Q22 70 22 64 Z" {...skin} />
            <path d="M36 80 Q52 85 68 78" fill="none" strokeWidth="2.4" opacity=".45" />
          </>
        )}
        <path d="M30 92 L70 92 L72 108 L28 108 Z" fill={sleeve} />
        <path d="M30 99 L70 99" strokeWidth="2.4" opacity=".5" />
      </g>
    </svg>
  )
}

export default function KeoBuaBaoGame() {
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const wide = !useMobile(1024)
  const [s, setS] = useState(() => start(3))
  const [round, setRound] = useState({ phase: 'pick', mine: null, his: null, beat: 0, n: 0 }) // ván đang diễn
  const [howto, setHowto] = useState(false)
  const { phase, mine, his, beat, n } = round
  const last = s.hist[s.hist.length - 1]
  const res = phase === 'show' ? last?.res : null

  // Lắc ba nhịp rồi lật tay; xem kết quả một lúc rồi sang ván mới (chưa xong trận).
  useEffect(() => {
    if (phase === 'shake') {
      const ids = [1, 2].map((k) => setTimeout(() => setRound((r) => ({ ...r, beat: k })), k * BEAT_MS))
      ids.push(setTimeout(() => {
        setS((cur) => play(cur, mine, his))
        setRound((r) => ({ ...r, phase: 'show' }))
      }, 3 * BEAT_MS))
      return () => ids.forEach(clearTimeout)
    }
    if (phase === 'show' && !s.over) {
      const id = setTimeout(() => setRound((r) => ({ ...r, phase: 'pick' })), SHOW_MS)
      return () => clearTimeout(id)
    }
    return undefined
  }, [phase, mine, his, s.over])

  const choose = (p) => {
    if (phase !== 'pick' || s.over) return
    setRound({ phase: 'shake', mine: p, his: botPick(s), beat: 0, n: n + 1 })
  }
  const reset = (best = s.best) => {
    setS(start(best))
    setRound({ phase: 'pick', mine: null, his: null, beat: 0, n })
  }

  const need = needOf(s.best)
  const meWin = res === 'win'
  const botWin = res === 'lose'
  const handAnim = (win, lose, delay) => (phase === 'shake' ? `${n % 2 ? 'kbShakeA' : 'kbShakeB'} ${BEAT_MS / 1000}s ease-in-out 3`
    : phase === 'show' ? (win ? 'kbWin .5s ease-out both' : lose ? 'kbLose .5s ease-out both' : 'kbDraw .4s ease-out')
      : `kbIdle 2.4s ease-in-out ${delay}s infinite`)
  const center = phase === 'shake' ? t('games.keobuabao.beat.' + beat)
    : phase === 'show' ? t(meWin ? 'games.keobuabao.youWinRound' : botWin ? 'games.keobuabao.botWinRound' : 'games.keobuabao.drawRound')
      : s.over ? '' : t('games.keobuabao.round', { n: s.hist.length + 1 })
  const sub = phase === 'show' ? t('games.keobuabao.meets', { a: t('games.keobuabao.pick.' + mine), b: t('games.keobuabao.pick.' + his) })
    : phase === 'shake' ? t('games.keobuabao.go') : t('games.keobuabao.choose')
  const youWon = s.me > s.bot
  const arenaH = isMobile ? 340 : 500
  const handW = isMobile ? 130 : 230

  const hand = (who) => {
    const meSide = who === 'me'
    const win = meSide ? meWin : botWin
    const lose = meSide ? botWin : meWin
    return (
      <div style={{
        position: 'absolute', [meSide ? 'left' : 'right']: '6%', top: '50%', width: handW, height: handW * 1.1, marginTop: -handW * 0.55,
        transform: `rotate(${meSide ? 90 : -90}deg)`,
      }}>
        <span aria-hidden="true" style={{ position: 'absolute', inset: -40, borderRadius: '50%', background: win ? `radial-gradient(circle,${meSide ? 'rgba(0,178,169,.55)' : 'rgba(255,122,26,.55)'},transparent 65%)` : 'transparent' }} />
        <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 100%', animation: handAnim(win, lose, meSide ? 0 : 0.6) }}>
          <Hand pick={phase === 'show' ? (meSide ? mine : his) : 'rock'} sleeve={meSide ? ME : BOT} />
        </div>
      </div>
    )
  }

  const arena = (
    <div data-game-fx style={{
      position: 'relative', height: arenaH, borderRadius: 24, overflow: 'hidden', border: '1px solid #22304A', color: '#E9EFF7',
      background: 'radial-gradient(circle at 50% 50%,rgba(88,80,200,.2),transparent 62%),#0c1426',
    }}>
      <span aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'linear-gradient(transparent,rgba(148,163,184,.35),transparent)' }} />
      <span style={{ position: 'absolute', left: 20, top: 16, display: 'flex', alignItems: 'center', gap: 8, font: '700 14px/1 var(--font-sans)' }}>
        <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: ME }} />{t('games.keobuabao.you')}
      </span>
      <span style={{ position: 'absolute', right: 20, top: 16, display: 'flex', alignItems: 'center', gap: 8, font: '700 14px/1 var(--font-sans)' }}>
        {t('games.keobuabao.bot')}<span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: BOT }} />
      </span>
      {hand('me')}
      {hand('bot')}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none', minWidth: 200 }}>
        {center && (
          <div key={phase + beat} role="status" style={{
            display: 'inline-block', padding: '8px 20px', borderRadius: 99, background: 'rgba(5,8,18,.8)', font: `800 ${isMobile ? 24 : 34}px/1.2 var(--font-display)`,
            color: phase === 'show' ? (meWin ? '#2FCCC3' : botWin ? '#ff9a5a' : '#E9EFF7') : '#E9EFF7',
            animation: phase === 'shake' ? `${beat % 2 ? 'kbWordA' : 'kbWordB'} .42s ease-out` : phase === 'show' ? 'kbWordA .5s cubic-bezier(.2,1.4,.4,1)' : undefined,
          }}>{center}</div>
        )}
        <div style={{ font: '400 14px/1.4 var(--font-sans)', color: '#A8B7CB', marginTop: 8 }}>{sub}</div>
      </div>
      {s.over && (
        <>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', background: 'rgba(5,8,18,.45)' }}>
            {youWon && Array.from({ length: 36 }, (_, i) => (
              <span key={i} style={{
                position: 'absolute', top: -20, left: ((i * 29) % 100) + '%', width: 9, height: 14, borderRadius: 2, background: CONF[i % 6],
                animation: `kbFall ${(2 + (i % 5) * 0.3).toFixed(2)}s linear ${((i * 0.07) % 1.2).toFixed(2)}s infinite`,
              }} />
            ))}
          </div>
          <div style={{
            position: 'absolute', left: '50%', top: '50%', width: 'min(320px, 86%)', padding: 24, borderRadius: 20, textAlign: 'center', transform: 'translate(-50%,-50%)',
            background: 'rgba(12,20,38,.96)', border: '2px solid ' + (youWon ? ME : BOT), boxShadow: '0 0 50px ' + (youWon ? ME : BOT), animation: 'kbIn .45s cubic-bezier(.2,1.4,.4,1) both',
          }}>
            <div style={{ font: '800 32px/1.2 var(--font-display)' }}>{youWon ? t('games.keobuabao.win', { a: s.me, b: s.bot }) : t('games.keobuabao.lose', { a: s.bot, b: s.me })}</div>
            <button type="button" onClick={() => reset()} style={{ ...btn('primary'), marginTop: 14, minHeight: 46, padding: '0 26px', fontSize: 15 }}>{t('games.keobuabao.again')}</button>
          </div>
        </>
      )}
    </div>
  )

  const picks = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: isMobile ? 8 : 14 }}>
      {PICKS.map((p) => {
        const on = phase === 'pick' && !s.over
        const chosen = mine === p && phase !== 'pick'
        return (
          <button key={p} type="button" onClick={() => choose(p)} disabled={!on} aria-label={t('games.keobuabao.pickAria', { name: t('games.keobuabao.pick.' + p) })}
            className="kb-pick" style={{
              ...card, minHeight: isMobile ? 112 : 150, borderRadius: 20, border: '2px solid ' + (chosen ? ME : G.line), cursor: on ? 'pointer' : 'default',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: G.text,
              opacity: on || chosen ? 1 : 0.35, transform: chosen ? 'translateY(-6px)' : 'none', transition: 'transform .2s, opacity .2s, border-color .2s',
            }}>
            <Hand pick={p} sleeve={ME} size={isMobile ? 60 : 84} />
            <span style={{ font: '800 17px/1.2 var(--font-sans)' }}>{t('games.keobuabao.pick.' + p)}</span>
          </button>
        )
      })}
    </div>
  )

  const dots = (k) => Array.from({ length: need }, (_, i) => <span key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: i < k ? '#F0B75C' : G.lineHi }} />)
  const aside = (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ ...card, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        {[['me', t('games.keobuabao.you'), s.me, ME, '#2FCCC3', meWin], ['bot', t('games.keobuabao.bot'), s.bot, BOT, '#ff9a5a', botWin]].map(([who, name, v, ring, ink, on], j) => (
          <div key={who} style={{
            padding: '14px 16px', display: 'grid', gap: 6, justifyItems: j ? 'end' : 'start', borderRight: j ? 'none' : '1px solid ' + G.line,
            background: on ? (j ? 'rgba(255,122,26,.16)' : 'rgba(0,178,169,.16)') : 'transparent', transition: 'background .3s',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: j ? 'row-reverse' : 'row' }}>
              <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: j ? '#2a3550' : '#3b7a7a', color: j ? '#ff9a5a' : '#fff', boxShadow: '0 0 0 2px ' + ring }}>
                <Icon name={j ? 'bot' : 'user'} size={15} />
              </span>
              <span style={{ font: '700 14px/1.2 var(--font-sans)' }}>{name}</span>
            </span>
            <span style={{ font: '800 40px/1 var(--font-display)', color: ink }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ ...card, padding: '14px 16px', display: 'grid', gap: 10 }}>
        <span style={over}>{t('games.keobuabao.format')}</span>
        <div role="radiogroup" aria-label={t('games.keobuabao.format')} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4, padding: 4, borderRadius: 10, background: G.inset }}>
          {BESTS.map((b) => (
            <button key={b} type="button" role="radio" aria-checked={s.best === b} onClick={() => reset(b)} style={{
              minHeight: 36, borderRadius: 7, border: 0, cursor: 'pointer', font: '700 13px/1 var(--font-sans)',
              background: s.best === b ? G.tealA(0.18) : 'transparent', color: s.best === b ? G.tealHi : G.muted,
            }}>{t('games.keobuabao.firstTo', { n: needOf(b) })}</button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', gap: 5 }}>{dots(s.me)}</span>
          <span style={{ font: '400 12px/1.3 var(--font-sans)', color: G.muted, textAlign: 'center' }}>{t('games.keobuabao.dotsHint')}</span>
          <span style={{ display: 'flex', gap: 5 }}>{dots(s.bot)}</span>
        </div>
      </div>
      <div style={{ ...card, padding: '14px 16px', display: 'grid', gap: 6 }}>
        <span style={over}>{t('games.keobuabao.history')}</span>
        {s.hist.slice(-6).map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderTop: '1px solid ' + G.line }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: h.res === 'win' ? ME : h.res === 'lose' ? BOT : G.muted }} />
            <span style={{ ...mono, fontSize: 13 }}>{t('games.keobuabao.histLine', { a: t('games.keobuabao.pick.' + h.mine), b: t('games.keobuabao.pick.' + h.his) })}</span>
          </div>
        ))}
        <span style={{ font: '400 13px/1.4 var(--font-sans)', color: G.muted }}>{t('games.keobuabao.rule')}</span>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr)', color: G.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => navigate(pathOf('games'))} style={btn('ghost', { sm: true })}><Icon name="arrow-left" size={15} />{!isMobile && t('games.lobbyShort')}</button>
        <span style={{ font: `800 ${isMobile ? 18 : 24}px/1.2 var(--font-display)` }}>{t('games.keobuabao.name')}</span>
        <span style={{ padding: '4px 10px', borderRadius: 99, background: G.inset, font: '400 12px/1.2 var(--font-sans)', color: G.soft }}>{t('games.keobuabao.vsBot')}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setHowto(true)} style={btn('ghost', { sm: true })} aria-label={t('games.howto')}><Icon name="book-open" size={15} />{!isMobile && t('games.howto')}</button>
      </div>
      <div style={{ display: 'grid', gap: 20, alignItems: 'start', gridTemplateColumns: wide ? 'minmax(0, 1fr) 320px' : 'minmax(0, 1fr)' }}>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr)' }}>{arena}{picks}</div>
        {aside}
      </div>
      {howto && <HowTo gameId="keobuabao" onClose={() => setHowto(false)} />}
    </div>
  )
}
