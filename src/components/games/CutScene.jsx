import { Icon } from '#ds'
import { G, btn } from '#components/games/stage.js'
import { setSkin, useSkin } from '#components/games/chessSkins.js'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'

// Lớp "Cận cảnh" (bản "Cờ · sinh động", 2026-11-14): một dải phim 560 × 236 quét ngang giữa bàn, diễn lại đòn vừa đánh
// bằng nhân vật cỡ lớn rồi tự tắt. Bật / tắt ở nút đầu trang (CloseUpToggle) — nhớ theo máy, mặc định tắt.
// Như ChessFx: suy từ nước vừa đi, gắn `key` theo số nước ở chỗ gọi nên mỗi nước diễn một lần, không giữ state / hẹn giờ.
// Màu viết cứng (một "vật" trên bàn — DESIGN.md §2.4). Hiệu ứng cs* / cg* ở effects.css.
//   kind 'ganh' — người vừa đi nhún, đòn gánh nhấc hai quang, người trong quang lật sang làng mình (`n` > 1: hai quang).
//   kind 'vay'  — bốn người phe mình nhún quanh, vòng vây quay, người bị vây lật sang làng mình.
//   kind 'hole' — Cờ vây: lõi hố đen (hoặc siêu tân tinh) hiện giữa dải, `n` quân bị ăn xoáy vào rồi biến mất.
//   kind 'duel' — Cờ vua / Cờ tướng: quân đánh lao tới theo kiểu đòn `blow` (BLOWS), quân bị ăn phản ứng theo CUTS.
//   kind 'rise' — thăng cấp: quân cũ `att` tan trong cột sáng, quân mới `vic` rơi xuống (`wing` hồi sinh có cánh, `badge` nhãn).
// <MateCage> (không cần bật Cận cảnh): lồng rơi úp vua bị chiếu bí, vương miện văng ra, chữ tên đòn nảy lên.

/** Game có cảnh cận cảnh — đầu trang phòng hiện nút bật / tắt. */
export const CLOSEUP_GAMES = ['coganh', 'covay', 'covua', 'cotuong', 'coup']

/** Đang bật Cận cảnh không (theo máy). */
export const useCloseUp = () => useSkin('closeup')[0] === 'on'

/** Nút bật / tắt ở đầu trang phòng. Điện thoại chỉ còn icon. */
export function CloseUpToggle() {
  const on = useCloseUp()
  const isMobile = useMobile(768)
  const label = t(on ? 'games.closeup.on' : 'games.closeup.off')
  return (
    <button type="button" aria-pressed={on} title={t('games.closeup.hint')} aria-label={label} onClick={() => setSkin('closeup', on ? 'off' : 'on')}
      style={{ ...btn('ghost', { sm: true }), ...(isMobile ? { width: 36, height: 36, padding: 0 } : null), ...(on ? { background: G.goldA(0.16), color: G.goldHi, borderColor: G.goldA(0.5) } : null) }}>
      <Icon name="sparkles" size={15} />{!isMobile && label}
    </button>
  )
}

/** Kiểu đòn → cách quân bị đánh ngã (văng / bẹp / tan / cháy / ngã). */
const CUTS = { thrust: 'flung', charge: 'flung', leap: 'flatten', stomp: 'flatten', beam: 'dissolve', slash: 'fall', cannon: 'burn', seal: 'flatten', fan: 'fall' }
const LINES = ['thrust', 'charge', 'leap', 'slash']
const SHOCK = ['leap', 'stomp', 'seal', 'cannon']

const T = (name, delay, d = 1.6) => `${name} ${d}s ease-in-out ${delay}s both`
const fig = (src, style, key) => <img key={key} src={src} alt="" style={{ position: 'absolute', display: 'block', ...style }} />

/** Một người đổi phe: mặt cũ lật đi rồi mặt mới lật về. */
function Turn({ vic, vic2, delay, style }) {
  return (
    <span style={{ position: 'absolute', perspective: 400, ...style }}>
      {fig(vic, { inset: 0, width: '100%', height: '100%', opacity: 0, animation: T('cgOut', delay) })}
      {fig(vic2, { inset: 0, width: '100%', height: '100%', animation: T('cgIn', delay) })}
    </span>
  )
}

