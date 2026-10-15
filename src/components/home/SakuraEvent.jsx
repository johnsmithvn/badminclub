import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '#contexts/AppContext.jsx'
import { isFemalePlayer } from '#lib/rating.js'
import { greetingSegs, parseGreeting } from '#lib/sakura.js'
import { todayISO } from '#utils/dates.js'
import { t } from '#i18n'
import cfg from '#config/womensDay.js'

/**
 * Sự kiện 20/10 (thiết kế "Sakura Moment"): banner đầu trang chủ cho cả CLB + thiệp popup.
 * - Thành viên nữ: thiệp tự mở MỘT lần trong ngày, banner có nút "Xem lại thiệp".
 * - Người khác: không tự mở; bấm "Xem thiệp" trên banner → popup troll → "Vẫn xem" → màn nạp
 *   năng lượng → thiệp troll. Luồng này không ghi khoá đã-xem.
 * Lời chúc riêng từng người ở src/config/womensDay.json, dàn chữ bởi #lib/sakura.js.
 *
 * Xem trước ngoài ngày 20/10: thêm `?sakura` vào URL trang chủ (với tư cách chính mình) hoặc
 * `?sakura=<id thành viên>` (với tư cách người đó). Xem trước không ghi khoá đã-xem, nên không làm
 * mất lần tự mở thật vào đúng ngày.
 *
 * Bảng màu Sakura cố ý nằm ngoài token: banner nền đêm, thiệp nền giấy hồng, giống nhau ở cả hai theme.
 */
const SK = {
  // banner (nền đêm)
  pink: '#FF8FBF', pinkSoft: '#FFB3D1', ink: '#2A0A18', textBanner: '#F3D9E5', white: '#FFFFFF',
  line: 'rgba(255,170,205,.32)',
  banner: 'radial-gradient(120% 150% at 100% 0%, rgba(255,143,191,.28), transparent 58%), linear-gradient(120deg,#131B30 0%,#1D1832 62%,#2A1A3B 100%)',
  thumb: 'radial-gradient(circle at 50% 40%, rgba(255,190,220,.35), rgba(42,26,59,.6) 70%)',
  bannerBtn: 'linear-gradient(180deg,#FFB3D3,#F27AB0)',
  // thiệp (nền giấy)
  paper: '#FFFBFC', title: '#2E0F22', body: '#4A3442', soft: '#8A5A73', deep: '#8A1F52', rose: '#C2306F',
  paperLine: 'rgba(232,85,143,.22)', chip: '#FFF1F6', chipLine: 'rgba(232,85,143,.25)', hl: '#FFE6EF',
  box: 'linear-gradient(135deg,#FFF4F8,#FFE2ED)', boxLine: 'rgba(232,85,143,.24)', footLine: 'rgba(232,85,143,.14)',
  fade: 'linear-gradient(180deg,rgba(255,251,252,0),#FFFBFC)', shadow: '0 24px 60px rgba(122,30,72,.22)',
  scrim: 'radial-gradient(70% 50% at 50% 42%, rgba(255,170,205,.45), transparent 75%), rgba(255,243,248,.74)',
  cta: 'linear-gradient(180deg,#FFA3CB,#F27AB0)', ctaShadow: '0 8px 20px rgba(242,122,176,.32), inset 0 1px 0 rgba(255,255,255,.45)',
  ghost: '#FFEDF4', ghostLine: 'rgba(232,85,143,.4)',
}
const EASE = 'cubic-bezier(.2,.8,.2,1)'
const TROLL_ICONS = ['🤨', '😏', '🙄', '🤡', '🫵']

