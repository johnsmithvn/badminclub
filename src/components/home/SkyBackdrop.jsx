import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { t, tBranch } from '#i18n'
import { SKY_CAST, isLate, moonAge, pickCast, skyFacts, skyLines, ufoOutcome, ufoScript } from '#lib/sky.js'
import cfg from '#config/app.js'

/**
 * Nền bầu trời động của trang chủ cá nhân (thiết kế "Home · Nền bầu trời").
 * - Tối: trời sao — trăng có chú Cuội, cá voi sao, ngân hà, sao băng, sao chổi, đom đóm, chòm sao
 *   hiện ở header, mưa sao băng, sao ước bay ngang (bấm để ước).
 * - Sáng: hoàng hôn trên biển mây — ráng chiều, sao sớm, ba lớp mây cuộn, chim, máy bay.
 * - Mỗi lần mở trang một nhân vật ghé thăm (cú mèo chỉ sau 22h), câu thoại theo số liệu thật.
 *
 * Hai lớp `position: fixed`: lớp trời dưới cùng (z -1, sau mọi nội dung) và lớp nhân vật trên nội
 * dung (z 20, dưới dialog 40). Trời đứng yên, nội dung cuộn; nhân vật mờ dần khi cuộn xuống.
 * Thẻ trong suốt nhờ token kính ở `effects.css` → `[data-sky]` (AppLayout gắn ở route home).
 *
 * Cảnh vẽ trên khung 1440×940 của thiết kế rồi phóng cho phủ kín màn. Mobile giữ tỉ lệ 1:1, lấy
 * khúc trời quanh mặt trăng; nhân vật mobile canh theo tâm màn.
 *
 * Xem trước: `?sky=owl|banner|top1|hero|ufo|all` trên URL trang chủ (cú mèo không cần chờ 22h).
 * Toàn bộ tình huống và câu thoại: docs/HOME_SKY.md.
 *
 * Bảng màu bầu trời cố ý nằm ngoài token (giống SakuraEvent): đây là tranh vẽ, không phải UI.
 */

const W = 1440
const H = 940
const C = cfg.sky
/** Tâm mặt trăng mobile trên khung 1440 — khúc trời mobile canh theo điểm này. */
const MOON_M = 895

/** Số giả ngẫu nhiên theo chỉ số: sao, mây, đom đóm đứng yên chỗ cũ giữa các lần render. */
const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x) }
const px = (n) => n.toFixed(1) + 'px'
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';')
const tl = (line) => (line ? t(line[0], line[1]) : '')

/* ============================ BỐ CỤC ============================ */

// Desktop: toạ độ trên khung 1440 (gồm cả sidebar 248). Mobile: khung 390 của thiết kế, `mobileLayout`
// dời theo bề rộng thật để mặt trăng luôn ở giữa màn.
const LD = {
  W, mx: 960, my: 22, md: 72, ox: 930, oy: 62, os: 20, br: 516, bt: 56, bw: 210, tail: 'r', bnT: 3, bnD: 1960,
  tX: 770, tY: 30, tG: 7,
  wish: { x: 720, xr: 560, y: 16, yr: 34, dx: 380, dxr: 220, dy: 70, dyr: 60 },
  sc: { uy: 4, xa: 1120, xb: 860, yG: 62, yUp: 22, us: 1, ps: 1.1, hy: 4, hs: 0.9, vE: 160, vD: 45, vH: 170, bw: 240, rk: [320, 96], fall: 150 },
}
function mobileLayout(w) {
  const d = w / 2 - 195
  return {
    W: w, mx: 174 + d, my: 1, md: 42, ox: 222 + d, oy: 14, os: 16, br: 14 + d, bt: 46, bw: 196, tail: 't', tailR: 141,
    bnT: 44, bnD: w + 510, tX: 250 + d, tY: 46, tG: 4.5,
    wish: { x: 250 + d, xr: 110, y: 52, yr: 16, dx: 170, dxr: 90, dy: 30, dyr: 30 },
    sc: { uy: 2, xa: 290 + d, xb: 180 + d, yG: 50, yUp: 16, us: 0.7, ps: 0.85, hy: 46, hs: 0.7, vE: 60, vD: 20, vH: 45, bw: 180, rk: [150, 70], fall: 110 },
  }
}
/** Trời đêm mobile: trăng nhỏ, chòm sao không tên, cá voi nhỏ bơi ngang đúng bề rộng màn. */
const nightMobile = (w) => ({
  mx: 874, my: 1, md: 42, cx: 790, cy: 3, cs: 0.28, ch: 34, cw: 56, nl: 1,
  wx: MOON_M + w / 2 + 10, wy: 56, wd: -(w + 250), wdy: 16, wdur: 44, wdl: 3, wsc: 0.58,
})

function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return vp
}

/* ============================ COMPONENT ============================ */

