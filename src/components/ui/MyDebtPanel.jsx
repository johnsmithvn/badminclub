// Nhắc công nợ cho THÀNH VIÊN ở Trang chủ — ba lớp vỏ, một luồng.
//
// Kiểu banner là cài đặt của CLB (`club.debtBanner`, migration 0019), không phải của từng
// người. Cả ba kiểu mở CÙNG một popup chi tiết và cùng đi tiếp qua `PayDebtsDialog`: đổi vỏ
// nhắc thì được, đổi luồng tiền thì không.

import { useState } from 'react'
import { Button, Checkbox, Dialog, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { PayDebtsDialog } from '#components/ui/PayDebtsDialog.jsx'
import { fmt, myDebtSummary } from '#lib/money.js'
import { ddmy } from '#utils/dates.js'
import { t } from '#i18n'

const Mono = ({ children, size, weight, color, style }) => (
  <span style={{
    font: `${weight || 400} ${size || 13}px/1.15 var(--font-mono)`,
    color: color || 'inherit', letterSpacing: '-0.01em', ...style,
  }}>
    {children}
  </span>
)

/* ============================ popup chi tiết ============================ */

/**
 * Danh sách nợ đầy đủ, lọc và tích chọn. Dùng chung cho cả ba kiểu banner — đó là lý do danh
 * sách KHÔNG nằm thẳng trên dashboard: 50 khoản là dashboard dài gấp ba, mà người không nợ thì
 * chẳng cần thấy gì.
 *
 * Khoản ĐANG CHỜ DUYỆT hiện ra nhưng không tích được: đã khai rồi, khai lại là chuyển tiền hai lần.
 */
function MyDebtDialog({ onClose }) {
  const { db } = useApp()
  const sum = myDebtSummary(db)
  const [filter, setFilter] = useState('all')
  // Mở ra là tích sẵn TẤT CẢ khoản khai được: trả hết là việc thường, trả lẻ mới là ngoại lệ.
  // Bắt người ta tự tick 10 ô để làm việc thường nhất là bắt sai chiều.
  const [picked, setPicked] = useState(() => Object.fromEntries(sum.open.map((x) => [x.key, true])))
  const [pay, setPay] = useState(null)

  const list = filter === 'open' ? sum.open : filter === 'waiting' ? sum.waiting : sum.items
  const chosen = sum.open.filter((x) => picked[x.key])
  const chosenTotal = chosen.reduce((n, x) => n + x.amount, 0)
  const allPicked = sum.open.length > 0 && chosen.length === sum.open.length
  const toggleAll = () =>
    setPicked(allPicked ? {} : Object.fromEntries(sum.open.map((x) => [x.key, true])))

  const CHIPS = [
    { key: 'all', label: t('home.debt.fAll', { n: sum.items.length }) },
    { key: 'open', label: t('home.debt.fOpen', { n: sum.open.length }) },
    { key: 'waiting', label: t('home.debt.fWaiting', { n: sum.waiting.length }) },
  ]

  return (
    <>
      <Dialog
        open
        width={560}
        title={t('home.debt.dlgTitle')}
        onClose={onClose}
        footer={
          // Thanh này LUÔN hiện, kể cả khi chưa tích gì: nó cũng là chỗ nói "đã chọn mấy khoản,
          // bao nhiêu tiền". Ẩn đi rồi hiện lại làm popup nhảy cao thấp mỗi lần tick một ô.
          // Không có nút Đóng — header đã có dấu ×, hai đường làm cùng một việc là thừa.
          <div style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            padding: '10px 14px', borderRadius: 10, background: 'var(--navy-800)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)' }}>
                {t('home.debt.picked', { n: chosen.length, m: sum.open.length })}
              </div>
              <Mono size={17} weight={700} color="#fff">{fmt(chosenTotal)}</Mono>
            </div>
            <Button variant="ghost" size="sm" disabled={!chosen.length}
              style={{ color: 'rgba(255,255,255,0.85)' }}
              onClick={() => setPicked({})}>
              {t('home.debt.clear')}
            </Button>
            <Button variant="primary" size="sm" icon="banknote"
              disabled={!chosen.length} onClick={() => setPay(chosen)}>
              {t('home.debt.payPicked')}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Mono size={16} weight={700} color="var(--status-incident)">{fmt(sum.total)}</Mono>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                style={{
                  cursor: 'pointer', padding: '5px 12px', borderRadius: 99,
                  font: '600 12px/1 var(--font-sans)',
                  border: '1px solid ' + (filter === c.key ? 'var(--navy-800)' : 'var(--border-subtle)'),
                  background: filter === c.key ? 'var(--navy-800)' : 'var(--surface-card)',
                  color: filter === c.key ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px',
              background: 'var(--surface-inset)', borderBottom: '1px solid var(--border-subtle)',
              font: 'var(--type-overline)', textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)', color: 'var(--text-muted)',
            }}>
              <Checkbox checked={allPicked} disabled={!sum.open.length} onChange={toggleAll} />
              <span style={{ flex: 1, minWidth: 0 }}>{t('home.debt.colDebt')}</span>
              <span>{t('home.debt.colAmount')}</span>
            </div>

            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {list.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {t('home.debt.empty')}
                </div>
              )}
              {list.map((x, i) => {
                const waiting = Boolean(x.claimedAt)
                return (
                  <div key={x.key} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                    borderTop: i === 0 ? 0 : '1px solid var(--border-subtle)',
                    background: 'var(--surface-card)',
                  }}>
                    {/* Khoản đã khai vẫn hiện ô tick nhưng KHOÁ: khai lại là chuyển tiền hai lần. */}
                    <Checkbox
                      checked={!!picked[x.key]}
                      disabled={waiting}
                      onChange={(e) => setPicked((p) => ({ ...p, [x.key]: e.target.checked }))}
                    />
                    <span style={{
                      width: 7, height: 7, borderRadius: 99, flexShrink: 0,
                      background: waiting ? 'var(--status-scheduled)' : 'var(--status-delayed)',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: 'var(--type-label)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {x.label}
                        {waiting && (
                          <span style={{
                            marginLeft: 6, padding: '1px 6px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                            background: 'var(--status-scheduled-bg)', color: 'var(--status-scheduled-fg)',
                          }}>
                            {t('debts.waitApprove')}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {ddmy(x.date)}{x.sub ? ' · ' + x.sub : ''}
                      </div>
                    </div>
                    <Mono weight={700}>{fmt(x.amount)}</Mono>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Dialog>

      {pay && <PayDebtsDialog items={pay} onClose={() => { setPay(null); setPicked({}); onClose() }} />}
    </>
  )
}

/* ============================ ba kiểu banner ============================ */

/** 2a — một dòng vàng mảnh. Bấm cả dòng để mở popup. */
function SlimBanner({ sum, onOpen }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}
      style={{
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 10, marginBottom: 12,
        background: 'var(--status-delayed-bg)',
        border: '1px solid var(--status-delayed)',
      }}
    >
      <span style={{
        width: 24, height: 24, borderRadius: 99, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--status-delayed)', color: '#fff',
      }}>
        <Icon name="triangle-alert" size={13} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: 'var(--type-label)', fontWeight: 700, color: 'var(--status-delayed-fg)' }}>
          {t('home.debt.slimTitle', { amount: fmt(sum.total), n: sum.items.length })}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--status-delayed-fg)', opacity: 0.85 }}>
          {sum.waiting.length
            ? t('home.debt.slimWaiting', { n: sum.waiting.length })
            : t('home.debt.slimNone', { n: sum.open.length })}
        </div>
      </div>
      <span style={{ font: '600 12px/1 var(--font-sans)', color: 'var(--status-delayed-fg)', whiteSpace: 'nowrap' }}>
        {t('home.debt.slimGo')}
      </span>
    </div>
  )
}