/** Số giả ngẫu nhiên theo seed: hiệu ứng đứng yên chỗ cũ giữa các lần render. */
function rng(seed) {
  let s = seed % 2147483647 || 1
  return () => ((s = (s * 16807) % 2147483647), (s - 1) / 2147483646)
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

/** % nạp năng lượng theo thời gian (k = 0 → 1): vọt nhanh tới 92 rồi nhích chậm cho hồi hộp. */
const chargePct = (k) => (k >= 1 ? 100 : k < 0.6 ? Math.round((k / 0.6) * 92) : Math.min(99, 92 + Math.floor(((k - 0.6) / 0.4) * 8)))

export default function SakuraEvent({ member, isMobile }) {
  const { db } = useApp()
  const [params] = useSearchParams()
  const previewId = params.get('sakura')
  const preview = previewId !== null
  const today = todayISO()
  const target = (previewId && (db.members || []).find((m) => m.id === previewId)) || member
  const club = db.club?.name || ''
  const key = `badminclub_${today.slice(0, 4)}${cfg.date.replace('-', '')}_sakura_${target.id}`
  const female = isFemalePlayer(target)

  const [rm] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  })
  const [phase, setPhase] = useState(() => (female && (preview || !seen(key)) ? 'open' : 'closed'))
  const [rcv, setRcv] = useState(false)
  const [burstN, setBurstN] = useState(0)
  const [trollCard, setTrollCard] = useState(false)
  const [trollN, setTrollN] = useState(0)
  const [trollOpen, setTrollOpen] = useState(false)
  const [charge, setCharge] = useState(null)
  const acRef = useRef(null)
  const chargeN = charge?.n

  useEffect(() => {
    if (phase === 'burst') {
      const id = setTimeout(() => setPhase('final'), rm ? 150 : 1450)
      return () => clearTimeout(id)
    }
    if (phase === 'closing') {
      const id = setTimeout(() => { setPhase('closed'); setTrollCard(false) }, 280)
      return () => clearTimeout(id)
    }
  }, [phase, rm])

  // Màn nạp năng lượng: chạy 1,9 giây, dừng ở 100% một nhịp rồi lật ra thiệp troll.
  useEffect(() => {
    if (!chargeN) return
    const t0 = Date.now()
    const id = setInterval(() => {
      const k = (Date.now() - t0) / 1900
      if (k < 1.16) return setCharge({ n: chargeN, pct: chargePct(k) })
      clearInterval(id)
      setCharge(null)
      setTrollCard(true)
      setRcv(false)
      setPhase('open')
    }, 50)
    return () => clearInterval(id)
  }, [chargeN])

  if (!preview && today.slice(5) !== cfg.date) return null

  const remember = () => {
    if (preview || trollCard) return
    try { localStorage.setItem(key, '1') } catch { /* storage tắt — mai không còn sự kiện nữa */ }
  }
  const close = () => {
    remember()
    setPhase((p) => (p === 'closing' || p === 'closed' ? p : 'closing'))
  }
  const receive = () => {
    if (phase !== 'open') return
    remember()
    // Chuông luôn kêu: chỉ chạy lúc bấm "Nhận lời chúc" — có cú bấm nên trình duyệt không chặn.
    chime(acRef)
    setRcv(true)
    setBurstN((n) => n + 1)
    setPhase('burst')
  }
  const onBanner = () => {
    if (!female) {
      setTrollN((n) => n + 1)
      setTrollOpen(true)
      return
    }
    setTrollCard(false)
    setRcv(false)
    setPhase('open')
  }
  const peek = () => {
    setTrollOpen(false)
    if (!rm) return setCharge((c) => ({ n: (c?.n || 0) + 1, pct: 0 }))
    setTrollCard(true)
    setRcv(false)
    setPhase('open')
  }

  const g = cfg.greetings?.[target.id] || {}
  const name = g.name || target.name
  const card = trollCard
    ? { name: t('event2010.trollName'), msg: parseGreeting(t('event2010.trollMsg'), null), final: [] }
    : {
      name,
      msg: parseGreeting(g.msg || t('event2010.msg'), name),
      final: greetingSegs(g.final || t('event2010.final', { club }), null),
    }

  return (
    <>
      <Banner isMobile={isMobile} club={club} rm={rm} label={t(female ? 'event2010.reopen' : 'event2010.view')} onTap={onBanner} />
      {phase !== 'closed' && (
        <Card
          key={trollCard ? 'troll' : 'card'}
          isMobile={isMobile}
          rm={rm}
          phase={phase}
          rcv={rcv}
          burstN={burstN}
          troll={trollCard}
          recipient={g.realName || name}
          date={cfg.date.split('-').reverse().join('.') + '.' + today.slice(0, 4)}
          club={club}
          onClose={close}
          onReceive={receive}
          {...card}
        />
      )}
      {trollOpen && (
        <TrollPopup isMobile={isMobile} rm={rm} n={trollN} onPeek={peek} onClose={() => setTrollOpen(false)} />
      )}
      {charge && <Charging isMobile={isMobile} n={charge.n} pct={charge.pct} />}
    </>
  )
}

/* ============================ BANNER ============================ */