export default function SkyBackdrop({ hero, form, season, lastAt, name, isMobile }) {
  const { isDark } = useTheme()
  const [params] = useSearchParams()
  const vp = useViewport()
  const [motion] = useState(() => {
    try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return true }
  })
  // Bốc nhân vật và chốt giờ đúng MỘT lần khi mở trang (F5 là đổi nhân vật).
  const [opened] = useState(() => ({ now: Date.now(), cast: pickCast(isLate(new Date().getHours()), Math.random()) }))
  const q = params.get('sky')
  const castKey = q === 'all' ? SKY_CAST.join() : SKY_CAST.includes(q) ? q : opened.cast
  const cast = useMemo(() => castKey.split(','), [castKey])

  const st = useMemo(() => skyFacts({ hero, form, season, lastAt, now: new Date(opened.now) }), [hero, form, season, lastAt, opened.now])
  const lines = useMemo(() => {
    const L = skyLines(st, name)
    return { owl: L.owl.map(tl), banner: L.banner.map(tl), hero: L.hero.map(tl), wish: L.wish.map(tl) }
  }, [st, name])

  // Cảnh khung 1440 phủ kín màn (desktop) / lấy khúc quanh trăng ở tỉ lệ 1:1 (mobile).
  const s = isMobile ? Math.max(1, vp.h / H) : Math.max(vp.w / W, vp.h / H)
  const left = isMobile ? vp.w / 2 - MOON_M * s : (vp.w - W * s) / 2
  const stage = { position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${px(left)},0) scale(${s.toFixed(4)})` }
  const mw = Math.round(vp.w / s)
  const ly = useMemo(() => (isMobile ? mobileLayout(mw) : LD), [isMobile, mw])
  const box = isMobile ? { position: 'absolute', left: 0, top: 0, width: mw, height: H, transformOrigin: '0 0', transform: `scale(${s.toFixed(4)})` } : stage
  const nightOpt = useMemo(() => (isMobile ? nightMobile(mw) : {}), [isMobile, mw])
  const age = moonAge(C.moon, opened.now)

  const back = useMemo(
    () => (isDark ? <Night o={nightOpt} motion={motion} age={age} full={C.moon === 'full'} /> : <Day motion={motion} />),
    [isDark, nightOpt, motion, age],
  )

  // Câu thoại mới nhất cho cảnh viết tay (siêu nhân, UFO, sao ước) — đọc lúc cảnh bắt đầu, không
  // dựng lại cảnh đang bay khi db đồng bộ.
  const data = useRef({ st, lines, name })
  useEffect(() => { data.current = { st, lines, name } }, [st, lines, name])

  // Cuộn nội dung → nhân vật trôi lên và mờ dần, hết 80px thì ẩn (trời vẫn đứng yên).
  const fadeRef = useRef(null)
  useEffect(() => {
    const el = fadeRef.current, main = el?.closest('main')
    if (!main) return
    const on = () => {
      const y = main.scrollTop
      el.style.transform = y ? `translateY(${px(-y / s)})` : ''
      el.style.opacity = String(Math.max(0, 1 - y / 80))
      el.style.visibility = y > 80 ? 'hidden' : ''
    }
    on()
    main.addEventListener('scroll', on, { passive: true })
    return () => main.removeEventListener('scroll', on)
  }, [s])

  // Siêu nhân / UFO: cảnh viết tay bằng Web Animations, thay phiên nhau, nghỉ sceneGapMs giữa hai lượt.
  const sceneRef = useRef(null)
  const flyKinds = cast.filter((c) => c === 'hero' || c === 'ufo').join()
  useEffect(() => {
    const host = sceneRef.current
    if (!motion || !flyKinds || !host) return
    const kinds = flyKinds.split(',')
    const timers = new Set()
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn() }, ms); timers.add(id) }
    const seq = { hero: 0 }
    let busy = Date.now() + C.sceneFirstMs, rot = 0
    const iv = setInterval(() => {
      // Tab ẩn thì animation không chạy tới onfinish — sinh cảnh lúc đó chỉ để phần tử chất đống.
      if (Date.now() < busy || !host.isConnected || document.hidden) return
      rot += 1
      const kind = kinds[rot % kinds.length]
      const ctx = { host, later, seq, dark: isDark, ly, ...data.current }
      busy = Date.now() + (kind === 'hero' ? heroFly(ctx) : ufoScene(ctx)) + C.sceneGapMs
    }, 1000)
    return () => { clearInterval(iv); timers.forEach(clearTimeout); host.replaceChildren() }
  }, [motion, flyKinds, isDark, ly])

  // Sao ước (chỉ đêm): bay ngang header, bấm vào → bung sáng + một điều ước.
  const flyRef = useRef(null)
  useEffect(() => {
    const host = flyRef.current
    if (!motion || !isDark || !host) return
    const go = () => { if (!document.hidden) spawnWish(host, ly.wish, () => data.current.lines.wish) }
    const first = setTimeout(go, C.wishFirstMs)
    const iv = setInterval(go, C.wishEveryMs)
    return () => { clearTimeout(first); clearInterval(iv); host.replaceChildren() }
  }, [motion, isDark, ly])

  const [owlK, setOwlK] = useState(0)
  const [banK, setBanK] = useState(0)
  const [shape, setShape] = useState(() => Math.floor(Math.random() * SHAPES.length))
  // Hình kế luôn khác hình đang xếp.
  const nextShape = () => {
    const jump = 1 + Math.floor(Math.random() * (SHAPES.length - 1))
    setShape((cur) => (cur + jump) % SHAPES.length)
  }

  return (
    <>
      <div aria-hidden="true" data-sky-fx="" style={S.back}>
        <div style={stage}>{back}</div>
      </div>
      <div data-sky-fx="" style={S.top}>
        {isDark && <div style={stage}><Shower motion={motion} /></div>}
        <div style={box}>
          <div ref={fadeRef} style={S.fill}>
            {cast.includes('owl') && (
              <Owl ly={ly} dark={isDark} motion={motion} k={owlK} line={lines.owl[owlK % lines.owl.length]} onNext={() => setOwlK((k) => k + 1)} />
            )}
            {cast.includes('banner') && (
              <Banner ly={ly} dark={isDark} motion={motion} line={lines.banner[banK % lines.banner.length]} onNext={() => setBanK((k) => k + 1)} />
            )}
            {cast.includes('top1') && <Top1 ly={ly} dark={isDark} motion={motion} shape={shape} onNext={nextShape} />}
            <div ref={sceneRef} style={S.fill} />
          </div>
          <div ref={flyRef} style={S.fill} />
        </div>
      </div>
    </>
  )
}

const S = {
  back: { position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' },
  top: { position: 'fixed', inset: 0, zIndex: 20, overflow: 'hidden', pointerEvents: 'none' },
  fill: { position: 'absolute', inset: 0 },
}

/* ============================ TRỜI ĐÊM ============================ */

const MOON_BG = 'radial-gradient(circle at 30% 62%,rgba(150,160,180,.32) 0,rgba(150,160,180,.32) 7%,transparent 12%),radial-gradient(circle at 62% 30%,rgba(150,160,180,.26) 0,rgba(150,160,180,.26) 9%,transparent 14%),radial-gradient(circle at 56% 70%,rgba(150,160,180,.22) 0,rgba(150,160,180,.22) 6%,transparent 10%),radial-gradient(circle at 40% 38%,#FDFCF5,#E9EAF0 62%,#CDD2E0)'
const BRIGHT = [[260, 64, 22, 5], [520, 138, 18, 6.5], [700, 40, 16, 4.8], [1180, 150, 24, 7], [1360, 60, 14, 5.6], [420, 300, 16, 6], [860, 250, 14, 5.2], [1300, 380, 20, 7.4], [90, 430, 14, 6.2], [640, 520, 13, 4.4], [1100, 620, 12, 5.8], [300, 700, 14, 6.6]]
// Chòm sao: [điểm, đường nối]. Tên lấy theo thứ tự trong vi.json → sky.cons.
const CONS = [
  [[[0, 30], [40, 26], [72, 34], [100, 46], [110, 80], [150, 84], [160, 52]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]],
  [[[0, 10], [30, 40], [60, 18], [92, 44], [120, 8]], [[0, 1], [1, 2], [2, 3], [3, 4]]],
  [[[14, 20], [76, 26], [34, 70], [46, 66], [58, 62], [24, 118], [84, 112], [46, 0]], [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [1, 7]]],
  [[[10, 10], [22, 20], [34, 34], [42, 54], [46, 74], [56, 92], [74, 102], [96, 100], [106, 86], [100, 74], [0, 0], [24, 0]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [0, 10], [0, 11]]],
  [[[14, 30], [30, 10], [54, 8], [64, 30], [52, 56], [120, 48], [150, 66], [112, 78]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 7], [7, 6], [6, 5], [5, 3]]],
  [[[60, 0], [60, 46], [60, 96], [60, 136], [8, 30], [112, 64]], [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]]],
]
const STAR_TILES = [
  ['radial-gradient(1px 1px at 10px 14px,#fff,transparent),radial-gradient(1px 1px at 46px 60px,rgba(220,230,255,.9),transparent),radial-gradient(1px 1px at 88px 22px,#fff,transparent),radial-gradient(1px 1px at 112px 78px,rgba(255,245,220,.9),transparent),radial-gradient(1px 1px at 70px 90px,#fff,transparent),radial-gradient(1px 1px at 28px 44px,rgba(200,255,235,.8),transparent)', '130px 96px', 7, 0, 92],
  ['radial-gradient(1.5px 1.5px at 12px 18px,#fff,transparent),radial-gradient(1px 1px at 86px 64px,#fff,transparent),radial-gradient(1.5px 1.5px at 150px 30px,rgba(190,240,255,1),transparent),radial-gradient(1px 1px at 210px 122px,#fff,transparent),radial-gradient(1.5px 1.5px at 40px 150px,rgba(255,240,210,.95),transparent)', '240px 180px', 4.5, -1, 96],
  ['radial-gradient(2px 2px at 60px 40px,rgba(210,200,255,1),transparent),radial-gradient(1.5px 1.5px at 170px 110px,#fff,transparent),radial-gradient(1.5px 1.5px at 280px 20px,#fff,transparent),radial-gradient(2px 2px at 330px 150px,rgba(167,240,255,1),transparent)', '360px 220px', 6.5, -3, 100],
  ['radial-gradient(2.5px 2.5px at 90px 60px,#fff,transparent),radial-gradient(2px 2px at 400px 200px,rgba(255,236,200,1),transparent),radial-gradient(2.5px 2.5px at 260px 120px,rgba(200,215,255,1),transparent)', '520px 300px', 5.5, -2, 90],
]
const SHOOTS = [[70, 1300, 9, 1, 170], [30, 900, 13, 5.5, 130], [200, 1420, 17, 9, 210], [16, 620, 23, 14, 150], [360, 1100, 19, 3, 140]]

function Night({ o, motion, age, full }) {
  const an = (v) => (motion ? v : 'none')
  const ph = (age / 29.530589) * 2 * Math.PI, lit = (1 - Math.cos(ph)) / 2, wax = ph < Math.PI
  const D = o.md || 72, Rr = D / 2, MX = o.mx ?? 960, MY = o.my ?? 22
  const tw = Math.abs(Math.cos(ph)) * D, ts = wax ? (lit < 0.5 ? 0 : 1) : (lit < 0.5 ? 1 : 0)
  const clip = full ? 'none' : `path('M${Rr} 0 A${Rr} ${Rr} 0 0 ${wax ? 1 : 0} ${Rr} ${D} A${(tw / 2).toFixed(2)} ${Rr} 0 0 ${ts} ${Rr} 0 Z')`
  const consNames = tBranch('sky.cons')

  // Mỗi vòng hiện, chòm sao đổi chỗ / góc nghiêng một chút quanh header.
  const spot = (el) => {
    const sv = el.firstChild, h = +sv.getAttribute('height') || 120, w = +sv.getAttribute('width') || 120
    const sc = Math.min(o.cs || 0.42, (o.ch || 50) / h, (o.cw || 80) / w)
    el.style.left = ((o.cx ?? 1044) + Math.random() * 10).toFixed(0) + 'px'
    el.style.top = ((o.cy ?? 4) + Math.random() * 6).toFixed(0) + 'px'
    el.style.transform = `scale(${sc.toFixed(2)}) rotate(${((Math.random() - 0.5) * 16).toFixed(0)}deg)`
    const lb = el.lastChild
    if (lb && lb.tagName === 'SPAN') lb.style.fontSize = (11 / sc).toFixed(1) + 'px'
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'linear-gradient(180deg,#040814 0%,#071027 45%,#0A1733 75%,#0E1E40 100%)' }}>
      <div style={{ position: 'absolute', inset: '-12%', background: 'radial-gradient(40% 35% at 70% 6%,rgba(88,80,200,.30),transparent 70%),radial-gradient(35% 40% at 10% 72%,rgba(20,140,150,.22),transparent 70%),radial-gradient(30% 30% at 55% 58%,rgba(150,70,180,.14),transparent 70%)', filter: 'blur(30px)', animation: an('skyNeb 34s ease-in-out infinite alternate') }} />
      <div style={{ position: 'absolute', left: -300, top: 240, width: 2100, height: 320, transform: 'rotate(-17deg)', background: 'radial-gradient(50% 50% at 50% 50%,rgba(190,205,255,.18),rgba(170,190,240,.06) 50%,transparent 75%),radial-gradient(30% 40% at 34% 55%,rgba(200,180,255,.14),transparent 70%),radial-gradient(25% 35% at 70% 45%,rgba(140,240,215,.10),transparent 70%)', filter: 'blur(14px)' }} />
      <div style={{ position: 'absolute', left: -300, top: 240, width: 2100, height: 320, transform: 'rotate(-17deg)', backgroundImage: 'radial-gradient(1px 1px at 8px 10px,#fff,transparent),radial-gradient(1px 1px at 30px 34px,rgba(220,230,255,.9),transparent),radial-gradient(1px 1px at 52px 18px,#fff,transparent),radial-gradient(1px 1px at 20px 44px,rgba(255,240,220,.9),transparent),radial-gradient(1px 1px at 62px 40px,#fff,transparent)', backgroundSize: '70px 50px', WebkitMaskImage: 'radial-gradient(50% 42% at 50% 50%,#000,transparent)', maskImage: 'radial-gradient(50% 42% at 50% 50%,#000,transparent)', animation: an('skyTwinkleB 9s ease-in-out infinite') }} />
      {STAR_TILES.map(([img, size, dur, delay, fade], i) => (
        <div key={'s' + i} style={{ position: 'absolute', inset: 0, backgroundImage: img, backgroundSize: size, WebkitMaskImage: `linear-gradient(to bottom,#000,transparent ${fade}%)`, maskImage: `linear-gradient(to bottom,#000,transparent ${fade}%)`, animation: an(`skyTwinkleB ${dur}s ease-in-out ${delay}s infinite`) }} />
      ))}
      {BRIGHT.map(([x, y, sz, d], i) => (
        <span key={'b' + i} style={{ position: 'absolute', left: x - sz / 2, top: y - sz / 2, width: sz, height: sz, background: 'radial-gradient(circle,#fff 0,#fff 1.2px,rgba(210,225,255,.6) 2.5px,transparent 5px),linear-gradient(90deg,transparent,rgba(215,228,255,.85),transparent) 50% 50%/100% 1px no-repeat,linear-gradient(0deg,transparent,rgba(215,228,255,.85),transparent) 50% 50%/1px 100% no-repeat', filter: 'drop-shadow(0 0 4px rgba(200,220,255,.9))', animation: an(`skyStarPulse ${d}s ease-in-out ${(-i * 1.3).toFixed(1)}s infinite`) }} />
      ))}
      <span style={{ position: 'absolute', left: MX + Rr - 280, top: MY + Rr - 280, width: 560, height: 560, borderRadius: '50%', background: `radial-gradient(closest-side,rgba(220,230,255,${(0.07 + 0.2 * lit).toFixed(2)}),rgba(220,230,255,0))`, animation: an('skyMoonGlow 9s ease-in-out infinite alternate') }} />
      <span style={{ position: 'absolute', left: MX, top: MY, width: D, height: D, borderRadius: '50%', background: 'radial-gradient(circle,rgba(170,190,230,.10),rgba(170,190,230,.04) 70%,transparent 72%)' }}>
        <span style={{ position: 'absolute', inset: 0, filter: `drop-shadow(0 0 ${(6 + 14 * lit).toFixed(0)}px rgba(245,248,255,${(0.4 + 0.4 * lit).toFixed(2)})) drop-shadow(0 0 ${(14 + 30 * lit).toFixed(0)}px rgba(200,215,250,${(0.2 + 0.3 * lit).toFixed(2)}))` }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: full ? '50%' : 0, background: MOON_BG, clipPath: clip, WebkitClipPath: clip }}>
            {/* Chú Cuội ngồi gốc cây đa */}
            <svg width={D} height={D} viewBox="0 0 64 64" style={{ position: 'absolute', inset: 0 }}>
              <g fill="rgba(110,120,152,.42)">
                <path d="M28 26 C26 18 32 13 38 14 C42 9 50 11 51 17 C57 18 58 26 53 29 C54 34 48 37 44 35 C40 38 32 36 32 32 C27 32 26 28 28 26 Z" />
                <path d="M40 34 C40 40 39 44 37 48 L45 48 C43 44 42 40 42 34 Z" />
                <path d="M28 48 Q41 46 54 48 Q41 50.5 28 48 Z" />
                <circle cx="31" cy="40.5" r="2" />
                <path d="M29.5 42.6 L32.6 42.6 L33.6 46.6 L36.2 46.6 L36.2 48.4 L29 48.4 Z" />
              </g>
            </svg>
          </span>
        </span>
      </span>
      <Whale o={o} an={an} />
      {SHOOTS.map(([top, l, dur, delay, w], i) => (
        <div key={'m' + i} style={{ position: 'absolute', top, left: l, width: w, height: 1.5, borderRadius: 1, opacity: 0, transformOrigin: '0 50%', background: 'linear-gradient(90deg,#fff,rgba(190,230,255,.65) 22%,rgba(167,139,250,.25) 60%,transparent)', animation: an(`skyShoot ${dur}s linear ${delay}s infinite`) }}>
          <span style={{ position: 'absolute', left: -2, top: -2, width: 5, height: 5, borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px 3px rgba(200,230,255,.9)' }} />
        </div>
      ))}
      <div style={{ position: 'absolute', top: 40, left: 1500, width: 0, height: 0, opacity: 0, animation: an('skyComet 40s linear 6s infinite') }}>
        <span style={{ position: 'absolute', left: 0, top: -1.5, width: 320, height: 3, borderRadius: 2, transformOrigin: '0 50%', transform: 'rotate(-10deg)', background: 'linear-gradient(90deg,rgba(225,255,248,.95),rgba(94,242,194,.5) 18%,rgba(139,92,246,.22) 55%,transparent)', filter: 'blur(1px)' }} />
        <span style={{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: '50%', background: '#fff', boxShadow: '0 0 14px 5px rgba(190,255,240,.85),0 0 46px 14px rgba(94,242,194,.35)' }} />
      </div>
      {Array.from({ length: 24 }, (_, i) => {
        const r = (j) => rnd(i * 17 + j + 500), sz = 3 + r(1) * 2.5, v = (j) => ((r(j) - 0.5) * 150).toFixed(0) + 'px'
        return (
          <span key={'f' + i} style={{
            position: 'absolute', left: (r(2) * W).toFixed(0) + 'px', top: (H * (0.3 + r(3) * 0.66)).toFixed(0) + 'px', width: sz, height: sz, borderRadius: '50%',
            background: 'radial-gradient(circle,#F7FFD6 0,#D9F99D 35%,rgba(190,242,100,0) 72%)', boxShadow: `0 0 ${(sz * 5).toFixed(0)}px ${(sz * 1.4).toFixed(1)}px rgba(190,242,100,.6)`,
            '--x1': v(4), '--y1': v(5), '--x2': v(6), '--y2': v(7), '--x3': v(8), '--y3': v(9), opacity: motion ? undefined : 0.7,
            animation: an(`skyFfWander ${(12 + r(10) * 10).toFixed(1)}s ease-in-out ${(-r(11) * 20).toFixed(1)}s infinite, skyFfBlink ${(1.8 + r(12) * 2.4).toFixed(2)}s ease-in-out ${(-r(13) * 3).toFixed(2)}s infinite`),
          }} />
        )
      })}
      {CONS.map(([P, Ls], i) => {
        const w = Math.max(...P.map((p) => p[0])) + 10, h = Math.max(...P.map((p) => p[1])) + 10, dly = (-150 + i * 25 + 6) + 's'
        return (
          <span key={'c' + i}
            ref={(el) => { if (el && !el.dataset.placed) { el.dataset.placed = '1'; spot(el) } }}
            onAnimationIteration={(ev) => { if (ev.target === ev.currentTarget) spot(ev.currentTarget) }}
            style={{ position: 'absolute', left: o.cx ?? 1044, top: (o.cy ?? 4) + 2, transform: `scale(${o.cs ? o.cs * 0.8 : 0.34})`, width: w, height: h + 20, transformOrigin: '0 0', opacity: 0, animation: an(`skyConsShow 150s ease-in-out ${dly} infinite`) }}>
            <svg width={w} height={h} viewBox={`-5 -5 ${w} ${h}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              <path d={Ls.map(([a, b]) => `M${P[a][0]} ${P[a][1]}L${P[b][0]} ${P[b][1]}`).join('')} pathLength="1" fill="none" stroke="rgba(190,210,255,.6)" strokeWidth="2.4" strokeDasharray="1" style={{ animation: an(`skyConsLine 150s linear ${dly} infinite`) }} />
              {P.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={k % 3 === 0 ? 4.4 : 3.2} fill="#fff" style={{ filter: 'drop-shadow(0 0 6px rgba(200,220,255,.95))' }} />)}
            </svg>
            {!o.nl && <span style={{ position: 'absolute', left: w + 8, top: Math.round(h * 0.3), font: '500 11px/1 var(--font-sans)', letterSpacing: '.06em', color: 'rgba(200,212,245,.85)', whiteSpace: 'nowrap', textShadow: '0 0 6px rgba(0,0,0,.6)' }}>{consNames[i]}</span>}
          </span>
        )
      })}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '32%', background: 'linear-gradient(to top,rgba(40,70,130,.32),transparent)' }} />
    </div>
  )
}

/** Cá voi sao bơi ngang trời: vệt sao sau đuôi, phun bụi sao, chòm sao trên lưng. */
function Whale({ o, an }) {
  return (
    <div style={{ position: 'absolute', left: o.wx ?? W + 40, top: o.wy ?? 30, width: 0, height: 0, '--wd': (o.wd ?? -1840) + 'px', '--wdy': (o.wdy ?? 50) + 'px', opacity: 0, animation: an(`skyWhaleSwim ${o.wdur || 90}s linear ${o.wdl ?? 4}s infinite`) }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${o.wsc || 1})`, transformOrigin: '0 0' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, animation: an('skyWhaleBob 7s ease-in-out infinite') }}>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={'t' + i} style={{ position: 'absolute', left: 236, top: 52 + (rnd(i + 700) - 0.5) * 16, width: 3, height: 3, borderRadius: '50%', background: '#EAF4FF', boxShadow: '0 0 6px 2px rgba(170,210,255,.8)', opacity: 0, '--dx': (60 + rnd(i + 710) * 90).toFixed(0) + 'px', '--dy': ((rnd(i + 720) - 0.5) * 40).toFixed(0) + 'px', animation: an(`skyTrail 2.6s ease-out ${(i * 0.26).toFixed(2)}s infinite`) }} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <span key={'p' + i} style={{ position: 'absolute', left: 64, top: 26, width: 3, height: 3, borderRadius: '50%', background: '#F2F8FF', boxShadow: '0 0 6px 2px rgba(190,225,255,.85)', opacity: 0, '--dx': ((i - 2.5) * 7).toFixed(0) + 'px', animation: an(`skySpout 9s ease-out ${(i * 0.06).toFixed(2)}s infinite`) }} />
          ))}
          <svg width="250" height="100" viewBox="0 0 250 100" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: 'drop-shadow(0 0 10px rgba(140,190,255,.55))' }}>
            <defs>
              <linearGradient id="sky-wg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgba(110,150,230,.55)" />
                <stop offset=".6" stopColor="rgba(150,190,250,.42)" />
                <stop offset="1" stopColor="rgba(205,228,255,.6)" />
              </linearGradient>
            </defs>
            <g style={{ transformOrigin: '204px 56px', animation: an('skyWhaleTail 3.2s ease-in-out infinite') }}>
              <path d="M202 54 C212 42 226 32 242 28 C238 38 232 46 224 52 C234 55 242 63 246 74 C230 70 214 64 202 58 Z" fill="url(#sky-wg)" stroke="rgba(205,230,255,.85)" strokeWidth="1" />
            </g>
            <path d="M10 58 C10 36 42 22 88 22 C132 22 164 34 190 48 C196 51 202 53 206 54 C208 58 204 62 196 63 C168 70 138 80 94 80 C48 80 10 76 10 58 Z" fill="url(#sky-wg)" stroke="rgba(205,230,255,.85)" strokeWidth="1" />
            <path d="M22 66 C50 72 90 74 130 70 M26 71 C54 77 92 78 122 75" fill="none" stroke="rgba(225,240,255,.45)" strokeWidth=".8" />
            <g style={{ transformOrigin: '84px 70px', animation: an('skyWhaleFin 2.6s ease-in-out infinite') }}>
              <path d="M80 70 C86 84 98 94 112 92 C104 86 98 78 96 70 Z" fill="rgba(160,200,255,.5)" stroke="rgba(205,230,255,.8)" strokeWidth=".8" />
            </g>
            <circle cx="34" cy="52" r="2" fill="#F4F9FF" />
            <path d="M60 36 L92 32 L124 38 L150 46 L176 52" fill="none" stroke="rgba(220,235,255,.35)" strokeWidth=".7" />
            {[[60, 36, 1.4], [92, 32, 1.8], [124, 38, 1.3], [150, 46, 1.6], [110, 56, 1.2], [70, 50, 1.1], [176, 52, 1.3]].map(([x, y, r], k) => (
              <circle key={k} cx={x} cy={y} r={r} fill="#FFFFFF" style={{ filter: 'drop-shadow(0 0 3px rgba(220,235,255,.95))', animation: an(`skyTwinkle ${(2 + k * 0.4).toFixed(1)}s ease-in-out ${(-k * 0.3).toFixed(1)}s infinite`) }} />
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}

/** Mưa sao băng: 14 vệt quét qua cả màn, 42 giây một trận. Nằm trên nội dung. */
function Shower({ motion }) {
  return Array.from({ length: 14 }, (_, i) => {
    const r = (j) => rnd(i * 31 + j + 900), w = 110 + r(1) * 110
    return (
      <div key={i} style={{ position: 'absolute', left: (620 + r(2) * 860).toFixed(0) + 'px', top: (-30 + r(3) * 200).toFixed(0) + 'px', width: w, height: 1.6, borderRadius: 1, opacity: 0, transformOrigin: '0 50%', background: 'linear-gradient(90deg,#fff,rgba(200,235,255,.7) 20%,rgba(167,139,250,.25) 60%,transparent)', animation: motion ? `skyShower 42s linear ${(10 + i * 0.24 + r(4) * 0.5).toFixed(2)}s infinite` : 'none' }}>
        <span style={{ position: 'absolute', left: -2.5, top: -2, width: 5, height: 5, borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px 3px rgba(210,235,255,.9)' }} />
      </div>
    )
  })
}

/* ============================ HOÀNG HÔN ============================ */

const PLANE_D = 'M1 6 L20 5 Q25 5.4 25 6 Q25 6.6 20 7 L1 6 Z M9 5.6 L5 0.5 L8 0.5 L14 5.4 Z M9 6.4 L5 11.5 L8 11.5 L14 6.6 Z M2 5.8 L0.5 2.5 L2.5 2.5 L5 5.7 Z'

function Day({ motion }) {
  const an = (v) => (motion ? v : 'none')

  // Mây tích: 6 cụm tròn + đế, lắc lên xuống và trôi ngang.
  const cum = (k, fx, fy, w, h, seed) => {
    const gid = 'sky-cu' + k
    return (
      <div key={'cu' + k} style={{ position: 'absolute', left: fx * W, top: fy * H, '--by': (6 + rnd(seed + 9) * 8).toFixed(0) + 'px', animation: an(`skyBob ${(6 + rnd(seed + 7) * 4).toFixed(1)}s ease-in-out ${(-rnd(seed + 3) * 5).toFixed(1)}s infinite alternate`) }}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible', '--dx': ((k % 2 ? -1 : 1) * (90 + rnd(seed + 11) * 90)).toFixed(0) + 'px', animation: an(`skyDrift ${(40 + rnd(seed + 13) * 30).toFixed(0)}s ease-in-out ${(-rnd(seed + 5) * 30).toFixed(1)}s infinite alternate`), filter: 'drop-shadow(0 10px 14px rgba(190,110,140,.22))' }}>
          <defs>
            <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={h}>
              <stop offset="0" stopColor="#FFE7CF" />
              <stop offset=".55" stopColor="#FFF3EC" />
              <stop offset="1" stopColor="#F0BFC6" />
            </linearGradient>
            <filter id={gid + 'f'} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4" /></filter>
          </defs>
          <g fill={`url(#${gid})`} filter={`url(#${gid}f)`}>
            {Array.from({ length: 6 }, (_, j) => {
              const tt = (j + 0.5) / 6, pk = Math.sin(Math.PI * tt), r = h * (0.26 + 0.3 * pk) * (0.85 + 0.3 * rnd(seed + j))
              return <circle key={j} cx={(w * (0.1 + 0.8 * tt)).toFixed(1)} cy={(h - r * 0.8 - h * 0.1).toFixed(1)} r={r.toFixed(1)} />
            })}
            <ellipse cx={w / 2} cy={h * 0.8} rx={w * 0.46} ry={h * 0.2} />
          </g>
        </svg>
      </div>
    )
  }

  // Biển mây: dải vòng tròn dài gấp 3 khung, cuộn sang trái liền mạch.
  const sea = (key, top, rMin, rMax, n, c2, shade, dur, seed, op) => {
    const base = rMax, h = H - top + base + 40, gid = 'sky-sea' + key, pts = []
    for (let c = 0; c < 3; c++) for (let i = 0; i < n; i++) pts.push([c * W + (i + 0.2 + rnd(seed + i + 40) * 0.6) * (W / n), base + rMax * 0.35 + rnd(seed + i + 80) * rMax * 0.4, rMin + rnd(seed + i) * (rMax - rMin), c + '_' + i])
    const circ = (dy, pre) => pts.map(([x, y, r, k]) => <circle key={pre + k} cx={x.toFixed(0)} cy={(y + dy).toFixed(0)} r={r.toFixed(0)} />)
    const bodyY = (base + rMax * 0.75).toFixed(0)
    return (
      <svg key={key} width={3 * W} height={h} style={{ position: 'absolute', left: -W, top: top - base, overflow: 'visible', opacity: op, animation: an(`skySea ${dur}s linear infinite`) }}>
        <defs>
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={(base * 2.4).toFixed(0)}>
            <stop offset="0" stopColor="#FFF1E6" />
            <stop offset=".42" stopColor="#FDEDE6" />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
        </defs>
        <g fill={shade} opacity=".55">{circ(rMax * 0.2, 's')}<rect x="0" y={bodyY} width={3 * W} height={h} /></g>
        <g fill={`url(#${gid})`}>{circ(0, 'm')}<rect x="0" y={bodyY} width={3 * W} height={h} /></g>
      </svg>
    )
  }

  const bird = (i, x, y, sz) => (
    <svg key={'b' + i} width={24 * sz} height={12 * sz} viewBox="0 0 24 12" style={{ position: 'absolute', left: x, top: y, overflow: 'visible', transformOrigin: '50% 60%', animation: an(`skyFlap ${(0.42 + i * 0.05).toFixed(2)}s ease-in-out ${(-i * 0.13).toFixed(2)}s infinite alternate`) }}>
      <path d="M1 4 Q6 0 12 7 Q18 0 23 4" fill="none" stroke="#3A2E4A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'linear-gradient(180deg,#B4C0E6 0%,#CDBFE0 22%,#EBC2D2 40%,#F6CDB8 55%,#FAD9BF 64%,#FBE6D2 100%)' }}>
      <div style={{ position: 'absolute', left: 140, top: H * 0.3, width: 1300, height: 420, borderRadius: '50%', background: 'radial-gradient(closest-side,rgba(255,168,120,.55),rgba(255,150,150,.22) 50%,rgba(255,150,150,0))', filter: 'blur(14px)', animation: an('skySunBreath 12s ease-in-out infinite alternate') }} />
      <div style={{ position: 'absolute', left: -100, right: -100, top: H * 0.2, height: 220, background: 'linear-gradient(180deg,transparent,rgba(255,190,200,.28) 45%,rgba(255,200,170,.18) 70%,transparent)', filter: 'blur(18px)' }} />
      {[[1060, 34, 3.4, 4.2], [420, 22, 1.6, 5.4], [700, 60, 1.4, 6.2], [1270, 70, 1.5, 5], [180, 50, 1.3, 7]].map(([x, y, sz, d], i) => (
        <span key={'e' + i} style={{ position: 'absolute', left: x, top: y, width: sz, height: sz, borderRadius: '50%', background: '#FFFDF6', boxShadow: `0 0 ${(sz * 3).toFixed(0)}px ${(sz * 0.8).toFixed(1)}px rgba(255,250,235,.8)`, animation: an(`skyTwinkle ${d}s ease-in-out ${-i}s infinite`) }} />
      ))}
      {[[0.06, 0.07, 560, 40, 70], [0.42, 0.2, 420, 30, -60], [0.7, 0.3, 600, 46, 80]].map(([x, y, w, h, dx], i) => (
        <span key={'ci' + i} style={{ position: 'absolute', left: x * W, top: y * H, width: w, height: h, borderRadius: '50%', background: 'radial-gradient(50% 50% at 50% 50%,rgba(255,206,196,.7),transparent 70%)', filter: 'blur(10px)', '--dx': dx + 'px', animation: an(`skyDrift ${30 + i * 8}s ease-in-out infinite alternate`) }} />
      ))}
      <div style={{ position: 'absolute', left: -80, top: 110, width: 0, height: 0, opacity: 0, animation: an('skyPlane 56s linear 10s infinite') }}>
        <div style={{ position: 'absolute', left: 0, top: 0, transform: 'rotate(-1.6deg)' }}>
          <span style={{ position: 'absolute', left: -300, top: 3, width: 300, height: 2, borderRadius: 2, background: 'linear-gradient(90deg,rgba(255,240,235,0),rgba(255,240,235,.9))' }} />
          <span style={{ position: 'absolute', left: -260, top: 7, width: 260, height: 2, borderRadius: 2, background: 'linear-gradient(90deg,rgba(255,240,235,0),rgba(255,240,235,.8))' }} />
          <svg width="26" height="12" viewBox="0 0 26 12" style={{ position: 'absolute', left: -2, top: -1 }}><path d={PLANE_D} fill="#5A4A6E" /></svg>
        </div>
      </div>
      <div style={{ position: 'absolute', left: W + 40, top: 170, width: 0, height: 0, opacity: 0, animation: an('skyBirds 38s linear 4s infinite') }}>
        {[[0, 0, 1], [28, -14, 0.85], [30, 16, 0.9], [58, -24, 0.75], [60, 26, 0.8], [86, 6, 0.7]].map(([x, y, sz], i) => bird(i, x, y, sz))}
      </div>
      {cum(0, 0.14, 0.14, 280, 92, 10)}
      {cum(1, 0.47, 0.27, 200, 66, 20)}
      {cum(2, 0.63, 0.04, 260, 86, 30)}
      {cum(3, 0.84, 0.33, 260, 84, 40)}
      {cum(4, 0.02, 0.36, 180, 58, 50)}
      <svg width={W} height="200" viewBox="0 0 1440 200" style={{ position: 'absolute', left: 0, top: H * 0.5 - 130 }}>
        <defs>
          <linearGradient id="sky-mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8E80B4" /><stop offset="1" stopColor="#E2C3D2" /></linearGradient>
        </defs>
        <path d="M0 200 L120 130 L190 150 L310 70 L400 130 L500 100 L620 160 L760 80 L860 42 L960 110 L1080 86 L1190 150 L1310 104 L1440 140 L1440 200 Z" fill="url(#sky-mt)" opacity=".75" />
      </svg>
      {sea('s1', H * 0.52, 50, 95, 16, '#E3BFD0', '#CFA9C2', 220, 100, 0.95)}
      <div style={{ position: 'absolute', left: -200, right: -200, top: H * 0.58, height: 120, background: 'radial-gradient(50% 50% at 50% 50%,rgba(255,232,224,.75),transparent 70%)', filter: 'blur(14px)', animation: an('skyMist 26s ease-in-out infinite alternate') }} />
      {sea('s2', H * 0.63, 60, 120, 13, '#EDC9CF', '#DDB3C2', 140, 200, 1)}
      {sea('s3', H * 0.76, 70, 140, 11, '#F5DCD6', '#E6C2C8', 90, 300, 1)}
      {Array.from({ length: 12 }, (_, i) => {
        const sz = 3 + rnd(i + 300) * 4
        return (
          <span key={'mo' + i} style={{ position: 'absolute', left: (rnd(i + 310) * W).toFixed(0) + 'px', top: (H * (0.5 + rnd(i + 320) * 0.45)).toFixed(0) + 'px', width: sz, height: sz, borderRadius: '50%', background: 'radial-gradient(circle,#fff,rgba(255,255,255,0) 70%)', boxShadow: '0 0 8px 2px rgba(255,205,175,.75)', opacity: motion ? 0 : 0.6, '--dx': ((rnd(i + 330) - 0.5) * 120).toFixed(0) + 'px', '--dy': -(200 + rnd(i + 340) * 160).toFixed(0) + 'px', animation: an(`skyFloatUp ${(14 + rnd(i + 350) * 10).toFixed(1)}s ease-in-out ${(-rnd(i + 360) * 20).toFixed(1)}s infinite`) }} />
        )
      })}
    </div>
  )
}

/* ============================ NHÂN VẬT ============================ */

const bubC = (dark) => (dark ? { bg: 'rgba(10,16,34,.92)', bd: 'rgba(170,200,255,.35)', fg: '#EAF1FF', sh: '0 6px 20px rgba(0,0,0,.4)' } : { bg: 'rgba(255,248,242,.95)', bd: '#EBC3BC', fg: '#4A2A38', sh: '0 6px 18px rgba(150,80,100,.18)' })
const bubSt = (dark) => {
  const c = bubC(dark)
  return { padding: '8px 12px', borderRadius: 10, background: c.bg, border: '1px solid ' + c.bd, color: c.fg, boxShadow: c.sh, whiteSpace: 'normal', textWrap: 'pretty', font: '600 12px/1.35 var(--font-sans)' }
}

/** Cú mèo đậu trên trăng (chỉ sau 22h). Bấm cú hoặc bóng thoại → câu kế + nghiêng đầu. */
function Owl({ ly, dark, motion, k, line, onNext }) {
  const an = (v) => (motion ? v : 'none')
  const sz = ly.os, D = ly.md, R2 = D / 2, c = bubC(dark)
  const body = dark ? '#121A33' : '#3A2E4A', rim = dark ? 'rgba(220,230,255,.45)' : 'rgba(255,228,218,.5)'
  const lid = (cx) => <rect key={'l' + cx} x={cx - 5.5} y="11.5" width="11" height="11" fill={body} style={{ transform: 'scaleY(0)', transformOrigin: `${cx}px 11.5px`, animation: an('skyOwlBlink 5s ease-in-out infinite') }} />
  const tailTop = ly.tail === 't'
  return (
    <div style={S.fill}>
      {/* Ban ngày không có trăng: vẽ vầng trăng non nhạt cho cú đậu */}
      {!dark && (
        <span style={{ position: 'absolute', left: ly.mx, top: ly.my, width: D, height: D, filter: 'drop-shadow(0 0 10px rgba(255,245,235,.85))' }}>
          <span style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 40% 38%,#FFFCF6,#F6E6E2)', clipPath: `path('M${R2} 0 A${R2} ${R2} 0 0 1 ${R2} ${D} A${(R2 * 0.56).toFixed(1)} ${R2} 0 0 0 ${R2} 0 Z')`, opacity: 0.9 }} />
        </span>
      )}
      <svg width={sz * 3} height={sz * 0.3} viewBox="0 0 60 6" style={{ position: 'absolute', left: ly.ox - sz * 0.8, top: ly.oy + sz * 1.1, overflow: 'visible' }}>
        <path d="M0 4 C14 2.6 30 3.4 44 2.4 C50 2 55 1.4 60 0" fill="none" stroke={body} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <div key={'o' + k} title={t('sky.tip.owl')} onClick={onNext} style={{ position: 'absolute', left: ly.ox, top: ly.oy, width: sz, height: sz * 1.2, cursor: 'pointer', pointerEvents: 'auto', transformOrigin: '50% 90%', animation: k && motion ? 'skyOwlTilt .9s ease-in-out' : 'none' }}>
        <svg width={sz} height={sz * 1.2} viewBox="0 0 40 46" style={{ display: 'block', overflow: 'visible' }}>
          <path d="M9 14 L6 2 L15 8 Z M31 14 L34 2 L25 8 Z" fill={body} />
          <path d="M20 6 C11 6 6 13 6 21 C6 32 10 40 20 44 C30 40 34 32 34 21 C34 13 29 6 20 6 Z" fill={body} stroke={rim} strokeWidth=".8" />
          <path d="M10 27 C11 34 14 39 18 41 M30 27 C29 34 26 39 22 41" fill="none" stroke={rim} strokeWidth=".7" />
          <circle cx="14.5" cy="17" r="5" fill="#FFC857" style={{ filter: 'drop-shadow(0 0 3px rgba(255,200,87,.9))' }} />
          <circle cx="25.5" cy="17" r="5" fill="#FFC857" style={{ filter: 'drop-shadow(0 0 3px rgba(255,200,87,.9))' }} />
          <circle cx="14.5" cy="17" r="2.2" fill="#1A1208" />
          <circle cx="25.5" cy="17" r="2.2" fill="#1A1208" />
          {lid(14.5)}{lid(25.5)}
          <path d="M20 21 L18 24 L20 27 L22 24 Z" fill="#D99A3E" />
          <path d="M16 43 L16 46 M24 43 L24 46" stroke="#D99A3E" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      {/* Bóng thoại hiện/ẩn theo nhịp 16 giây, hết một vòng tự sang câu kế */}
      <div key={'ob' + k} onClick={onNext} onAnimationIteration={onNext} style={{ position: 'absolute', right: ly.br, top: ly.bt, pointerEvents: 'auto', cursor: 'pointer', ...bubSt(dark), maxWidth: ly.bw, opacity: motion ? 0 : 1, animation: an(`skyBubble 16s ease-in-out ${k ? 0 : 2}s infinite`) }}>
        <span style={{ position: 'absolute', right: tailTop ? ly.tailR : -5, top: tailTop ? -5 : 13, width: 9, height: 9, transform: 'rotate(45deg)', background: c.bg, borderTop: '1px solid ' + c.bd, [tailTop ? 'borderLeft' : 'borderRight']: '1px solid ' + c.bd }} />
        <span>{line}</span>
      </div>
    </div>
  )
}

/** Máy bay kéo băng rôn ngang header, 32 giây một lượt; mỗi lượt / mỗi lần bấm đổi chữ. */
function Banner({ ly, dark, motion, line, onNext }) {
  const c = dark
    ? { bg: 'rgba(16,24,50,.9)', bd: 'rgba(170,200,255,.45)', fg: '#EAF1FF', pl: '#C9D4EC', rope: 'rgba(200,215,245,.6)' }
    : { bg: 'rgba(255,247,240,.95)', bd: '#E7B7B0', fg: '#5A2E3E', pl: '#5A4A6E', rope: 'rgba(90,74,110,.6)' }
  const an = (v) => (motion ? v : 'none')
  return (
    <div onAnimationIteration={(ev) => { if (ev.target === ev.currentTarget) onNext() }} style={{ position: 'absolute', left: -440, top: ly.bnT, '--fd': ly.bnD + 'px', opacity: 0, animation: an('skyBannerFly 32s linear 6s infinite') }}>
      <div title={t('sky.tip.banner')} onClick={onNext} style={{ display: 'flex', alignItems: 'center', pointerEvents: 'auto', cursor: 'pointer' }}>
        <span style={{ padding: '3px 12px', borderRadius: 3, background: c.bg, border: '1px solid ' + c.bd, color: c.fg, font: '600 11.5px/1.3 var(--font-sans)', whiteSpace: 'nowrap', transformOrigin: '100% 50%', animation: an('skyFlagWave 1.4s ease-in-out infinite alternate') }}>{line}</span>
        <span style={{ width: 22, height: 1, background: c.rope }} />
        <svg width="32" height="14" viewBox="0 0 26 12" style={{ overflow: 'visible' }}>
          <path d={PLANE_D} fill={c.pl} />
          {dark && <circle cx="5.5" cy="1" r="1.1" fill="#FF5A5A" style={{ animation: an('skyNavBlink 1.2s linear infinite') }} />}
          {dark && <circle cx="5.5" cy="11" r="1.1" fill="#5AFF9A" style={{ animation: an('skyNavBlink 1.2s linear .6s infinite') }} />}
        </svg>
      </div>
    </div>
  )
}

// Xếp hình: đom đóm (đêm) / chim (ngày) bay tới xếp thành chữ TOP 1, tim, mèo, mặt cười, ^_^,
// quả cầu lông, ngôi sao. 30 giây một hình, hết vòng đổi sang hình khác.
const FONT = { T: ['#####', '..#..', '..#..', '..#..', '..#..'], O: ['.###.', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '####.', '#....', '#....'], 1: ['..#..', '.##..', '..#..', '..#..', '.###.'] }
const grid = (rows) => {
  const p = []
  rows.forEach((row, r) => [...row].forEach((v, c) => { if (v === '#') p.push([c, r]) }))
  return { p, c: rows[0].length, r: rows.length }
}
const TOP1 = []
;[['T', 0], ['O', 6], ['P', 12], ['1', 19]].forEach(([ch, c0]) => FONT[ch].forEach((row, r) => [...row].forEach((v, cc) => { if (v === '#') TOP1.push([c0 + cc, r]) })))
const SHAPES = [{ p: TOP1, c: 24, r: 5 }].concat([
  ['.##...##.', '####.####', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  ['#.......#', '##.....##', '#.#####.#', '#.......#', '#.#...#.#', '#...#...#', '.#.#.#.#.', '..#####..'],
  ['..#####..', '.#.....#.', '#..#.#..#', '#.......#', '#.#...#.#', '#..###..#', '.#.....#.', '..#####..'],
  ['.#.......#.', '#.#.....#.#', '...........', '...#####...'],
  ['#.#.#.#', '#.#.#.#', '.#.#.#.', '.#####.', '..###..', '..###..', '...#...'],
  ['....#....', '...###...', '#########', '.#######.', '..#####..', '.###.###.', '##.....##'],
].map(grid))
const NDOT = Math.max(...SHAPES.map((sp) => sp.p.length))

function Top1({ ly, dark, motion, shape, onNext }) {
  const an = (v) => (motion ? v : 'none')
  const SP = SHAPES[shape % SHAPES.length]
  const u = Math.min((ly.tG * 24) / SP.c, (ly.tG * 7) / SP.r)
  const OX = ly.tX + (ly.tG * 24 - SP.c * u) / 2, OY = ly.tY + (ly.tG * 5 - SP.r * u) / 2
  return (
    <div style={S.fill}>
      {Array.from({ length: NDOT }, (_, i) => {
        const hid = i >= SP.p.length, [x0, y0] = SP.p[i % SP.p.length], x = x0 * u, y = y0 * u
        const r = (j) => rnd(i * 13 + j + 1200)
        // Đêm: đom đóm bay lên từ dưới rồi tản ra. Ngày: chim bay tới từ phải, rời đi về trái.
        const sx = dark ? (r(1) - 0.5) * 520 : ly.W + 80 - (OX + x) + r(1) * 160
        const sy = dark ? 260 + r(2) * 420 : (r(2) - 0.5) * 160
        const ex = dark ? (r(3) - 0.5) * 380 : -(OX + x + 140) - r(3) * 160
        const ey = dark ? (r(4) - 0.5) * 220 : -60 - r(4) * 120
        return (
          <span key={i} onAnimationIteration={i === 0 ? (ev) => { if (ev.target === ev.currentTarget) onNext() } : undefined}
            style={{ position: 'absolute', visibility: hid ? 'hidden' : 'visible', left: OX + x, top: OY + y, width: 0, height: 0, '--sx': sx.toFixed(0) + 'px', '--sy': sy.toFixed(0) + 'px', '--ex': ex.toFixed(0) + 'px', '--ey': ey.toFixed(0) + 'px', opacity: 0, animation: an(`skyFormTop 30s ease-in-out ${(3 + i * 0.04).toFixed(2)}s infinite`) }}>
            {dark ? (
              <span style={{ position: 'absolute', left: -2.5, top: -2.5, width: 5, height: 5, borderRadius: '50%', background: 'radial-gradient(circle,#F7FFD6 0,#D9F99D 40%,rgba(190,242,100,0) 75%)', boxShadow: '0 0 10px 3px rgba(190,242,100,.6)', animation: an(`skyFfBlink ${(1.6 + r(5) * 1.6).toFixed(2)}s ease-in-out ${(-r(6) * 2).toFixed(2)}s infinite`) }} />
            ) : (
              <svg width="11" height="5" viewBox="0 0 10 4" style={{ position: 'absolute', left: -5.5, top: -2.5, overflow: 'visible', transformOrigin: '50% 60%', animation: an(`skyFlap ${(0.36 + r(5) * 0.12).toFixed(2)}s ease-in-out infinite alternate`) }}>
                <path d="M0 3 Q2.5 0 5 3 Q7.5 0 10 3" fill="none" stroke="#3A2E4A" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            )}
          </span>
        )
      })}
    </div>
  )
}

/* ============================ CẢNH VIẾT TAY (Web Animations) ============================ */
// Siêu nhân, UFO và sao ước tạo phần tử DOM trực tiếp trong một lớp riêng: mỗi lượt bay có quỹ đạo,
// lời thoại và kết cục khác nhau, tự dọn khi xong. Toạ độ theo khung của lớp (đã tính phóng to).

function mk(host, html, x, y) {
  const e = document.createElement('div')
  e.style.cssText = `position:absolute;left:0;top:0;opacity:0;transform:translate(${x}px,${y}px)`
  e.innerHTML = html
  host.appendChild(e)
  return e
}
/** Khung hình: [x, y, opacity, rotate, scale, offset]. */
function mv(e, F, dur, delay) {
  return e.animate(F.map((f) => {
    const k = { transform: `translate(${f[0].toFixed(1)}px,${f[1].toFixed(1)}px) rotate(${f[3] || 0}deg) scale(${f[4] ?? 1})`, opacity: f[2] ?? 1 }
    if (f[5] != null) k.offset = f[5]
    return k
  }), { duration: dur, delay: delay || 0, fill: 'both' })
}
function bub(par, text, dark, pos, maxW) {
  const c = bubC(dark), b = document.createElement('div')
  b.style.cssText = `position:absolute;${pos};width:max-content;max-width:${maxW}px;padding:7px 11px;border-radius:10px;font:600 12px/1.35 var(--font-sans);text-wrap:pretty;white-space:normal;opacity:0;pointer-events:none;background:${c.bg};border:1px solid ${c.bd};color:${c.fg};box-shadow:${c.sh}`
  b.textContent = text
  par.appendChild(b)
  return b
}
function say(b, at, len) {
  b.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none', offset: 0.08 }, { opacity: 1, transform: 'none', offset: 0.92 }, { opacity: 0, transform: 'translateY(-3px)' }], { duration: len, delay: at, fill: 'both' })
}
function pop(ctx, txt, x, y) {
  const e = mk(ctx.host, `<span style="font-size:18px;line-height:1">${txt}</span>`, x, y)
  mv(e, [[x, y + 6, 0], [x, y, 1, 0, 1.2, 0.25], [x, y - 14, 0]], 1300)
  ctx.later(() => e.remove(), 1400)
}
/** Vị trí phần tử trong khung của lớp (bù phóng to). */
function at(host, el, dx, dy) {
  const r = el.getBoundingClientRect(), hb = host.getBoundingClientRect(), k = host.offsetWidth / (hb.width || 1)
  return [(r.left - hb.left) * k + dx, (r.top - hb.top) * k + dy]
}

const heroSVG = (s, d) => `<svg width="${80 * s}" height="${34 * s}" viewBox="0 0 80 34" style="display:block;overflow:visible;filter:${d ? 'drop-shadow(0 0 6px rgba(150,190,255,.5))' : 'drop-shadow(0 3px 4px rgba(90,40,60,.25))'}"><g style="transform-origin:32px 12px;animation:skyCapeFlap .32s ease-in-out infinite alternate"><path d="M32 10 C22 5 10 8 0 3 C5 11 9 17 1 26 C13 24 24 22 33 18 Z" fill="#E5484D"/></g><path d="M5 13.5 L13 13.5 L13 20 L5 20 Q3 16.8 5 13.5 Z" fill="#C8323A"/><path d="M12 13.5 L33 12.5 L33 19.5 L12 20 Z" fill="#2F5BD3"/><path d="M31 11 C41 9 50 9.5 55 12.5 C56 16.5 51 20 41 21 L31 20 Z" fill="#3A6AE6"/><rect x="31" y="11.2" width="2.2" height="8.6" fill="#FFD54A"/><path d="M41 12.6 L46.4 12.6 L48 14.8 L43.7 18.8 L39.4 14.8 Z" fill="#FFD54A" stroke="#C8323A" stroke-width=".8"/><path d="M53 12.5 L70 9.6" stroke="#3A6AE6" stroke-width="3.2" stroke-linecap="round"/><circle cx="71" cy="9.4" r="2.2" fill="#F5C9A0"/><circle cx="59.5" cy="12" r="5.2" fill="#F5C9A0"/><path d="M54.4 11.2 C54.6 6.4 61.6 5 65 9 C62.4 8.2 58.6 8.6 56.2 10.8 Z" fill="#1B1F2E"/><circle cx="62" cy="12" r=".8" fill="#1B1F2E"/></svg>`
const UFO_LIGHTS = ['#FF6B6B', '#FFD54A', '#5FD9A2', '#5FDBD3', '#B49BFF']
const ufoSVG = (s, d) => {
  const g = 'sky-ug' + Math.random().toString(36).slice(2, 7)
  return `<svg width="${70 * s}" height="${34 * s}" viewBox="0 0 70 34" style="display:block;overflow:visible;filter:${d ? 'drop-shadow(0 0 8px rgba(160,255,220,.45))' : 'drop-shadow(0 3px 4px rgba(90,40,60,.25))'}"><defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E4EAF5"/><stop offset="1" stop-color="#7D8AA8"/></linearGradient></defs><path d="M22 15 C22 6 28 2 35 2 C42 2 48 6 48 15 Z" fill="rgba(158,231,255,.55)" stroke="rgba(220,245,255,.9)"/><circle cx="35" cy="10" r="4.2" fill="#7FE07A"/><circle cx="33.4" cy="9.4" r="1.1" fill="#1B1F2E"/><circle cx="36.6" cy="9.4" r="1.1" fill="#1B1F2E"/><path d="M35 5.8 L35 2.6" stroke="#7FE07A"/><ellipse cx="35" cy="18" rx="34" ry="7.5" fill="url(#${g})" stroke="rgba(255,255,255,.6)" stroke-width=".8"/><ellipse cx="35" cy="22" rx="16" ry="3.2" fill="#5C6884"/>${UFO_LIGHTS.map((c, i) => `<circle cx="${11 + i * 12}" cy="18.5" r="2" fill="${c}" style="animation:skyNavBlink 1.4s linear ${(i * 0.28).toFixed(2)}s infinite"/>`).join('')}</svg>`
}
const personSVG = (s, jer, pony) => `<svg width="${20 * s}" height="${28 * s}" viewBox="0 0 20 28" style="display:block;overflow:visible"><path d="M15.5 10 L18.4 4" stroke="#2B2F3A" stroke-width="1.2" stroke-linecap="round"/><ellipse cx="19.2" cy="2" rx="2" ry="2.8" transform="rotate(25 19.2 2)" fill="rgba(255,255,255,.35)" stroke="#9AA6BD" stroke-width=".9"/><path d="M6 12.5 L2.4 8.6 M14 12.5 L15.8 10" stroke="#F5C9A0" stroke-width="2" stroke-linecap="round"/><rect x="5.5" y="10.5" width="9" height="9" rx="2.6" fill="${jer}"/><path d="M7.6 19 L7 26.5 M12.4 19 L13 26.5" stroke="#2B3550" stroke-width="2.4" stroke-linecap="round"/>${pony ? '<path d="M14 5 C17 6 17.6 9.4 16 12 C15.6 9.6 15 8 13.6 7 Z" fill="#2A1C14"/>' : ''}<circle cx="10" cy="6.2" r="4.4" fill="#F5C9A0"/><path d="M5.6 6 C5.6 2 9 1 10.6 1.4 C13.6 1.8 14.8 3.8 14.4 6 C12.6 4.6 9.4 4.2 5.6 6 Z" fill="#2A1C14"/><circle cx="8.4" cy="6.6" r=".65" fill="#1B1F2E"/><circle cx="11.6" cy="6.6" r=".65" fill="#1B1F2E"/><circle cx="10" cy="8.9" r=".8" fill="#1B1F2E"/></svg>`
const rocketSVG = (s) => `<svg width="${28 * s}" height="${10 * s}" viewBox="0 0 28 10" style="display:block;overflow:visible"><path d="M-10 5 L0 3 L0 7 Z" fill="#FFB347" style="transform-origin:0 5px;animation:skyFlame .08s ease-in-out infinite alternate"/><path d="M2 2 L18 2 C23 2 27 4 28 5 C27 6 23 8 18 8 L2 8 Z" fill="#E9EFF7" stroke="#8C98B0" stroke-width=".6"/><path d="M22 2.6 C25 3.4 27 4.4 28 5 C27 5.6 25 6.6 22 7.4 Z" fill="#E5484D"/><path d="M2 2 L-1 -1.5 L6 2 Z M2 8 L-1 11.5 L6 8 Z" fill="#E5484D"/></svg>`

/** Nổ tung khi tên lửa trúng UFO: 14 tia lửa + chữ BÙM. */
function boom(ctx, x, y, s) {
  const { host, later } = ctx
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, r = (24 + Math.random() * 26) * (s + 0.3), z = 3 + Math.random() * 3, c = ['#FFD54A', '#FF8A3D', '#FF5A5A', '#FFF4C2'][i % 4]
    const e = mk(host, `<span style="position:absolute;left:${-z / 2}px;top:${-z / 2}px;width:${z}px;height:${z}px;border-radius:50%;background:${c};box-shadow:0 0 8px 2px ${c}"></span>`, x, y)
    mv(e, [[x, y, 1], [x + Math.cos(a) * r, y + Math.sin(a) * r, 0]], 700 + Math.random() * 400)
    later(() => e.remove(), 1200)
  }
  const tx = mk(host, `<span style="display:block;transform:translate(-50%,-50%);font:800 ${(16 * (s + 0.4)).toFixed(0)}px/1 var(--font-display);color:#FFD54A;-webkit-text-stroke:1px #8A2A12;letter-spacing:.04em;white-space:nowrap">${esc(t('sky.boom'))}</span>`, x, y)
  mv(tx, [[x, y, 0, -8, 0.4], [x, y - 4, 1, 4, 1.15, 0.25], [x, y - 10, 0, 0, 1]], 1000)
  later(() => tx.remove(), 1100)
}

/** Siêu nhân bay ngang header kèm một câu; bấm → câu kế + giơ ngón cái. Trả về thời lượng (ms). */
function heroFly(ctx) {
  const { host, later, seq, dark: d, ly, lines } = ctx
  const y = ly.sc, s = y.hs, hw = 80 * s, hh = 34 * s, L = lines.hero
  // Mỗi lượt bay mang câu kế tiếp trong danh sách.
  let i = (seq.hero += 1)
  const e = mk(host, `<div data-a style="position:relative;animation:skyHover 1.6s ease-in-out infinite;pointer-events:auto;cursor:pointer" title="${esc(t('sky.tip.hero'))}">${heroSVG(s, d)}</div>`, -hw - 20, y.hy)
  const b = bub(e, L[i % L.length], d, `right:calc(100% + 8px);top:${hh / 2 - 16}px`, y.bw)
  b.style.opacity = 1
  const x0 = -hw - 20, x1 = ly.W + b.offsetWidth + 30, dur = ((x1 - x0) / y.vH) * 1000
  mv(e, [[x0, y.hy, 1], [x1, y.hy - 6, 1]], dur)
  e.querySelector('[data-a]').onclick = (ev) => {
    ev.stopPropagation()
    b.textContent = L[++i % L.length]
    const q = at(host, e, hw * 0.55, -20)
    pop(ctx, '👍', q[0], q[1])
  }
  later(() => e.remove(), dur + 100)
  return dur
}

/**
 * UFO hạ xuống, chiếu tia hút một người (mình hoặc người kề trên BXH) lên. Người xem bấm người bị
 * hút → gọi siêu nhân cứu; bấm UFO → bắn tên lửa. Không bấm gì thì kết cục ngẫu nhiên.
 * Trả về thời lượng (ms).
 */
function ufoScene(ctx) {
  const { host, later, dark: d, ly, st, name } = ctx
  const y = ly.sc, Wl = ly.W, us = y.us, uw = 70 * us, ps = y.ps, pw = 20 * ps, ph = 28 * ps, uy = y.uy, xb = y.xb, vD = y.vD
  const sc = ufoScript(st, Math.random() < 0.5, name)
  const rise = sc.rise.map(tl).sort(() => Math.random() - 0.5)
  const x0 = Wl + 20, t1 = (x0 - y.xa) / y.vE, dt = (y.xa - xb) / vD, t2 = t1 + dt, scn = { out: null, done: false }

  const u = mk(host, `<div data-b style="position:absolute;left:${14 * us}px;top:${22 * us}px;width:${42 * us}px;height:${y.yG + ph - uy - 22 * us}px;transform-origin:50% 0;opacity:0;background:linear-gradient(180deg,rgba(220,255,200,.6),rgba(190,255,220,.04));clip-path:polygon(32% 0,68% 0,100% 100%,0 100%)"></div><div data-a style="position:relative;transform-origin:50% 60%;animation:skyWobble 2.4s ease-in-out infinite;pointer-events:auto;cursor:pointer" title="${esc(t('sky.tip.ufo'))}">${ufoSVG(us, d)}</div>`, x0, uy)
  const beam = u.querySelector('[data-b]')
  mv(u, [[x0, uy, 0], [x0 - (x0 - y.xa) * 0.1, uy, 1, 0, 1, (t1 * 0.1) / t2], [y.xa, uy, 1, 0, 1, t1 / t2], [xb, uy, 1]], t2 * 1000)
  beam.animate([{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'scaleY(1)' }], { duration: 450, delay: Math.max(0, t1 * 1000 - 250), fill: 'both' })

  const pxA = y.xa + uw / 2 - pw / 2, pxB = xb + uw / 2 - pw / 2, yR = y.yUp + (y.yG - y.yUp) * 0.35
  const p = mk(host, `<div data-a style="position:relative;transform-origin:50% 100%;animation:skyWobble .45s ease-in-out infinite;pointer-events:auto;cursor:pointer" title="${esc(t('sky.tip.victim'))}">${personSVG(ps, sc.me ? '#00B2A9' : '#E86A9A', !sc.me)}</div>`, pxA, y.yG)
  const tag = document.createElement('span')
  tag.style.cssText = `position:absolute;left:50%;top:${ph + 2}px;transform:translateX(-50%);padding:1px 5px;border-radius:4px;background:${d ? 'rgba(10,16,34,.85)' : 'rgba(255,248,242,.92)'};font:600 9px/1.3 var(--font-mono);color:${d ? '#EAF1FF' : '#4A2A38'};white-space:nowrap`
  tag.textContent = sc.me ? t('sky.you') : sc.victim
  p.appendChild(tag)
  mv(p, [[pxA, y.yG, 0], [pxA + (pxB - pxA) * 0.06, y.yG, 1, 0, 1, 0.06], [pxB, yR, 1]], dt * 1000, t1 * 1000)
  const bp = 'right:calc(100% + 8px);top:-4px'
  say(bub(p, rise[0], d, bp, y.bw), t1 * 1000 + 300, 2700)
  if (rise[1]) say(bub(p, rise[1], d, bp, y.bw), t1 * 1000 + 3100, Math.max(2000, dt * 1000 - 3200))

  p.querySelector('[data-a]').onclick = (ev) => {
    ev.stopPropagation()
    if (scn.done) return
    scn.out = 'hero'
    const q = at(host, p, pw / 2 - 9, -26)
    pop(ctx, '🦸', q[0], q[1])
  }
  u.querySelector('[data-a]').onclick = (ev) => {
    ev.stopPropagation()
    if (scn.done) return
    scn.out = 'rocket'
    const q = at(host, u, uw / 2 - 9, -22)
    pop(ctx, '🎯', q[0], q[1])
  }

  later(() => {
    scn.done = true
    if (!u.isConnected) return
    const o = scn.out || ufoOutcome(Math.random(), !!sc.abduct)
    const end = (ms) => later(() => { u.remove(); p.remove() }, ms)
    const ub = 'right:calc(100% + 6px);top:0'
    if (o === 'abduct') {
      mv(u, [[xb, uy, 1], [xb - vD * 3, uy, 1, 0, 1, 3 / 4.2], [-uw - 60, uy - 50, 0]], 4200)
      mv(p, [[pxB, yR, 1], [xb - vD * 1.2 + uw / 2 - pw / 2, uy + 8 * us, 0, 0, 0.3]], 1200)
      beam.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 1300, fill: 'forwards' })
      say(bub(u, tl(sc.abduct), d, ub, y.bw), 1200, 2000)
      end(4300)
    } else if (o === 'hero') {
      const hs = y.hs, hw = 80 * hs, hh = 34 * hs, sx = pxB + pw / 2 - 0.88 * hw, sy = yR - 0.22 * hh, xe = Wl + 40, carry = (xe - sx) / y.vH, T = (1 + carry) * 1000
      const h = mk(host, `<div style="position:relative;animation:skyHover 1.6s ease-in-out infinite">${heroSVG(hs, d)}</div>`, -hw - 30, sy)
      mv(h, [[-hw - 30, sy, 1], [sx, sy, 1, 0, 1, 1000 / T], [xe, sy - 60, 1]], T)
      mv(p, [[pxB, yR, 1], [pxB, yR, 1, 0, 1, 1000 / T], [xe + (pxB - sx), sy - 60 + (yR - sy), 1]], T)
      beam.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 600, fill: 'forwards' })
      say(bub(u, t('sky.ufo.hero'), d, ub, y.bw), 200, 1400)
      mv(u, [[xb, uy, 1], [xb + 20, uy - 4, 1, 0, 1, 0.5], [-uw - 60, uy - 70, 0]], 2400)
      say(bub(h, tl(sc.heroSay), d, `right:calc(100% + 8px);top:${hh / 2 - 16}px`, y.bw), 1000, Math.min(3600, T - 1000))
      later(() => h.remove(), T + 100)
      end(T + 100)
    } else {
      const rx0 = xb - y.rk[0], ry0 = y.yG + y.rk[1], ux = xb - vD * 0.9, tx = ux + uw / 2, ty = uy + 18 * us
      const ang = (Math.atan2(ty - ry0, tx - rx0) * 180) / Math.PI, rs = us * 1.1
      const r = mk(host, rocketSVG(rs), rx0, ry0)
      mv(r, [[rx0, ry0, 0, ang], [rx0 + (tx - rx0) * 0.1, ry0 + (ty - ry0) * 0.1, 1, ang, 1, 0.1], [tx - 26 * rs, ty - 5 * rs, 1, ang]], 900)
      later(() => { r.remove(); boom(ctx, tx, ty, us) }, 900)
      beam.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 900, fill: 'forwards' })
      mv(u, [[xb, uy, 1, 0], [ux, uy, 1, 0, 1, 0.9 / 2.6], [ux - 70 * us, uy + y.fall, 0, -50]], 2600)
      mv(p, [[pxB, yR, 1], [pxB, yR, 1, 0, 1, 0.18], [pxB - 8, y.yG, 1, 0, 1, 0.3], [pxB - 8, y.yG - 6, 1, 0, 1, 0.33], [pxB - 8, y.yG, 1, 0, 1, 0.36], [pxB - 8, y.yG, 1, 0, 1, 0.9], [pxB - 8, y.yG, 0]], 5000)
      say(bub(p, tl(sc.safe), d, bp, y.bw), 1800, 2600)
      end(5100)
    }
  }, t2 * 1000)
  return t2 * 1000 + 6500
}