/** Quang gánh: dây treo + sọt tre + người ngồi trong đang đổi làng. */
function Basket({ vic, vic2, delay, side }) {
  return (
    <span style={{ position: 'absolute', [side]: 62, bottom: 30, width: 116, height: 150, zIndex: 4, animation: T('csBasket', delay) }}>
      <span style={{ position: 'absolute', left: 56, top: 0, width: 2, height: 40, background: '#6b4a24' }} />
      <span style={{ position: 'absolute', left: 4, right: 4, bottom: 0, height: 58, borderRadius: '6px 6px 40px 40px', background: 'repeating-linear-gradient(90deg,#c08a44 0 7px,#9a6a30 7px 9px)', border: '3px solid #6b4a24', zIndex: 2 }} />
      <Turn vic={vic} vic2={vic2} delay={delay} style={{ left: 16, top: 22, width: 84, height: 101 }} />
    </span>
  )
}

/**
 * `kind` 'ganh' | 'vay' · `att` ảnh phe vừa đánh · `vic` / `vic2` ảnh người bị ăn trước / sau khi đổi phe · `n` số quang (ganh) ·
 * `title` / `sub` chữ trên dải · `col` màu nhấn · `bg` nền dải · `side` 1 = lật ngang (phe trên đánh) · `delay` giây chờ trước khi chạy ·
 * hole: `n` số quân bị nuốt, `core` nền lõi, `dot` nền mỗi quân ·
 * duel: `blow` kiểu đòn (khoá của CUTS), `seal` chữ trên ấn (kiểu 'seal') · rise: `wing` có cánh, `badge` nhãn trên quân mới.
 * Đặt trong khung bàn có position: relative (giữa bàn).
 */
