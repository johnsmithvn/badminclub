import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '#contexts/AppContext.jsx'
import { isFemalePlayer } from '#lib/rating.js'
import { todayISO } from '#utils/dates.js'
import { t } from '#i18n'
import cfg from '#config/womensDay.js'

/**
 * Sự kiện 20/10 (thiết kế "Sakura Moment"): banner đầu trang chủ cho cả CLB + thiệp popup cho
 * thành viên nữ, tự mở MỘT lần trong ngày. Lời chúc riêng từng người ở src/config/womensDay.json.
 *
 * Xem trước ngoài ngày 20/10: thêm `?sakura` vào URL trang chủ (thiệp của chính mình, bỏ qua
 * giới tính) hoặc `?sakura=<id thành viên>` (thiệp của người đó). Chế độ xem trước không ghi
 * khoá đã-xem, nên không làm mất lần tự mở thật vào đúng ngày.
 *
 * Bảng màu hồng Sakura cố ý nằm ngoài token: thiệp luôn là nền đêm, giống nhau ở cả hai theme.
 */
const SK = {
  pink: '#FF8FBF', pinkSoft: '#FFB3D1', pinkPale: '#FFD3E5', pinkInk: '#FFE3EE', ink: '#2A0A18',
  text: '#E6D6E0', textBanner: '#F3D9E5', sign: '#B79AAE', muted: '#A8B7CB', white: '#FFFFFF',
  line: 'rgba(255,170,205,.32)', lineBtn: 'rgba(255,170,205,.5)', fillBtn: 'rgba(255,143,191,.12)',
  chip: 'rgba(11,18,32,.66)', chipLine: 'rgba(255,255,255,.16)', iconFg: '#E9EFF7', borderGhost: '#2E3E5C',
  banner: 'radial-gradient(120% 150% at 100% 0%, rgba(255,143,191,.28), transparent 58%), linear-gradient(120deg,#131B30 0%,#1D1832 62%,#2A1A3B 100%)',
  thumb: 'radial-gradient(circle at 50% 40%, rgba(255,190,220,.35), rgba(42,26,59,.6) 70%)',
  card: 'linear-gradient(180deg,#1C1631 0%,#121427 55%,#0E1324 100%)',
  head: 'radial-gradient(90% 90% at 70% 20%, rgba(255,180,212,.40), transparent 60%), linear-gradient(160deg,#3A2147,#1C1631)',
  headFade: 'linear-gradient(180deg,transparent,#1C1631)',
  scrim: 'radial-gradient(60% 45% at 50% 42%, rgba(255,120,180,.16), transparent 72%), rgba(5,8,16,.76)',
  cta: 'linear-gradient(180deg,#FFA3CB,#F27AB0)',
  petalA: 'linear-gradient(135deg,#FFE6F0,#FF9EC4)', petalB: 'linear-gradient(135deg,#FFD0E2,#F27AB0)',
}
const EASE = 'cubic-bezier(.2,.8,.2,1)'

/** Số giả ngẫu nhiên theo seed: cánh hoa đứng yên chỗ cũ giữa các lần render. */
function rng(seed) {
  let s = seed % 2147483647 || 1
  return () => ((s = (s * 16807) % 2147483647), (s - 1) / 2147483646)
}

function storageKey(year, memberId) {
  return `badminclub_${year}${cfg.date.replace('-', '')}_sakura_${memberId}`
}

function seen(key) {
  try { return localStorage.getItem(key) !== null } catch { return false }
}

function chime(acRef) {
  try {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return
    acRef.current = acRef.current || new C()
    const ac = acRef.current
    const t0 = ac.currentTime + 0.02
    ;[1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), at = t0 + i * 0.085
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(0.07, at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.1)
      o.connect(g)
      g.connect(ac.destination)
      o.start(at)
      o.stop(at + 1.2)
    })
  } catch {
    // trình duyệt chặn âm thanh — thiệp vẫn chạy bình thường
  }
}

