import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '#contexts/AppContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { t, tBranch } from '#i18n'
import { myMember } from '#lib/money.js'
import { getMyHeroStats, getPlayerForm5 } from '#lib/homePersonal.js'
import { getPersonalHighlights } from '#lib/activity.js'
import { isFemalePlayer } from '#lib/rating.js'
import { calculateSeasonLeaderboard } from '#lib/season.js'
import { OWL_WAKE, SKY_ACT_MS, SKY_CAST, UFO_GIVE_BACK, UFO_HUH, beatenBy, createBags, opponentsOf, fxMs, isLate, lastMatchOf, moonAge, shortName, skyFacts, skyFoes, skyLines, stageNext, ufoPool, ufoScript } from '#lib/sky.js'
import cfg from '#config/app.js'

/**
 * Nền bầu trời động (thiết kế "Home · Nền bầu trời"). AppLayout gắn ở các route trong
 * app.json → sky.routes (`mode` 'full': nền + nhân vật — Trang chủ, BXH), sky.liteRoutes ('lite': trăng, sao,
 * mưa sao băng, cá voi sao, thành phố xa và cú mèo — các trang chính khác, cho nhẹ máy) và sky.bgRoutes ('bg', trang con: nền đứng yên).
 * - Tối: trời sao — trăng có chú Cuội, cá voi sao, ngân hà, sao băng, sao chổi, đom đóm, chòm sao
 *   hiện ở header, mưa sao băng, sao ước bay ngang (bấm để ước).
 * - Sáng: hoàng hôn trên biển mây — ráng chiều, sao sớm, ba lớp mây cuộn, chim, máy bay.
 * - Nhân vật / hoạt cảnh bật ở trang Giao diện (ThemeContext → skyPrefs) cùng ghé, mỗi loại "cứ N giây"
 *   một lượt (cú mèo chỉ sau 22h); câu thoại theo số liệu thật. Tắt "hiệu ứng nền" thì đêm chỉ còn trăng,
 *   sao và mưa sao băng.
 *
 * Hai lớp `position: fixed`: lớp trời dưới cùng (z -1, sau mọi nội dung) và lớp nhân vật trên nội
 * dung (z 35: trên header mobile 30, dưới footer nav 40 và dialog 60). Trời đứng yên, nội dung
 * cuộn; nhân vật mờ dần khi cuộn `scrollRef` (thẻ <main>). Thẻ trong suốt nhờ token kính ở
 * `effects.css` → `[data-sky]` (AppLayout gắn cùng lúc với component này).
 *
 * Cảnh vẽ trên khung 1440×940 của thiết kế rồi phóng cho phủ kín màn. Mobile giữ tỉ lệ 1:1, lấy
 * khúc trời quanh mặt trăng; nhân vật mobile canh theo tâm màn.
 *
 * Xem trước: `?sky=owl|banner|top1|hero|ufo|all` trên URL trang có nền — chỉ cho đúng nhân vật đó ra, bỏ
 * qua công tắc ở trang Giao diện (cú mèo không cần chờ 22h).
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
// Mọi câu có {name} (tên bạn, người trên, đối thủ) đi qua đây → tên dài được cắt gọn một chỗ.
/** Cỡ px hiển thị cố định trong lớp nhân vật: `fk` = 1 / độ phóng khung (xem `fk` trong SkyBackdrop). */
const sk = (n, fk = 1) => `${(n * fk).toFixed(1)}px`
const tl = (line) => (line ? t(line[0], line[1]?.name ? { ...line[1], name: shortName(line[1].name) } : line[1]) : '')
/** Chữ của một câu băng rôn: câu gạ kèo có nhóm tên (`dares`) thì rút một tên bằng túi xáo riêng. */
const bannerText = (e, bags) => tl(e?.[1]?.dares ? [e[0], { name: e[1].dares[bags('dare', e[1].dares.length)] }] : e)
/** Thời lượng một lượt bay sao ước — khớp spawnWish (6,8 s). Băng rôn: `ly.bnMs` theo bố cục (xem LD / mobileLayout). */
const WISH_FLY_MS = 6800

/* ============================ BỐ CỤC ============================ */