/** Một hạt WAAPI tự xoá khi chạy xong. */
function add(host, html, x, y, fr, dur) {
  const e = document.createElement('div')
  e.style.cssText = `position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:0;height:0;pointer-events:none`
  e.innerHTML = html
  host.appendChild(e)
  e.animate(fr, { duration: dur, fill: 'both' }).onfinish = () => e.remove()
}

/** Sao ước bay ngang header 6,8 giây kèm nhãn "Bấm để ước". */
function spawnWish(host, w, wishes) {
  if (!host.isConnected) return
  const R = Math.random
  const x0 = w.x + R() * w.xr, y0 = w.y + R() * w.yr, dx = -(w.dx + R() * w.dxr), dy = w.dy + R() * w.dyr, ang = (Math.atan2(dy, dx) * 180) / Math.PI
  const el = document.createElement('div')
  el.style.cssText = `position:absolute;left:${x0.toFixed(0)}px;top:${y0.toFixed(0)}px;width:0;height:0;pointer-events:auto;cursor:pointer`
  el.innerHTML = `<div style="position:absolute;left:0;top:0;transform:rotate(${ang.toFixed(1)}deg)"><span style="position:absolute;left:-150px;top:-1px;width:150px;height:2px;border-radius:2px;background:linear-gradient(90deg,rgba(255,240,200,0),rgba(255,250,235,.95))"></span></div>`
    + '<span style="position:absolute;left:-28px;top:-28px;width:56px;height:56px;border-radius:50%"></span>'
    + '<span data-h style="position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 8px 3px rgba(255,244,200,.95),0 0 26px 10px rgba(240,183,92,.45)"></span>'
    + '<span style="position:absolute;left:-22px;top:-22px;width:44px;height:44px;box-sizing:border-box;border-radius:50%;border:1px dashed rgba(255,240,200,.55);animation:badgeSpin 5s linear infinite"></span>'
    + `<span style="position:absolute;left:0;top:26px;transform:translateX(-50%);white-space:nowrap;font:600 11.5px/1 var(--font-sans);color:#FFF4D6;text-shadow:0 0 8px rgba(240,183,92,.9),0 1px 2px rgba(0,0,0,.8)">${esc(t('sky.tip.wish'))}</span>`
  host.appendChild(el)
  const a = el.animate([{ transform: 'translate(0px,0px)', opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.9 }, { transform: `translate(${dx.toFixed(0)}px,${dy.toFixed(0)}px)`, opacity: 0 }], { duration: 6800, fill: 'both' })
  a.onfinish = () => el.remove()
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    const hb = host.getBoundingClientRect(), k = host.offsetWidth / (hb.width || 1), b = el.querySelector('[data-h]').getBoundingClientRect()
    const x = (b.left + b.width / 2 - hb.left) * k, y = (b.top + b.height / 2 - hb.top) * k
    a.cancel()
    el.remove()
    burst(host, x, y, wishes())
  })
}