export default function SakuraEvent({ member, isMobile }) {
  const { db } = useApp()
  const [params] = useSearchParams()
  const previewId = params.get('sakura')
  const preview = previewId !== null
  const today = todayISO()
  const target = (previewId && (db.members || []).find((m) => m.id === previewId)) || member
  const club = db.club?.name || ''
  const key = storageKey(today.slice(0, 4), target.id)
  const canCard = preview || isFemalePlayer(target)

  const [rm] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  })
  const [phase, setPhase] = useState(() => (canCard && (preview || !seen(key)) ? 'open' : 'closed'))
  const [rcv, setRcv] = useState(false)
  const [burstN, setBurstN] = useState(0)
  const [sound, setSound] = useState(false)
  const acRef = useRef(null)

  useEffect(() => {
    if (phase === 'burst') {
      const id = setTimeout(() => setPhase('final'), rm ? 150 : 1450)
      return () => clearTimeout(id)
    }
    if (phase === 'closing') {
      const id = setTimeout(() => setPhase('closed'), 280)
      return () => clearTimeout(id)
    }
  }, [phase, rm])

  if (!preview && today.slice(5) !== cfg.date) return null

  const remember = () => {
    if (preview) return
    try { localStorage.setItem(key, '1') } catch { /* storage tắt — mai không còn sự kiện nữa */ }
  }
  const close = () => {
    remember()
    setPhase((p) => (p === 'closing' || p === 'closed' ? p : 'closing'))
  }
  const receive = () => {
    if (phase !== 'open') return
    remember()
    if (sound) chime(acRef)
    setRcv(true)
    setBurstN((n) => n + 1)
    setPhase('burst')
  }
  const reopen = () => {
    setRcv(false)
    setPhase('open')
  }

  const g = cfg.greetings?.[target.id] || {}
  const card = {
    name: g.name || target.name,
    msg: g.msg || t('event2010.msg'),
    final: g.final || t('event2010.final', { club }),
    img: g.img || cfg.image,
    photo: Boolean(g.img),
    date: cfg.date.split('-').reverse().join('.') + '.' + today.slice(0, 4),
    club,
  }

  return (
    <>
      <Banner isMobile={isMobile} club={club} rm={rm} onReopen={canCard ? reopen : null} />
      {phase !== 'closed' && (
        <Card
          isMobile={isMobile}
          rm={rm}
          phase={phase}
          rcv={rcv}
          burstN={burstN}
          sound={sound}
          onSound={() => setSound((s) => !s)}
          onClose={close}
          onReceive={receive}
          {...card}
        />
      )}
    </>
  )
}

/* ============================ BANNER ============================ */

function Banner({ isMobile, club, rm, onReopen }) {
  const reopenBtn = onReopen && (
    <button type="button" onClick={onReopen} style={{
      ...S.btnReset, alignSelf: isMobile ? 'flex-start' : 'center', flexShrink: 0,
      marginTop: isMobile ? 2 : 0, minHeight: 32, padding: isMobile ? '7px 11px' : '11px 16px', borderRadius: 999,
      border: '1px solid ' + SK.lineBtn, background: SK.fillBtn, color: SK.pinkPale,
      font: `600 ${isMobile ? 12 : 13}px/1 var(--font-sans)`,
    }}>
      {t('event2010.reopen')}
    </button>
  )
  return (
    <div style={{ position: 'relative', borderRadius: isMobile ? 16 : 18, overflow: 'hidden', border: '1px solid ' + SK.line, background: SK.banner }}>
      <Petals seed={isMobile ? 11 : 23} count={isMobile ? 8 : 14} fall={isMobile ? 150 : 170} scale={isMobile ? 0.8 : 0.9} durK={0.6} rm={rm} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 24, padding: isMobile ? '14px 14px 14px 16px' : '20px 20px 20px 28px' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: isMobile ? 6 : 8 }}>
          <span style={{ font: `600 ${isMobile ? 10 : 11}px/1 var(--font-mono)`, letterSpacing: '.14em', textTransform: 'uppercase', color: SK.pinkSoft }}>
            {t('event2010.overline')}
          </span>
          <span style={{ font: `700 ${isMobile ? 20 : 30}px/1.1 var(--font-display)`, letterSpacing: '-0.01em', color: SK.white }}>
            {t('event2010.bannerTitle')}
          </span>
          <span style={{ font: `400 ${isMobile ? 12.5 : 14.5}px/1.45 var(--font-sans)`, color: SK.textBanner }}>
            {t('event2010.bannerText', { club })}
          </span>
          {isMobile && reopenBtn}
        </div>
        {!isMobile && reopenBtn}
        <div style={{
          position: 'relative', flexShrink: 0, width: isMobile ? 84 : 220, height: isMobile ? 84 : 112, borderRadius: 14,
          overflow: 'hidden', background: SK.thumb, border: '1px solid ' + SK.line, display: 'grid', placeItems: 'center',
        }}>
          <Flower size={isMobile ? 46 : 60} rm />
          <img src={cfg.bannerImage} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>
    </div>
  )
}

