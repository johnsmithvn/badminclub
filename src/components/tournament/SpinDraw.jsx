import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Icon } from '#ds'
import { Mono } from '#ui'
import { t } from '#i18n'

const EASE = 'cubic-bezier(.2,.8,.2,1)' // DESIGN.md §6

/**
 * Quay bốc thăm từng lượt (bốc số nhánh, chia bảng, ghép cặp ngẫu nhiên): mỗi lần bấm "Quay" tên chạy vòng rồi
 * chậm dần, dừng ở một người/đội NGẪU NHIÊN còn lại → điền vào ô đang chọn (bấm ô trống để chọn; mặc định ô trống
 * đầu tiên). "Quay hết" chạy nhanh mọi ô trống. X trên ô đã điền = trả người/đội về danh sách, quay lại ô đó.
 * Lọc (chip trên danh sách còn lại) = chỉ quay trong những ai mang nhãn đó (VD "Nữ").
 * Chưa ghi gì cho tới khi bấm "Lưu kết quả" — huỷ giữa chừng là không đổi dữ liệu.
 *
 * @param {object} p
 * @param {Array<{ id: string, label: string, sub?: string, pool?: string, tags?: Record<string, string|null> }>} p.items
 *   người/đội đem bốc; `tags` = nhãn để lọc theo loại (đã dịch), VD { gender: 'Nữ', guest: null }
 * @param {Array<{ label: string, pool?: string, wide?: boolean }>} p.slots  ô theo THỨ TỰ điền; `pool` = chỉ bốc trong
 *   items cùng `pool` (đôi nam nữ: ô "Nam" chỉ bốc nam) — không có thì bốc tất cả; `wide` = ô chiếm cả hàng (miễn đấu)
 * @param {(order: string[]) => Promise<boolean>|boolean} p.onDone  id theo thứ tự ô; true → đóng hộp
 * @param {number} [p.columns]  số cột lưới ô (ô chia nhóm theo cột: bảng A/B…)
 */