function Banner({ isMobile, club, rm, label, onTap }) {
  const m = isMobile
  const btn = (
    <button type="button" onClick={onTap} style={{
      ...S.btnReset, position: 'relative', flexShrink: 0, alignSelf: m ? 'flex-start' : 'center', marginTop: m ? 4 : 0,
      padding: m ? '9px 14px' : '12px 18px', borderRadius: 999, background: SK.bannerBtn, color: SK.ink,
      font: `600 ${m ? 12.5 : 14}px/1 var(--font-sans)`, whiteSpace: 'nowrap',
    }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: '0 0 16px rgba(255,143,191,.55)', animation: rm ? 'none' : 'skGlow 2.2s ease-out infinite' }} />
      {!rm && (
        <span style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none' }}>
          <span style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%', animation: 'skShine 2.8s ease-in-out infinite',
            background: 'linear-gradient(100deg, rgba(255,255,255,0), rgba(255,255,255,.75), rgba(255,255,255,0))',
          }} />
        </span>
      )}
      <span style={{ position: 'relative' }}>{label}</span>
    </button>
  )
  return (
    <div style={{ position: 'relative', borderRadius: m ? 16 : 18, overflow: 'hidden', border: '1px solid ' + SK.line, background: SK.banner }}>
      <Petals seed={m ? 11 : 23} count={m ? 8 : 14} fall={m ? 150 : 170} scale={m ? 0.8 : 0.9} durK={0.6} rm={rm} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: m ? 12 : 24, padding: m ? '14px 14px 14px 16px' : '20px 20px 20px 28px' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: m ? 6 : 8 }}>
          <span style={{ font: `600 ${m ? 10 : 11}px/1 var(--font-mono)`, letterSpacing: '.14em', textTransform: 'uppercase', color: SK.pinkSoft }}>
            {t('event2010.overline')}
          </span>
          <span style={{ font: `700 ${m ? 20 : 30}px/1.1 var(--font-display)`, letterSpacing: '-0.01em', color: SK.white }}>
            {t('event2010.bannerTitle')}
          </span>
          <span style={{ font: `400 ${m ? 12.5 : 14.5}px/1.45 var(--font-sans)`, color: SK.textBanner }}>
            {t('event2010.bannerText', { club })}
          </span>
          {m && btn}
        </div>
        {!m && btn}
        <div style={{
          position: 'relative', flexShrink: 0, width: m ? 84 : 220, height: m ? 84 : 112, borderRadius: 14,
          overflow: 'hidden', background: SK.thumb, border: '1px solid ' + SK.line, display: 'grid', placeItems: 'center',
        }}>
          <Flower size={m ? 46 : 60} rm />
          <img src={cfg.bannerImage} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>
    </div>
  )
}

/* ============================ THIỆP ============================ */