/* ============================ THIỆP ============================ */

function Card({ isMobile, rm, phase, rcv, burstN, sound, onSound, onClose, onReceive, name, msg, final, img, photo, date, club }) {
  const m = isMobile
  const front = phase === 'open'
  const back = phase === 'final' || (phase === 'closing' && rcv)
  const closing = phase === 'closing'
  const headH = m ? 196 : 236
  const face = (on, slow) => ({
    gridArea: '1 / 1', minWidth: 0, display: 'flex', flexDirection: 'column',
    transition: slow ? `opacity .45s ease, transform .45s ${EASE}` : 'opacity .25s ease, transform .25s ease',
    opacity: on ? 1 : 0, pointerEvents: on ? 'auto' : 'none',
  })
  const ctaBtn = (
    <button type="button" onClick={onReceive} style={{
      ...S.btnReset, flex: 1, height: 48, borderRadius: 14, background: SK.cta, color: SK.ink,
      boxShadow: '0 8px 24px rgba(242,122,176,.35), inset 0 1px 0 rgba(255,255,255,.4)', font: '600 15px/1 var(--font-sans)',
    }}>
      {t('event2010.receive')}
    </button>
  )

  return (
    <div role="dialog" aria-modal="true" aria-label={t('event2010.cardTitle')} style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex',
      padding: m ? 16 : 24, overflowY: 'auto', background: SK.scrim, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      animation: rm ? 'none' : closing ? 'skFadeOut .28s ease both' : 'skFade .3s ease both',
    }}>
      <Petals seed={m ? 7 : 13} count={m ? 18 : 29} fall={m ? 880 : 840} scale={m ? 1 : 1.15} rm={rm} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: m ? 342 : 460, margin: 'auto', borderRadius: m ? 24 : 26,
        background: SK.card, border: '1px solid rgba(255,170,205,.30)',
        boxShadow: '0 30px 80px rgba(0,0,0,.6), 0 0 70px rgba(255,120,180,.18)',
        animation: rm ? 'none' : closing ? 'skOut .28s ease-in both' : `skPop .45s ${EASE} both`,
      }}>
        <div style={{ position: 'relative', height: headH, borderRadius: `${m ? 24 : 26}px ${m ? 24 : 26}px 0 0`, overflow: 'hidden', background: SK.head }}>
          <img src={img} alt="" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: photo ? '50% 30%' : '50% 22%', mixBlendMode: photo ? 'normal' : 'lighten',
          }} />
          <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: m ? 70 : 80, background: SK.headFade, pointerEvents: 'none' }} />
          <span style={{
            position: 'absolute', left: m ? 18 : 26, bottom: m ? 12 : 14, padding: '6px 10px', borderRadius: 999, background: SK.pink,
            font: '600 11px/1 var(--font-mono)', letterSpacing: '.08em', color: SK.ink, pointerEvents: 'none',
          }}>
            {date}
          </span>
        </div>
        <button type="button" onClick={onSound} aria-pressed={sound} style={{
          ...S.btnReset, position: 'absolute', top: 8, left: 8, zIndex: 2, height: 44, padding: '0 4px',
        }}>
          <span style={{ ...S.chip, padding: '0 11px', color: sound ? SK.pinkPale : SK.muted, font: '500 12px/1 var(--font-sans)' }}>
            {t(sound ? 'event2010.soundOn' : 'event2010.soundOff')}
          </span>
        </button>
        <button type="button" onClick={onClose} aria-label={t('event2010.close')} style={{
          ...S.btnReset, position: 'absolute', top: 8, right: 8, zIndex: 2, width: 44, height: 44,
        }}>
          <span style={{ ...S.chip, width: 32, justifyContent: 'center', color: SK.iconFg, font: '500 17px/1 var(--font-sans)' }}>×</span>
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {/* Mặt trước: lời chúc riêng */}
          <div style={{ ...face(front), padding: m ? '16px 20px 18px' : '18px 28px 24px', gap: m ? 12 : 14, transform: front ? 'none' : 'scale(.97)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={S.overline(m)}>{t('event2010.cardOverline')}</span>
              <span style={S.title(m)}>{t('event2010.cardTitle')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, font: `400 ${m ? 14 : 15}px/1.6 var(--font-sans)`, color: SK.text }}>
              <span style={{ fontWeight: 600, color: SK.pinkInk }}>{t('event2010.dear', { name })}</span>
              <span>{msg}</span>
            </div>
            <span style={S.sign}>{club}</span>
            {m ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 4 }}>
                {ctaBtn}
                <button type="button" onClick={onClose} style={{ ...S.btnReset, height: 44, color: SK.muted, font: '500 13.5px/1 var(--font-sans)' }}>
                  {t('event2010.close')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, paddingTop: 6 }}>
                <button type="button" onClick={onClose} style={{
                  ...S.btnReset, flexShrink: 0, height: 48, padding: '0 20px', borderRadius: 14, border: '1px solid ' + SK.borderGhost,
                  color: SK.muted, font: '500 14px/1 var(--font-sans)', whiteSpace: 'nowrap',
                }}>
                  {t('event2010.close')}
                </button>
                {ctaBtn}
              </div>
            )}
          </div>

          {/* Mặt sau: hiện ra sau Sakura Burst */}
          <div style={{
            ...face(back, true), alignItems: 'center', textAlign: 'center', padding: m ? '18px 20px' : '22px 28px 24px', gap: m ? 10 : 12,
            transform: back ? 'none' : 'translateY(10px)',
          }}>
            <span style={{ width: m ? 72 : 80, height: m ? 72 : 80, flexShrink: 0 }} />
            <span style={{ ...S.overline(m), paddingTop: 4 }}>{t('event2010.openedOverline')}</span>
            <span style={S.title(m)}>{t('event2010.finalTitle', { name })}</span>
            <span style={{ font: `400 ${m ? 14 : 15}px/1.6 var(--font-sans)`, color: SK.text, maxWidth: m ? 280 : 340 }}>{final}</span>
            <span style={S.sign}>{club} · {date}</span>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={onClose} style={{
              ...S.btnReset, alignSelf: 'stretch', height: 48, borderRadius: 14, border: '1px solid ' + SK.lineBtn,
              background: 'rgba(255,143,191,.14)', color: SK.pinkInk, font: '600 15px/1 var(--font-sans)',
            }}>
              {t('event2010.close')}
            </button>
          </div>
        </div>

        {rcv && phase !== 'open' && (
          <Burst key={burstN} seed={burstN} top={m ? 250 : 298} size={m ? 72 : 80} rm={rm} />
        )}
      </div>
    </div>
  )
}