/** 2b — thẻ đỏ, số tiền to, kèm vài khoản gần nhất để khỏi bấm mới biết nợ gì. */
function AlertBanner({ sum, onOpen, onPayAll }) {
  const head = sum.items.slice(0, 2)
  const rest = sum.items.length - head.length
  const chip = {
    padding: '3px 9px', borderRadius: 6, background: 'rgba(0,0,0,0.18)',
    font: '600 11px/1.4 var(--font-mono)', color: '#fff', whiteSpace: 'nowrap',
  }
  const btn = {
    padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
    font: '600 12.5px/1 var(--font-sans)', whiteSpace: 'nowrap',
  }
  return (
    <div style={{
      display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start',
      padding: '14px 16px', borderRadius: 'var(--radius-card)', marginBottom: 12,
      background: 'var(--status-incident)',
    }}>
      <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)' }}>
          {t('home.debt.alertSub', { n: sum.items.length })}
        </div>
        <Mono size={26} weight={700} color="#fff">{fmt(sum.total)}</Mono>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {head.map((x) => (
            <span key={x.key} style={chip}>{x.label} {ddmy(x.date)} · {fmt(x.amount)}</span>
          ))}
          {rest > 0 && <span style={chip}>{t('home.debt.alertMore', { n: rest })}</span>}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <button type="button" onClick={onPayAll}
          style={{ ...btn, background: '#fff', color: 'var(--status-incident)', border: 0 }}>
          {t('home.debt.alertPayAll')}
        </button>
        <button type="button" onClick={onOpen}
          style={{ ...btn, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.6)' }}>
          {t('home.debt.alertDetail')}
        </button>
      </div>
    </div>
  )
}