export default function SpinDraw({ title, hint, items, slots, onDone, onClose, columns = 2, rand = Math.random }) {
  const [filled, setFilled] = useState(() => slots.map(() => null))
  const [reel, setReel] = useState(null) // id đang chạy trên màn quay
  const [spinning, setSpinning] = useState(false)
  const [last, setLast] = useState(-1) // ô vừa điền — loé sáng
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState(null) // ô người dùng bấm chọn để quay (null = ô trống đầu tiên)
  const [filter, setFilter] = useState(() => new Set()) // nhãn đang lọc (rỗng = tất cả)
  const alive = useRef(true)
  const timers = useRef([])
  useEffect(() => () => { alive.current = false; timers.current.forEach(clearTimeout) }, [])

  const byId = new Map(items.map((x) => [x.id, x]))
  const next = picked != null && !filled[picked] ? picked : filled.indexOf(null)
  const done = filled.every(Boolean)
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const wait = (ms) => new Promise((r) => { timers.current.push(setTimeout(r, ms)) })
  // Chip lọc theo từng loại nhãn — chỉ loại nào CHIA ĐƯỢC danh sách (không phải ai cũng cùng một giá trị).
  // Cùng loại: HOẶC (Nhóm 1 hoặc Nhóm 2); khác loại: VÀ (Nhóm 1 và Nữ – Nữ).
  const cats = [...new Set(items.flatMap((x) => Object.keys(x.tags || {})))].map((cat) => {
    const vals = items.map((x) => x.tags?.[cat] ?? null)
    const uniq = [...new Set(vals.filter(Boolean))]
    return { cat, vals: uniq, useful: uniq.length > 1 || (uniq.length === 1 && vals.includes(null)) }
  }).filter((c) => c.useful)
  const chipKey = (cat, v) => cat + '\u0000' + v
  const inFilter = (x) => cats.every(({ cat, vals }) => {
    const on = vals.filter((v) => filter.has(chipKey(cat, v)))
    return !on.length || on.includes(x.tags?.[cat])
  })
  const left = items.filter((x) => !filled.includes(x.id))
  const toggleTag = (g) => setFilter((f) => { const n = new Set(f); if (n.has(g)) n.delete(g); else n.add(g); return n })

  // Một lượt quay cho ô `i`: chạy qua các ứng viên, chậm dần, dừng ở người đã chọn sẵn (ngẫu nhiên đều).
  const spinOne = async (i, taken, fast) => {
    const pool = items.filter((x) => !taken.has(x.id) && (!slots[i].pool || x.pool === slots[i].pool) && inFilter(x))
    if (!pool.length) return null
    const pick = pool[Math.floor(rand() * pool.length)]
    const ticks = reduced ? 0 : fast ? 7 : 16
    for (let k = 0; k < ticks && alive.current; k++) {
      setReel(pool[Math.floor(rand() * pool.length)].id)
      await wait((fast ? 30 : 45) + k * k * (fast ? 1.5 : 1.2))
    }
    if (!alive.current) return null
    setReel(pick.id)
    return pick.id
  }
  const fill = (i, id) => {
    setFilled((f) => f.map((x, k) => (k === i ? id : x)))
    setLast(i)
  }
  const spin = async () => {
    if (spinning || done) return
    setSpinning(true)
    const id = await spinOne(next, new Set(filled.filter(Boolean)), false)
    if (alive.current) {
      if (id) { fill(next, id); setPicked(null) }
      setSpinning(false)
    }
  }
  // Mọi ô trống, từ trái sang; ô nào hết người hợp lệ (lọc / Nam–Nữ) thì bỏ qua, không dừng cả lượt.
  const spinAll = async () => {
    if (spinning || done) return
    setSpinning(true)
    const taken = new Set(filled.filter(Boolean))
    for (let i = 0; i < slots.length && alive.current; i++) {
      if (filled[i]) continue
      const id = await spinOne(i, taken, true)
      if (!alive.current) break
      if (!id) continue
      taken.add(id)
      fill(i, id)
      await wait(reduced ? 0 : 120)
    }
    if (alive.current) { setSpinning(false); setPicked(null) }
  }
  // X: trả về danh sách, chọn luôn ô đó để quay lại.
  const clear = (i) => {
    setFilled((f) => f.map((x, k) => (k === i ? null : x)))
    setPicked(i)
    setLast(-1)
  }
  const reset = () => {
    setFilled(slots.map(() => null))
    setReel(null)
    setLast(-1)
    setPicked(null)
  }
  // Ô đang chọn còn ai quay được không (theo lọc + Nam/Nữ của ô) — hết thì nói rõ thay vì bấm Quay không có gì.
  const canSpin = !done && items.some((x) => !filled.includes(x.id) && (!slots[next]?.pool || x.pool === slots[next].pool) && inFilter(x))
  const save = async () => {
    setBusy(true)
    const ok = await onDone(filled)
    if (!alive.current) return
    setBusy(false)
    if (ok !== false) onClose()
  }

  const shown = reel ? byId.get(reel) : null
  return (
    <Dialog open width={640} title={title} description={hint} onClose={spinning || busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" disabled={spinning || busy} onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={!done || spinning} loading={busy} onClick={save}>{t('tournament.spin.save')}</Button>
        </>
      )}>
      <div style={{ display: 'grid', gap: 14 }}>
        {/* Màn quay */}
        <div style={{
          display: 'grid', gap: 6, justifyItems: 'center', padding: '18px 16px', borderRadius: 12, textAlign: 'center',
          background: 'var(--surface-inset)', border: `1px solid ${spinning ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
          boxShadow: spinning ? '0 0 0 3px color-mix(in srgb, var(--teal-500) 22%, transparent)' : 'none', transition: `box-shadow .25s ${EASE}, border-color .25s`,
        }}>
          <Mono size={11} weight={700} color="var(--text-muted)" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {done ? t('tournament.spin.allDone') : canSpin ? t('tournament.spin.now', { slot: slots[next].label }) : t('tournament.spin.noneLeft', { slot: slots[next].label })}
          </Mono>
          <span key={reel || 'empty'} style={{
            font: '700 22px/1.25 var(--font-display)', color: shown ? 'var(--text-primary)' : 'var(--text-disabled)', minHeight: 28,
            animation: spinning && !reduced ? `spin-tick .12s ${EASE}` : undefined,
          }}>
            {shown ? shown.label : t('tournament.spin.ready')}
          </span>
          {shown?.sub && <Mono size={11} color="var(--text-muted)">{shown.sub}</Mono>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 6 }}>
            <Button icon="sparkles" disabled={!canSpin || spinning} onClick={spin}>{t('tournament.spin.spin')}</Button>
            <Button variant="secondary" icon="shuffle" disabled={done || spinning} onClick={spinAll}>{t('tournament.spin.spinAll')}</Button>
            <Button variant="ghost" icon="rotate-ccw" disabled={spinning || filled.every((x) => !x)} onClick={reset}>{t('tournament.spin.reset')}</Button>
          </div>
        </div>

        {/* Danh sách còn lại + lọc theo nhãn */}
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Mono size={10.5} weight={700} color="var(--text-muted)" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('tournament.spin.left', { n: left.filter(inFilter).length, total: left.length })}
            </Mono>
            {cats.flatMap(({ cat, vals }) => vals.map((v) => ({ key: chipKey(cat, v), label: v }))).map(({ key: g, label }) => {
              const on = filter.has(g)
              return (
                <button key={g} type="button" aria-pressed={on} disabled={spinning} onClick={() => toggleTag(g)} style={{
                  padding: '3px 9px', borderRadius: 99, cursor: 'pointer', font: '600 11px/1.2 var(--font-sans)',
                  color: on ? 'var(--status-transit-fg)' : 'var(--text-secondary)', background: on ? 'var(--surface-accent-soft)' : 'transparent',
                  border: `1px solid ${on ? 'var(--teal-500)' : 'var(--border-default)'}`,
                }}>{label}</button>
              )
            })}
            {filter.size > 0 && <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.spin.filterHint')}</span>}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 66, overflowY: 'auto' }}>
            {left.map((x) => (
              <span key={x.id} style={{
                padding: '2px 7px', borderRadius: 6, font: '500 11px/1.4 var(--font-sans)', whiteSpace: 'nowrap',
                color: inFilter(x) ? 'var(--text-primary)' : 'var(--text-disabled)', background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
              }}>{x.label}</span>
            ))}
          </div>
        </div>

        {/* Các ô — bấm ô trống để chọn ô sẽ quay; X để trả về danh sách */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: 6, maxHeight: '38vh', overflowY: 'auto', paddingRight: 2 }}>
          {slots.map((s, i) => {
            const it = filled[i] && byId.get(filled[i])
            const cur = i === next && !done
            return (
              <div key={i} role={it ? undefined : 'button'} tabIndex={it || spinning ? undefined : 0} aria-pressed={it ? undefined : cur}
                onClick={it || spinning ? undefined : () => setPicked(i)}
                onKeyDown={it || spinning ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked(i) } }}
                style={{
                  gridColumn: s.wide ? '1 / -1' : undefined, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '7px 10px', borderRadius: 8,
                  cursor: it || spinning ? 'default' : 'pointer',
                  background: cur ? 'color-mix(in srgb, var(--teal-500) 10%, var(--surface-card))' : i === last ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
                  border: `1px ${it ? 'solid' : 'dashed'} ${cur || i === last ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
                  boxShadow: cur ? '0 0 0 2px color-mix(in srgb, var(--teal-500) 25%, transparent)' : 'none',
                  transition: `background .4s ${EASE}, border-color .3s`,
                  animation: i === last && !reduced ? `spin-land .45s ${EASE}` : undefined,
                }}>
                <Mono size={10.5} weight={700} color={cur ? 'var(--status-transit-fg)' : 'var(--text-muted)'} style={{ flex: '0 0 auto', minWidth: 46 }}>{s.label}</Mono>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  font: `${it ? 600 : 400} 12.5px/1.3 var(--font-sans)`, color: it ? 'var(--text-primary)' : 'var(--text-disabled)' }}>
                  {it ? it.label : cur ? t('tournament.spin.here') : '—'}
                </span>
                {it && (
                  <button type="button" disabled={spinning} aria-label={t('tournament.spin.clear')} title={t('tournament.spin.clear')} onClick={() => clear(i)}
                    style={{ flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 20, height: 20, padding: 0, borderRadius: 5, cursor: 'pointer',
                      border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-muted)' }}>
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <style>{'@keyframes spin-tick{from{opacity:.35;transform:translateY(-6px)}to{opacity:1;transform:none}}@keyframes spin-land{0%{transform:scale(.96)}60%{transform:scale(1.03)}100%{transform:none}}'}</style>
    </Dialog>
  )
}