/** Đoạn chữ đã tách: cụm ** tô nền, cụm !! gạch sóng như lỗi chính tả, tên in đậm. */
const SEG_STYLE = {
  hl: { fontWeight: 600, color: SK.title, background: SK.hl, padding: '1px 4px', borderRadius: 5, WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone' },
  odd: { fontWeight: 700, color: SK.rose, letterSpacing: '.04em', textDecoration: 'underline wavy #E8558F', textDecorationThickness: 1.5, textUnderlineOffset: 4 },
  name: { fontWeight: 700 },
}
function Segs({ segs }) {
  return segs.map((s, i) => <span key={i} style={SEG_STYLE[s.kind]}>{s.t}</span>)
}

function Card({ isMobile, rm, phase, rcv, burstN, troll, recipient, date, club, onClose, onReceive, name, msg, final }) {
  const m = isMobile
  const front = phase === 'open'
  const back = !troll && (phase === 'final' || (phase === 'closing' && rcv))
  const closing = phase === 'closing'
  const [cardH, setCardH] = useState(null)
  const [ov, setOv] = useState(false)
  const cardRef = useRef(null)
  const scrollRef = useRef(null)
  const finalRef = useRef(null)
  const footRef = useRef(null)

  // Lời chúc dài hơn khung → hiện dải mờ ở đáy để báo còn chữ bên dưới.
  const checkOv = () => {
    const el = scrollRef.current
    setOv(!!el && el.scrollHeight - el.clientHeight - el.scrollTop > 4)
  }
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setOv(el.scrollHeight - el.clientHeight - el.scrollTop > 4))
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [])

  // Nhận lời chúc: khoá chiều cao hiện tại rồi co/giãn mượt về đúng cỡ mặt sau.
  const receive = () => {
    const c = cardRef.current, sc = scrollRef.current, fv = finalRef.current, ft = footRef.current
    if (sc) sc.scrollTop = 0
    if (c && sc && fv) {
      const h = c.offsetHeight
      const target = h - sc.offsetHeight - (ft ? ft.offsetHeight : 0) + fv.offsetHeight
      setCardH(h)
      requestAnimationFrame(() => requestAnimationFrame(() => setCardH(target)))
    }
    onReceive()
  }

  const face = (on, slow) => ({
    gridArea: '1 / 1', minWidth: 0, display: 'flex', flexDirection: 'column',
    transition: slow ? `opacity .45s ease, transform .45s ${EASE}` : 'opacity .25s ease, transform .25s ease',
    opacity: on ? 1 : 0, pointerEvents: on ? 'auto' : 'none',
  })

  return (
    <div role="dialog" aria-modal="true" aria-label={t('event2010.cardTitle')} style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: m ? 16 : 32, background: SK.scrim, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      animation: rm ? 'none' : closing ? 'skFadeOut .28s ease both' : 'skFade .3s ease both',
    }}>
      <Petals seed={m ? 7 : 13} count={m ? 18 : 29} fall={900} scale={m ? 1 : 1.15} rm={rm} light />
      <div ref={cardRef} style={{
        position: 'relative', width: '100%', maxWidth: m ? 342 : 460, maxHeight: '100%',
        height: cardH != null && !front ? cardH : 'auto', transition: `height .4s ${EASE}`,
        display: 'flex', flexDirection: 'column', borderRadius: m ? 24 : 26,
        background: SK.paper, border: '1px solid ' + SK.paperLine, boxShadow: SK.shadow,
        animation: rm ? 'none' : closing ? 'skOut .28s ease-in both' : troll ? 'skSlam .55s cubic-bezier(.2,.9,.3,1) both' : `skPop .45s ${EASE} both`,
      }}>
        <div style={{ flexShrink: 0, height: m ? 52 : 58, display: 'flex', alignItems: 'center', gap: m ? 8 : 10, padding: m ? '8px 8px 0 16px' : '12px 12px 0 26px' }}>
          {troll && <Stickers isMobile={m} rm={rm} />}
          <span style={{ padding: '6px 10px', borderRadius: 999, background: SK.pink, font: '600 11px/1 var(--font-mono)', letterSpacing: '.08em', color: SK.ink }}>
            {date}
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label={t('event2010.close')} style={{
          ...S.btnReset, position: 'absolute', top: m ? 8 : 12, right: m ? 8 : 12, zIndex: 4, width: 44, height: 44,
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: 999, background: SK.chip, border: '1px solid ' + SK.chipLine,
            display: 'grid', placeItems: 'center', font: '500 16px/1 var(--font-sans)', color: SK.deep,
          }}>×</span>
        </button>

        <div ref={scrollRef} onScroll={checkOv} style={{
          flex: '1 1 auto', minHeight: 0, overflowY: front ? 'auto' : 'hidden', overscrollBehavior: 'contain', scrollbarWidth: 'none',
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)',
        }}>
          {/* Mặt trước: lời chúc */}
          <div style={{ ...face(front), padding: m ? '8px 20px 18px' : '10px 28px 20px', gap: m ? 14 : 16, transform: front ? 'none' : 'scale(.97)' }}>
            <span style={S.title(m)}>{t('event2010.cardTitle')}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ font: `600 ${m ? 13.5 : 14.5}px/1.3 var(--font-sans)`, color: SK.soft }}>{t('event2010.dear', { name })}</span>
              <span style={{ font: `600 ${m ? 19 : 22}px/1.3 var(--font-display)`, letterSpacing: '-0.005em', color: SK.title }}>
                <Segs segs={msg.lead} />
              </span>
              {msg.body.map((p, i) => (
                <span key={i} style={{ font: `400 ${m ? 14 : 15}px/1.65 var(--font-sans)`, color: SK.body }}><Segs segs={p} /></span>
              ))}
              {msg.close && (
                <div style={{
                  position: 'relative', margin: '8px 0 6px', padding: m ? '20px 20px 18px 28px' : '22px 24px 20px 30px', borderRadius: 16,
                  background: SK.box, border: '1px solid ' + SK.boxLine, font: `500 ${m ? 14.5 : 15.5}px/1.55 var(--font-sans)`, color: SK.deep,
                }}>
                  <Vine rm={rm} />
                  <span style={{ position: 'relative' }}><Segs segs={msg.close} /></span>
                </div>
              )}
              <span style={{ ...S.sign, alignSelf: 'flex-end' }}>— {club}</span>
            </div>
          </div>

          {/* Mặt sau: hiện ra sau Sakura Burst. Ẩn thì nằm tuyệt đối để không đội chiều cao thiệp. */}
          {!troll && (
            <div ref={finalRef} style={{
              ...face(back, true), alignSelf: 'start', position: phase === 'burst' || back ? 'relative' : 'absolute', top: 0, left: 0, right: 0,
              alignItems: 'center', textAlign: 'center', padding: m ? '16px 20px 18px' : '20px 28px 20px', gap: m ? 12 : 14,
              transform: back ? 'none' : 'translateY(10px)',
            }}>
              <span style={{ width: m ? 72 : 80, height: m ? 72 : 80, flexShrink: 0 }} />
              <span style={{ font: `600 ${m ? 10.5 : 11}px/1 var(--font-mono)`, letterSpacing: '.14em', textTransform: 'uppercase', color: SK.rose, paddingTop: 4 }}>
                {t('event2010.openedOverline')}
              </span>
              <span style={{ ...S.title(m), lineHeight: 1.08 }}>{t('event2010.finalTitle', { name: recipient })}</span>
              <span style={{ font: `400 ${m ? 14 : 15}px/1.6 var(--font-sans)`, color: SK.body, maxWidth: m ? 280 : 340 }}><Segs segs={final} /></span>
              <span style={S.sign}>{club} · {date}</span>
            </div>
          )}
          <span style={{
            gridArea: '2 / 1', position: 'sticky', bottom: 0, height: 26, marginTop: -26, background: SK.fade,
            pointerEvents: 'none', transition: 'opacity .2s ease', opacity: ov && front ? 1 : 0,
          }} />
        </div>

        {!troll && (front || (closing && !rcv)) && (
          <div ref={footRef} style={{ flexShrink: 0, display: 'flex', padding: m ? '12px 16px 14px' : '14px 24px 18px', borderTop: '1px solid ' + SK.footLine }}>
            <button type="button" onClick={receive} style={{ ...S.cta, flex: '1 0 auto', height: 48 }}>{t('event2010.receive')}</button>
          </div>
        )}
        {rcv && !front && <Burst key={burstN} seed={burstN} top={m ? 104 : 118} size={m ? 72 : 80} rm={rm} />}
      </div>
    </div>
  )
}