export default function CutScene({ kind, att, vic, vic2 = att, n = 1, title, sub, col = '#ffcf3a', bg, side = 0, delay = 0, core, dot, blow = 'thrust', seal, wing, badge }) {
  const hit = { position: 'absolute', left: 460, opacity: 0 } // điểm trúng đòn (giữa quân bị đánh)
  const slashC = blow === 'fan' ? '#7fffd4' : '#ffffff'
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', width: 560, height: 236, margin: '-118px 0 0 -280px', pointerEvents: 'none', zIndex: 100 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', opacity: 0, animation: T('csBand', delay),
        background: bg || 'linear-gradient(100deg,rgba(10,14,34,.96),rgba(30,26,70,.96))', boxShadow: `0 24px 70px rgba(0,0,0,.7), 0 0 0 2px ${col}, 0 0 40px -6px ${col}`,
      }}>
        <div style={{ position: 'absolute', inset: 0, transform: side === 1 ? 'scaleX(-1)' : 'none' }}>
          <span style={{ position: 'absolute', left: 0, right: 0, bottom: 30, height: 2, background: `linear-gradient(90deg,transparent,${col},transparent)`, opacity: 0.7 }} />
          {kind === 'ganh' && (
            <>
              <span style={{ position: 'absolute', left: 280, bottom: 118, width: 400, height: 12, borderRadius: 6, background: 'linear-gradient(180deg,#e2b46a,#8a5a2a)', boxShadow: '0 4px 10px rgba(0,0,0,.5)', zIndex: 3, animation: T('csPole', delay) }} />
              {fig(att, { left: 220, bottom: 30, width: 120, height: 144, zIndex: 2, animation: T('csMover', delay) })}
              <Basket vic={vic} vic2={vic2} delay={delay} side="left" />
              {n > 1 && <Basket vic={vic} vic2={vic2} delay={delay} side="right" />}
            </>
          )}
          {kind === 'vay' && (
            <>
              <span style={{ position: 'absolute', left: 280, top: 126, width: 420, height: 420, borderRadius: '50%', border: '5px dashed ' + col, boxShadow: '0 0 20px ' + col, clipPath: 'inset(0 0 50% 0)', opacity: 0, animation: `csRing 1.6s linear ${delay}s both` }} />
              {[{ left: 40, bottom: 26, s: 96 }, { right: 40, bottom: 26, s: 96 }, { left: 140, bottom: 96, s: 76 }, { right: 140, bottom: 96, s: 76 }].map(({ s, ...pos }, i) => (
                fig(att, { ...pos, width: s, height: s * 1.2, animation: `cgBob .5s ease-in-out ${delay}s infinite` }, i)
              ))}
              <Turn vic={vic} vic2={vic2} delay={delay} style={{ left: 232, bottom: 30, width: 96, height: 115 }} />
            </>
          )}
          {kind === 'duel' && (
            <>
              {LINES.includes(blow) && <span style={{ position: 'absolute', left: 0, top: -10, width: 620, bottom: -10, background: 'repeating-linear-gradient(98deg,transparent 0 30px,rgba(255,255,255,.12) 30px 33px)', animation: 'csLines .35s linear infinite' }} />}
              {blow === 'beam' && <span style={{ position: 'absolute', left: 140, width: 300, bottom: 96, height: 22, borderRadius: 11, transformOrigin: '0 50%', background: 'linear-gradient(90deg,#fff,#e7d4ff 30%,#b197fc 70%,rgba(177,151,252,.2))', boxShadow: '0 0 26px #b197fc,0 0 60px #e7d4ff', animation: T('duBeam', delay) }} />}
              {blow === 'thrust' && <span style={{ position: 'absolute', left: 330, width: 110, bottom: 100, height: 6, borderRadius: 3, transformOrigin: '0 50%', background: 'linear-gradient(90deg,rgba(255,255,255,0),#fff)', boxShadow: '0 0 14px #fff', animation: T('duSpear', delay) }} />}
              {blow === 'cannon' && (
                <>
                  <span style={{ position: 'absolute', left: 40, top: 120, width: 60, height: 60, borderRadius: '50%', background: 'radial-gradient(circle,rgba(220,220,220,.9),rgba(140,140,140,.4) 60%,transparent 72%)', animation: T('duSmoke', delay) }} />
                  <span style={{ position: 'absolute', left: 0, top: 0, width: 26, height: 26, margin: '-13px 0 0 -13px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#666,#111 70%)', boxShadow: '0 0 0 3px rgba(255,140,40,.6),0 0 18px #ff8a2a', offsetPath: "path('M150 110 Q300 -30 460 120')", offsetRotate: '0deg', animation: T('duBall', delay) }} />
                </>
              )}
              {fig(att, { left: 40, bottom: 30, width: 120, height: 144, transformOrigin: '50% 90%', zIndex: 2, animation: T('duA_' + (blow === 'fan' ? 'slash' : blow), delay) })}
              <span style={{ position: 'absolute', right: 40, bottom: 30, width: 120, height: 144, transform: 'scaleX(-1)', zIndex: 1 }}>
                {fig(vic, { inset: 0, width: '100%', height: '100%', transformOrigin: '50% 92%', animation: T('duV_' + CUTS[blow], delay) })}
              </span>
              {SHOCK.includes(blow) && <span style={{ ...hit, top: 204, width: 150, height: 40, borderRadius: '50%', border: '4px solid ' + col, boxShadow: '0 0 18px ' + col, animation: T('duShock', delay) }} />}
              <span style={{ ...hit, top: 130, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle,#fff 0 12%,${col} 30%,transparent 66%)`, mixBlendMode: 'screen', zIndex: 3, animation: T('duFlash', delay) }} />
              {(blow === 'slash' || blow === 'fan') && [38, -38].map((r) => (
                <span key={r} style={{ ...hit, '--r': r + 'deg', top: 125, width: 190, height: 9, borderRadius: 5, background: slashC, boxShadow: '0 0 18px ' + slashC, zIndex: 4, animation: T('duSlash', delay) }} />
              ))}
              {blow === 'seal' && (
                <span style={{ ...hit, top: 120, width: 96, height: 96, display: 'grid', placeItems: 'center', borderRadius: 14, background: '#c92a2a', border: '4px solid #ffe3e3', color: '#fff5f5', font: "900 62px/1 'Noto Serif TC', 'KaiTi', serif", boxShadow: '0 10px 30px rgba(0,0,0,.6),0 0 30px #ff6b6b', zIndex: 4, animation: T('duSeal', delay) }}>{seal}</span>
              )}
            </>
          )}
          {kind === 'rise' && (
            <>
              <span style={{ position: 'absolute', left: 280, top: -10, bottom: 20, width: 150, background: `linear-gradient(0deg,${col},rgba(255,255,255,.85) 40%,rgba(255,255,255,0))`, filter: 'blur(3px)', mixBlendMode: 'screen', opacity: 0, animation: T('risePillar', delay, 1.9) }} />
              {wing && (
                <span style={{ position: 'absolute', left: 280, bottom: 70, width: 300, height: 120, opacity: 0, animation: T('riseWing', delay, 1.9) }}>
                  <span style={{ position: 'absolute', left: 0, top: 10, width: 120, height: 80, borderRadius: '100% 0 60% 40%', background: 'linear-gradient(200deg,#fff,#d0ebff 60%,rgba(208,235,255,0))', boxShadow: '0 0 24px #fff' }} />
                  <span style={{ position: 'absolute', right: 0, top: 10, width: 120, height: 80, borderRadius: '0 100% 40% 60%', background: 'linear-gradient(160deg,#fff,#d0ebff 60%,rgba(208,235,255,0))', boxShadow: '0 0 24px #fff' }} />
                </span>
              )}
              {fig(att, { left: 220, bottom: 30, width: 120, height: 144, zIndex: 2, opacity: 0, animation: T('riseOld', delay, 1.9) })}
              {fig(vic, { left: 220, bottom: 30, width: 120, height: 144, zIndex: 3, animation: T('riseNew', delay, 1.9) })}
              {/* Mười ngôi sao bung ra khi quân mới đáp xuống (chBurst). */}
              <span style={{ position: 'absolute', left: 280, top: 110, width: 0, height: 0, zIndex: 5 }}>
                {Array.from({ length: 10 }, (_, i) => {
                  const a = (i / 10) * Math.PI * 2
                  const c = ['#fff6c8', '#ffd76a', col][i % 3]
                  return <span key={i} style={{ position: 'absolute', left: 0, top: 0, width: 14, height: 14, background: c, clipPath: 'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)', '--dx': Math.cos(a) * 130 + 'px', '--dy': Math.sin(a) * 130 + 'px', opacity: 0, animation: `chBurst .9s cubic-bezier(.2,.7,.3,1) ${delay + 0.95}s forwards` }} />
                })}
              </span>
              {badge && <span style={{ position: 'absolute', left: 316, bottom: 140, zIndex: 4, padding: '4px 10px', borderRadius: 99, background: '#ffd43b', color: '#3a2600', font: '800 15px/1.2 var(--font-display)', boxShadow: '0 0 16px #ffd43b', animation: T('riseNew', delay, 1.9) }}>{badge}</span>}
            </>
          )}
          {kind === 'hole' && (
            <>
              <span style={{ position: 'absolute', left: 280, top: 118, width: 150, height: 150, borderRadius: '50%', boxShadow: '0 0 40px rgba(150,110,255,.6)', opacity: 0, animation: T('csCore', delay),
                background: core || 'radial-gradient(circle,#000 0 34%,#3a1d7a 46%,rgba(150,110,255,.6) 56%,transparent 70%)' }} />
              <span style={{ position: 'absolute', left: 280, top: 118, width: 0, height: 0, opacity: 0, animation: T('csSwirl', delay) }}>
                {Array.from({ length: Math.min(12, n) }, (_, i) => {
                  const a = (i / Math.min(12, n)) * Math.PI * 2
                  const r = 70 + (i % 3) * 22
                  return <span key={i} style={{ position: 'absolute', left: Math.cos(a) * r, top: Math.sin(a) * r * 0.55, width: 30, height: 30, margin: '-15px 0 0 -15px', borderRadius: '50%', boxShadow: '0 0 12px rgba(255,255,255,.6)', background: dot || 'radial-gradient(circle at 35% 30%,#fffbe6,#ffd76a 60%,#c99a2e)' }} />
                })}
              </span>
            </>
          )}
        </div>
        <div style={{ position: 'absolute', left: '50%', top: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, whiteSpace: 'nowrap', zIndex: 6, opacity: 0, animation: T('csTitle', delay) }}>
          <span style={{ font: 'italic 800 30px/1.1 var(--font-display)', letterSpacing: '.02em', color: '#fff', textShadow: `0 0 18px ${col}, 0 3px 0 rgba(0,0,0,.5)` }}>{title}</span>
          {sub && <span style={{ font: '600 13px/1.3 var(--font-sans)', color: col }}>{sub}</span>}
        </div>
      </div>
    </div>
  )
}