/* ============================ HIỆU ỨNG ============================ */

/** Cánh hoa rơi chậm + đốm sáng. CSS thuần; giảm chuyển động thì cánh đứng yên rải khắp khung. */
function Petals({ seed, count, fall, scale = 1, durK = 1, rm }) {
  const kids = useMemo(() => {
    const r = rng(seed * 977 + count * 31 + fall)
    const out = []
    for (let i = 0; i < count; i++) {
      const size = (9 + r() * 9) * scale, dur = (7 + r() * 7) * durK, delay = -r() * dur, left = r() * 100
      const pink = r() > 0.5, drift = r() * 120 - 40, rot = r() * 540 + 180, top = r() * 90
      out.push(<span key={'p' + i} style={{
        position: 'absolute', left: left + '%', top: rm ? top + '%' : -20, width: size, height: size * 0.78,
        borderRadius: '150% 0 150% 0', opacity: rm ? 0.7 : 0.92, background: pink ? SK.petalA : SK.petalB,
        boxShadow: '0 0 8px rgba(255,160,200,.45)', '--drift': drift + 'px', '--rot': rot + 'deg', '--fall': fall + 'px',
        animation: rm ? 'none' : `skFall ${dur.toFixed(2)}s linear ${delay.toFixed(2)}s infinite`,
        transform: rm ? `rotate(${rot}deg)` : undefined,
      }} />)
    }
    for (let i = 0; i < Math.round(count / 2); i++) {
      const s = 2 + r() * 2.5, d = 2.4 + r() * 2.6
      out.push(<span key={'s' + i} style={{
        position: 'absolute', left: r() * 100 + '%', top: r() * 100 + '%', width: s, height: s, borderRadius: '50%',
        background: '#FFF4F8', boxShadow: '0 0 6px 1px rgba(255,200,225,.8)', opacity: 0.6,
        animation: rm ? 'none' : `skTwinkle ${d.toFixed(2)}s ease-in-out ${(-r() * d).toFixed(2)}s infinite`,
      }} />)
    }
    return out
  }, [seed, count, fall, scale, durK, rm])
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>{kids}</div>
}