/** 2c — thanh mảnh sát trên hàng tab. Ẩn được, và tự biến mất khi hết nợ. */
function BarBanner({ sum, onOpen, onHide }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px', borderRadius: 8, marginBottom: 10,
      background: 'var(--navy-800)', color: '#fff',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: 99, flexShrink: 0,
        background: 'var(--status-delayed)',
      }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
        <Mono weight={600} color="#fff">
          {t('home.debt.barText', { amount: fmt(sum.total), n: sum.items.length })}
        </Mono>
        {sum.waiting.length > 0 && (
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>
            {' '}{t('home.debt.barWaiting', { n: sum.waiting.length })}
          </span>
        )}
      </div>
      <button type="button" onClick={onOpen} style={{
        background: 'transparent', border: 0, cursor: 'pointer', padding: 0,
        color: '#fff', font: '700 12.5px/1 var(--font-sans)', textDecoration: 'underline',
      }}>
        {t('home.debt.barGo')}
      </button>
      <button type="button" onClick={onHide} aria-label={t('home.debt.barHide')} style={{
        background: 'transparent', border: 0, cursor: 'pointer', padding: 2,
        color: 'rgba(255,255,255,0.7)', lineHeight: 1,
      }}>
        <Icon name="x" size={13} />
      </button>
    </div>
  )
}

/* ============================ điều phối ============================ */

/**
 * `place` nói chỗ gọi đang ở đâu, để mỗi kiểu chỉ mọc đúng một lần:
 *   'top'      — ngay trên hàng tab của Trang chủ (chỉ kiểu `bar`)
 *   'overview' — trong tab Tổng quan (kiểu `slim` và `alert`)
 *
 * Ẩn hoàn toàn khi tài khoản chưa ghép thành viên, không nợ đồng nào, hoặc CLB tắt nhắc.
 */
export function MyDebtPanel({ place = 'overview' }) {
  const { db } = useApp()
  const [open, setOpen] = useState(null)
  const [hidden, setHidden] = useState(false)

  const style = (db.club && db.club.debtBanner) || 'slim'
  const sum = myDebtSummary(db)
  if (style === 'off' || !sum.items.length) return null
  if (place === 'top' ? style !== 'bar' : style === 'bar') return null
  if (hidden) return null

  return (
    <>
      {style === 'slim' && <SlimBanner sum={sum} onOpen={() => setOpen(true)} />}
      {style === 'alert' && (
        // `Trả tất cả` và `Xem chi tiết` mở cùng một popup: popup vốn đã tích sẵn tất cả.
        <AlertBanner sum={sum} onOpen={() => setOpen(true)} onPayAll={() => setOpen(true)} />
      )}
      {style === 'bar' && (
        <BarBanner sum={sum} onOpen={() => setOpen(true)} onHide={() => setHidden(true)} />
      )}
      {open && <MyDebtDialog onClose={() => setOpen(false)} />}
    </>
  )
}