// Lồng chiếu bí: [thanh lồng, quầng, màu vòng] theo chất liệu (ánh sáng / đá / gỗ / dây leo / dây thừng / vàng / ngọc / lụa).
const CAGE = {
  light: ['#f3e8ff', '0 0 18px #b197fc', '#b197fc'], stone: ['#a3acb6', '0 4px 0 #5b6470', '#d9c49a'], wood: ['#b07434', '0 3px 0 #6b4a24', '#e0a060'],
  vine: ['#5fae4a', '0 0 10px #9be15d', '#9be15d'], rope: ['#e2c07e', '0 0 0 transparent', '#ffd43b'], gold: ['#f0b75c', '0 0 16px #ffcf3a', '#ffcf3a'],
  jade: ['#7fd6b4', '0 0 16px #7fd6b4', '#7fd6b4'], silk: ['#ff8a9a', '0 0 14px #ff8a9a', '#ffb3c7'],
}
const CROWN = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 30"><path d="M3 26 L5 8 L13 16 L20 3 L27 16 L35 8 L37 26 Z" fill="#ffd43b" stroke="#8a5a00" stroke-width="2" stroke-linejoin="round"/><circle cx="20" cy="17" r="3" fill="#e5484d"/><circle cx="11" cy="21" r="2" fill="#4dabf7"/><circle cx="29" cy="21" r="2" fill="#9be15d"/></svg>')