/** Bông anh đào 5 cánh. `rm` = đứng yên (giảm chuyển động hoặc làm ảnh giữ chỗ trên banner). */
function Flower({ size, rm }) {
  const gid = 'skf' + useId().replace(/[^\w-]/g, '')
  const bloom = (i) => ({ transformOrigin: '0 0', animation: rm ? 'none' : `skBloom .55s cubic-bezier(.2,1.2,.4,1) ${(0.9 + i * 0.07).toFixed(2)}s both` })
  return (
    <svg viewBox="-34 -34 68 68" width={size} height={size} style={{
      display: 'block', overflow: 'visible',
      filter: 'drop-shadow(0 0 8px rgba(255,150,200,.85)) drop-shadow(0 0 24px rgba(255,110,170,.55))',
    }}>
      <defs>
        <radialGradient id={gid} cx="0" cy="0" r="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E8558F" />
          <stop offset=".45" stopColor="#FF9EC4" />
          <stop offset="1" stopColor="#FFF0F6" />
        </radialGradient>
      </defs>
      <g style={{ transformOrigin: '0 0', animation: rm ? 'none' : 'skSpin 24s linear 1.6s infinite' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`rotate(${i * 72})`}>
            <path d="M0 -2 C -10 -8 -13 -22 -6 -30 L 0 -25.5 L 6 -30 C 13 -22 10 -8 0 -2 Z" fill={`url(#${gid})`}
              stroke="rgba(255,240,246,.75)" strokeWidth={0.6} style={bloom(i)} />
            <path d="M0 -5 L0 -19" stroke="rgba(232,85,143,.4)" strokeWidth={0.7} strokeLinecap="round" style={bloom(i)} />
          </g>
        ))}
        <g style={{ transformOrigin: '0 0', animation: rm ? 'none' : 'skHeart .45s cubic-bezier(.2,1.4,.4,1) 1.25s both' }}>
          {Array.from({ length: 10 }, (_, i) => {
            const a = ((i * 36 + 18) * Math.PI) / 180, x = Math.sin(a) * 9, y = -Math.cos(a) * 9
            return (
              <g key={i}>
                <line x1={0} y1={0} x2={x} y2={y} stroke="#F7B0CF" strokeWidth={0.7} />
                <circle cx={x} cy={y} r={1.3} fill="#FFD66B" />
              </g>
            )
          })}
          <circle cx={0} cy={0} r={4} fill="#FFE7A3" />
        </g>
      </g>
    </svg>
  )
}