/* ============================ TROLL ============================ */

function TrollPopup({ isMobile, rm, n, onPeek, onClose }) {
  const m = isMobile
  return (
    <div role="dialog" aria-modal="true" aria-label={t('event2010.trollTitle')} onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: m ? 24 : 32,
      background: 'rgba(255,243,248,.62)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: rm ? 'none' : 'skFade .2s ease both',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: m ? 300 : 360, padding: m ? '28px 22px 16px' : '32px 28px 20px', borderRadius: m ? 24 : 26,
        background: SK.paper, border: '1px solid ' + SK.paperLine, boxShadow: SK.shadow,
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: m ? 14 : 16,
        animation: rm ? 'none' : 'skPop .35s cubic-bezier(.2,1.3,.4,1) both',
      }}>
        <span key={n} style={{
          display: 'block', fontSize: 64, lineHeight: 1, filter: 'drop-shadow(0 6px 10px rgba(122,30,72,.18))',
          animation: rm ? 'none' : 'skBonk .45s cubic-bezier(.2,1.3,.4,1) both, skWobble 1.4s ease-in-out .45s infinite',
        }}>
          {TROLL_ICONS[(n + TROLL_ICONS.length - 1) % TROLL_ICONS.length]}
        </span>
        <span style={{ font: `700 ${m ? 22 : 26}px/1.2 var(--font-display)`, letterSpacing: '-0.01em', color: SK.title, textWrap: 'balance' }}>
          {t('event2010.trollTitle')}
        </span>
        <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
          <button type="button" onClick={onPeek} style={{ ...S.cta, height: m ? 46 : 48 }}>{t('event2010.trollPeek')}</button>
          <button type="button" onClick={onClose} style={{
            ...S.btnReset, height: m ? 46 : 48, borderRadius: 14, border: '1px solid ' + SK.ghostLine, background: SK.ghost,
            font: '600 15px/1 var(--font-sans)', color: SK.deep,
          }}>
            {t('event2010.trollNo')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Màn "nạp năng lượng" trước khi lật thiệp troll: mặt 😤 phình to, rung mạnh dần, chớp trắng ở cuối. */
function Charging({ isMobile, n, pct }) {
  const z = isMobile ? 1 : 1.35
  const R = Math.round(56 * z)
  const lvl = pct < 40 ? 1 : pct < 85 ? 2 : 3
  const sparks = useMemo(() => {
    const r = rng(n * 97 + (z > 1 ? 13 : 7))
    return Array.from({ length: 24 }, (_, i) => {
      const a = r() * Math.PI * 2, dist = (110 + r() * 100) * z, s = 3 + r() * 3.5
      return (
        <span key={i} style={{
          position: 'absolute', left: -s / 2, top: -s / 2, width: s, height: s, borderRadius: '50%',
          background: r() > 0.5 ? '#FF5C8A' : '#FFC2DA', boxShadow: '0 0 10px 2px rgba(255,80,130,.8)',
          '--sx': (Math.cos(a) * dist).toFixed(1) + 'px', '--sy': (Math.sin(a) * dist).toFixed(1) + 'px',
          animation: `skConverge ${(0.45 + r() * 0.3).toFixed(2)}s cubic-bezier(.55,0,.8,.4) ${(r() * 0.6).toFixed(2)}s infinite`,
        }} />
      )
    })
  }, [n, z])
  const label = pct < 40 ? t('event2010.charge.open') : pct < 92 ? t('event2010.charge.weird') : pct < 100 ? t('event2010.charge.brace') : t('event2010.charge.boom')

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001, overflow: 'hidden', animation: 'skFade .3s ease both',
      background: `radial-gradient(${isMobile ? 60 : 50}% 50% at 50% 46%, rgba(70,10,36,.6), rgba(6,2,8,.94))`,
    }}>
      <span style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 120px 24px rgba(255,40,100,.55)', animation: 'skThrob .35s ease-in-out infinite alternate' }} />
      <div style={{ position: 'absolute', inset: 0, animation: `skJit${lvl} .09s linear infinite` }}>
        <div style={{ position: 'absolute', left: '50%', top: '46%', width: 0, height: 0 }}>
          {sparks}
          <span style={{
            position: 'absolute', left: -R * 1.4, top: -R * 1.4, width: R * 2.8, height: R * 2.8, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,80,130,.55), rgba(255,80,130,0) 68%)', animation: 'skThrob .3s ease-in-out infinite alternate',
          }} />
          <svg width={R * 2 + 12} height={R * 2 + 12} style={{ position: 'absolute', left: -(R + 6), top: -(R + 6), overflow: 'visible', transform: 'rotate(-90deg)' }}>
            <circle cx={R + 6} cy={R + 6} r={R} fill="none" stroke="rgba(255,143,191,.18)" strokeWidth={6} />
            <circle cx={R + 6} cy={R + 6} r={R} fill="none" stroke="#FF5C8A" strokeWidth={6} strokeLinecap="round" pathLength={1} style={{
              strokeDasharray: 1, strokeDashoffset: 1, filter: 'drop-shadow(0 0 8px rgba(255,80,130,.9))', animation: 'skDraw 1.9s cubic-bezier(.3,.2,.6,1) forwards',
            }} />
          </svg>
          <span style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%,-50%)', fontSize: 56 * z, lineHeight: 1 }}>
            <span style={{ display: 'block', animation: 'skGrow 2.1s cubic-bezier(.5,0,.9,.5) both' }}>
              <span style={{ display: 'block', animation: `skJit${lvl} .07s linear infinite` }}>😤</span>
            </span>
          </span>
        </div>
      </div>
      <span style={{ position: 'absolute', inset: 0, zIndex: 3, background: '#FFF4F8', opacity: 0, pointerEvents: 'none', animation: 'skWhiteout .3s ease-in 1.92s forwards' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: '20%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 10 : 12, pointerEvents: 'none' }}>
        <span style={{ font: `700 ${isMobile ? 22 : 30}px/1 var(--font-display)`, letterSpacing: '.02em', color: '#FFE3EE' }}>{label}</span>
        <span style={{ font: `600 ${isMobile ? 13 : 14}px/1 var(--font-mono)`, letterSpacing: '.1em', color: SK.pink }}>{pct}%</span>
      </div>
    </div>
  )
}

