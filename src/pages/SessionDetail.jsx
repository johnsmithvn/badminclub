// Chi tiết buổi: điểm danh · sân buổi này · khách giao lưu · chốt tiền (handoff 02 §3).
// Nút "Chốt buổi" là hành động primary DUY NHẤT của trang.

import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Card, IconButton, Input, Select, Switch } from '#ds'
import { Empty, LevelChip, Mono, Overline, SessionPill } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, wd } from '#utils/dates.js'
import {
  costRow, costState, courtOf, courtPayMode, courtTxt, dueState, duesOf, fmt, fmtK, genderTxt,
  groupOf, guestOf, guestPaidRev, guestPrice, levelOf, perTube, playedCourts, presentCount,
  quotaFor, rowCost, sGuests, sessionMembers, sessionOf, soldTotal, timeTxt,
} from '#lib/money.js'
import { addCourtForm, guestForm } from '#lib/forms.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

export default function SessionDetail() {
  const { db, a } = useApp()
  const { id } = useParams()
  const sid = id || db.sessionId
  const s = sessionOf(db, sid)

  // URL là nguồn sự thật; đồng bộ vào db để action dùng db.sessionId.
  useEffect(() => { if (sid) a.setSessionId(sid) }, [sid, a])

  if (!s) {
    return (
      <Card padding="0">
        <Empty icon="calendar-days" title={t('session.emptyTitle')} hint={t('session.emptyHint')} />
      </Card>
    )
  }

  const role = db.viewAs || 'owner'
  const canEdit = can(role, 'sessions')
  const canMoney = can(role, 'money')
  const month = s.date.slice(0, 7)
  const group = groupOf(db, s.groupId)
  // Cố định của nhóm + người đi thêm hôm nay. Người đi thêm trả tiền theo ĐƠN GIÁ MỘT BUỔI
  // của nhóm, không phải giá khách — họ là người nhà, xem tab Đối chiếu ở Công nợ.
  const members = sessionMembers(db, s)
  const att = db.attendance[s.id] || {}
  const guests = sGuests(db, s.id)
  const dues = duesOf(db, month)

  const paid = guestPaidRev(db, s.id)
  const sold = soldTotal(s)
  // Giá thành buổi — CÙNG hàm với bảng "Giá thành từng buổi" ở Báo cáo, không viết lại công thức.
  // quỹ bù = chi phí − thu khách; KHÔNG trừ tiền bán sân vì courtNet đã loại sân bán rồi.
  // Buổi đã chốt thì c.* là số ĐÃ ĐÓNG BĂNG hôm chốt, không tính lại theo giá hôm nay.
  const c = costRow(db, s)
  const cState = costState(s)

  return (
    <>
      <div>
        <Button variant="ghost" size="sm" icon="arrow-left" onClick={() => a.go('sessions')}>
          {t('session.backToList')}
        </Button>
      </div>

      <Card padding="14px 18px">
        <div style={S.headRow}>
          <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ font: 'var(--type-h3)', color: 'var(--text-primary)' }}>
                {ddmy(s.date) + ' · ' + wd(s.date)}
              </span>
              <SessionPill status={s.status} size="md" />
            </div>
            <Mono color="var(--text-muted)">
              {group.name + ' · ' + timeTxt(s) + ' · ' + courtTxt(db, s)}
            </Mono>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" icon="send" onClick={() => a.copyZalo(s.id)}>
              {t('session.copyZalo')}
            </Button>
            {canEdit && s.status !== 'cancelled' && (
              <Button variant="ghost" size="sm" icon="circle-x" onClick={() => a.setSessionStatus(s.id, 'cancelled')}>
                {t('session.doCancel')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: 16, alignItems: 'start' }}>
        {/* ---------------- điểm danh ---------------- */}
        <Card
          title={t('session.attendTitle')}
          subtitle={t('session.attendSub')}
          icon="user-round-check"
          padding="14px 16px"
          actions={canEdit && (
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="secondary" size="sm" onClick={() => a.markAll(s.id, true)}>{t('session.allPresent')}</Button>
              <Button variant="ghost" size="sm" onClick={() => a.markAll(s.id, false)}>{t('session.allAbsent')}</Button>
            </div>
          )}
        >
          <div style={{ display: 'grid', gap: 7 }}>
            <Mono color="var(--text-muted)">
              {t('session.attendCount', { present: presentCount(db, s), total: members.length })}
            </Mono>
            {members.length === 0 && <Empty icon="users" title={t('members.emptyGroup')} hint={t('members.emptyGroupHint')} />}
            {members.map((m) => {
              const state = att[m.id]
              const extra = state === 'extra'
              const due = dues.find((d) => d.memberId === m.id && d.groupId === s.groupId)
              return (
                <div key={m.id} style={{
                  ...S.attRow,
                  background: state === true ? 'var(--surface-accent-soft)'
                    : extra ? 'var(--status-scheduled-bg)'
                      : state === false ? 'var(--surface-sunken)' : 'var(--surface-card)',
                  borderColor: state === true ? 'var(--teal-500)'
                    : extra ? 'var(--status-scheduled-fg)' : 'var(--border-subtle)',
                }}>
                  <button type="button" disabled={!canEdit || extra}
                    onClick={() => a.toggleAtt(s.id, m.id)}
                    style={{
                      ...S.attBtn,
                      cursor: canEdit && !extra ? 'pointer' : 'default',
                    }}>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={S.label}>{m.name}</div>
                      <div style={S.caption}>{genderTxt(m.gender) + ' · ' + levelOf(m, month)}</div>
                    </div>
                    <LevelChip level={levelOf(m, month)} levels={db.levels} />
                    <span style={{
                      font: 'var(--type-label)', minWidth: 74, textAlign: 'right',
                      color: state === true ? 'var(--status-transit)'
                        : extra ? 'var(--status-scheduled-fg)'
                          : state === false ? 'var(--text-muted)' : 'var(--text-disabled)',
                    }}>
                      {extra ? t('attend.extra')
                        : state === true ? t('attend.present')
                          : state === false ? t('attend.absent') : t('attend.unmarked')}
                    </span>
                  </button>
                  {extra
                    ? <>
                        <span style={{ ...S.caption, minWidth: 96, textAlign: 'right' }}>{t('session.extraDueTag')}</span>
                        {canEdit && <IconButton icon="user-round-minus" size="sm" variant="ghost"
                          label={t('common.delete')} onClick={() => a.removeExtra(s.id, m.id)} />}
                      </>
                    : <span style={{
                        font: 'var(--type-caption)', minWidth: 96, textAlign: 'right',
                        color: !due ? 'var(--text-disabled)'
                          : dueState(due).state === 'full' ? 'var(--status-delivered)' : 'var(--status-delayed)',
                      }}>
                        {!due ? t('session.noDueTag')
                          : dueState(due).state === 'full' ? t('session.duePaidTag')
                            : dueState(due).state === 'partial'
                              ? t('session.duePartialTag', { amount: fmtK(dueState(due).remain) })
                              : t('session.dueUnpaidTag')}
                      </span>}
                </div>
              )
            })}
            {canEdit && <ExtraPicker s={s} members={members} />}
          </div>
        </Card>

        {/* ---------------- cột phải ---------------- */}
        <div style={{ display: 'grid', gap: 16 }}>
          <Card
            title={t('session.courtsTitle')}
            subtitle={t('session.courtsSub')}
            icon="map-pin"
            padding="14px 16px"
            actions={canEdit && (
              <Button variant="secondary" size="sm" icon="plus"
                onClick={() => a.openDialog('addcourt', addCourtForm(db, s))}>
                {t('session.addCourt')}
              </Button>
            )}
          >
            <div style={{ display: 'grid', gap: 9 }}>
              {(s.courts || []).map((c, i) => (
                <div key={i} style={S.courtRow}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={S.label}>{courtOf(db, c.courtId).name}</span>
                      {c.extra && <span style={S.tagAmber}>{t('session.extraBadge')}</span>}
                      {c.sold && <span style={S.tagGreen}>{t('session.soldBadge')}</span>}
                    </div>
                    <Mono color="var(--text-muted)">{c.from + ' → ' + c.to}</Mono>
                  </div>
                  <Mono weight={600} color={c.sold ? 'var(--text-muted)' : 'var(--text-primary)'}
                    style={c.sold ? { textDecoration: 'line-through' } : undefined}>
                    {fmt(rowCost(db, c))}
                  </Mono>
                  {canEdit && (
                    <>
                      <Button variant={c.sold ? 'ghost' : 'secondary'} size="sm"
                        onClick={() => a.toggleCourtSold(s.id, i)}>
                        {c.sold ? t('session.unsell') : t('session.sell')}
                      </Button>
                      {c.extra && (
                        <IconButton icon="trash-2" size="sm" variant="ghost"
                          label={t('common.delete')} onClick={() => a.removeSessionCourt(s.id, i)} />
                      )}
                    </>
                  )}
                  {c.sold && (
                    <div style={S.soldBox}>
                      <Input label={t('session.soldAmount')} mono suffix={t('units.dong')}
                        value={String(c.soldAmount || 0)} disabled={!canEdit}
                        onChange={(e) => a.setSold(s.id, i, 'soldAmount', e.target.value)}
                        style={{ width: 140 }} />
                      <Input label={t('session.soldTo')} value={c.soldTo || ''} disabled={!canEdit}
                        onChange={(e) => a.setSold(s.id, i, 'soldTo', e.target.value)}
                        style={{ width: 170 }} />
                    </div>
                  )}
                </div>
              ))}
              <div style={S.caption}>{t('session.courtRule')}</div>
            </div>
          </Card>

          <Card title={t('session.guestsTitle')} subtitle={t('session.guestsSub')} icon="user-round-plus" padding="14px 16px">
            {canEdit && <GuestForm />}
            <div style={{ display: 'grid', gap: 8, marginTop: guests.length ? 12 : 0 }}>
              {guests.length === 0
                ? <Empty icon="user-round-plus" title={t('session.guestEmpty')} hint={t('session.guestEmptyHint')} />
                : guests.map((g) => (
                    <div key={g.id} style={S.guestRow}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.label}>{guestOf(db, g.guestId).name}</div>
                        <div style={S.caption}>{genderTxt(g.gender) + ' · ' + g.level}</div>
                      </div>
                      <Select size="sm" style={{ width: 136 }}
                        options={[{ value: '', label: t('session.guestByShort') }].concat(
                          db.members.map((m) => ({ value: m.id, label: m.name }))
                        )}
                        value={g.invitedBy || ''}
                        onChange={(e) => a.setGuestInviter(g.id, e.target.value)} />
                      <Mono weight={600} color="var(--text-primary)">{fmt(g.price)}</Mono>
                      <Switch label={g.paid ? t('session.guestPaid') : t('session.guestDebt')}
                        checked={g.paid} onChange={() => a.toggleGuestPaid(g.id)} />
                      {canEdit && (
                        <IconButton icon="trash-2" size="sm" variant="ghost"
                          label={t('common.delete')} onClick={() => a.removeGuest(g.id)} />
                      )}
                    </div>
                  ))}
            </div>
          </Card>

          <Card title={t('session.costTitle')} subtitle={t('session.costSub')} icon="calculator" padding="14px 16px"
            actions={<span style={S.costTag[cState]}>{t('session.costState.' + cState)}</span>}>
            <div style={{ display: 'grid', gap: 12 }}>
              <ShuttleBox s={s} canEdit={canEdit} />

              <div style={S.sumBox}>
                <SumRow label={t('session.sumCourt')} value={fmt(c.court)}
                  hint={courtPayMode(db) === 'month' ? t('session.sumCourtHint') : undefined} />
                <SumRow label={t('session.sumShuttle')} value={fmt(c.shuttle)}
                  hint={t('session.sumShuttleHint', { n: s.shuttleUsed || 0, unit: fmtK(c.unit) })} />
                {sold > 0 && <SumRow label={t('session.sumSold')} value={fmt(sold)}
                  hint={t('session.sumSoldHint')} color="var(--status-delivered)" />}
                <SumRow label={t('session.sumGuest')} value={fmt(c.rev)} />
                <SumRow label={t('session.sumGuestPaid')} value={fmt(paid)} color="var(--status-delivered)" />
                <SumRow label={t('session.sumGuestDebt')} value={fmt(c.rev - paid)} color="var(--status-delayed)" />
                <div style={S.sumDivider} />
                <SumRow label={t('session.sumCost')} value={fmt(c.cost)} strong />
                <SumRow label={t('session.sumPerHead')} value={fmt(c.per)}
                  hint={t('session.sumPerHeadHint', { n: c.people })} />
                <SumRow label={t('session.sumSubsidy')} value={fmt(c.subsidy)} strong
                  color={c.subsidy > 0 ? 'var(--status-incident)' : 'var(--status-delivered)'} />
              </div>

              <div style={S.caption}>{t('session.costNote')}</div>

              {canEdit && (
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  {s.status === 'draft' && (
                    <Button variant="primary" icon="user-round-check" onClick={() => a.setSessionStatus(s.id, 'open')}>
                      {t('session.doOpen')}
                    </Button>
                  )}
                  {s.status === 'open' && (
                    <Button variant="primary" icon="circle-check" disabled={!canMoney}
                      onClick={() => a.setSessionStatus(s.id, 'closed')}>
                      {t('session.doClose')}
                    </Button>
                  )}
                  {(s.status === 'closed' || s.status === 'cancelled') && (
                    <Button variant="secondary" icon="rotate-ccw" onClick={() => a.setSessionStatus(s.id, 'open')}>
                      {t('session.doReopen')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

/* ---------------- thêm người đi thêm ---------------- */

/**
 * Thành viên CLB nhưng không cố định nhóm này, hôm nay có đánh. Trước đây cách duy nhất để thu
 * là nhét họ vào danh sách khách với giá khách — sai người, thu vượt, và phồng báo cáo khách.
 * Giờ họ trả theo ĐƠN GIÁ MỘT BUỔI của nhóm, hiện ở tab Đối chiếu bên Công nợ.
 */
function ExtraPicker({ s, members }) {
  const { db, ui, a } = useApp()
  const inSession = new Set(members.map((m) => m.id))
  const rest = db.members.filter((m) => m.active !== false && !inSession.has(m.id))
  if (!rest.length) return null

  return (
    <div style={S.extraBox}>
      <Select size="sm" style={{ flex: 1, minWidth: 160 }}
        value={ui.form.exMember || ''}
        options={[{ value: '', label: t('session.extraPick') }]
          .concat(rest.map((m) => ({ value: m.id, label: m.name + ' · ' + levelOf(m, s.date.slice(0, 7)) })))}
        onChange={(e) => a.setF('exMember', e.target.value)} />
      <Button variant="secondary" size="sm" icon="user-round-plus"
        onClick={() => { a.addExtra(s.id, ui.form.exMember); a.setF('exMember', '') }}>
        {t('session.extraAdd')}
      </Button>
    </div>
  )
}

/* ---------------- form thêm khách ---------------- */

function GuestForm() {
  const { db, ui, a } = useApp()
  // GỘP mặc định với form đang gõ, KHÔNG chọn một trong hai. Guard cũ
  // (`ui.form.gLevel ? ui.form : guestForm(db)`) lấy chính field phải khởi tạo làm cờ "đã khởi
  // tạo": CLB chưa có thang trình độ thì `gLevel` rỗng vĩnh viễn nên nhánh luôn rơi về form
  // mặc định — mọi ký tự gõ vào ô Tên bị vứt ngay lúc đọc lại, và giá luôn 0.
  const f = { ...guestForm(db), ...(ui.form || {}) }
  const set = (k, v) => a.setF(k, v)
  const price = guestPrice(db, f.gLevel, f.gGender)
  // Hai lỗi cấu hình khác nhau, đừng gộp: không có thang trình độ thì KHÔNG tính được giá
  // (chặn); có thang mà giá 0 thì tính được, chỉ là chưa ai đặt giá (cảnh báo, vẫn cho thêm
  // vì có CLB cho khách quen đánh miễn phí).
  const noLevel = !f.gLevel
  const toSettings = () => { a.go('settings'); a.setTab('settings', 'money') }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={S.guestForm}>
        <Input label={t('session.guestName')} value={f.gName || ''} onChange={(e) => set('gName', e.target.value)} />
        <Select label={t('session.guestGender')} value={f.gGender}
          options={cfg.genders.map((g) => ({ value: g, label: genderTxt(g) }))}
          onChange={(e) => set('gGender', e.target.value)} />
        <Select label={t('session.guestLevel')} value={f.gLevel}
          options={db.levels.map((l) => ({ value: l, label: l }))}
          onChange={(e) => set('gLevel', e.target.value)} />
        <Select label={t('session.guestBy')} value={f.gBy || ''}
          options={[{ value: '', label: t('common.unknown') }].concat(db.members.map((m) => ({ value: m.id, label: m.name })))}
          onChange={(e) => set('gBy', e.target.value)} />
        <Button variant="accent" icon="plus" disabled={noLevel} onClick={() => a.addGuest()}>
          {t('common.add') + (noLevel ? '' : ' · ' + fmt(price))}
        </Button>
      </div>
      {(noLevel || price === 0) && (
        <button type="button" onClick={toSettings} style={S.guestWarn}>
          {t(noLevel ? 'session.guestNoLevel' : 'session.guestNoPrice')}
        </button>
      )}
    </div>
  )
}

/* ---------------- ba cách vào số cầu ---------------- */

function ShuttleBox({ s, canEdit }) {
  const { db, a } = useApp()
  const mode = s.shuttleMode || 'quota'
  const per = perTube(db, s)
  const group = groupOf(db, s.groupId)

  const note = mode === 'quota'
    ? t('session.quotaNote', { group: group.name, quota: quotaFor(db, s), courts: playedCourts(s) })
    : mode === 'tubes'
      ? t('session.tubesNote', { tubes: s.tubesOpened || 0, per, loose: s.loose || 0, total: s.shuttleUsed || 0 })
      : t('session.exactNote')

  return (
    <div style={{ display: 'grid', gap: 9 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {cfg.shuttleModes.map((m) => (
          <Button key={m} size="sm" variant={mode === m ? 'primary' : 'secondary'} disabled={!canEdit}
            onClick={() => a.setShuttleMode(s.id, m)}>
            {t('session.shuttleMode' + m[0].toUpperCase() + m.slice(1))}
          </Button>
        ))}
      </div>

      {mode === 'tubes' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Stepper label={t('session.tubesLabel')} value={s.tubesOpened || 0} disabled={!canEdit}
            onMinus={() => a.bumpTubes(s.id, -1)} onPlus={() => a.bumpTubes(s.id, 1)} />
          <Stepper label={t('session.looseLabel')} value={s.loose || 0} disabled={!canEdit}
            onMinus={() => a.bumpLoose(s.id, -1)} onPlus={() => a.bumpLoose(s.id, 1)} />
        </div>
      )}

      {mode === 'exact' && (
        <Input label={t('session.exactLabel')} mono suffix={t('units.shuttle')} disabled={!canEdit}
          value={String(s.shuttleUsed || 0)} onChange={(e) => a.setShuttle(s.id, e.target.value)}
          style={{ width: 180 }} />
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <Mono weight={600} size={14} color="var(--text-primary)">
          {(s.shuttleUsed || 0) + ' ' + t('units.shuttle')}
        </Mono>
        {s.shuttleEst && <span style={S.tagAmber}>{t('session.estTag')}</span>}
        <span style={S.caption}>{note}</span>
      </div>
    </div>
  )
}

function Stepper({ label, value, onMinus, onPlus, disabled }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <Overline>{label}</Overline>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconButton icon="minus" size="sm" variant="secondary" label="-" disabled={disabled} onClick={onMinus} />
        <Mono weight={600} size={14} color="var(--text-primary)" style={{ minWidth: 28, textAlign: 'center' }}>
          {value}
        </Mono>
        <IconButton icon="plus" size="sm" variant="secondary" label="+" disabled={disabled} onClick={onPlus} />
      </div>
    </div>
  )
}

const SumRow = ({ label, value, color, strong, hint }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
    <span style={{ font: strong ? 'var(--type-label)' : 'var(--type-caption)', color: 'var(--text-secondary)' }}>
      {label}
      {hint && <span style={{ ...S.caption, marginLeft: 6 }}>{hint}</span>}
    </span>
    <Mono weight={strong ? 600 : 400} size={strong ? 14 : 13} color={color || 'var(--text-primary)'}>
      {value}
    </Mono>
  </div>
)

const S = {
  headRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  attRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', width: '100%',
    border: '1px solid', borderRadius: 8, font: 'inherit',
  },
  attBtn: {
    display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
    background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit',
  },
  extraBox: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 3,
    padding: '9px 11px', borderRadius: 8, border: '1px dashed var(--border-subtle)',
  },
  courtRow: {
    display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', padding: '9px 11px',
    border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--surface-card)',
  },
  soldBox: { display: 'flex', gap: 9, flexBasis: '100%', flexWrap: 'wrap' },
  guestForm: { display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.2fr auto', gap: 9, alignItems: 'flex-end' },
  // Bấm được: lỗi cấu hình thì phải chỉ thẳng sang chỗ sửa, không bắt người ta đi mò.
  guestWarn: {
    textAlign: 'left', border: 0, padding: 0, cursor: 'pointer', background: 'transparent',
    font: 'var(--type-caption)', color: 'var(--status-delayed-fg)', textDecoration: 'underline',
  },
  guestRow: {
    display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', padding: '8px 11px',
    border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--surface-card)',
  },
  sumBox: { display: 'grid', gap: 7, padding: '12px 14px', borderRadius: 8, background: 'var(--surface-inset)' },
  sumDivider: { height: 1, background: 'var(--border-subtle)', margin: '3px 0' },
  tagAmber: {
    font: '600 10px/1 var(--font-sans)', padding: '4px 8px', borderRadius: 99,
    background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)', whiteSpace: 'nowrap',
  },
  tagGreen: {
    font: '600 10px/1 var(--font-sans)', padding: '4px 8px', borderRadius: 99,
    background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)', whiteSpace: 'nowrap',
  },
}

// Ba trạng thái của con số giá thành — xem money.js: costState và DATABASE.md §8.
S.costTag = {
  live: { ...S.tagAmber, background: 'var(--status-scheduled-bg)', color: 'var(--status-scheduled-fg)' },
  temp: S.tagAmber,
  final: S.tagGreen,
}