// Desktop: toạ độ trên khung 1440 (gồm cả sidebar 248). Mobile: khung 390 của thiết kế, `mobileLayout`
// dời theo bề rộng thật để mặt trăng luôn ở giữa màn.
const LD = {
  W, mx: 960, my: 22, md: 72, ox: 930, oy: 62, os: 20, br: 516, bt: 56, bw: 210, tail: 'r', bnT: 3, bnD: 1960, bnMs: 26000,
  tX: 770, tY: 30, tG: 7,
  wish: { x: 720, xr: 560, y: 16, yr: 34, dx: 380, dxr: 220, dy: 70, dyr: 60 },
  sc: { uy: 4, xa: 1120, xb: 860, yG: 62, yUp: 22, us: 1, ps: 1.1, hy: 4, hs: 0.9, vE: 160, vD: 45, vH: 170, bw: 240, rk: [320, 96], fall: 150 },
}
function mobileLayout(w) {
  const d = w / 2 - 195
  return {
    m: 1, W: w, mx: 174 + d, my: 1, md: 42, ox: 222 + d, oy: 14, os: 16, br: 14 + d, bt: 46, bw: 196, tail: 't', tailR: 141,
    bnT: 44, bnD: w + 510, bnMs: 16640, tX: 250 + d, tY: 46, tG: 4.5,
    wish: { x: 250 + d, xr: 110, y: 52, yr: 16, dx: 170, dxr: 90, dy: 30, dyr: 30 },
    sc: { uy: 2, xa: 290 + d, xb: 180 + d, yG: 50, yUp: 16, us: 0.7, ps: 0.85, hy: 46, hs: 0.7, vE: 60, vD: 20, vH: 65, bw: 180, rk: [150, 70], fall: 110 },
  }
}
/** Trời đêm mobile: trăng nhỏ, chòm sao không tên, cá voi nhỏ bơi ngang đúng bề rộng màn. */
const nightMobile = (w) => ({
  mx: 874, my: 1, md: 42, cx: 790, cy: 3, cs: 0.28, ch: 34, cw: 56, nl: 1, ff: 10,
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

export default function SkyBackdrop({ mode, isMobile, scrollRef }) {
  // 'lite' vẫn chuyển động nhưng chỉ cú mèo; 'bg' đứng yên hẳn.
  const chars = mode !== 'bg', full = mode === 'full'
  const { db } = useApp()
  const { isDark, skyMotion, skyPrefs: P } = useTheme()
  const [params] = useSearchParams()
  const vp = useViewport()
  const [osMotion] = useState(() => {
    try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return true }
  })
  // Tắt khi hệ điều hành bật "Giảm chuyển động" hoặc người dùng tắt ở Cài đặt → Chung (theo thiết bị):
  // trời vẫn vẽ đủ nhưng đứng yên, không nhân vật bay / sao ước / hoạt cảnh.
  const motion = osMotion && skyMotion
  // Trang con (chỉ nền) vẽ trời đứng yên: hay mở cả buổi tối (ghi điểm ở chi tiết buổi tập), trời
  // chạy liên tục suốt chừng đó là tốn pin, nóng máy.
  const live = motion && chars
  // Túi xáo dùng chung cho mọi lựa chọn ngẫu nhiên: câu thoại (kể cả khi bấm), kết cục UFO, người bị
  // bắt, điều ước, hình xếp — rút đủ một lượt mới xáo lượt mới (lib/sky.js → createBags).
  const [bags] = useState(() => createBags())
  // Chốt giờ đúng MỘT lần khi mở trang: đang mở mà đồng hồ qua 22h thì cú chưa ra, phải mở lại.
  const [opened] = useState(() => ({ now: Date.now(), late: isLate(new Date().getHours()) }))
  // Nhân vật ghé thăm: bật ở trang Giao diện (cú mèo thêm điều kiện khuya). `?sky=` xem trước thì chỉ đúng
  // nhân vật đó, bỏ qua công tắc.
  const q = params.get('sky')
  const castKey = !chars ? '' : SKY_CAST.filter((k) => (full || k === 'owl') && (q ? q === 'all' || q === k : P.on[k] && (k !== 'owl' || opened.late))).join()
  const cast = useMemo(() => (castKey ? castKey.split(',') : []), [castKey])
  // Nhịp "cứ N giây" mới nhất — các lịch đọc qua ref lúc hẹn lượt kế, đổi N không xoá cảnh đang bay.
  const prefRef = useRef(P)
  useEffect(() => { prefRef.current = P }, [P])
  const firstMs = (k) => Math.min(C[k + 'FirstMs'], fxMs(P, k))

  // Số liệu nhân vật nói theo — cùng hàm với các thẻ trang chủ. Trang chỉ có nền thì khỏi tính.
  const me = useMemo(() => myMember(db), [db])
  const id = me?.id || '', name = me?.name || ''
  const st = useMemo(() => {
    const now = new Date(opened.now)
    if (!chars || !id) return skyFacts({ now })
    const last = lastMatchOf(db.matches, id)
    // Người để réo tên (chỉ thành viên CLB, không lấy khách): { id, name, female }.
    const who = (pid) => {
      const m = pid && (db.members || []).find((x) => x.id === pid)
      return m ? { id: m.id, name: m.name, female: isFemalePlayer(m) } : null
    }
    const top = (calculateSeasonLeaderboard(db)?.leaderboard || []).map((r) => who(r.id)).filter(Boolean)
    const arch = getPersonalHighlights(id, db).find((x) => x.type === 'arch_rival')?.rivalId
    return {
      ...skyFacts({ hero: getMyHeroStats(db, id), form: getPlayerForm5(db, id), lastAt: last?.at || 0, now }),
      ...(() => {
        const opp = opponentsOf(db.matches, id)
        return skyFoes({ meId: id, female: isFemalePlayer(me), top, arch: who(arch), beatBy: who(beatenBy(last, id)), beaters: opp.beaters.map(who), rivals: opp.rivals.map(who) })
      })(),
    }
  }, [chars, db, id, me, opened.now])
  // Điều ước và băng rôn giữ nguyên [key, tham số]: câu réo tên rút tên lúc hiện (burst · bannerText).
  const lines = useMemo(() => {
    const L = skyLines(st, name)
    return { owl: L.owl.map(tl), banner: L.banner, hero: L.hero.map(tl), wish: L.wish }
  }, [st, name])

  // Cảnh khung 1440 phủ kín màn (desktop) / lấy khúc quanh trăng ở tỉ lệ 1:1 (mobile).
  const s = isMobile ? Math.max(1, vp.h / H) : Math.max(vp.w / W, vp.h / H)
  const left = isMobile ? vp.w / 2 - MOON_M * s : (vp.w - W * s) / 2
  const stage = { position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${px(left)},0) scale(${s.toFixed(4)})` }
  const mw = Math.round(vp.w / s)
  // Chiều cao màn tính theo khung của lớp: UFO chiếu tia và người bị hút trồi lên từ đúng mép dưới màn.
  // Đọc qua ref lúc cảnh bắt đầu — để trong deps thì bật bàn phím ảo / kéo cửa sổ là cảnh đang bay bị xoá.
  const vh = Math.round(vp.h / s)
  const vhRef = useRef(vh)
  useEffect(() => { vhRef.current = vh }, [vh])
  const ly = useMemo(() => (isMobile ? mobileLayout(mw) : LD), [isMobile, mw])
  const box = isMobile ? { position: 'absolute', left: 0, top: 0, width: mw, height: H, transformOrigin: '0 0', transform: `scale(${s.toFixed(4)})` } : stage
  // Lớp nhân vật phóng theo màn (×1.3–1.6 ở màn lớn) nên chữ cũng phóng theo. `fk` = 1 / phóng: bóng thoại,
  // băng rôn, thẻ điều ước nhân cỡ chữ với nó (sk()) để luôn đúng cỡ thiết kế 11–12px.
  // Desktop (màn đọc xa hơn) chữ to hơn thiết kế một nấc: ×1.15 (bóng thoại 13px, băng rôn 12.5px, thẻ ước 14px).
  const fk = (isMobile ? 1 : 1.15) / s
  const fkRef = useRef(fk)
  useEffect(() => { fkRef.current = fk }, [fk])
  const nightOpt = useMemo(() => (isMobile ? nightMobile(mw) : {}), [isMobile, mw])
  const age = moonAge(C.moon, opened.now)
  // Trời ngày theo giờ mở trang: trước 12h là bình minh, từ 12h là hoàng hôn (không có kiểu nắng trưa gắt).
  const phase = new Date(opened.now).getHours() < 12 ? 'dawn' : 'dusk'

  const amb = full && P.on.ambient
  const lite = mode === 'lite'
  const showWhale = (full || lite) && P.on.ambient
  const showHorizon = (full || lite) && P.on.ambient
  const back = useMemo(
    () => (
      isDark ? (
        <Night
          o={nightOpt}
          motion={live}
          amb={amb}
          age={age}
          full={C.moon === 'full'}
          showWhale={showWhale}
          showHorizon={showHorizon}
        />
      ) : (
        <Day motion={live} amb={amb} phase={phase} />
      )
    ),
    [isDark, nightOpt, live, age, amb, phase, showWhale, showHorizon],
  )

  // Hoạt cảnh trời đêm định kỳ: bật / "cứ N giây" ở trang Giao diện. Chỉ trang 'full', không giảm chuyển động.
  const nightLive = live && isDark && full
  const cuoi = useEvery(nightLive && P.on.cuoi, firstMs('cuoi'), fxMs(P, 'cuoi'), SKY_ACT_MS.cuoi)
  const fire = useEvery(nightLive && P.on.fireShuttle, firstMs('fireShuttle'), fxMs(P, 'fireShuttle'), SKY_ACT_MS.fireShuttle)
  const eclipse = useEvery(nightLive && P.on.eclipse, firstMs('eclipse'), fxMs(P, 'eclipse'), SKY_ACT_MS.eclipse)
  // Sao băng cầu lửa xuất phát trong khúc trời đang thấy, lệch phải; chỗ đổi theo lượt (giả ngẫu nhiên, đứng yên khi re-render).
  const visW = vp.w / s, vis0 = -left / s
  const fireAt = { x: vis0 + visW * (0.55 + 0.35 * rnd(fire.n * 3 + 1)), y: 10 + 90 * rnd(fire.n * 3 + 2), dx: -(visW * 0.55 + 220), dy: (visW * 0.55 + 220) * 0.5317 }

  // Câu thoại mới nhất cho cảnh viết tay (siêu nhân, UFO, sao ước) — đọc lúc cảnh bắt đầu, không
  // dựng lại cảnh đang bay khi db đồng bộ.
  const data = useRef({ st, lines, name })
  useEffect(() => { data.current = { st, lines, name } }, [st, lines, name])

  // Cuộn nội dung → nhân vật trôi lên và mờ dần, hết 80px thì ẩn (trời vẫn đứng yên). `awayRef` = đang ẩn vì
  // cuộn: sân khấu không cho cảnh mới ra (cảnh đang diễn vẫn chạy nốt), cuộn lên lại thì diễn tiếp.
  const fadeRef = useRef(null)
  const awayRef = useRef(false)
  useEffect(() => {
    const el = fadeRef.current, main = scrollRef?.current
    if (!el || !main) return
    const on = () => {
      const y = main.scrollTop
      el.style.transform = y ? `translateY(${px(-y / s)})` : ''
      el.style.opacity = String(Math.max(0, 1 - y / 80))
      el.style.visibility = y > 80 ? 'hidden' : ''
      awayRef.current = y > 80
    }
    on()
    main.addEventListener('scroll', on, { passive: true })
    return () => main.removeEventListener('scroll', on)
  }, [s, scrollRef])

  // Sân khấu chung: siêu nhân, UFO (cảnh viết tay bằng Web Animations), băng rôn và xếp hình đom đóm (chỉ
  // đêm) THAY PHIÊN — mỗi lúc một cảnh. Mỗi cảnh giữ nhịp riêng: lượt đầu sau *FirstMs (app.json), rồi nghỉ
  // "N giây" (trang Giao diện) tính từ lúc diễn xong. Tới lượt mà sân đang bận thì đợi cảnh kia xong +
  // sky.stageGapMs; nhiều cảnh cùng chờ thì cảnh tới hạn sớm nhất lên trước.
  const sceneRef = useRef(null)
  // Băng rôn: mỗi `lap` là MỘT lượt bay (key đổi → animation chạy lại), `on` = đang bay — bay xong là gỡ, khỏi
  // để phần tử vô hình chạy hiệu ứng ngầm. Đom đóm: `n` = lượt, `on` = đang xếp (mỗi lượt một hình rút từ túi
  // xáo, đủ cả bộ hình mới lặp).
  const [ban, setBan] = useState({ lap: 0, i: 0, on: false })
  const [form, setForm] = useState({ n: 0, on: false })
  const stageKinds = cast.filter((k) => k !== 'owl' && (k !== 'top1' || isDark)).join()
  useEffect(() => {
    const host = sceneRef.current
    if (!live || !stageKinds || !host) return
    const timers = new Set()
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn() }, ms); timers.add(id) }
    const t0 = Date.now()
    const due = Object.fromEntries(stageKinds.split(',').map((k) => [k, t0 + Math.min(C[k + 'FirstMs'], fxMs(prefRef.current, k))]))
    let free = 0
    /** Cho cảnh `k` lên sân, trả về thời lượng (ms). */
    const play = (k) => {
      if (k === 'banner') {
        const i = bags('banner', data.current.lines.banner.length), text = bannerText(data.current.lines.banner[i], bags)
        setBan((b) => ({ lap: b.lap + 1, i, text, on: true }))
        later(() => setBan((b) => ({ ...b, on: false })), ly.bnMs)
        return ly.bnMs
      }
      if (k === 'top1') {
        setForm((f) => ({ n: f.n + 1, on: true }))
        later(() => setForm((f) => ({ ...f, on: false })), FORM_MS)
        return FORM_MS
      }
      return (k === 'hero' ? heroFly : ufoScene)({ host, later, bags, dark: isDark, ly, H: floorY(host, vhRef.current), fk: fkRef.current, ...data.current })
    }
    const tick = () => {
      // Tab ẩn thì animation không chạy tới onfinish — đợi tab hiện lại mới diễn, khỏi chất đống phần tử.
      // Đang cuộn xuống (lớp nhân vật ẩn): diễn cũng chẳng ai thấy — đợi cuộn lên, cảnh tới hạn ra ngay.
      if (document.hidden || awayRef.current || document.querySelector('[aria-modal="true"]') || !host.isConnected) return later(tick, 1000)
      const now = Date.now()
      const { k, at } = stageNext(due, free)
      if (at > now) return later(tick, at - now)
      const end = now + play(k)
      free = end + C.stageGapMs
      due[k] = end + fxMs(prefRef.current, k)
      later(tick, free - now)
    }
    tick()
    return () => {
      timers.forEach(clearTimeout)
      host.replaceChildren()
      setBan((b) => (b.on ? { ...b, on: false } : b))
      setForm((f) => (f.on ? { ...f, on: false } : f))
    }
  }, [live, stageKinds, isDark, ly, bags])

  // Dialog / sheet đang mở (aria-modal): hoạt hình CSS đã dừng (effects.css) nhưng cảnh Web Animations (siêu nhân, UFO,
  // sao ước) thì không — lớp mờ toàn màn của dialog phải làm mờ lại cả màn mỗi khung hình, máy yếu mất hình / giật.
  // Dừng tay đúng những animation đang chạy, đóng dialog thì chạy tiếp đúng những cái đó.
  // Gỡ hẳn hai lớp trời khi có popup — dự phòng cho trình duyệt không hiểu :has (effects.css làm việc này tức thì).
  const [modal, setModal] = useState(false)
  useEffect(() => {
    const iv = setInterval(() => setModal(!!document.querySelector('[aria-modal="true"]')), 300)
    return () => clearInterval(iv)
  }, [])
  useEffect(() => {
    if (!motion) return
    const held = new Set()
    const iv = setInterval(() => {
      const modal = !!document.querySelector('[aria-modal="true"]')
      if (modal && !held.size) {
        for (const h of [sceneRef.current, flyRef.current]) {
          h?.getAnimations?.({ subtree: true }).forEach((x) => { if (x.playState === 'running') { x.pause(); held.add(x) } })
        }
      } else if (!modal && held.size) {
        held.forEach((x) => { if (x.playState === 'paused') x.play() })
        held.clear()
      }
    }, 400)
    return () => clearInterval(iv)
  }, [motion])

  // Sao ước (chỉ đêm): bay ngang header, bấm vào → bung sáng + một điều ước. Cứ N giây một ngôi.
  const flyRef = useRef(null)
  useEffect(() => {
    const host = flyRef.current
    if (!motion || !isDark || !full || !P.on.wish || !host) return
    let id
    const go = (ms) => {
      id = setTimeout(() => {
        if (document.hidden) return go(1000)
        spawnWish(host, ly.wish, () => data.current.lines.wish, bags)
        go(fxMs(prefRef.current, 'wish'))
      }, ms)
    }
    go(Math.min(C.wishFirstMs, fxMs(prefRef.current, 'wish')))
    return () => { clearTimeout(id); host.replaceChildren() }
  }, [motion, isDark, full, P.on.wish, ly, bags])

  // Cú mèo: `k` đổi để nghiêng đầu + chạy lại bóng thoại; `i` = câu đang nói, rút từ túi xáo.
  // Để màn hình yên N giây (trang Giao diện → Cú ngủ gật) thì `sleep` (ngủ gật, zzZ); bấm lúc đang ngủ → `wake` tăng (giật mình, rơi
  // lông) và `say` = câu giật mình, thay câu thường cho tới lần đổi câu kế. Bấm bóng thoại → `hide` (tắt bóng
  // cho khỏi che nội dung) tới khi bấm con cú.
  const hasOwl = cast.includes('owl')
  const [owl, setOwl] = useState(() => ({ k: 0, i: bags('owl', lines.owl.length), say: null, sleep: false, wake: 0, hide: false }))
  const nextOwl = () => {
    if (owl.sleep) {
      const say = OWL_WAKE[bags('owlWake', OWL_WAKE.length)]
      setOwl((o) => ({ ...o, say, sleep: false, wake: o.wake + 1, hide: false }))
      return
    }
    const i = bags('owl', lines.owl.length)
    setOwl((o) => ({ ...o, k: o.k + 1, i, say: null, hide: false }))
  }
  const hideOwl = () => setOwl((o) => ({ ...o, hide: true }))
  const owlAwake = !owl.sleep
  useEffect(() => {
    if (!live || !hasOwl || !owlAwake || !P.on.owlDoze) return
    let last = Date.now()
    const wait = fxMs(prefRef.current, 'owlDoze')
    const poke = () => { last = Date.now() }
    const evs = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']
    evs.forEach((e) => window.addEventListener(e, poke, { passive: true, capture: true }))
    const iv = setInterval(() => {
      if (!document.hidden && Date.now() - last >= wait) setOwl((o) => ({ ...o, sleep: true }))
    }, 1000)
    return () => { clearInterval(iv); evs.forEach((e) => window.removeEventListener(e, poke, { capture: true })) }
  }, [live, hasOwl, owlAwake, P.on.owlDoze])

  // Băng rôn (lịch ở sân khấu chung phía trên): bấm → câu kế từ túi xáo.
  const hasBanner = cast.includes('banner')
  const nextBanner = () => {
    const i = bags('banner', lines.banner.length), text = bannerText(lines.banner[i], bags)
    setBan((b) => ({ ...b, i, text }))
  }

  return (
    <>
      <div aria-hidden="true" data-sky-fx="" style={modal ? S.gone : S.back}>
        <div style={stage}>
          {back}
          {isDark && <MoonActs o={nightOpt} age={age} full={C.moon === 'full'} cuoi={cuoi.on ? cuoi.n : 0} eclipse={eclipse.on ? eclipse.n : 0} />}
          {isDark && amb && <MoonClouds o={nightOpt} motion={live} />}
        </div>
      </div>
      <div data-sky-fx="" style={modal ? S.gone : S.top}>
        {isDark && (
          <div style={stage}>
            <Shower motion={live} />
            {fire.on && <FireShuttle key={fire.n} {...fireAt} />}
          </div>
        )}
        <div style={box}>
          <div ref={fadeRef} style={S.fill}>
            {hasOwl && (
              <Owl ly={ly} fk={fk} dark={isDark} motion={motion} k={owl.k} sleep={owl.sleep} wake={owl.wake} fy={vh - ly.oy}
                line={owl.say ? tl(owl.say) : lines.owl[owl.i % lines.owl.length]} hide={owl.hide} onNext={nextOwl} onHide={hideOwl} />
            )}
            {/* Key có tiền tố: băng rôn và lượt đom đóm là anh em cùng cha, key số trơn trùng nhau (lượt 4 = lượt 4)
                thì React để sót bản cũ — từng ra 2–3 máy bay cùng lúc và đọng phần tử chạy ngầm. */}
            {hasBanner && ban.on && (
              <Banner key={'ban' + ban.lap} ly={ly} fk={fk} dark={isDark} line={ban.text} onNext={nextBanner} />
            )}
            {form.on && <Top1 key={'form' + form.n} ly={ly} bags={bags} />}
            <div ref={sceneRef} style={S.fill} />
          </div>
          <div ref={flyRef} style={S.fill} />
        </div>
      </div>
    </>
  )
}

const S = {
  gone: { display: 'none' },
  back: { position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' },
  top: { position: 'fixed', inset: 0, zIndex: 35, overflow: 'hidden', pointerEvents: 'none' },
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
  // Song Tử: hai anh em đứng cạnh nhau, đầu là Castor / Pollux
  [[[20, 0], [60, 6], [18, 40], [58, 44], [14, 82], [54, 86], [6, 120], [30, 124], [48, 124], [72, 120]], [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [4, 6], [4, 7], [5, 8], [5, 9]]],
  // Ngưu Lang – Chức Nữ: đàn Lyra quanh sao Chức Nữ (trái trên), sao Ngưu Lang kẹp giữa hai sao nhỏ (phải dưới)
  [[[10, 10], [24, 28], [36, 30], [30, 48], [18, 46], [128, 92], [116, 82], [140, 102]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1], [5, 6], [5, 7]]],
  // Tua Rua (Thất Tinh Mão — Pleiades): chùm sao nhỏ như cái gáo con
  [[[20, 30], [38, 22], [52, 34], [40, 44], [64, 46], [30, 54], [52, 62]], [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [3, 5], [4, 6]]],
  // Cây Vợt (chòm của CLB): mặt vợt bầu dục + cán
  [[[40, 0], [66, 10], [76, 36], [66, 62], [40, 72], [14, 62], [4, 36], [14, 10], [40, 100], [40, 136]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [4, 8], [8, 9]]],
]
/** Mỗi chòm hiện 25 s rồi nhường chòm kế — chu kỳ = số chòm × 25 s (keyframe skyConsShow / skyConsLine tính cho 10 chòm). */
const CONS_CYC = CONS.length * 25
const STAR_TILES = [
  ['radial-gradient(1px 1px at 10px 14px,#fff,transparent),radial-gradient(1px 1px at 46px 60px,rgba(220,230,255,.9),transparent),radial-gradient(1px 1px at 88px 22px,#fff,transparent),radial-gradient(1px 1px at 112px 78px,rgba(255,245,220,.9),transparent),radial-gradient(1px 1px at 70px 90px,#fff,transparent),radial-gradient(1px 1px at 28px 44px,rgba(200,255,235,.8),transparent)', '130px 96px', 7, 0, 92],
  ['radial-gradient(1.5px 1.5px at 12px 18px,#fff,transparent),radial-gradient(1px 1px at 86px 64px,#fff,transparent),radial-gradient(1.5px 1.5px at 150px 30px,rgba(190,240,255,1),transparent),radial-gradient(1px 1px at 210px 122px,#fff,transparent),radial-gradient(1.5px 1.5px at 40px 150px,rgba(255,240,210,.95),transparent)', '240px 180px', 4.5, -1, 96],
  ['radial-gradient(2px 2px at 60px 40px,rgba(210,200,255,1),transparent),radial-gradient(1.5px 1.5px at 170px 110px,#fff,transparent),radial-gradient(1.5px 1.5px at 280px 20px,#fff,transparent),radial-gradient(2px 2px at 330px 150px,rgba(167,240,255,1),transparent)', '360px 220px', 6.5, -3, 100],
  ['radial-gradient(2.5px 2.5px at 90px 60px,#fff,transparent),radial-gradient(2px 2px at 400px 200px,rgba(255,236,200,1),transparent),radial-gradient(2.5px 2.5px at 260px 120px,rgba(200,215,255,1),transparent)', '520px 300px', 5.5, -2, 90],
]
const SHOOTS = [[70, 1300, 9, 1, 170], [30, 900, 13, 5.5, 130], [200, 1420, 17, 9, 210], [16, 620, 23, 14, 150], [360, 1100, 19, 3, 140]]

/** Vị trí, cỡ, độ sáng và hình (clip theo tuổi trăng) của mặt trăng — Night và MoonActs dùng chung. */
function moonShape(o, age, full) {
  const ph = (age / 29.530589) * 2 * Math.PI, lit = (1 - Math.cos(ph)) / 2, wax = ph < Math.PI
  const D = o.md || 72, Rr = D / 2, MX = o.mx ?? 960, MY = o.my ?? 22
  const tw = Math.abs(Math.cos(ph)) * D, ts = wax ? (lit < 0.5 ? 0 : 1) : (lit < 0.5 ? 1 : 0)
  const clip = full ? 'none' : `path('M${Rr} 0 A${Rr} ${Rr} 0 0 ${wax ? 1 : 0} ${Rr} ${D} A${(tw / 2).toFixed(2)} ${Rr} 0 0 ${ts} ${Rr} 0 Z')`
  return { D, Rr, MX, MY, lit, clip }
}

function Night({ o, motion, amb = true, age, full, showWhale = amb, showHorizon = amb }) {
  // `amb` = nhóm "hiệu ứng nền" (trang Giao diện). Tắt thì chỉ còn trời, sao, trăng, sương đáy (+ mưa sao băng ở lớp trên).
  const an = (v) => (motion ? v : 'none')
  const { D, Rr, MX, MY, lit, clip } = moonShape(o, age, full)
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
      {amb && <div style={{ position: 'absolute', inset: '-12%', background: 'radial-gradient(40% 35% at 70% 6%,rgba(88,80,200,.30),transparent 70%),radial-gradient(35% 40% at 10% 72%,rgba(20,140,150,.22),transparent 70%),radial-gradient(30% 30% at 55% 58%,rgba(150,70,180,.14),transparent 70%)', animation: an('skyNeb 34s ease-in-out infinite alternate') }} />}
      {amb && <div style={{ position: 'absolute', left: -300, top: 240, width: 2100, height: 320, transform: 'rotate(-17deg)', background: 'radial-gradient(50% 50% at 50% 50%,rgba(190,205,255,.18),rgba(170,190,240,.06) 50%,transparent 75%),radial-gradient(30% 40% at 34% 55%,rgba(200,180,255,.14),transparent 70%),radial-gradient(25% 35% at 70% 45%,rgba(140,240,215,.10),transparent 70%)', }} />}
      {amb && <div style={{ position: 'absolute', left: -300, top: 240, width: 2100, height: 320, transform: 'rotate(-17deg)', backgroundImage: 'radial-gradient(1px 1px at 8px 10px,#fff,transparent),radial-gradient(1px 1px at 30px 34px,rgba(220,230,255,.9),transparent),radial-gradient(1px 1px at 52px 18px,#fff,transparent),radial-gradient(1px 1px at 20px 44px,rgba(255,240,220,.9),transparent),radial-gradient(1px 1px at 62px 40px,#fff,transparent)', backgroundSize: '70px 50px', WebkitMaskImage: 'radial-gradient(50% 42% at 50% 50%,#000,transparent)', maskImage: 'radial-gradient(50% 42% at 50% 50%,#000,transparent)', animation: an('skyTwinkleB 9s ease-in-out infinite') }} />}
      {/* Điện thoại (o.ff): chỉ 2 lớp sao đầu nháy, 2 lớp sau đứng yên — mỗi lớp nháy là một vùng đệm GPU cỡ cả màn */}
      {STAR_TILES.map(([img, size, dur, delay, fade], i) => (
        <div key={'s' + i} style={{ position: 'absolute', inset: 0, backgroundImage: img, backgroundSize: size, WebkitMaskImage: `linear-gradient(to bottom,#000,transparent ${fade}%)`, maskImage: `linear-gradient(to bottom,#000,transparent ${fade}%)`, animation: o.ff && i >= 2 ? 'none' : an(`skyTwinkleB ${dur}s ease-in-out ${delay}s infinite`) }} />
      ))}
      {BRIGHT.map(([x, y, sz, d], i) => (
        <span key={'b' + i} style={{ position: 'absolute', left: x - sz / 2, top: y - sz / 2, width: sz, height: sz, background: 'radial-gradient(circle,#fff 0,#fff 1.2px,rgba(210,225,255,.6) 2.5px,transparent 5px),linear-gradient(90deg,transparent,rgba(215,228,255,.85),transparent) 50% 50%/100% 1px no-repeat,linear-gradient(0deg,transparent,rgba(215,228,255,.85),transparent) 50% 50%/1px 100% no-repeat', filter: o.ff ? undefined : 'drop-shadow(0 0 4px rgba(200,220,255,.9))', animation: an(`skyStarPulse ${d}s ease-in-out ${(-i * 1.3).toFixed(1)}s infinite`) }} />
      ))}
      <span style={{ position: 'absolute', left: MX + Rr - 280, top: MY + Rr - 280, width: 560, height: 560, borderRadius: '50%', background: `radial-gradient(closest-side,rgba(220,230,255,${(0.07 + 0.2 * lit).toFixed(2)}),rgba(220,230,255,0))`, animation: an('skyMoonGlow 9s ease-in-out infinite alternate') }} />
      <span style={{ position: 'absolute', left: MX, top: MY, width: D, height: D, borderRadius: '50%', background: 'radial-gradient(circle,rgba(170,190,230,.10),rgba(170,190,230,.04) 70%,transparent 72%)' }}>
        <span style={{ position: 'absolute', inset: 0, filter: `drop-shadow(0 0 ${(6 + 14 * lit).toFixed(0)}px rgba(245,248,255,${(0.4 + 0.4 * lit).toFixed(2)})) drop-shadow(0 0 ${(14 + 30 * lit).toFixed(0)}px rgba(200,215,250,${(0.2 + 0.3 * lit).toFixed(2)}))` }}>
          {/* Chú Cuội vẽ ở lớp MoonActs (có hoạt cảnh), nằm ngay trên đĩa trăng này */}
          <span style={{ position: 'absolute', inset: 0, borderRadius: full ? '50%' : 0, background: MOON_BG, clipPath: clip, WebkitClipPath: clip }} />
        </span>
      </span>
      {showWhale && <Whale o={o} an={an} />}
      {amb && <NightPlanes an={an} />}
      {amb && <NightRocket an={an} />}
      {amb && SHOOTS.map(([top, l, dur, delay, w], i) => (
        <div key={'m' + i} style={{ position: 'absolute', top, left: l, width: w, height: 1.5, borderRadius: 1, opacity: 0, transformOrigin: '0 50%', background: 'linear-gradient(90deg,#fff,rgba(190,230,255,.65) 22%,rgba(167,139,250,.25) 60%,transparent)', animation: an(`skyShoot ${dur}s linear ${delay}s infinite`) }}>
          <span style={{ position: 'absolute', left: -2, top: -2, width: 5, height: 5, borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px 3px rgba(200,230,255,.9)' }} />
        </div>
      ))}
      {amb && (
      <div style={{ position: 'absolute', top: 40, left: 1500, width: 0, height: 0, opacity: 0, animation: an('skyComet 40s linear 6s infinite') }}>
        <span style={{ position: 'absolute', left: 0, top: -1.5, width: 320, height: 3, borderRadius: 2, transformOrigin: '0 50%', transform: 'rotate(-10deg)', background: 'linear-gradient(90deg,rgba(225,255,248,.95),rgba(94,242,194,.5) 18%,rgba(139,92,246,.22) 55%,transparent)', filter: 'blur(1px)' }} />
        <span style={{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: '50%', background: '#fff', boxShadow: '0 0 14px 5px rgba(190,255,240,.85),0 0 46px 14px rgba(94,242,194,.35)' }} />
      </div>
      )}
      {amb && Array.from({ length: o.ff || 24 }, (_, i) => {
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
      {amb && CONS.map(([P, Ls], i) => {
        const w = Math.max(...P.map((p) => p[0])) + 10, h = Math.max(...P.map((p) => p[1])) + 10, dly = (-CONS_CYC + i * 25 + 6) + 's'
        return (
          <span key={'c' + i}
            ref={(el) => { if (el && !el.dataset.placed) { el.dataset.placed = '1'; spot(el) } }}
            onAnimationIteration={(ev) => { if (ev.target === ev.currentTarget) spot(ev.currentTarget) }}
            style={{ position: 'absolute', left: o.cx ?? 1044, top: (o.cy ?? 4) + 2, transform: `scale(${o.cs ? o.cs * 0.8 : 0.34})`, width: w, height: h + 20, transformOrigin: '0 0', opacity: 0, animation: an(`skyConsShow ${CONS_CYC}s ease-in-out ${dly} infinite`) }}>
            <svg width={w} height={h} viewBox={`-5 -5 ${w} ${h}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              <path d={Ls.map(([a, b]) => `M${P[a][0]} ${P[a][1]}L${P[b][0]} ${P[b][1]}`).join('')} pathLength="1" fill="none" stroke="rgba(190,210,255,.6)" strokeWidth="2.4" strokeDasharray="1" style={{ animation: an(`skyConsLine ${CONS_CYC}s linear ${dly} infinite`) }} />
              {P.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={k % 3 === 0 ? 4.4 : 3.2} fill="#fff" style={{ filter: 'drop-shadow(0 0 6px rgba(200,220,255,.95))' }} />)}
            </svg>
            {!o.nl && <span style={{ position: 'absolute', left: w + 8, top: Math.round(h * 0.3), font: '500 11px/1 var(--font-sans)', letterSpacing: '.06em', color: 'rgba(200,212,245,.85)', whiteSpace: 'nowrap', textShadow: '0 0 6px rgba(0,0,0,.6)' }}>{consNames[i]}</span>}
          </span>
        )
      })}
      {amb && <span style={{ position: 'absolute', left: -20, top: 64, width: 2.4, height: 2.4, borderRadius: '50%', background: '#F4F8FF', boxShadow: '0 0 4px 1px rgba(220,232,255,.8)', '--sx': '1480px', '--sy': '70px', opacity: 0, animation: an('skySat 120s linear 35s infinite') }} />}
      {showHorizon && <NightHorizon an={an} />}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '32%', background: 'linear-gradient(to top,rgba(40,70,130,.32),transparent)' }} />
    </div>
  )
}

/*
 * Chân trời đêm (hiệu ứng nền): chớp xa loé sau núi, dãy núi xa, thành phố xa có đèn cửa sổ, đồi gần che chân
 * phố — cho trời có chiều sâu. Đèn tĩnh vẽ chung một SVG (vẽ một lần); vài đèn nhấp nháy là span riêng (chỉ đổi
 * opacity) để khỏi vẽ lại cả SVG mỗi khung hình. Phố nằm quanh giữa khung (mobile cũng thấy).
 */
const CITY_BASE = 236
const CITY = (() => {
  let x = 640
  return Array.from({ length: 30 }, (_, i) => {
    const w = 12 + Math.round(rnd(i + 900) * 20), h = 20 + Math.round(rnd(i + 910) * 62), b = [x, w, h]
    x += w + 2
    return b
  })
})()
const CITY_LIGHTS = CITY.flatMap(([bx, w, h], i) => {
  const out = []
  for (let r = 0; r < Math.floor((h - 6) / 8); r++) for (let c = 0; c < Math.floor((w - 2) / 5); c++) {
    const k = i * 97 + r * 13 + c
    if (rnd(k + 2000) < 0.26) out.push([bx + 2 + c * 5, CITY_BASE - h + 4 + r * 8, k])
  }
  return out
})
function NightHorizon({ an }) {
  const top = H - 260
  const blink = CITY_LIGHTS.filter((_, i) => i % 9 === 4).slice(0, 10)
  return (
    <>
      {[[430, 23, 4], [1020, 31, 13]].map(([lx, dur, dl], i) => (
        <span key={'fl' + i} style={{ position: 'absolute', left: lx - 200, top: top - 70, width: 400, height: 230, background: 'radial-gradient(50% 60% at 50% 72%,rgba(190,205,255,.5),rgba(150,170,240,.16) 50%,rgba(150,170,240,0) 75%)', opacity: 0, animation: an(`skyFlash ${dur}s linear ${dl}s infinite`) }} />
      ))}
      <svg width={W} height="260" viewBox="0 0 1440 260" style={{ position: 'absolute', left: 0, top }}>
        <path d="M0 260 L0 152 L90 122 L180 142 L300 82 L400 130 L520 98 L640 142 L760 94 L880 62 L990 114 L1100 86 L1230 132 L1340 102 L1440 126 L1440 260 Z" fill="#14234A" opacity=".92" />
        {CITY.map(([bx, w, h], i) => <rect key={i} x={bx} y={CITY_BASE - h} width={w} height={h + 20} fill="#0B1530" />)}
        <g fill="#FFD98A">{CITY_LIGHTS.map(([lx, ly, k]) => <rect key={k} x={lx} y={ly} width="2.2" height="2.6" opacity={(0.4 + rnd(k + 3000) * 0.5).toFixed(2)} />)}</g>
        <path d="M0 260 L0 214 L140 200 L280 226 L420 206 L560 230 L700 218 L840 234 L980 214 L1120 232 L1260 210 L1440 224 L1440 260 Z" fill="#081128" />
      </svg>
      {blink.map(([lx, ly, k], i) => (
        <span key={'cl' + k} style={{ position: 'absolute', left: lx, top: top + ly, width: 2.2, height: 2.6, background: '#FFE7A8', boxShadow: '0 0 3px 1px rgba(255,214,140,.6)', animation: an(`skyTwinkle ${(2.4 + rnd(k + 4000) * 3).toFixed(1)}s ease-in-out ${-i}s infinite`) }} />
      ))}
    </>
  )
}

/** Mây mỏng trôi ngang trăng (hiệu ứng nền đêm): nửa đầu chu kỳ trôi qua, che bớt đĩa trăng; nằm trên lớp chú Cuội. */
function MoonClouds({ o, motion }) {
  const { D, MX, MY } = moonShape(o, 0, true)
  const k = D / 72
  return [[0.34, 300, 26, 70, -6], [0.68, 220, 18, 88, -40]].map(([fy, w, h, dur, dl], i) => {
    const cw = w * k, x0 = MX - cw - 60 * k
    return (
      <span key={'mc' + i} style={{ position: 'absolute', left: x0, top: MY + D * fy - (h * k) / 2, width: cw, height: h * k, borderRadius: '50%', background: 'radial-gradient(50% 50% at 50% 50%,rgba(118,130,168,.66),rgba(118,130,168,.3) 48%,rgba(118,130,168,0) 72%)', '--cd': (D + cw + 120 * k).toFixed(0) + 'px', opacity: 0, animation: motion ? `skyMoonCloud ${dur}s linear ${dl}s infinite` : 'none' }} />
    )
  })
}

/** Cá voi sao bơi ngang trời: vệt sao sau đuôi, phun bụi sao, chòm sao trên lưng. */
/**
 * Máy bay đêm (hiệu ứng nền): hai chiếc xa xa bay ngang hai chiều — chỉ thấy bóng mờ và đèn đỏ / xanh / trắng
 * nháy. Đèn là span (nháy bằng opacity, không vẽ lại SVG) cho nhẹ máy.
 */
function NightPlanes({ an }) {
  const plane = (
    <div style={{ position: 'absolute', left: 0, top: 0 }}>
      <svg width="22" height="10" viewBox="0 0 26 12" style={{ position: 'absolute', left: -2, top: -1 }}><path d={PLANE_D} fill="rgba(150,165,205,.35)" /></svg>
      {[['#FF5A5A', 4.5, 0, 0], ['#5AFF9A', 4.5, 9, 0.6], ['#FFFFFF', 0, 4.5, 0.3]].map(([c, x, y, d], i) => (
        <span key={i} style={{ position: 'absolute', left: x - 1.2, top: y - 1.2, width: 2.4, height: 2.4, borderRadius: '50%', background: c, boxShadow: `0 0 4px 1px ${c}`, animation: an(`skyNavBlink 1.4s linear ${d}s infinite`) }} />
      ))}
    </div>
  )
  return (
    <>
      <div style={{ position: 'absolute', left: -60, top: 128, width: 0, height: 0, opacity: 0, animation: an('skyPlane 60s linear 18s infinite') }}>{plane}</div>
      {/* Chiếc thứ hai bay ngược chiều: lật cả khung toạ độ */}
      <div style={{ position: 'absolute', left: W + 60, top: 74, width: 0, height: 0, transform: 'scaleX(-1)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, opacity: 0, animation: an('skyPlane 76s linear 47s infinite') }}>{plane}</div>
      </div>
    </>
  )
}

/**
 * Tên lửa phóng (hiệu ứng nền đêm): cứ `cyc` giây một lần, từ sau chân trời (sau nội dung) vút lên, nhanh dần,
 * kéo vệt lửa + vệt khói, khói tản ở chỗ phóng. Desktop bay ngang qua mặt trăng; mobile bay bên phải trăng.
 * Chỉ trượt / co giãn (không nhoè) cho nhẹ máy. Nhịp khớp keyframe skyRocket / skyRocketPuff (effects.css).
 */
const RK = { x: 1012, y: 560, rx: 66, ry: -760, a: 5, cyc: 64, dl: 26 }
function NightRocket({ an }) {
  const { x, y, rx, ry, a, cyc, dl } = RK
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={'rp' + i} style={{ position: 'absolute', left: x - 14 + (i - 2) * 8, top: y - 4, width: 28, height: 28, borderRadius: '50%', background: 'radial-gradient(circle,rgba(205,212,232,.5),rgba(205,212,232,0) 70%)', opacity: 0, '--dx': (i - 2) * 16 + 'px', animation: an(`skyRocketPuff ${cyc}s linear ${dl + i * 0.08}s infinite`) }} />
      ))}
      <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, '--rx': rx + 'px', '--ry': ry + 'px', opacity: 0, animation: an(`skyRocket ${cyc}s linear ${dl}s infinite`) }}>
        <div style={{ position: 'absolute', left: 0, top: 0, transform: `rotate(${a}deg)` }}>
          <span style={{ position: 'absolute', left: -5, top: 12, width: 10, height: 230, borderRadius: 5, background: 'linear-gradient(rgba(222,228,242,.42),rgba(205,212,232,.1) 60%,rgba(205,212,232,0))' }} />
          <span style={{ position: 'absolute', left: -1.5, top: 12, width: 3, height: 100, borderRadius: 2, background: 'linear-gradient(rgba(255,222,150,.95),rgba(255,140,60,.5) 40%,rgba(255,90,60,0))' }} />
          <span style={{ position: 'absolute', left: -3.5, top: 9, width: 7, height: 14, borderRadius: '50% 50% 50% 50% / 30% 30% 70% 70%', background: 'radial-gradient(60% 60% at 50% 30%,#FFF7D6,#FDBA74 50%,rgba(244,63,94,0))', transformOrigin: '50% 0', animation: an('skyFlame .1s ease-in-out infinite alternate') }} />
          <svg width="12" height="32" viewBox="-6 -20 12 32" style={{ position: 'absolute', left: -6, top: -20, overflow: 'visible' }}>
            <path d="M-3.5 4 L-6.5 11 L-3 9.5 Z M3.5 4 L6.5 11 L3 9.5 Z" fill="#E5484D" />
            <path d="M0 -20 Q4 -12 4 0 L4 10 L-4 10 L-4 0 Q-4 -12 0 -20 Z" fill="#EEF2FA" />
            <path d="M0 -20 Q2.8 -15 3.3 -11 L-3.3 -11 Q-2.8 -15 0 -20 Z" fill="#E5484D" />
            <circle cx="0" cy="-3" r="1.7" fill="#5FB4FF" stroke="#9AA6BD" strokeWidth=".6" />
          </svg>
        </div>
      </div>
    </>
  )
}

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
          {/* Mỗi lượt bơi, giữa đường cá voi "nhả" một chùm bụi sao lớn: phun vọt lên rồi lắng, trôi lại
              phía sau (cùng nhịp với lượt bơi skyWhaleSwim). */}
          {Array.from({ length: 16 }, (_, i) => {
            const r = (j) => rnd(i * 7 + j + 980), sz = 2 + r(1) * 2.5
            return (
              <span key={'d' + i} style={{ position: 'absolute', left: 64, top: 24, width: sz, height: sz, borderRadius: '50%', background: ['#FFFFFF', '#CFE6FF', '#FFE9A8', '#D9CCFF'][i % 4], boxShadow: '0 0 7px 2px rgba(200,225,255,.85)', opacity: 0, '--dx': ((r(2) - 0.5) * 70).toFixed(0) + 'px', '--dy': (-40 - r(3) * 70).toFixed(0) + 'px', '--dr': (40 + r(4) * 60).toFixed(0) + 'px', animation: an(`skyWhalePuff ${o.wdur || 90}s ease-out ${((o.wdl ?? 4) + i * 0.05).toFixed(2)}s infinite`) }} />
            )
          })}
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
              <circle key={k} cx={x} cy={y} r={r} fill="#FFFFFF" style={{ filter: o.ff ? undefined : 'drop-shadow(0 0 3px rgba(220,235,255,.95))', animation: an(`skyTwinkle ${(2 + k * 0.4).toFixed(1)}s ease-in-out ${(-k * 0.3).toFixed(1)}s infinite`) }} />
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

/* ============================ HOẠT CẢNH TRỜI ĐÊM ĐỊNH KỲ ============================ */

/**
 * Hoạt cảnh định kỳ: lượt đầu sau `firstMs`, rồi cứ `everyMs` (tính từ lúc bắt đầu lượt trước); mỗi
 * lượt bật `on` trong `durMs` rồi tắt — component chỉ dựng lúc đang diễn, xong là gỡ, khỏi tốn GPU khi
 * vô hình. `n` = số lượt (làm key để animation chạy lại từ đầu). Tab ẩn thì bỏ lượt đó.
 */
function useEvery(enabled, firstMs, everyMs, durMs) {
  const [ev, setEv] = useState({ n: 0, on: false })
  useEffect(() => {
    if (!enabled) return
    const ids = []
    const later = (fn, ms) => ids.push(setTimeout(fn, ms))
    // Lượt dở dang từ lần bật trước (đổi theme / sang trang con giữa chừng) không được hiện lại.
    later(() => setEv((e) => (e.on ? { ...e, on: false } : e)), 0)
    const tick = (ms) => later(() => {
      if (!document.hidden) {
        setEv((e) => ({ n: e.n + 1, on: true }))
        later(() => setEv((e) => ({ ...e, on: false })), durMs)
      }
      tick(everyMs)
    }, ms)
    tick(firstMs)
    return () => ids.forEach(clearTimeout)
  }, [enabled, firstMs, everyMs, durMs])
  return enabled ? ev : { n: ev.n, on: false }
}

const CUOI = 'rgba(110,120,152,.42)'

/**
 * Lớp ngay trên đĩa trăng: chú Cuội (ngồi gốc cây đa; tới lượt thì đứng dậy vung vợt đánh quả cầu bay
 * qua mặt trăng) và nguyệt thực trăng máu (bóng Trái Đất trượt qua, trăng đỏ đồng rồi sáng lại).
 * `cuoi` / `eclipse` = số lượt đang diễn (0 = không diễn).
 */
function MoonActs({ o, age, full, cuoi, eclipse }) {
  const { D, Rr, MX, MY, clip } = moonShape(o, age, full)
  const disk = full ? { borderRadius: '50%', overflow: 'hidden' } : { clipPath: clip, WebkitClipPath: clip }
  const act = (name, ms) => `${name} ${ms}ms ease-in-out both`
  return (
    <>
      {eclipse > 0 && (
        <span key={'eh' + eclipse} style={{ position: 'absolute', left: MX + Rr - D, top: MY + Rr - D, width: D * 2, height: D * 2, borderRadius: '50%', background: 'radial-gradient(closest-side,rgba(200,70,40,.42),rgba(160,40,30,.12) 60%,rgba(160,40,30,0))', opacity: 0, animation: act('skyEclipseHalo', SKY_ACT_MS.eclipse) }} />
      )}
      <span style={{ position: 'absolute', left: MX, top: MY, width: D, height: D, ...disk }}>
        {eclipse > 0 && (
          <span key={'ec' + eclipse} style={{ position: 'absolute', inset: 0 }}>
            <span style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 40% 38%,#E8743F,#B23A1F 58%,#5E1A10)', opacity: 0, animation: act('skyEclipseBlood', SKY_ACT_MS.eclipse) }} />
            <span style={{ position: 'absolute', inset: '-6%', borderRadius: '50%', background: 'radial-gradient(circle at 55% 50%,rgba(18,10,14,.92) 0,rgba(18,10,14,.86) 62%,rgba(18,10,14,0) 74%)', transform: 'translateX(-115%)', animation: act('skyEclipseUmbra', SKY_ACT_MS.eclipse) }} />
          </span>
        )}
        <svg width={D} height={D} viewBox="0 0 64 64" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <g fill={CUOI}>
            {/* Cây đa + gốc */}
            <path d="M28 26 C26 18 32 13 38 14 C42 9 50 11 51 17 C57 18 58 26 53 29 C54 34 48 37 44 35 C40 38 32 36 32 32 C27 32 26 28 28 26 Z" />
            <path d="M40 34 C40 40 39 44 37 48 L45 48 C43 44 42 40 42 34 Z" />
            <path d="M28 48 Q41 46 54 48 Q41 50.5 28 48 Z" />
          </g>
          {/* Chú Cuội ngồi */}
          <g key={'cs' + cuoi} fill={CUOI} style={{ animation: cuoi ? act('skyCuoiSit', SKY_ACT_MS.cuoi) : 'none' }}>
            <circle cx="31" cy="40.5" r="2" />
            <path d="M29.5 42.6 L32.6 42.6 L33.6 46.6 L36.2 46.6 L36.2 48.4 L29 48.4 Z" />
          </g>
          {/* Lượt diễn: đứng dậy vung vợt, quả cầu bay vào từ mép phải rồi bị đánh văng ra ngoài */}
          {cuoi > 0 && (
            <g key={'cu' + cuoi}>
              <g style={{ opacity: 0, animation: act('skyCuoiStand', SKY_ACT_MS.cuoi) }}>
                <circle cx="31" cy="35.4" r="2" fill={CUOI} />
                <path d="M31 37.4 L31 43.5 M31 43.5 L29.3 48.2 M31 43.5 L32.9 48.2 M31 39 L28.6 42" fill="none" stroke={CUOI} strokeWidth="1.5" strokeLinecap="round" />
                <g style={{ transformOrigin: '31px 38.8px', animation: act('skyCuoiSwing', SKY_ACT_MS.cuoi) }}>
                  <path d="M31 38.8 L34.4 36.2 L36.8 33.4" fill="none" stroke={CUOI} strokeWidth="1.4" strokeLinecap="round" />
                  <ellipse cx="38.3" cy="31.6" rx="1.7" ry="2.4" transform="rotate(40 38.3 31.6)" fill="rgba(110,120,152,.18)" stroke={CUOI} strokeWidth=".9" />
                </g>
              </g>
              <g style={{ opacity: 0, animation: act('skyCuoiShuttle', SKY_ACT_MS.cuoi) }}>
                <circle cx="-1" cy="0" r="1" fill="rgba(80,90,125,.85)" />
                <path d="M-0.2 -0.9 L2.8 -1.8 L2.8 1.8 L-0.2 0.9 Z" fill="rgba(80,90,125,.7)" />
              </g>
            </g>
          )}
        </svg>
      </span>
    </>
  )
}

/**
 * Sao băng "quả cầu lông lửa": đầu là quả cầu (đế + váy lông) bốc lửa, đuôi xoè như chùm lông cháy,
 * lao chéo xuống trái như mưa sao băng. `x`, `y` điểm xuất phát; `dx`, `dy` quãng bay (khung của lớp).
 */
function FireShuttle({ x, y, dx, dy }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, '--dx': px(dx), '--dy': px(dy), opacity: 0, animation: `skyFireShuttle ${SKY_ACT_MS.fireShuttle}ms cubic-bezier(.35,0,.65,1) both` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: 'rotate(-28deg)', transformOrigin: '0 0' }}>
        <span style={{ position: 'absolute', left: 8, top: -14, width: 300, height: 28, clipPath: 'polygon(0 40%,100% 0,100% 100%,0 60%)', background: 'linear-gradient(90deg,rgba(255,236,170,.95),rgba(255,160,50,.75) 18%,rgba(255,80,40,.4) 50%,rgba(180,40,90,0))', filter: 'blur(1.5px)' }} />
        {[-9, -4.5, 0, 4.5, 9].map((a, i) => (
          <span key={i} style={{ position: 'absolute', left: 14, top: -0.8, width: 170 + (i % 2) * 50, height: 1.6, borderRadius: 1, transformOrigin: '0 50%', transform: `rotate(${a}deg)`, background: 'linear-gradient(90deg,rgba(255,200,90,.9),rgba(255,110,50,.4) 45%,rgba(255,80,60,0))' }} />
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={'e' + i} style={{ position: 'absolute', left: 40 + i * 34, top: (rnd(i + 950) - 0.5) * 22, width: 3, height: 3, borderRadius: '50%', background: '#FFD27A', boxShadow: '0 0 6px 2px rgba(255,140,40,.8)', animation: `skyTwinkle ${(0.35 + rnd(i + 960) * 0.3).toFixed(2)}s ease-in-out infinite` }} />
        ))}
        <svg width="30" height="20" viewBox="-4 -10 30 20" style={{ position: 'absolute', left: -4, top: -10, overflow: 'visible', filter: 'drop-shadow(0 0 8px rgba(255,150,40,.95))' }}>
          <ellipse cx="14" cy="0" rx="12" ry="9" fill="rgba(255,140,40,.35)" style={{ transformOrigin: '2px 0', animation: 'skyFlame .12s ease-in-out infinite alternate' }} />
          <path d="M4 -3 L24 -9 L24 9 L4 3 Z" fill="rgba(255,190,80,.92)" stroke="#FFE7A3" strokeWidth=".8" />
          <path d="M5 -2 L24 -6 M5 0 L24 0 M5 2 L24 6" stroke="rgba(255,110,40,.85)" strokeWidth=".7" />
          <circle cx="2" cy="0" r="3.4" fill="#FFF7E0" />
        </svg>
      </div>
    </div>
  )
}

/* ============================ HOÀNG HÔN ============================ */

const PLANE_D = 'M1 6 L20 5 Q25 5.4 25 6 Q25 6.6 20 7 L1 6 Z M9 5.6 L5 0.5 L8 0.5 L14 5.4 Z M9 6.4 L5 11.5 L8 11.5 L14 6.6 Z M2 5.8 L0.5 2.5 L2.5 2.5 L5 5.7 Z'

// Mặt trời theo giờ mở trang (SkyBackdrop → phase): bình minh bên trái, vàng hồng dịu; hoàng hôn bên phải, đỏ cam
// rực. Cả hai sát dãy núi (nửa dưới khuất sau núi / biển mây), nằm trong khúc trời mobile thấy được (x 700–1090).
const DAY_SUN = {
  dawn: { x: 800, y: 414, r: 52, bg: 'radial-gradient(circle at 50% 45%,#FFFBEA 0,#FFE6A8 34%,#FFC285 72%,#FFA478 100%)', sh: '0 0 36px 12px rgba(255,205,140,.45),0 0 110px 46px rgba(255,190,160,.24)', ray: '255,236,200' },
  dusk: { x: 1000, y: 436, r: 60, bg: 'radial-gradient(circle at 50% 45%,#FFF0D2 0,#FFC07A 28%,#FF7A45 66%,#E2463A 100%)', sh: '0 0 40px 14px rgba(255,118,78,.5),0 0 130px 56px rgba(255,130,100,.3)', ray: '255,214,180' },
}
const DAY_BG = {
  dawn: 'linear-gradient(180deg,#A9C3EC 0%,#C6CDEB 22%,#E9CBDD 42%,#F8D4C4 56%,#FBE0C8 66%,#FDEEDD 100%)',
  dusk: 'linear-gradient(180deg,#B4C0E6 0%,#CDBFE0 22%,#EBC2D2 40%,#F6CDB8 55%,#FAD9BF 64%,#FBE6D2 100%)',
}

/** Thuyền buồm trôi trên biển mây (hiệu ứng nền ngày): trôi qua lại chậm + nhấp nhô. */
function Sailboat({ x, y, s, dx, dur, dl, an }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, '--dx': dx + 'px', animation: an(`skyDrift ${dur}s ease-in-out ${dl}s infinite alternate`) }}>
      <svg width={34 * s} height={30 * s} viewBox="0 0 34 30" style={{ display: 'block', overflow: 'visible', '--by': '3px', animation: an(`skyBob 3.4s ease-in-out ${dl}s infinite alternate`) }}>
        <path d="M17 2 L17 22 L5 22 Z" fill="#FFF6EE" />
        <path d="M19 6 L19 22 L29 22 Z" fill="#F7D9DE" />
        <path d="M17 1 L17 23" stroke="#7A6690" strokeWidth="1" />
        <path d="M3 23 L31 23 L27 28 L7 28 Z" fill="#7A6690" />
      </svg>
    </div>
  )
}

function Day({ motion, amb = true, phase = 'dusk' }) {
  const an = (v) => (motion ? v : 'none')
  // `amb` = nhóm "hiệu ứng nền": mây ti, máy bay, đàn chim, mây tích, hạt sáng; biển mây chỉ cuộn khi bật.
  const anAmb = (v) => (motion && amb ? v : 'none')

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
      <svg key={key} width={3 * W} height={h} style={{ position: 'absolute', left: -W, top: top - base, overflow: 'visible', opacity: op, animation: anAmb(`skySea ${dur}s linear infinite`) }}>
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
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: DAY_BG[phase] || DAY_BG.dusk }}>
      <div style={{ position: 'absolute', left: 140, top: H * 0.3, width: 1300, height: 420, borderRadius: '50%', background: 'radial-gradient(closest-side,rgba(255,168,120,.55),rgba(255,150,150,.22) 50%,rgba(255,150,150,0))', animation: an('skySunBreath 12s ease-in-out infinite alternate') }} />
      <div style={{ position: 'absolute', left: -100, right: -100, top: H * 0.2, height: 220, background: 'linear-gradient(180deg,transparent,rgba(255,190,200,.28) 45%,rgba(255,200,170,.18) 70%,transparent)', }} />
      {[[1060, 34, 3.4, 4.2], [420, 22, 1.6, 5.4], [700, 60, 1.4, 6.2], [1270, 70, 1.5, 5], [180, 50, 1.3, 7]].map(([x, y, sz, d], i) => (
        <span key={'e' + i} style={{ position: 'absolute', left: x, top: y, width: sz, height: sz, borderRadius: '50%', background: '#FFFDF6', boxShadow: `0 0 ${(sz * 3).toFixed(0)}px ${(sz * 0.8).toFixed(1)}px rgba(255,250,235,.8)`, animation: an(`skyTwinkle ${d}s ease-in-out ${-i}s infinite`) }} />
      ))}
      {/* Cầu vồng mờ: mỗi vòng 96 s hiện ~25 s rồi tan; chân khuất sau núi / biển mây */}
      {amb && <span style={{ position: 'absolute', left: 460, top: H * 0.56 - 440, width: 880, height: 440, background: 'radial-gradient(circle 440px at 50% 100%,transparent 0 372px,rgba(255,96,96,.38) 380px,rgba(255,170,70,.36) 388px,rgba(255,236,96,.32) 396px,rgba(110,214,120,.3) 404px,rgba(90,160,255,.3) 412px,rgba(150,110,230,.28) 420px,transparent 428px)', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 22%,#000 78%,transparent)', maskImage: 'linear-gradient(90deg,transparent,#000 22%,#000 78%,transparent)', opacity: 0, animation: an('skyRainbow 96s ease-in-out 20s infinite') }} />}
      {amb && [[0.06, 0.07, 560, 40, 70], [0.42, 0.2, 420, 30, -60], [0.7, 0.3, 600, 46, 80]].map(([x, y, w, h, dx], i) => (
        <span key={'ci' + i} style={{ position: 'absolute', left: x * W, top: y * H, width: w, height: h, borderRadius: '50%', background: 'radial-gradient(50% 50% at 50% 50%,rgba(255,206,196,.7),transparent 70%)', '--dx': dx + 'px', animation: an(`skyDrift ${30 + i * 8}s ease-in-out infinite alternate`) }} />
      ))}
      {amb && (
      <div style={{ position: 'absolute', left: -80, top: 110, width: 0, height: 0, opacity: 0, animation: an('skyPlane 56s linear 10s infinite') }}>
        <div style={{ position: 'absolute', left: 0, top: 0, transform: 'rotate(-1.6deg)' }}>
          <span style={{ position: 'absolute', left: -300, top: 3, width: 300, height: 2, borderRadius: 2, background: 'linear-gradient(90deg,rgba(255,240,235,0),rgba(255,240,235,.9))' }} />
          <span style={{ position: 'absolute', left: -260, top: 7, width: 260, height: 2, borderRadius: 2, background: 'linear-gradient(90deg,rgba(255,240,235,0),rgba(255,240,235,.8))' }} />
          <svg width="26" height="12" viewBox="0 0 26 12" style={{ position: 'absolute', left: -2, top: -1 }}><path d={PLANE_D} fill="#5A4A6E" /></svg>
        </div>
      </div>
      )}
      {amb && (
      <div style={{ position: 'absolute', left: W + 40, top: 170, width: 0, height: 0, opacity: 0, animation: an('skyBirds 62.24s linear 4s infinite') }}>
        {[[0, 0, 1], [28, -14, 0.85], [30, 16, 0.9], [58, -24, 0.75], [60, 26, 0.8], [86, 6, 0.7]].map(([x, y, sz], i) => bird(i, x, y, sz))}
      </div>
      )}
      {amb && cum(0, 0.14, 0.14, 280, 92, 10)}
      {amb && cum(1, 0.47, 0.27, 200, 66, 20)}
      {amb && cum(2, 0.63, 0.04, 260, 86, 30)}
      {amb && cum(3, 0.84, 0.33, 260, 84, 40)}
      {amb && cum(4, 0.02, 0.36, 180, 58, 50)}
      {(() => {
        const sun = DAY_SUN[phase] || DAY_SUN.dusk
        return (
          <>
            {/* Tia nắng xuyên mây (hiệu ứng nền): chùm tia toả lên từ mặt trời, thở nhẹ */}
            {amb && <span style={{ position: 'absolute', left: sun.x - 420, top: sun.y - 380, width: 840, height: 380, background: `repeating-conic-gradient(from -90deg at 50% 100%,rgba(${sun.ray},.22) 0deg 3deg,rgba(${sun.ray},0) 3deg 11deg)`, WebkitMaskImage: 'radial-gradient(circle 400px at 50% 100%,#000 18%,transparent 100%)', maskImage: 'radial-gradient(circle 400px at 50% 100%,#000 18%,transparent 100%)', animation: an('skyRays 9s ease-in-out infinite alternate') }} />}
            <span style={{ position: 'absolute', left: sun.x - sun.r, top: sun.y - sun.r, width: sun.r * 2, height: sun.r * 2, borderRadius: '50%', background: sun.bg, boxShadow: sun.sh }} />
          </>
        )
      })()}
      <svg width={W} height="200" viewBox="0 0 1440 200" style={{ position: 'absolute', left: 0, top: H * 0.5 - 130 }}>
        <defs>
          <linearGradient id="sky-mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8E80B4" /><stop offset="1" stopColor="#E2C3D2" /></linearGradient>
        </defs>
        <path d="M0 200 L120 130 L190 150 L310 70 L400 130 L500 100 L620 160 L760 80 L860 42 L960 110 L1080 86 L1190 150 L1310 104 L1440 140 L1440 200 Z" fill="url(#sky-mt)" opacity=".75" />
      </svg>
      {sea('s1', H * 0.52, 50, 95, 16, '#E3BFD0', '#CFA9C2', 220, 100, 0.95)}
      {amb && <Sailboat x={840} y={440} s={1} dx={70} dur={46} dl={-8} an={an} />}
      {amb && <Sailboat x={1210} y={452} s={0.8} dx={-56} dur={58} dl={-21} an={an} />}
      <div style={{ position: 'absolute', left: -200, right: -200, top: H * 0.58, height: 120, background: 'radial-gradient(50% 50% at 50% 50%,rgba(255,232,224,.75),transparent 70%)', animation: anAmb('skyMist 26s ease-in-out infinite alternate') }} />
      {sea('s2', H * 0.63, 60, 120, 13, '#EDC9CF', '#DDB3C2', 140, 200, 1)}
      {sea('s3', H * 0.76, 70, 140, 11, '#F5DCD6', '#E6C2C8', 90, 300, 1)}
      {amb && Array.from({ length: 12 }, (_, i) => {
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
const bubSt = (dark, fk) => {
  const c = bubC(dark)
  return { padding: `${sk(7, fk)} ${sk(11, fk)}`, borderRadius: 10, background: c.bg, border: '1px solid ' + c.bd, color: c.fg, boxShadow: c.sh, whiteSpace: 'normal', overflowWrap: 'anywhere', textWrap: 'pretty', font: `600 ${sk(11.5, fk)}/1.35 var(--font-sans)` }
}

/**
 * Cú mèo đậu trên trăng (chỉ sau 22h). Bấm cú hoặc bóng thoại → câu kế + nghiêng đầu.
 * `sleep`: ngủ gật — gục đầu, mỏ chúc xuống, mắt nhắm, bóng zzZ to dần rồi vỡ "pop!", ẩn bóng thoại.
 * `wake` tăng: vừa bị bấm đánh thức — bật dậy xù lông, mắt tròn xoe, suýt ngã, một cọng lông rơi xuống
 * đáy màn (`fy` = khoảng rơi theo khung của lớp).
 */
function Owl({ ly, fk, dark, motion, k, sleep, wake, fy, line, hide, onNext, onHide }) {
  const an = (v) => (motion ? v : 'none')
  const sz = ly.os, D = ly.md, R2 = D / 2, c = bubC(dark)
  const body = dark ? '#121A33' : '#3A2E4A', rim = dark ? 'rgba(220,230,255,.45)' : 'rgba(255,228,218,.5)'
  // Mí mắt: ngủ thì sụp dần rồi nhắm hẳn; vừa giật mình thì mở trừng một lúc rồi mới chớp lại.
  const lidAnim = sleep ? 'skyOwlLidClose 2.5s ease-in both' : wake ? 'skyOwlBlink 5s ease-in-out 1.6s infinite' : 'skyOwlBlink 5s ease-in-out infinite'
  const lid = (cx) => <rect key={'l' + cx + (sleep ? 's' : 'a' + wake)} x={cx - 5.5} y="11.5" width="11" height="11" fill={body} style={{ transform: 'scaleY(0)', transformOrigin: `${cx}px 11.5px`, animation: an(lidAnim) }} />
  const pose = sleep ? 'skyOwlDoze 2.5s ease-in-out both, skyOwlBreathe 3s ease-in-out 2.5s infinite' : wake ? 'skyOwlStartle 1.3s ease-out both' : 'none'
  const fill = { transformBox: 'fill-box', transformOrigin: 'center' }
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
      <div key={'o' + k} onClick={onNext} style={{ position: 'absolute', left: ly.ox, top: ly.oy, width: sz, height: sz * 1.2, cursor: 'pointer', pointerEvents: 'auto', transformOrigin: '50% 90%', animation: k && motion ? 'skyOwlTilt .9s ease-in-out' : 'none' }}>
        <div key={'p' + wake + (sleep ? 's' : '')} style={{ width: '100%', height: '100%', transformOrigin: '50% 90%', animation: an(pose) }}>
          <svg width={sz} height={sz * 1.2} viewBox="0 0 40 46" style={{ display: 'block', overflow: 'visible' }}>
            {/* Lông xù khi giật mình */}
            {wake > 0 && !sleep && (
              <path key={'x' + wake} d="M6 18 L1 15 L7 16 M5 26 L0 26 L6 24 M8 34 L3 38 L9 33 M34 18 L39 15 L33 16 M35 26 L40 26 L34 24 M32 34 L37 38 L31 33 M13 8 L10 2 L16 6 M27 8 L30 2 L24 6"
                fill="none" stroke={rim} strokeWidth="1.3" strokeLinecap="round" style={{ ...fill, opacity: 0, animation: an('skyOwlFluff 1.3s ease-out both') }} />
            )}
            <path d="M9 14 L6 2 L15 8 Z M31 14 L34 2 L25 8 Z" fill={body} />
            <path d="M20 6 C11 6 6 13 6 21 C6 32 10 40 20 44 C30 40 34 32 34 21 C34 13 29 6 20 6 Z" fill={body} stroke={rim} strokeWidth=".8" />
            <path d="M10 27 C11 34 14 39 18 41 M30 27 C29 34 26 39 22 41" fill="none" stroke={rim} strokeWidth=".7" />
            <g key={'e' + wake} style={{ ...fill, animation: wake && !sleep ? an('skyOwlEyesWide 1.6s ease-out both') : 'none' }}>
              <circle cx="14.5" cy="17" r="5" fill="#FFC857" style={{ filter: 'drop-shadow(0 0 3px rgba(255,200,87,.9))' }} />
              <circle cx="25.5" cy="17" r="5" fill="#FFC857" style={{ filter: 'drop-shadow(0 0 3px rgba(255,200,87,.9))' }} />
              <circle cx="14.5" cy="17" r="2.2" fill="#1A1208" style={{ ...fill, animation: wake && !sleep ? an('skyOwlPupil 1.6s ease-out both') : 'none' }} />
              <circle cx="25.5" cy="17" r="2.2" fill="#1A1208" style={{ ...fill, animation: wake && !sleep ? an('skyOwlPupil 1.6s ease-out both') : 'none' }} />
            </g>
            {lid(14.5)}{lid(25.5)}
            {/* Mỏ chúc xuống khi ngủ */}
            <path d="M20 21 L18 24 L20 27 L22 24 Z" fill="#D99A3E" style={{ transformOrigin: '20px 21px', transform: sleep ? 'rotate(32deg)' : 'none', transition: motion ? 'transform 2.2s ease-in' : 'none' }} />
            <path d="M16 43 L16 46 M24 43 L24 46" stroke="#D99A3E" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      {/* Ngủ gật: bóng zzZ to dần rồi vỡ "pop!", lặp mỗi 4 giây */}
      {sleep && motion && (
        <>
          <span style={{ position: 'absolute', left: ly.ox + sz * 0.75, top: ly.oy - sz * 0.95, padding: `${sk(2, fk)} ${sk(8, fk)}`, borderRadius: 999, background: c.bg, border: '1px solid ' + c.bd, color: c.fg, font: `700 ${sk(11, fk)}/1.3 var(--font-sans)`, whiteSpace: 'nowrap', transformOrigin: '0% 100%', opacity: 0, animation: 'skyOwlZzz 4s ease-in 2.5s infinite' }}>{t('sky.owl.zzz')}</span>
          <span style={{ position: 'absolute', left: ly.ox + sz * 1.05, top: ly.oy - sz * 1.25, color: c.fg, font: `800 ${sk(11, fk)}/1 var(--font-display)`, whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,.35)', opacity: 0, animation: 'skyOwlPop 4s ease-out 2.5s infinite' }}>{t('sky.owl.pop')}</span>
        </>
      )}
      {/* Giật mình: một cọng lông lơ lửng rơi xuống đáy màn */}
      {wake > 0 && !sleep && motion && (
        <span key={'f' + wake} style={{ position: 'absolute', left: ly.ox + sz * 0.55, top: ly.oy + sz * 0.6, width: 0, height: 0, '--fy': Math.max(80, fy) + 'px', opacity: 0, animation: 'skyFeather 5.5s ease-in both' }}>
          <svg width="16" height="7" viewBox="0 0 16 7" style={{ position: 'absolute', left: -8, top: -3.5, overflow: 'visible' }}>
            <path d="M1 3.5 C5 0 11 0 15 3.5 C11 7 5 7 1 3.5 Z" fill={dark ? 'rgba(205,215,245,.92)' : '#6B5A80'} />
            <path d="M0 3.5 L15 3.5" stroke={dark ? 'rgba(255,255,255,.75)' : '#4A3A5E'} strokeWidth=".6" />
          </svg>
        </span>
      )}
      {/* Bóng thoại hiện/ẩn theo nhịp 16 giây, hết một vòng tự sang câu kế. Đang ngủ thì im. Bấm bóng → tắt bóng. */}
      {!sleep && !hide && (
        <div key={'ob' + k + '.' + wake} onClick={onHide} onAnimationIteration={onNext} style={{ position: 'absolute', right: ly.br, top: ly.bt, pointerEvents: 'auto', cursor: 'pointer', ...bubSt(dark, fk), maxWidth: sk(ly.bw, fk), opacity: motion ? 0 : 1, animation: an(`skyBubble 16s ease-in-out ${k || wake ? 0 : 2}s infinite`) }}>
          <span style={{ position: 'absolute', right: tailTop ? ly.tailR : -5, top: tailTop ? -5 : 13, width: 9, height: 9, transform: 'rotate(45deg)', background: c.bg, borderTop: '1px solid ' + c.bd, [tailTop ? 'borderLeft' : 'borderRight']: '1px solid ' + c.bd }} />
          <span>{line}</span>
        </div>
      )}
    </div>
  )
}

/** Máy bay kéo băng rôn ngang header — MỘT lượt bay 16,64 s (cha đổi key để bay lượt mới); bấm → đổi chữ. */
function Banner({ ly, fk, dark, line, onNext }) {
  const c = dark
    ? { bg: 'rgba(16,24,50,.9)', bd: 'rgba(170,200,255,.45)', fg: '#EAF1FF', pl: '#C9D4EC', rope: 'rgba(200,215,245,.6)' }
    : { bg: 'rgba(255,247,240,.95)', bd: '#E7B7B0', fg: '#5A2E3E', pl: '#5A4A6E', rope: 'rgba(90,74,110,.6)' }
  // Chỉ dựng khi có chuyển động: cha không cho bay lúc giảm chuyển động / ở trang chỉ nền.
  return (
    <div style={{ position: 'absolute', left: -440, top: ly.bnT, '--fd': ly.bnD + 'px', opacity: 0, animation: 'skyBannerOnce ' + ly.bnMs + 'ms linear both' }}>
      <div onClick={onNext} style={{ display: 'flex', alignItems: 'center', pointerEvents: 'auto', cursor: 'pointer' }}>
        <span style={{ borderRadius: 3, background: c.bg, border: '1px solid ' + c.bd, color: c.fg, padding: `${sk(3, fk)} ${sk(12, fk)}`, font: `600 ${sk(11, fk)}/1.3 var(--font-sans)`, whiteSpace: 'nowrap', maxWidth: sk(ly.m ? 260 : 440, fk), overflow: 'hidden', textOverflow: 'ellipsis' }} title={line}>{line}</span>
        <span style={{ width: 22, height: 1, background: c.rope }} />
        <svg width="32" height="14" viewBox="0 0 26 12" style={{ overflow: 'visible' }}>
          <path d={PLANE_D} fill={c.pl} />
          {dark && <circle cx="5.5" cy="1" r="1.1" fill="#FF5A5A" style={{ animation: 'skyNavBlink 1.2s linear infinite' }} />}
          {dark && <circle cx="5.5" cy="11" r="1.1" fill="#5AFF9A" style={{ animation: 'skyNavBlink 1.2s linear .6s infinite' }} />}
        </svg>
      </div>
    </div>
  )
}

// Xếp hình: chỉ ban đêm, đom đóm bay tới xếp thành chữ SIU, trái tim viền, mặt cười, ^_^, nháy mắt ;).
// 30 giây một hình, hết vòng đổi sang hình khác từ túi xáo.
const grid = (rows) => {
  const p = []
  rows.forEach((row, r) => [...row].forEach((v, c) => { if (v === '#') p.push([c, r]) }))
  return { p, c: rows[0].length, r: rows.length }
}
const SHAPES = [
  // 1. Chữ SIU
  ['.####...###...#...#', '#........#....#...#', '.###.....#....#...#', '....#....#....#...#', '####....###....###.'],
  // 2. Trái tim viền (outline, rỗng bên trong)
  ['..##...##..', '.#..#.#..#.', '#....#....#', '#.........#', '.#.......#.', '..#.....#..', '...#...#...', '....#.#....', '.....#.....'],
  // 3. Mặt cười
  ['..#####..', '.#.....#.', '#..#.#..#', '#.......#', '#.#...#.#', '#..###..#', '.#.....#.', '..#####..'],
  // 4. Mặt ^_^
  ['.#.......#.', '#.#.....#.#', '...........', '...#####...'],
  // 5. Mặt nháy mắt ;)
  ['..#####..', '.#.....#.', '#..#.##.#', '#.......#', '#.#...#.#', '#..###..#', '.#.....#.', '..#####..'],
].map(grid)
const NDOT = Math.max(...SHAPES.map((sp) => sp.p.length))
/** Một lượt xếp hình: keyframe + con cuối xuất phát trễ NDOT × 40 ms. */
const FORM_MS = SKY_ACT_MS.top1 + NDOT * 40 + 300

/** Một lượt xếp hình (dựng lại mỗi lượt): hình rút từ túi xáo lúc dựng, đủ cả bộ hình mới lặp. */
function Top1({ ly, bags }) {
  const [shape] = useState(() => bags('shape', SHAPES.length))
  const SP = SHAPES[shape % SHAPES.length]
  const u = Math.min((ly.tG * 24) / SP.c, (ly.tG * 7) / SP.r)
  const OX = ly.tX + (ly.tG * 24 - SP.c * u) / 2, OY = ly.tY + (ly.tG * 5 - SP.r * u) / 2
  return (
    <div style={S.fill}>
      {Array.from({ length: NDOT }, (_, i) => {
        const hid = i >= SP.p.length, [x0, y0] = SP.p[i % SP.p.length], x = x0 * u, y = y0 * u
        const r = (j) => rnd(i * 13 + j + 1200)
        // Đêm: đom đóm bay lên từ dưới rồi tản ra
        const sx = (r(1) - 0.5) * 520, sy = 260 + r(2) * 420
        const ex = (r(3) - 0.5) * 380, ey = (r(4) - 0.5) * 220
        return (
          <span key={i}
            style={{ position: 'absolute', visibility: hid ? 'hidden' : 'visible', left: OX + x, top: OY + y, width: 0, height: 0, '--sx': sx.toFixed(0) + 'px', '--sy': sy.toFixed(0) + 'px', '--ex': ex.toFixed(0) + 'px', '--ey': ey.toFixed(0) + 'px', opacity: 0, animation: `skyFormTop ${SKY_ACT_MS.top1}ms ease-in-out ${(i * 0.04).toFixed(2)}s both` }}>
            <span style={{ position: 'absolute', left: -2.5, top: -2.5, width: 5, height: 5, borderRadius: '50%', background: 'radial-gradient(circle,#F7FFD6 0,#D9F99D 40%,rgba(190,242,100,0) 75%)', boxShadow: '0 0 10px 3px rgba(190,242,100,.6)', animation: `skyFfBlink ${(1.6 + r(5) * 1.6).toFixed(2)}s ease-in-out ${(-r(6) * 2).toFixed(2)}s infinite` }} />
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
function bub(par, text, dark, pos, maxW, fk) {
  const c = bubC(dark), b = document.createElement('div')
  b.style.cssText = `position:absolute;${pos};width:max-content;max-width:${sk(maxW, fk)};padding:${sk(7, fk)} ${sk(11, fk)};border-radius:10px;font:600 ${sk(11.5, fk)}/1.35 var(--font-sans);text-wrap:pretty;white-space:normal;overflow-wrap:anywhere;opacity:0;pointer-events:none;background:${c.bg};border:1px solid ${c.bd};color:${c.fg};box-shadow:${c.sh}`
  b.textContent = text
  par.appendChild(b)
  return b
}
function pop(ctx, txt, x, y) {
  const e = mk(ctx.host, `<span style="font-size:18px;line-height:1">${txt}</span>`, x, y)
  mv(e, [[x, y + 6, 0], [x, y, 1, 0, 1.2, 0.25], [x, y - 14, 0]], 1300)
  ctx.later(() => e.remove(), 1400)
}
/**
 * "Mặt đất" của cảnh UFO (toạ độ lớp): mobile có thanh điều hướng dưới (z 40, đè lên lớp này) → lấy mép trên
 * của nó, người bị hút trồi lên / đáp xuống ngay trên thanh thay vì bị che. Không có thanh → đáy màn.
 */
function floorY(host, H) {
  const nav = document.querySelector('[data-footer-nav]')
  if (!nav) return H
  const hb = host.getBoundingClientRect(), k = host.offsetWidth / (hb.width || 1)
  return Math.min(H, Math.round((nav.getBoundingClientRect().top - hb.top) * k))
}
/** Vị trí phần tử trong khung của lớp (bù phóng to). */
function at(host, el, dx, dy) {
  const r = el.getBoundingClientRect(), hb = host.getBoundingClientRect(), k = host.offsetWidth / (hb.width || 1)
  return [(r.left - hb.left) * k + dx, (r.top - hb.top) * k + dy]
}

const heroSVG = (s, d) => `<svg width="${80 * s}" height="${34 * s}" viewBox="0 0 80 34" style="display:block;overflow:visible;filter:${d ? 'drop-shadow(0 0 6px rgba(150,190,255,.5))' : 'drop-shadow(0 3px 4px rgba(90,40,60,.25))'}"><g style="transform-origin:32px 12px;animation:skyCapeFlap .32s ease-in-out infinite alternate"><path d="M32 10 C22 5 10 8 0 3 C5 11 9 17 1 26 C13 24 24 22 33 18 Z" fill="#E5484D"/></g><path d="M5 13.5 L13 13.5 L13 20 L5 20 Q3 16.8 5 13.5 Z" fill="#C8323A"/><path d="M12 13.5 L33 12.5 L33 19.5 L12 20 Z" fill="#2F5BD3"/><path d="M31 11 C41 9 50 9.5 55 12.5 C56 16.5 51 20 41 21 L31 20 Z" fill="#3A6AE6"/><rect x="31" y="11.2" width="2.2" height="8.6" fill="#FFD54A"/><path d="M41 12.6 L46.4 12.6 L48 14.8 L43.7 18.8 L39.4 14.8 Z" fill="#FFD54A" stroke="#C8323A" stroke-width=".8"/><path d="M53 12.5 L70 9.6" stroke="#3A6AE6" stroke-width="3.2" stroke-linecap="round"/><circle cx="71" cy="9.4" r="2.2" fill="#F5C9A0"/><circle cx="59.5" cy="12" r="5.2" fill="#F5C9A0"/><path d="M54.4 11.2 C54.6 6.4 61.6 5 65 9 C62.4 8.2 58.6 8.6 56.2 10.8 Z" fill="#1B1F2E"/><circle cx="62" cy="12" r=".8" fill="#1B1F2E"/></svg>`
const personSVG = (s, jer, pony) => `<svg width="${20 * s}" height="${28 * s}" viewBox="0 0 20 28" style="display:block;overflow:visible"><path d="M15.5 10 L18.4 4" stroke="#2B2F3A" stroke-width="1.2" stroke-linecap="round"/><ellipse cx="19.2" cy="2" rx="2" ry="2.8" transform="rotate(25 19.2 2)" fill="rgba(255,255,255,.35)" stroke="#9AA6BD" stroke-width=".9"/><path d="M6 12.5 L2.4 8.6 M14 12.5 L15.8 10" stroke="#F5C9A0" stroke-width="2" stroke-linecap="round"/><rect x="5.5" y="10.5" width="9" height="9" rx="2.6" fill="${jer}"/><path d="M7.6 19 L7 26.5 M12.4 19 L13 26.5" stroke="#2B3550" stroke-width="2.4" stroke-linecap="round"/>${pony ? '<path d="M14 5 C17 6 17.6 9.4 16 12 C15.6 9.6 15 8 13.6 7 Z" fill="#2A1C14"/>' : ''}<circle cx="10" cy="6.2" r="4.4" fill="#F5C9A0"/><path d="M5.6 6 C5.6 2 9 1 10.6 1.4 C13.6 1.8 14.8 3.8 14.4 6 C12.6 4.6 9.4 4.2 5.6 6 Z" fill="#2A1C14"/><circle cx="8.4" cy="6.6" r=".65" fill="#1B1F2E"/><circle cx="11.6" cy="6.6" r=".65" fill="#1B1F2E"/><circle cx="10" cy="8.9" r=".8" fill="#1B1F2E"/></svg>`

/** Siêu nhân bay ngang header kèm một câu; bấm → câu kế + giơ ngón cái. Trả về thời lượng (ms). */
function heroFly(ctx) {
  const { host, later, bags, dark: d, ly, lines, fk } = ctx
  const y = ly.sc, s = y.hs, hw = 80 * s, hh = 34 * s, L = lines.hero
  // Mỗi lượt bay / mỗi lần bấm một câu rút từ túi xáo.
  const e = mk(host, `<div data-a style="position:relative;animation:skyHover 1.6s ease-in-out infinite;pointer-events:auto;cursor:pointer">${heroSVG(s, d)}</div>`, -hw - 20, y.hy)
  const b = bub(e, L[bags('hero', L.length)], d, `right:calc(100% + 8px);top:${hh / 2 - 16}px`, y.bw, fk)
  b.style.opacity = 1
  const x0 = -hw - 20, x1 = ly.W + b.offsetWidth + 30, dur = ((x1 - x0) / y.vH) * 1000
  mv(e, [[x0, y.hy, 1], [x1, y.hy - 6, 1]], dur)
  e.querySelector('[data-a]').onclick = (ev) => {
    ev.stopPropagation()
    b.textContent = L[bags('hero', L.length)]
    const q = at(host, e, hw * 0.55, -20)
    pop(ctx, '👍', q[0], q[1])
  }
  later(() => e.remove(), dur + 100)
  return dur
}

/* ---------- UFO: bay theo đường cong, mọi chuyển động là Web Animations tự dọn khi xong ---------- */

/** Catmull-Rom qua các điểm [x, y, t] → đoạn Bézier bậc ba; t là mốc thời gian 0..1 của điểm. */
function cr(Q, n = 8) {
  return Q.slice(0, -1).map((a, i) => {
    const b = Q[i + 1], pa = Q[i - 1] || a, pb = Q[i + 2] || b
    return { p: [a, [a[0] + (b[0] - pa[0]) / 6, a[1] + (b[1] - pa[1]) / 6], [b[0] - (pb[0] - a[0]) / 6, b[1] - (pb[1] - a[1]) / 6], b], t: [a[2], b[2]], n }
  })
}
/** Đoạn thẳng a → b trong khoảng t0..t1 (a = b: đứng yên). */
function ln(a, b, t0, t1, n = 3) {
  return { p: [a, [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3], [a[0] + ((b[0] - a[0]) * 2) / 3, a[1] + ((b[1] - a[1]) * 2) / 3], b], t: [t0, t1], n }
}
function bez([a, b, c, d], u) {
  const v = 1 - u, A = v * v * v, B = 3 * v * v * u, Cc = 3 * v * u * u, Dd = u * u * u
  return [A * a[0] + B * b[0] + Cc * c[0] + Dd * d[0], A * a[1] + B * b[1] + Cc * c[1] + Dd * d[1]]
}
/** Vị trí trên đường bay tại thời điểm t. */
function segAt(segs, t0) {
  const s = segs.find((z) => t0 <= z.t[1]) || segs[segs.length - 1]
  return bez(s.p, Math.max(0, Math.min(1, (t0 - s.t[0]) / (s.t[1] - s.t[0] || 1))))
}
/**
 * Cho `art` (w×h, tâm ở gốc) bay dọc các đoạn `segs` trong `dur` giây, mũi hướng theo đường bay
 * (`tk` 0 = giữ thẳng, 1 = xoay hẳn). `k` phóng, `flip` lật ngang, `scf`/`opf` scale/opacity theo t,
 * `sync`: [[selector con, keyframes]] chạy cùng nhịp.
 */
function flyPath(host, art, w, h, segs, dur, o = {}) {
  const el = document.createElement('div'), fl = !!o.flip, tk = o.tk ?? 1, kz = o.k ?? 1
  el.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;will-change:transform'
  el.innerHTML = `<div style="position:absolute;left:${-w / 2}px;top:${-h / 2}px;width:${w}px;height:${h}px;transform:scale(${fl ? -kz : kz},${kz})"><div style="position:relative;width:100%;height:100%;${o.inner || ''}">${art}</div></div>`
  const pts = []
  segs.forEach((s, si) => {
    const n = s.n || 8
    for (let i = si ? 1 : 0; i <= n; i++) {
      const [x, y] = bez(s.p, i / n)
      pts.push({ x, y, o: s.t[0] + (s.t[1] - s.t[0]) * (i / n) })
    }
  })
  let prev = null
  const kf = pts.map((q, i) => {
    const a = pts[Math.min(i + 1, pts.length - 1)], b = pts[Math.max(i - 1, 0)]
    let g = Math.hypot(a.x - b.x, a.y - b.y) < 0.01 ? (prev ?? 0) : (Math.atan2(a.y - b.y, a.x - b.x) * 180) / Math.PI - (fl ? 180 : 0)
    if (prev == null || tk !== 1) g = (((g % 360) + 540) % 360) - 180
    else {
      while (g - prev > 180) g -= 360
      while (g - prev < -180) g += 360
    }
    prev = g
    const f = { transform: `translate(${q.x.toFixed(1)}px,${q.y.toFixed(1)}px) rotate(${(g * tk).toFixed(1)}deg)` + (o.scf ? ` scale(${o.scf(q.o).toFixed(3)})` : ''), offset: Math.min(1, Math.max(0, q.o)) }
    if (o.opf) f.opacity = Math.max(0, Math.min(1, o.opf(q.o)))
    return f
  })
  host.appendChild(el)
  el.animate(kf, { duration: dur * 1000, easing: 'linear', fill: 'both' }).onfinish = () => el.remove()
  ;(o.sync || []).forEach(([sel, fr]) => {
    const c = el.querySelector(sel)
    if (c) c.animate(fr, { duration: dur * 1000, fill: 'both' })
  })
  return el
}

/**
 * UFO bay vào từ một phía, lượn rồi đứng chiếu tia hút một người (bạn hoặc người kề trên BXH) từ
 * mép dưới màn lên; người bị hút kêu một câu; rồi một trong năm kết cục (lib/sky.js → UFO_OUTCOMES):
 * bắt cóc · siêu nhân cứu · bị bắn rơi (người bung dù) · tia chập tuột xuống · UFO trả người lại.
 * Trả về thời lượng (ms).
 */
function ufoScene(ctx) {
  const { host, bags, dark: d, ly, H, st, name, fk } = ctx
  const W = ly.W, mob = !!ly.m, k = mob ? 0.9 : 1.25, R = Math.random, rr = (a, b) => a + R() * (b - a)
  // Người bị bắt, câu kêu, kết cục, câu tuột / trả: rút từ túi xáo — đủ một lượt mới lặp.
  const sc = ufoScript(st, bags('ufoWho', 2) === 0, name), isMe = sc.me, who = isMe ? 'Me' : 'Rival'
  const s = R() < 0.5 ? 1 : -1, X0 = -120 * k, X1 = W + 120 * k, sx = s > 0 ? X0 : X1, ex = s > 0 ? X1 : X0
  const ux = mob ? W * rr(0.32, 0.68) : W * rr(0.56, 0.74), uy = mob ? rr(28, 36) : rr(30, 42), D = mob ? rr(13, 15) : rr(13, 16)
  const bh = Math.round((H - uy) / k + 30), yg = H + 40

  // Bóng thoại đặt trong phần tử đã phóng k → chia ngược để chữ vẫn 11px.
  const bubF = (kk) => `${d ? 'background:rgba(10,16,34,.92);color:#EAF1FF;border:1px solid rgba(170,200,255,.35)' : 'background:rgba(255,248,242,.96);color:#4A2A38;border:1px solid #EBC3BC'};padding:${sk(4 / kk, fk)} ${sk(8 / kk, fk)};border-radius:9px;font:600 ${sk(11 / kk, fk)}/1.3 var(--font-sans);width:max-content;max-width:${sk((mob ? 170 : 220) / kk, fk)};text-wrap:pretty;white-space:normal;overflow-wrap:anywhere;opacity:0`
  const bubS = bubF(k)
  const show = (a, b) => [{ opacity: 0, offset: 0 }, { opacity: 0, offset: a }, { opacity: 1, offset: a + 0.02 }, { opacity: 1, offset: b }, { opacity: 0, offset: Math.min(1, b + 0.03) }].concat(b + 0.03 < 1 ? [{ opacity: 0, offset: 1 }] : [])

  const lt = (x, y, cl, dd) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${cl}" style="animation:skyTwinkle .7s ${dd}s infinite"/>`
  const alien = '<circle cx="24" cy="7.6" r="3.2" fill="#86EFAC"/><circle cx="22.9" cy="7.2" r=".75" fill="#111"/><circle cx="25.1" cy="7.2" r=".75" fill="#111"/>'
  const UB = d
    ? `<svg width="48" height="22" viewBox="0 0 48 22" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 0 6px rgba(94,242,194,.6))">${alien}<path d="M15 10 Q15 2 24 2 Q33 2 33 10 Z" fill="rgba(167,139,250,.45)" stroke="#C4B5FD" stroke-width="1"/><ellipse cx="24" cy="12" rx="23" ry="6" fill="#1E1B4B" stroke="#5EF2C2" stroke-width="1.2"/><ellipse cx="24" cy="10.5" rx="16" ry="3" fill="#312E81"/>${lt(8, 13, '#5EF2C2', 0)}${lt(16, 15, '#F9A8D4', -0.2)}${lt(24, 16, '#FDE68A', -0.4)}${lt(32, 15, '#F9A8D4', -0.1)}${lt(40, 13, '#5EF2C2', -0.3)}</svg>`
    : `<svg width="48" height="22" viewBox="0 0 48 22" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 1px 1.5px rgba(76,64,140,.3))">${alien}<path d="M15 10 Q15 2 24 2 Q33 2 33 10 Z" fill="rgba(199,249,229,.55)" stroke="#5EEAD4" stroke-width="1"/><ellipse cx="24" cy="12" rx="23" ry="6" fill="#A78BFA"/><ellipse cx="24" cy="10.5" rx="16" ry="3" fill="#C4B5FD"/>${lt(10, 13, '#FDE68A', 0)}${lt(24, 15, '#F9A8D4', -0.3)}${lt(38, 13, '#FDE68A', -0.5)}</svg>`
  const ufoA = (inB, out) => `<div data-k="beam" style="position:absolute;left:9px;top:16px;width:30px;height:${bh}px;opacity:0;clip-path:polygon(32% 0,68% 0,100% 100%,0 100%);background:linear-gradient(${d ? 'rgba(94,242,194,.7),rgba(94,242,194,.05)' : 'rgba(253,230,138,.8),rgba(253,230,138,.05)'})"></div><div data-k="body" style="position:absolute;inset:0;transform-origin:50% 50%">${UB}${inB || ''}</div>${out || ''}`
  const qSide = ux > W / 2 ? 'right:46px' : 'left:46px'
  const q = (txt) => `<div data-k="q" style="position:absolute;${qSide};top:-6px;${bubS}">${esc(txt)}</div>`

  // Người bị hút: đung đưa dưới tia (áo teal là bạn, áo hồng là người kề), nhãn tên dưới chân — tên dài
  // cắt "…" ở 80px (chưa ghép thành viên thì bạn không có tên → không nhãn).
  const pw = 20, ph = 28, vSide = ux > W / 2 ? `right:${pw - 2}px` : `left:${pw - 2}px`, vin = 'transform-origin:50% 0;animation:skySway .45s ease-in-out infinite alternate'
  const vName = isMe ? name : sc.victim
  const vs = personSVG(1, isMe ? '#00B2A9' : '#E86A9A', !isMe) + (vName ? `<span style="position:absolute;left:50%;top:30px;transform:translateX(-50%);max-width:${sk(80 / k, fk)};overflow:hidden;text-overflow:ellipsis;padding:1px 4px;border-radius:4px;background:${d ? 'rgba(10,16,34,.85)' : 'rgba(255,248,242,.92)'};font:600 ${sk(9 / k, fk)}/1.3 var(--font-mono);color:${d ? '#EAF1FF' : '#4A2A38'};white-space:nowrap">${esc(vName)}</span>` : '')
  const bubV = (key, txt) => `<div data-k="${key}" style="position:absolute;${vSide};bottom:${ph - 4}px;${bubS}">${esc(txt)}</div>`
  const cry = tl(sc.rise[bags('rise' + who, sc.rise.length)])

  const pathU = cr([[sx, uy - 60, 0], [ux, uy, 0.26], [ux + 4, uy + 5, 0.4], [ux - 3, uy - 3, 0.56], [ux, uy + 2, 0.74], [ex + s * 40, -160, 0.88], [ex + s * 80, -220, 1]], 8)
  const fade = (x) => Math.min(1, x / 0.04, (1 - x) / 0.04), wob = 'transform-origin:50% 60%;animation:skyWobble 2.4s ease-in-out infinite'
  const pool = ufoPool(!!sc.abduct), out = pool[bags('ufo', pool.length)]
  // Người đã đáp đất: đứng một lúc rồi chạy ngang ra mép màn gần hơn, nhún từng bước (thay vì chìm xuống đáy).
  const runOff = (x, y, t0, t1) => {
    const x1 = x > W / 2 ? W + 40 : -40, n = Math.max(4, Math.round((t1 - t0) * D * 6)) // ~6 bước / giây
    return cr(Array.from({ length: n + 1 }, (_, i) => [x + ((x1 - x) * i) / n, y - (i % 2 ? 5 * k : 0), t0 + ((t1 - t0) * i) / n]), 2)
  }

  if (out === 'ok') {
    flyPath(host, ufoA('', q(tl(sc.abduct))), 48, 22, pathU, D, { k, tk: 0, inner: wob, sync: [['[data-k="beam"]', show(0.34, 0.72)], ['[data-k="q"]', show(0.62, 0.78)]] })
    flyPath(host, bubV('bub', cry) + vs, pw, ph, cr([[ux, yg, 0], [ux, yg, 0.4], [ux + 8, H * 0.62, 0.52], [ux - 6, uy + 90, 0.63], [ux, uy + 12, 0.71], [ux, uy + 10, 1]], 8), D, {
      k, tk: 0, inner: vin, scf: (x) => (x < 0.55 ? 1 : Math.max(0.3, 1 - (x - 0.55) * 4.4)), opf: (x) => (x < 0.7 ? Math.min(1, x / 0.04) : 0), sync: [['[data-k="bub"]', show(0.44, 0.6)]],
    })
  } else if (out === 'rescue') {
    const tC = 0.56, yc = H * rr(0.45, 0.56), s2 = R() < 0.5 ? 1 : -1, hx0 = s2 > 0 ? X0 : X1, hx1 = s2 > 0 ? X1 : X0, hh = 14 * k, hk = k * 0.62
    const after = [[ux + s2 * 70 * k, yc - 50 * k, 0.64], [ux + s2 * W * 0.35, yc - 150 * k, 0.8], [hx1 + s2 * 60, yc - 260 * k, 1]]
    flyPath(host, ufoA('', q(t('sky.ufo.huh'))), 48, 22, pathU, D, { k, tk: 0, inner: wob, sync: [['[data-k="beam"]', show(0.34, tC + 0.01)], ['[data-k="q"]', show(tC + 0.03, 0.74)]] })
    flyPath(host, bubV('bub', cry) + bubV('ty', tl(sc.thank)) + vs, pw, ph, cr([[ux, yg, 0], [ux, yg, 0.4], [ux + 8, H * 0.68, 0.49], [ux, yc, tC], ...after], 8), D, {
      k, tk: 0, inner: vin, opf: fade, sync: [['[data-k="bub"]', show(0.42, tC - 0.03)], ['[data-k="ty"]', show(tC + 0.06, 0.78)]],
    })
    // Siêu nhân bay tới từ một phía bất kỳ, đỡ người rồi bế đi; bay từ phải thì lật hình, chữ lật lại.
    const HERO = `<div data-k="hb" style="position:absolute;left:60px;top:-30px;${bubF(hk)}"><span style="display:inline-block;${s2 < 0 ? 'transform:scaleX(-1);' : ''}">${esc(tl(sc.heroSay))}</span></div>` + heroSVG(1, d)
    const p0 = [hx0, yc + 120 * k]
    flyPath(host, HERO, 80, 34, [ln(p0, p0, 0, 0.38, 1), ...cr([[hx0, yc + 120 * k, 0.38], [ux - s2 * W * 0.22, yc + 40 * k, 0.48], [ux, yc - hh, tC], ...after.map((p) => [p[0], p[1] - hh, p[2]])], 8)], D, {
      k: hk, tk: 0.3, flip: s2 < 0, opf: (x) => (x < 0.37 ? 0 : 1), sync: [['[data-k="hb"]', show(0.46, tC + 0.14)]],
    })
  } else if (out === 'down') {
    // Tên lửa bắn từ đáy màn lên trúng UFO: BÙM, UFO cháy lộn nhào rơi kèm khói; người bung dù.
    const tH = 0.55, tL = 0.43, yv = H * rr(0.5, 0.58), mx = Math.min(W - 30, Math.max(30, ux + rr(-0.25, 0.25) * W))
    const segsU = cr([[sx, uy - 60, 0], [ux, uy, 0.26], [ux + 4, uy + 5, 0.4], [ux, uy, tH], [ux + s * 36 * k, uy - 22, tH + 0.05], [ux + s * 110 * k, uy + 70, 0.68], [ux + s * 180 * k, H * 0.62, 0.84], [ux + s * 220 * k, H + 120, 1]], 10)
    const fire = '<div data-k="fire" style="position:absolute;left:28px;top:-9px;width:12px;height:14px;opacity:0;border-radius:50% 50% 40% 40%;background:radial-gradient(60% 60% at 50% 70%,#FFF7D6,#FDBA74 45%,rgba(244,63,94,.75) 75%,rgba(244,63,94,0));transform-origin:50% 100%;animation:skyFlame .15s ease-in-out infinite alternate"></div>'
    const aaa = `<div data-k="aaa" style="position:absolute;${qSide};top:-6px;${bubS}">${esc(t('sky.ufo.hit'))}</div>`
    flyPath(host, ufoA(fire, aaa), 48, 22, segsU, D, {
      k, tk: 0,
      sync: [
        ['[data-k="beam"]', show(0.34, tH - 0.01)],
        ['[data-k="body"]', [{ transform: 'rotate(0deg)', offset: 0 }, { transform: 'rotate(0deg)', offset: tH }, { transform: 'rotate(-28deg)', offset: tH + 0.04 }, { transform: 'rotate(16deg)', offset: tH + 0.1 }, { transform: 'rotate(-34deg)', offset: tH + 0.18 }, { transform: 'rotate(40deg)', offset: tH + 0.3 }, { transform: 'rotate(220deg)', offset: 1 }]],
        ['[data-k="fire"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: tH }, { opacity: 1, offset: tH + 0.02 }, { opacity: 1, offset: 1 }]],
        ['[data-k="aaa"]', show(tH + 0.04, tH + 0.24)],
      ],
    })
    const ROCKET = '<div style="position:absolute;left:-200px;top:3px;width:194px;height:12px;border-radius:6px;background:linear-gradient(to left,rgba(255,255,255,.9),rgba(255,255,255,0));filter:blur(2.5px)"></div><div style="position:absolute;left:-12px;top:4px;width:18px;height:10px;border-radius:50%;background:radial-gradient(70% 60% at 100% 50%,#FFF7D6,#FDBA74 45%,rgba(244,63,94,.8) 75%,rgba(244,63,94,0));transform-origin:100% 50%;animation:skyFlame .1s ease-in-out infinite alternate"></div><svg width="44" height="18" viewBox="0 0 44 18" style="position:absolute;inset:0;overflow:visible"><path d="M14 4.6 L6 0 H11 L20 4 Z M14 13.4 L6 18 H11 L20 14 Z" fill="#64748B"/><path d="M10 9 Q10 4.5 22 4.5 H32 Q40 5 43 9 Q40 13 32 13.5 H22 Q10 13.5 10 9 Z" fill="#E2E8F0"/><path d="M34 5.2 Q40 6 43 9 Q40 12 34 12.8 Z" fill="#EF4444"/></svg>'
    flyPath(host, ROCKET, 44, 18, [ln([mx, H + 40], [mx, H + 40], 0, tL, 1), { p: [[mx, H + 40], [mx, H * 0.6], [ux + (mx - ux) * 0.3, uy + 120], [ux, uy]], t: [tL, tH], n: 14 }, ln([ux, uy], [ux, uy], tH, 1, 10)], D, { k: k * 0.6, opf: (x) => (x < tH - 0.005 ? 1 : 0) })
    const sparks = Array.from({ length: 8 }, (_, i) => `<span style="position:absolute;left:0;top:-1px;width:30px;height:2px;border-radius:1px;background:linear-gradient(90deg,rgba(253,224,71,0),#FDE047);transform-origin:0 50%;transform:rotate(${i * 45 + 20}deg) translateX(16px)"></span>`).join('')
    add(host, `<div style="position:absolute;left:-40px;top:-40px;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,#FFFBEB 0,#FDE68A 25%,#FB923C 50%,rgba(244,63,94,.5) 65%,rgba(244,63,94,0) 72%)"></div>${sparks}<div style="position:absolute;left:-28px;top:-50px;font:800 18px/1 var(--font-display);color:#FDE047;-webkit-text-stroke:1.5px #9A3412;transform:rotate(-8deg);white-space:nowrap">${esc(t('sky.boom'))}</div>`, ux, uy,
      [{ opacity: 0, transform: `scale(${0.2 * k})`, offset: 0 }, { opacity: 0, transform: `scale(${0.2 * k})`, offset: tH - 0.002 }, { opacity: 1, transform: `scale(${k})`, offset: tH + 0.02 }, { opacity: 1, transform: `scale(${1.15 * k})`, offset: tH + 0.08 }, { opacity: 0, transform: `scale(${1.3 * k})`, offset: tH + 0.15 }, { opacity: 0, transform: `scale(${1.3 * k})`, offset: 1 }], D * 1000)
    const col = d ? '170,180,215' : '120,118,145'
    for (let x = tH + 0.03; x < 0.97; x += 0.035) {
      const [fx, fy] = segAt(segsU, x), sz = rr(14, 24) * k, x2 = Math.min(1, x + 0.16)
      add(host, `<div style="position:absolute;left:${(-sz / 2).toFixed(1)}px;top:${(-sz / 2).toFixed(1)}px;width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;border-radius:50%;background:radial-gradient(circle,rgba(${col},.55),rgba(${col},0) 70%)"></div>`, fx, fy,
        [{ opacity: 0, transform: 'scale(.4)', offset: 0 }, { opacity: 0, transform: 'scale(.4)', offset: x }, { opacity: 1, transform: 'scale(.8)', offset: Math.min(1, x + 0.01) }, { opacity: 0, transform: 'translateY(-10px) scale(2.2)', offset: x2 }].concat(x2 < 1 ? [{ opacity: 0, transform: 'translateY(-10px) scale(2.2)', offset: 1 }] : []), D * 1000)
    }
    const CH = `<svg data-k="chute" width="30" height="24" viewBox="0 0 30 24" style="position:absolute;left:${pw / 2 - 15}px;top:-24px;overflow:visible;opacity:0"><path d="M1 10 L15 24 M8 10 L15 24 M22 10 L15 24 M29 10 L15 24" stroke="rgba(255,255,255,.9)" stroke-width=".6"/><path d="M1 10 Q15 -6 29 10 Q25 7.5 22 10 Q18.5 7.5 15 10 Q11.5 7.5 8 10 Q4.5 7.5 1 10 Z" fill="${isMe ? '#00B2A9' : '#F472B6'}" stroke="#fff" stroke-width=".8"/></svg>`
    const xg = ux + 40 * k, yl = H - 60 * k
    flyPath(host, CH + bubV('bub', cry) + bubV('ph', tl(sc.safe)) + vs, pw, ph, [
      ...cr([[ux, yg, 0], [ux, yg, 0.4], [ux + 8, H * 0.7, 0.48], [ux - 4, yv, tH], [ux + 6, yv + 12 * k, tH + 0.05], [ux + 30 * k, (yv + yl) / 2, 0.72], [xg, yl, 0.82]], 8),
      ln([xg, yl], [xg, yl], 0.82, 0.88, 2),
      ...runOff(xg, yl, 0.88, 1),
    ], D, {
      k, tk: 0, inner: vin, opf: fade,
      sync: [['[data-k="bub"]', show(0.44, tH - 0.02)], ['[data-k="ph"]', show(tH + 0.08, 0.86)], ['[data-k="chute"]', [{ opacity: 0, offset: 0 }, { opacity: 0, offset: tH + 0.02 }, { opacity: 1, offset: tH + 0.05 }, { opacity: 1, offset: 0.83 }, { opacity: 0, offset: 0.86 }, { opacity: 0, offset: 1 }]]],
    })
  } else if (out === 'slip') {
    // Tia chập chờn rồi tắt: người tuột rơi xuống, nảy một nhịp, đứng một lúc rồi chạy ngang khỏi màn.
    const yc = uy + (yg - uy) * 0.45
    const flick = [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.34 }, { opacity: 1, offset: 0.36 }, { opacity: 1, offset: 0.48 }, { opacity: 0.15, offset: 0.49 }, { opacity: 1, offset: 0.5 }, { opacity: 0.1, offset: 0.51 }, { opacity: 0.8, offset: 0.52 }, { opacity: 0, offset: 0.53 }, { opacity: 0, offset: 1 }]
    flyPath(host, ufoA('', q(t('sky.ufo.slip'))), 48, 22, pathU, D, { k, tk: 0, inner: wob, sync: [['[data-k="beam"]', flick], ['[data-k="q"]', show(0.55, 0.72)]] })
    flyPath(host, bubV('bub', cry) + bubV('ph', tl(sc.slip[bags('slip' + who, sc.slip.length)])) + vs, pw, ph, [
      ...cr([[ux, yg, 0], [ux, yg, 0.4], [ux + 6, (yg + yc) / 2, 0.46], [ux, yc, 0.52]], 8),
      ...cr([[ux, yc, 0.52], [ux + 2, yc + (yg - yc) * 0.3, 0.555], [ux + 4, H - 60 * k, 0.6], [ux + 10 * k, H - 80 * k, 0.64], [ux + 16 * k, H - 60 * k, 0.68]], 6),
      ln([ux + 16 * k, H - 60 * k], [ux + 16 * k, H - 60 * k], 0.68, 0.8, 2),
      ...runOff(ux + 16 * k, H - 60 * k, 0.8, 1),
    ], D, { k, tk: 0, inner: vin, opf: (x) => Math.min(1, x / 0.04, (1 - x) / 0.05), sync: [['[data-k="bub"]', show(0.42, 0.5)], ['[data-k="ph"]', show(0.6, 0.86)]] })
  } else {
    // UFO hút người lên tàu rồi chê, thả trả lại.
    const yt = uy + 14
    flyPath(host, ufoA('', q(tl(UFO_GIVE_BACK[bags('giveBack', UFO_GIVE_BACK.length)]))), 48, 22, pathU, D, { k, tk: 0, inner: wob, sync: [['[data-k="beam"]', show(0.34, 0.74)], ['[data-k="q"]', show(0.6, 0.76)]] })
    flyPath(host, bubV('bub', cry) + bubV('ua', tl(UFO_HUH[bags('huh', UFO_HUH.length)])) + vs, pw, ph, [
      ...cr([[ux, yg, 0], [ux, yg, 0.38], [ux + 6, (yg + yt) / 2, 0.46], [ux, yt, 0.54]], 8),
      ln([ux, yt], [ux, yt], 0.54, 0.62, 2),
      ...cr([[ux, yt, 0.62], [ux - 6, (yg + yt) / 2, 0.7], [ux, H - 70 * k, 0.76]], 8),
      ln([ux, H - 70 * k], [ux, H - 70 * k], 0.76, 0.86, 2),
      ...runOff(ux, H - 70 * k, 0.86, 1),
    ], D, {
      k, tk: 0, inner: vin,
      scf: (x) => (x < 0.5 ? 1 : x < 0.54 ? 1 - (x - 0.5) * 15 : x < 0.62 ? 0.4 : x < 0.66 ? 0.4 + (x - 0.62) * 15 : 1),
      opf: (x) => Math.min(1, x / 0.04, (1 - x) / 0.05),
      sync: [['[data-k="bub"]', show(0.42, 0.5)], ['[data-k="ua"]', show(0.78, 0.92)]],
    })
  }
  return D * 1000
}

/** Một hạt WAAPI tự xoá khi chạy xong. */
function add(host, html, x, y, fr, dur) {
  const e = document.createElement('div')
  e.style.cssText = `position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:0;height:0;pointer-events:none`
  e.innerHTML = html
  host.appendChild(e)
  e.animate(fr, { duration: dur, fill: 'both' }).onfinish = () => e.remove()
}

/** Sao ước bay ngang header 6,8 giây (không nhãn — bấm vào là ước). */
function spawnWish(host, w, wishes, bags) {
  if (!host.isConnected) return
  const R = Math.random
  const x0 = w.x + R() * w.xr, y0 = w.y + R() * w.yr, dx = -(w.dx + R() * w.dxr), dy = w.dy + R() * w.dyr, ang = (Math.atan2(dy, dx) * 180) / Math.PI
  const el = document.createElement('div')
  el.style.cssText = `position:absolute;left:${x0.toFixed(0)}px;top:${y0.toFixed(0)}px;width:0;height:0;pointer-events:auto;cursor:pointer`
  el.innerHTML = `<div style="position:absolute;left:0;top:0;transform:rotate(${ang.toFixed(1)}deg)"><span style="position:absolute;left:-150px;top:-1px;width:150px;height:2px;border-radius:2px;background:linear-gradient(90deg,rgba(255,240,200,0),rgba(255,250,235,.95))"></span></div>`
    + '<span style="position:absolute;left:-28px;top:-28px;width:56px;height:56px;border-radius:50%"></span>'
    + '<span data-h style="position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 8px 3px rgba(255,244,200,.95),0 0 26px 10px rgba(240,183,92,.45)"></span>'
    + '<span style="position:absolute;left:-22px;top:-22px;width:44px;height:44px;box-sizing:border-box;border-radius:50%;border:1px dashed rgba(255,240,200,.55);animation:badgeSpin 5s linear infinite"></span>'
  host.appendChild(el)
  const a = el.animate([{ transform: 'translate(0px,0px)', opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.9 }, { transform: `translate(${dx.toFixed(0)}px,${dy.toFixed(0)}px)`, opacity: 0 }], { duration: WISH_FLY_MS, fill: 'both' })
  a.onfinish = () => el.remove()
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    const hb = host.getBoundingClientRect(), k = host.offsetWidth / (hb.width || 1), b = el.querySelector('[data-h]').getBoundingClientRect()
    const x = (b.left + b.width / 2 - hb.left) * k, y = (b.top + b.height / 2 - hb.top) * k
    a.cancel()
    el.remove()
    burst(host, x, y, wishes(), bags, k)
  })
}

/** Bung sáng tại chỗ bấm + thẻ hiện một điều ước rút từ túi xáo (câu réo tên rút thêm tên từ túi riêng). */
function burst(host, x, y, wishes, bags, fk = 1) {
  const R = Math.random
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, r = 30 + R() * 40, s = 2 + R() * 2.4
    add(host, `<span style="position:absolute;left:${-s / 2}px;top:${-s / 2}px;width:${s}px;height:${s}px;border-radius:50%;background:#FFF7D6;box-shadow:0 0 6px 2px rgba(253,230,138,.85)"></span>`, x, y, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${(Math.cos(a) * r).toFixed(1)}px,${(Math.sin(a) * r).toFixed(1)}px)`, opacity: 0 }], 900 + R() * 500)
  }
  add(host, '<svg width="40" height="40" viewBox="-20 -20 40 40" style="position:absolute;left:-20px;top:-20px;overflow:visible;filter:drop-shadow(0 0 8px rgba(253,230,138,.95))"><path d="M0 -18 L4 -4 L18 0 L4 4 L0 18 L-4 4 L-18 0 L-4 -4 Z" fill="#FFF7D6"/></svg>', x, y, [{ transform: 'scale(.2) rotate(0deg)', opacity: 0 }, { transform: 'scale(1.2) rotate(45deg)', opacity: 1, offset: 0.3 }, { transform: 'scale(0) rotate(120deg)', opacity: 0 }], 1200)
  const e = wishes[bags('wish', wishes.length)]
  const foes = e?.[1]?.foes
  const w = tl(foes ? [e[0], { name: foes[bags('foe', foes.length)] }] : e)
  const hw = Math.min(160, host.offsetWidth / 2 - 12), bx = Math.max(hw, Math.min(host.offsetWidth - hw, x))
  add(host, `<div style="position:absolute;left:0;top:0;transform:translateX(-50%);padding:${sk(7, fk)} ${sk(12, fk)};border-radius:10px;background:rgba(8,14,30,.92);border:1px solid rgba(253,230,138,.45);box-shadow:0 0 20px rgba(253,230,138,.2);width:max-content;max-width:${Math.min(hw * 2, 280 * fk).toFixed(0)}px;box-sizing:border-box;text-align:center;font:600 ${sk(12, fk)}/1.3 var(--font-sans);color:#F4F7FF;text-wrap:balance;overflow-wrap:anywhere">${esc(w)}</div>`, bx, y + 28, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)', offset: 0.08 }, { opacity: 1, transform: 'translateY(0)', offset: 0.86 }, { opacity: 0, transform: 'translateY(-6px)' }], 4400)
}