/** Ba sticker quanh thiệp troll. */
function Stickers({ isMobile, rm }) {
  const z = isMobile ? 1 : 1.2
  const st = (e, pos, size, rot, d) => (
    <span key={e} style={{ position: 'absolute', ...pos, zIndex: 1, fontSize: size * z, lineHeight: 1, transform: `rotate(${rot}deg)`, pointerEvents: 'none' }}>
      <span style={{
        display: 'block', filter: 'drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1.5px #fff) drop-shadow(0 4px 6px rgba(0,0,0,.35))',
        animation: rm ? 'none' : `skBonk .45s cubic-bezier(.2,1.3,.4,1) ${d}s both, skWobble 1.6s ease-in-out ${d + 0.45}s infinite`,
      }}>
        {e}
      </span>
    </span>
  )
  return [
    st('🤡', { right: 56, top: -24 }, 52, 12, 0.35),
    st('🤭', { left: -14, bottom: -14 }, 32, -10, 0.5),
    st('💅', { right: -12, top: '56%' }, 30, -14, 0.65),
  ]
}

/* ============================ HIỆU ỨNG ============================ */

/** Cánh hoa rơi chậm + đốm sáng. `light` = tông đậm hơn cho nền giấy sáng. Giảm chuyển động thì cánh đứng yên. */
function Petals({ seed, count, fall, scale = 1, durK = 1, rm, light }) {
  const kids = useMemo(() => {
    const r = rng(seed * 977 + count * 31 + fall)
    const [pa, pb] = light
      ? ['linear-gradient(135deg,#FFC2DA,#F27AB0)', 'linear-gradient(135deg,#FF9EC4,#E8558F)']
      : ['linear-gradient(135deg,#FFE6F0,#FF9EC4)', 'linear-gradient(135deg,#FFD0E2,#F27AB0)']
    const out = []
    for (let i = 0; i < count; i++) {
      const size = (9 + r() * 9) * scale, dur = (7 + r() * 7) * durK, delay = -r() * dur, left = r() * 100
      const pink = r() > 0.5, drift = r() * 120 - 40, rot = r() * 540 + 180, top = r() * 90
      out.push(<span key={'p' + i} style={{
        position: 'absolute', left: left + '%', top: rm ? top + '%' : -20, width: size, height: size * 0.78,
        borderRadius: '150% 0 150% 0', opacity: rm ? 0.7 : 0.92, background: pink ? pa : pb,
        boxShadow: light ? '0 0 6px rgba(232,85,143,.25)' : '0 0 8px rgba(255,160,200,.45)',
        '--drift': drift + 'px', '--rot': rot + 'deg', '--fall': fall + 'px',
        animation: rm ? 'none' : `skFall ${dur.toFixed(2)}s linear ${delay.toFixed(2)}s infinite`,
        transform: rm ? `rotate(${rot}deg)` : undefined,
      }} />)
    }
    for (let i = 0; i < Math.round(count / 2); i++) {
      const s = 2 + r() * 2.5, d = 2.4 + r() * 2.6
      out.push(<span key={'s' + i} style={{
        position: 'absolute', left: r() * 100 + '%', top: r() * 100 + '%', width: s, height: s, borderRadius: '50%', opacity: 0.6,
        background: light ? '#FF8FBF' : '#FFF4F8', boxShadow: light ? '0 0 6px 1px rgba(242,122,176,.6)' : '0 0 6px 1px rgba(255,200,225,.8)',
        animation: rm ? 'none' : `skTwinkle ${d.toFixed(2)}s ease-in-out ${(-r() * d).toFixed(2)}s infinite`,
      }} />)
    }
    return out
  }, [seed, count, fall, scale, durK, rm, light])
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>{kids}</div>
}

