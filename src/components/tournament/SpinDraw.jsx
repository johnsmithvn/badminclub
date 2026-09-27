import { useEffect, useRef, useState } from 'react'
import { Button, Dialog } from '#ds'
import { Mono } from '#ui'
import { t } from '#i18n'

const EASE = 'cubic-bezier(.2,.8,.2,1)' // DESIGN.md §6

/**
 * Quay bốc thăm từng lượt (bốc số nhánh, chia bảng, ghép cặp ngẫu nhiên): mỗi lần bấm "Quay" tên chạy vòng rồi
 * chậm dần, dừng ở một người/đội NGẪU NHIÊN còn lại → điền vào ô kế tiếp. "Quay hết" chạy nhanh các ô còn lại.
 * Chưa ghi gì cho tới khi bấm "Lưu kết quả" — huỷ giữa chừng là không đổi dữ liệu.
 *
 * @param {object} p
 * @param {Array<{ id: string, label: string, sub?: string, pool?: string }>} p.items  người/đội đem bốc
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
  const alive = useRef(true)
  const timers = useRef([])
  useEffect(() => () => { alive.current = false; timers.current.forEach(clearTimeout) }, [])

  const byId = new Map(items.map((x) => [x.id, x]))
  const next = filled.indexOf(null)
  const done = next < 0
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const wait = (ms) => new Promise((r) => { timers.current.push(setTimeout(r, ms)) })

  // Một lượt quay cho ô `i`: chạy qua các ứng viên, chậm dần, dừng ở người đã chọn sẵn (ngẫu nhiên đều).
  const spinOne = async (i, taken, fast) => {
    const pool = items.filter((x) => !taken.has(x.id) && (!slots[i].pool || x.pool === slots[i].pool))
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
      if (id) fill(next, id)
      setSpinning(false)
    }
  }
  const spinAll = async () => {
    if (spinning || done) return
    setSpinning(true)
    const taken = new Set(filled.filter(Boolean))
    for (let i = next; i < slots.length && alive.current; i++) {
      if (filled[i]) continue
      const id = await spinOne(i, taken, true)
      if (!id || !alive.current) break
      taken.add(id)
      fill(i, id)
      await wait(reduced ? 0 : 120)
    }
    if (alive.current) setSpinning(false)
  }
  const reset = () => {
    setFilled(slots.map(() => null))
    setReel(null)
    setLast(-1)
  }
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
            {done ? t('tournament.spin.allDone') : t('tournament.spin.now', { slot: slots[next].label })}
          </Mono>
          <span key={reel || 'empty'} style={{
            font: '700 22px/1.25 var(--font-display)', color: shown ? 'var(--text-primary)' : 'var(--text-disabled)', minHeight: 28,
            animation: spinning && !reduced ? `spin-tick .12s ${EASE}` : undefined,
          }}>
            {shown ? shown.label : t('tournament.spin.ready')}
          </span>
          {shown?.sub && <Mono size={11} color="var(--text-muted)">{shown.sub}</Mono>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 6 }}>
            <Button icon="sparkles" disabled={done || spinning} onClick={spin}>{t('tournament.spin.spin')}</Button>
            <Button variant="secondary" icon="shuffle" disabled={done || spinning} onClick={spinAll}>{t('tournament.spin.spinAll')}</Button>
            <Button variant="ghost" icon="rotate-ccw" disabled={spinning || filled.every((x) => !x)} onClick={reset}>{t('tournament.spin.reset')}</Button>
          </div>
        </div>

        {/* Các ô — điền dần */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: 6, maxHeight: '38vh', overflowY: 'auto', paddingRight: 2 }}>
          {slots.map((s, i) => {
            const it = filled[i] && byId.get(filled[i])
            const cur = i === next && !done
            return (
              <div key={i} style={{
                gridColumn: s.wide ? '1 / -1' : undefined, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '7px 10px', borderRadius: 8,
                background: i === last ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
                border: `1px ${it ? 'solid' : 'dashed'} ${cur || i === last ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
                transition: `background .4s ${EASE}, border-color .3s`,
                animation: i === last && !reduced ? `spin-land .45s ${EASE}` : undefined,
              }}>
                <Mono size={10.5} weight={700} color="var(--text-muted)" style={{ flex: '0 0 auto', minWidth: 46 }}>{s.label}</Mono>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  font: `${it ? 600 : 400} 12.5px/1.3 var(--font-sans)`, color: it ? 'var(--text-primary)' : 'var(--text-disabled)' }}>
                  {it ? it.label : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <style>{'@keyframes spin-tick{from{opacity:.35;transform:translateY(-6px)}to{opacity:1;transform:none}}@keyframes spin-land{0%{transform:scale(.96)}60%{transform:scale(1.03)}100%{transform:none}}'}</style>
    </Dialog>
  )
}