/** Sakura Burst 1,5 giây: vòng cánh hoa bung, ánh sáng hội tụ, rồi một bông anh đào nở ra. */
function Burst({ seed, top, size, rm }) {
  const kids = useMemo(() => {
    if (rm) return []
    const r = rng(seed * 131 + top)
    const out = []
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + (r() - 0.5) * 0.25, dist = 130 + r() * 70, s = 9 + r() * 8
      out.push(<span key={'p' + i} style={{
        position: 'absolute', left: -s / 2, top: -s / 2, width: s, height: s * 0.78, borderRadius: '150% 0 150% 0',
        background: r() > 0.5 ? SK.petalA : SK.petalB, boxShadow: '0 0 10px rgba(255,160,200,.6)',
        '--dx': (Math.cos(a) * dist).toFixed(1) + 'px', '--dy': (Math.sin(a) * dist).toFixed(1) + 'px', '--rot': (r() * 720 - 360).toFixed(0) + 'deg',
        animation: `skBurst ${(0.95 + r() * 0.35).toFixed(2)}s cubic-bezier(.12,.75,.3,1) ${(r() * 0.06).toFixed(2)}s both`,
      }} />)
    }
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2, dist = 110 + r() * 70, s = 4 + r() * 3
      out.push(<span key={'m' + i} style={{
        position: 'absolute', left: -s / 2, top: -s / 2, width: s, height: s, borderRadius: '50%',
        background: '#FFF4F8', boxShadow: '0 0 8px 2px rgba(255,190,220,.9)',
        '--sx': (Math.cos(a) * dist).toFixed(1) + 'px', '--sy': (Math.sin(a) * dist).toFixed(1) + 'px',
        animation: `skConverge .62s cubic-bezier(.55,0,.8,.4) ${(0.32 + r() * 0.24).toFixed(2)}s both`,
      }} />)
    }
    out.push(<span key="ring" style={{
      position: 'absolute', left: 0, top: 0, width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(255,205,228,.95)',
      boxShadow: '0 0 18px rgba(255,140,190,.75), inset 0 0 12px rgba(255,170,210,.6)', animation: 'skRing .85s cubic-bezier(.2,.7,.3,1) both',
    }} />)
    return out
  }, [seed, top, rm])

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3, borderRadius: 'inherit' }}>
      {!rm && (
        <span style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', animation: 'skFlash 1s ease-out both',
          background: `radial-gradient(260px 220px at 50% ${top}px, rgba(255,190,220,.42), rgba(255,190,220,0) 70%)`,
        }} />
      )}
      <div style={{ position: 'absolute', left: '50%', top, width: 0, height: 0 }}>
        {kids}
        <span style={{
          position: 'absolute', left: 0, top: 0, width: size * 1.9, height: size * 1.9, borderRadius: '50%', transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(circle, rgba(255,150,200,.55), rgba(255,150,200,0) 66%)',
          animation: rm ? 'none' : 'skFade .35s ease .9s both, skHalo 2.6s ease-in-out 1.4s infinite',
        }} />
        <span style={{
          position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size,
          animation: rm ? 'none' : 'skFloat 3s ease-in-out 1.6s infinite',
        }}>
          <Flower size={size} rm={rm} />
        </span>
      </div>
    </div>
  )
}

const S = {
  btnReset: {
    appearance: 'none', border: 0, margin: 0, padding: 0, background: 'transparent', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none',
  },
  chip: {
    height: 30, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 999,
    background: SK.chip, border: '1px solid ' + SK.chipLine, whiteSpace: 'nowrap',
  },
  overline: (m) => ({ font: `600 ${m ? 10.5 : 11}px/1 var(--font-mono)`, letterSpacing: '.14em', textTransform: 'uppercase', color: SK.pinkSoft }),
  title: (m) => ({ font: `700 ${m ? 26 : 32}px/1.08 var(--font-display)`, letterSpacing: '-0.015em', color: SK.white }),
  sign: { font: '400 12px/1 var(--font-mono)', color: SK.sign },
}