/** Dây hoa hồng ở hai góc khung lời chúc cuối: thân vẽ dần, hoa và lá nở theo sau. */
function Vine({ rm }) {
  const uid = useId().replace(/[^\w-]/g, '')
  const a = 'skva' + uid, b = 'skvb' + uid
  const pop = (d) => (rm ? undefined : { transformBox: 'fill-box', transformOrigin: 'center', animation: `skBloom .5s cubic-bezier(.2,1.3,.4,1) ${d}s both` })
  const stem = (d, w, delay) => (
    <path key={d} d={d} fill="none" stroke="#5E9A6A" strokeWidth={w} strokeLinecap="round" pathLength={1}
      style={rm ? undefined : { strokeDasharray: 1, strokeDashoffset: 1, animation: `skDraw .9s ease-out ${delay}s forwards` }} />
  )
  const P = 'M0 2 C -15 -2 -17 -24 0 -28 C 17 -24 15 -2 0 2 Z'
  const bloom = (gid, x, y, r, rot, d) => (
    <g key={'b' + x + y} transform={`translate(${x} ${y}) rotate(${rot}) scale(${r / 30})`}>
      <g style={pop(d)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={P} transform={`rotate(${i * 72 + 36})`} fill={`url(#${gid})`} stroke="#B8235F" strokeOpacity={0.35} strokeWidth={1.2} />
        ))}
        <circle cx={0} cy={0} r={15} fill="#E04883" />
        <path d="M-11 4 C -13 -9 9 -14 12 -2 C 14 8 0 13 -5 6 C -9 0 -2 -6 4 -3 C 8 -1 5 4 1 3" fill="none" stroke="#8E1748" strokeWidth={2.4} strokeLinecap="round" />
        <path d="M-6 -10 C 0 -14 8 -12 11 -6" fill="none" stroke="#FFC2DA" strokeWidth={1.6} strokeLinecap="round" strokeOpacity={0.8} />
      </g>
    </g>
  )
  const leaf = (x, y, rot, s, d) => (
    <g key={'l' + x + y} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <g style={pop(d)}>
        <path d="M0 0 C 5 -6 13 -8 20 -5 C 15 2 7 4 0 0 Z" fill="#7DB287" />
        <path d="M1 -0.5 C 7 -3 13 -4 18 -4.5" fill="none" stroke="#4E8A5C" strokeWidth={0.8} />
      </g>
    </g>
  )
  const bud = (x, y, rot, d) => (
    <g key={'u' + x + y} transform={`translate(${x} ${y}) rotate(${rot})`}>
      <g style={pop(d)}>
        <path d="M0 -6 C 4 -4 4 2 0 4 C -4 2 -4 -4 0 -6 Z" fill="#E04883" />
        <path d="M-3 2 L 0 6 L 3 2 C 2 4 -2 4 -3 2 Z" fill="#5E9A6A" />
      </g>
    </g>
  )
  const svg = (gid, pos, w, h, kids) => (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{
      position: 'absolute', ...pos, overflow: 'visible', pointerEvents: 'none', filter: 'drop-shadow(0 2px 3px rgba(194,48,111,.18))',
    }}>
      <defs>
        <radialGradient id={gid} cx="0" cy="0" r="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#C2306F" />
          <stop offset=".55" stopColor="#F25C93" />
          <stop offset="1" stopColor="#FFA8CA" />
        </radialGradient>
      </defs>
      {kids}
    </svg>
  )
  return (
    <>
      {svg(a, { left: -14, bottom: -14 }, 80, 112, [
        stem('M4 110 C 10 98, 15 88, 14 74 C 13 58, 10 44, 19 26', 1.8, 0.2),
        stem('M9 102 C 22 106, 36 103, 52 107', 1.3, 0.45),
        stem('M14 54 C 7 48, 4 42, 5 34', 1.1, 0.6),
        leaf(14, 86, 190, 0.85, 0.7), leaf(16, 44, -150, 0.75, 0.8), leaf(24, 104, 70, 0.7, 0.9), leaf(44, 104, 60, 0.6, 1.0),
        bloom(a, 14, 74, 10, 10, 0.75), bloom(a, 7, 98, 8.5, 30, 0.85), bloom(a, 19, 26, 8, -20, 0.95), bloom(a, 34, 104, 6.5, 0, 1.1),
        bud(5, 33, -15, 1.15), bud(53, 107, 80, 1.25),
      ])}
      {svg(b, { right: -14, top: -14 }, 100, 64, [
        stem('M98 2 C 90 8, 82 13, 66 14 C 52 15, 42 12, 30 16', 1.6, 0.35),
        stem('M86 11 C 91 22, 88 34, 90 46', 1.2, 0.55),
        leaf(78, 10, -100, 0.7, 0.8), leaf(52, 15, -120, 0.65, 0.95), leaf(89, 22, 10, 0.7, 1.0),
        bloom(b, 66, 14, 9, 15, 0.9), bloom(b, 88, 30, 7, -10, 1.05), bloom(b, 44, 13, 6.5, 40, 1.2),
        bud(29, 16, -70, 1.3), bud(90, 47, 170, 1.35),
      ])}
    </>
  )
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
          <stop offset="1" stopColor="#FFD3E4" />
        </radialGradient>
      </defs>
      <g style={{ transformOrigin: '0 0', animation: rm ? 'none' : 'skSpin 24s linear 1.6s infinite' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`rotate(${i * 72})`}>
            <path d="M0 -2 C -10 -8 -13 -22 -6 -30 L 0 -25.5 L 6 -30 C 13 -22 10 -8 0 -2 Z" fill={`url(#${gid})`}
              stroke="rgba(232,85,143,.5)" strokeWidth={0.6} style={bloom(i)} />
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
        background: r() > 0.5 ? 'linear-gradient(135deg,#FFC2DA,#F27AB0)' : 'linear-gradient(135deg,#FF9EC4,#E8558F)', boxShadow: '0 0 10px rgba(242,122,176,.4)',
        '--dx': (Math.cos(a) * dist).toFixed(1) + 'px', '--dy': (Math.sin(a) * dist).toFixed(1) + 'px', '--rot': (r() * 720 - 360).toFixed(0) + 'deg',
        animation: `skBurst ${(0.95 + r() * 0.35).toFixed(2)}s cubic-bezier(.12,.75,.3,1) ${(r() * 0.06).toFixed(2)}s both`,
      }} />)
    }
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2, dist = 110 + r() * 70, s = 4 + r() * 3
      out.push(<span key={'m' + i} style={{
        position: 'absolute', left: -s / 2, top: -s / 2, width: s, height: s, borderRadius: '50%',
        background: '#FF7EB6', boxShadow: '0 0 8px 2px rgba(242,122,176,.7)',
        '--sx': (Math.cos(a) * dist).toFixed(1) + 'px', '--sy': (Math.sin(a) * dist).toFixed(1) + 'px',
        animation: `skConverge .62s cubic-bezier(.55,0,.8,.4) ${(0.32 + r() * 0.24).toFixed(2)}s both`,
      }} />)
    }
    out.push(<span key="ring" style={{
      position: 'absolute', left: 0, top: 0, width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(242,122,176,.9)',
      boxShadow: '0 0 18px rgba(242,122,176,.5), inset 0 0 12px rgba(255,170,210,.5)', animation: 'skRing .85s cubic-bezier(.2,.7,.3,1) both',
    }} />)
    return out
  }, [seed, top, rm])

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3, borderRadius: 'inherit' }}>
      {!rm && (
        <span style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', animation: 'skFlash 1s ease-out both',
          background: `radial-gradient(260px 220px at 50% ${top}px, rgba(255,160,205,.4), rgba(255,160,205,0) 70%)`,
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
  cta: {
    appearance: 'none', border: 0, margin: 0, padding: 0, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14,
    background: SK.cta, boxShadow: SK.ctaShadow, font: '600 15px/1 var(--font-sans)', color: SK.ink,
  },
  title: (m) => ({ font: `700 ${m ? 26 : 32}px/1.06 var(--font-display)`, letterSpacing: '-0.015em', color: SK.title }),
  sign: { font: '500 12px/1 var(--font-mono)', color: SK.soft },
}