/** Bung sáng tại chỗ bấm + thẻ "Điều ước" với một điều ước ngẫu nhiên. */
function burst(host, x, y, wishes) {
  const R = Math.random
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, r = 30 + R() * 40, s = 2 + R() * 2.4
    add(host, `<span style="position:absolute;left:${-s / 2}px;top:${-s / 2}px;width:${s}px;height:${s}px;border-radius:50%;background:#FFF7D6;box-shadow:0 0 6px 2px rgba(253,230,138,.85)"></span>`, x, y, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${(Math.cos(a) * r).toFixed(1)}px,${(Math.sin(a) * r).toFixed(1)}px)`, opacity: 0 }], 900 + R() * 500)
  }
  add(host, '<svg width="40" height="40" viewBox="-20 -20 40 40" style="position:absolute;left:-20px;top:-20px;overflow:visible;filter:drop-shadow(0 0 8px rgba(253,230,138,.95))"><path d="M0 -18 L4 -4 L18 0 L4 4 L0 18 L-4 4 L-18 0 L-4 -4 Z" fill="#FFF7D6"/></svg>', x, y, [{ transform: 'scale(.2) rotate(0deg)', opacity: 0 }, { transform: 'scale(1.2) rotate(45deg)', opacity: 1, offset: 0.3 }, { transform: 'scale(0) rotate(120deg)', opacity: 0 }], 1200)
  const w = wishes[Math.floor(R() * wishes.length)] || ''
  const hw = Math.min(180, host.offsetWidth / 2 - 10), bx = Math.max(hw, Math.min(host.offsetWidth - hw, x))
  add(host, `<div style="position:absolute;left:0;top:0;transform:translateX(-50%);padding:9px 14px;border-radius:12px;background:rgba(8,14,30,.92);border:1px solid rgba(253,230,138,.45);box-shadow:0 0 26px rgba(253,230,138,.22);display:flex;flex-direction:column;align-items:center;gap:5px;white-space:nowrap"><span style="font:600 10px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:#FDE68A">${esc(t('sky.wishTitle'))}</span><span style="font:600 13.5px/1.25 var(--font-sans);color:#F4F7FF">${esc(w)}</span></div>`, bx, y + 28, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)', offset: 0.08 }, { opacity: 1, transform: 'translateY(0)', offset: 0.86 }, { opacity: 0, transform: 'translateY(-6px)' }], 4400)
}