/**
 * Lồng úp vua bị chiếu bí ở (`x`, `y`) — chân vua, px thiết kế của mặt bàn. `mat` chất liệu (CAGE) · `title` / `sub` chữ ·
 * `delay` giây chờ (đợi cảnh đấu xong). Lồng, vòng và chữ ở lại (giảm chuyển động vẫn thấy); vương miện văng rồi tắt.
 */
export function MateCage({ x, y, mat, title, sub, delay = 0 }) {
  const [bar, glow, ring] = CAGE[mat] || CAGE.stone
  const bars = mat === 'rope'
    ? `repeating-linear-gradient(45deg,${bar} 0 3px,transparent 3px 12px),repeating-linear-gradient(-45deg,${bar} 0 3px,transparent 3px 12px)`
    : `repeating-linear-gradient(90deg,${bar} 0 5px,transparent 5px 15px)`
  const A = (name, d, ease = 'ease-out') => `${name} ${d}s ${ease} ${delay}s both`
  return (
    <span aria-hidden="true" style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, zIndex: 12, pointerEvents: 'none' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, width: 118, height: 40, borderRadius: '50%', border: '4px dashed ' + ring, boxShadow: `0 0 22px ${ring}, inset 0 0 16px ${ring}`, transform: 'translate(-50%, -50%)', animation: A('mtRing', 2.6) }} />
      <span style={{ position: 'absolute', left: 0, top: -104, width: 84, height: 104, transform: 'translateX(-50%)', animation: A('mtCage', 2.6, 'cubic-bezier(.3,.7,.3,1)') }}>
        <span style={{ position: 'absolute', left: -6, right: -6, top: 0, height: 9, borderRadius: 5, background: bar, boxShadow: glow }} />
        <span style={{ position: 'absolute', left: 0, right: 0, top: 8, bottom: 6, background: bars, filter: `drop-shadow(${glow})` }} />
        <span style={{ position: 'absolute', left: -6, right: -6, bottom: 0, height: 8, borderRadius: 4, background: bar }} />
        <span style={{ position: 'absolute', left: '50%', top: -14, width: 16, height: 16, marginLeft: -8, borderRadius: '50%', border: '4px solid ' + bar }} />
      </span>
      <img src={CROWN} alt="" style={{ position: 'absolute', left: 0, top: -86, width: 40, height: 30, opacity: 0, animation: A('mtCrown', 2.2) }} />
      <span style={{ position: 'absolute', left: 0, top: -178, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, whiteSpace: 'nowrap', transform: 'translateX(-50%)', animation: A('mtTitle', 2.6) }}>
        <span style={{ padding: '6px 16px', borderRadius: 99, background: 'rgba(10,14,30,.92)', border: '2px solid ' + ring, boxShadow: '0 0 24px ' + ring, font: 'italic 800 24px/1.1 var(--font-display)', color: '#fff' }}>{title}</span>
        {sub && <span style={{ padding: '2px 10px', borderRadius: 99, background: 'rgba(10,14,30,.85)', font: '600 12.5px/1.3 var(--font-sans)', color: ring }}>{sub}</span>}
      </span>
    </span>
  )
}
