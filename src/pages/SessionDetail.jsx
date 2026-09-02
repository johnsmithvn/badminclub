// Chi tiết buổi: điểm danh · sân buổi này · khách giao lưu · chốt tiền (handoff 02 §3).
// Nút "Chốt buổi" là hành động primary DUY NHẤT của trang.

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Button, Card, Icon, IconButton, Input, Select, Switch } from '#ds'
import { EditGuestDialog, Empty, GenderSegment, LevelChip, Mono, Overline, SearchSelect, SessionPill } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy, wd } from '#utils/dates.js'
import {
  closeWarnings, costDrift, costRow, costState, courtOf, courtPayMode, courtTxt, dueState, duesOf,
  fmt, fmtK, genderTxt, groupOf, guestOf, guestPaidRev, guestPrice, guestRev, levelOf, perTube, playedCourts,
  isAdhoc, isMemberCharge, memberOf, presentCount, quotaFor, rowCost, sGuests, sGuestsOnly, sessionMembers,
  sessionOf, soldTotal, timeTxt, normalizeText, guestStats,
} from '#lib/money.js'
import { addCourtForm, guestForm } from '#lib/forms.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

export default function SessionDetail() {
  const { db, a } = useApp()
  const { id } = useParams()
  const [editingGuest, setEditingGuest] = useState(null)
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
  // Khối "Khách giao lưu" chỉ liệt kê khách NGOÀI CLB. Dòng thu của thành viên đi buổi đột xuất
  // nằm trong bảng điểm danh, ngay cạnh tên họ — không tách ra hai chỗ cho cùng một người.
  const guests = sGuestsOnly(db, s.id)
  const adhoc = isAdhoc(s)
  const charges = sGuests(db, s.id).filter(isMemberCharge)
  const dues = duesOf(db, month)

  // Thu khách có HAI con số khác nhau, đừng trộn: `c.rev` là số ĐÓNG BĂNG lúc chốt (thuộc giá
  // thành), còn đã-thu / còn-nợ là công nợ, luôn sống. Lấy `c.rev - paid` thì thêm một khách sau
  // khi chốt là ra "khách còn nợ" ÂM. Lệch giữa hai số đã có `costDrift` lo cảnh báo.
  const revLive = guestRev(db, s.id)
  const paid = guestPaidRev(db, s.id)
  const sold = soldTotal(s)
  // Giá thành buổi — CÙNG hàm với bảng "Giá thành từng buổi" ở Báo cáo, không viết lại công thức.
  // quỹ bù = chi phí − thu khách; KHÔNG trừ tiền bán sân vì courtNet đã loại sân bán rồi.
  // Buổi đã chốt thì c.* là số ĐÃ ĐÓNG BĂNG hôm chốt, không tính lại theo giá hôm nay.
  const c = costRow(db, s)
  const cState = costState(s)
  const warns = closeWarnings(db, s)
  const drift = costDrift(db, s)

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
            <Mono color="var(--text-muted)" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {group.name + ' · ' + timeTxt(s) + ' · ' + courtTxt(db, s)}
            </Mono>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Nút hành động chính theo trạng thái buổi: Mở / Chốt / Mở lại / Chốt lại */}
            {canEdit && (
              <>
                {drift && canMoney && (
                  <Button variant="primary" icon="rotate-ccw"
                    style={{
                      background: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
                      borderColor: '#f59e0b',
                      boxShadow: '0 2px 10px rgba(245, 158, 11, 0.4)',
                      fontWeight: 700,
                    }}
                    onClick={() => a.setSessionStatus(s.id, 'closed')}>
                    {t('session.driftBtn')}
                  </Button>
                )}
                {s.status === 'draft' && (
                  <Button variant="primary" icon="user-round-check"
                    style={{
                      background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
                      borderColor: '#0ea5e9',
                      boxShadow: '0 2px 10px rgba(14, 165, 233, 0.4)',
                      fontWeight: 700,
                    }}
                    onClick={() => a.setSessionStatus(s.id, 'open')}>
                    {t('session.doOpen')}
                  </Button>
                )}
                {s.status === 'open' && (
                  <Button
                    variant="primary"
                    icon="circle-check"
                    disabled={!canMoney}
                    style={{
                      background: !canMoney ? undefined : 'linear-gradient(135deg, #0d5e3a 0%, #00875a 100%)',
                      borderColor: !canMoney ? undefined : '#00875a',
                      boxShadow: !canMoney ? undefined : '0 2px 12px rgba(0, 135, 90, 0.45)',
                      fontWeight: 700,
                      padding: '0 16px',
                    }}
                    onClick={() => a.confirm({
                      title: t('session.closeTitle'),
                      message: t('session.closeMsg'),
                      tone: 'info',
                      confirmText: t('session.closeOk'),
                      onConfirm: () => a.setSessionStatus(s.id, 'closed'),
                    })}>
                    {t('session.doClose')}
                  </Button>
                )}
                {(s.status === 'closed' || s.status === 'cancelled') && (
                  <Button variant="secondary" icon="rotate-ccw" onClick={() => a.confirm({
                    title: t('session.reopenTitle'),
                    message: t('session.reopenMsg'),
                    tone: 'warning',
                    confirmText: t('session.reopenOk'),
                    onConfirm: () => a.setSessionStatus(s.id, 'open'),
                  })}>
                    {t('session.doReopen')}
                  </Button>
                )}
              </>
            )}

            <Button variant="secondary" size="sm" icon="send" onClick={() => a.copyZalo(s.id)}>
              {t('session.copyZalo')}
            </Button>
            {canEdit && s.status !== 'cancelled' && (
              <Button variant="ghost" size="sm" icon="circle-x" onClick={() => a.confirm({
                title: t('session.cancelTitle'),
                message: t('session.cancelMsg'),
                tone: 'warning',
                confirmText: t('session.cancelOk'),
                onConfirm: () => a.setSessionStatus(s.id, 'cancelled'),
              })}>
                {t('session.doCancel')}
              </Button>
            )}
            {/* Xoá HẲN chỉ mở khi chưa ai chạm vào buổi (`money.js: sessionRefs`). Sáu bảng con
                cascade theo `sessions` — xoá buổi đã có dấu vết là mất điểm danh, trận và tiền
                khách đã thu. Có dấu vết thì dùng Huỷ ở nút bên cạnh. */}
            {canEdit && (
              <Button variant="ghost" size="sm" icon="trash-2" onClick={() => a.confirm({
                title: t('session.delTitle'),
                message: t('session.delMsg', { date: ddmy(s.date) }),
                tone: 'danger',
                confirmText: t('session.doDelete'),
                onConfirm: () => a.deleteSession(s.id),
              })}>
                {t('session.doDelete')}
              </Button>
            )}
          </div>
        </div>

        {/* Ghi chú của buổi. Cột `sessions.note` có sẵn dưới DB và map hai chiều từ lâu, chỉ là
            chưa bao giờ có ô nhập. Lưu ngay khi gõ, không có nút Lưu riêng. */}
        <div style={{ marginTop: 12 }}>
          <Input label={t('session.note')} placeholder={t('session.notePh')}
            value={s.note || ''} disabled={!canEdit}
            onChange={(e) => a.setSessionNote(s.id, e.target.value)} />
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
            {adhoc && <Alert tone="info">{t('session.adhocChargeNote')}</Alert>}
            {members.length === 0 && <Empty icon="users" title={t('members.emptyGroup')} hint={t('members.emptyGroupHint')} />}
            {members.map((m) => {
              const state = att[m.id]
              const extra = state === 'extra'
              const due = dues.find((d) => d.memberId === m.id && d.groupId === s.groupId)
              // Buổi đột xuất: dòng thu sinh theo điểm danh (money.js: adhocCharges).
              const charge = adhoc ? charges.find((c) => c.memberId === m.id) : null
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
                  {charge
                    ? <>
                        <Input size="sm" mono style={{ width: 108, textAlign: 'right' }}
                          aria-label={t('session.chargePrice')}
                          suffix={t('units.dong')}
                          value={String(charge.price)}
                          disabled={!canEdit || charge.paid}
                          onChange={(e) => a.setChargePrice(charge.id, e.target.value)} />
                        <Switch label={charge.paid ? t('session.guestPaid') : t('session.guestDebt')}
                          checked={charge.paid} disabled={!canMoney}
                          onChange={() => a.toggleGuestPaid(charge.id)} />
                        {extra && canEdit && (
                          <IconButton
                            icon="trash-2"
                            size="sm"
                            variant="ghost"
                            style={{ color: 'var(--status-incident)' }}
                            label={t('common.delete')}
                            onClick={(e) => {
                              e.stopPropagation()
                              a.confirm({
                                title: t('session.dropExtraTitle'),
                                message: t('session.dropExtraMsg', { name: m.name }),
                                tone: 'danger',
                                confirmText: t('session.dropExtraOk'),
                                onConfirm: () => a.removeExtra(s.id, m.id),
                              })
                            }}
                          />
                        )}
                      </>
                    : adhoc
                    ? <span style={{ ...S.caption, minWidth: 96, textAlign: 'right' }} />
                    : extra
                    ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ ...S.caption, minWidth: 96, textAlign: 'right' }}>{t('session.extraDueTag')}</span>
                        {canEdit && (
                          <IconButton
                            icon="trash-2"
                            size="sm"
                            variant="ghost"
                            style={{ color: 'var(--status-incident)' }}
                            label={t('common.delete')}
                            onClick={(e) => {
                              e.stopPropagation()
                              a.confirm({
                                title: t('session.dropExtraTitle'),
                                message: t('session.dropExtraMsg', { name: m.name }),
                                tone: 'danger',
                                confirmText: t('session.dropExtraOk'),
                                onConfirm: () => a.removeExtra(s.id, m.id),
                              })
                            }}
                          />
                        )}
                      </div>
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
                      {courtOf(db, c.courtId).mapUrl && (
                        <a
                          href={courtOf(db, c.courtId).mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            color: 'var(--teal-600)', fontSize: 12, textDecoration: 'none',
                            padding: '2px 6px', borderRadius: 4, background: 'var(--surface-brand-soft)',
                          }}
                          title={t('session.mapTitle')}
                        >
                          <Icon name="map-pin" size={12} />
                          <span>{t('settings.openMap')}</span>
                        </a>
                      )}
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
                          label={t('common.delete')} onClick={() => a.confirm({
                            title: t('session.delCourtTitle'),
                            message: t('session.delCourtMsg', { from: c.from, to: c.to }),
                            tone: 'danger',
                            confirmText: t('session.delCourtOk'),
                            onConfirm: () => a.removeSessionCourt(s.id, i),
                          })} />
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
            {canEdit && <GuestForm s={s} />}
            <div style={{ display: 'grid', gap: 8, marginTop: guests.length ? 12 : 0 }}>
              {guests.length === 0
                ? <Empty icon="user-round-plus" title={t('session.guestEmpty')} hint={t('session.guestEmptyHint')} />
                : guests.map((g) => (
                    <div key={g.id} style={S.guestRow}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.label}>{guestOf(db, g.guestId).name}</div>
                        <div style={S.caption}>{genderTxt(g.gender) + ' · ' + g.level}</div>
                      </div>
                      <SearchSelect
                        size="sm"
                        style={{ width: 140 }}
                        menuWidth={240}
                        placeholder={t('session.guestByShort')}
                        searchPlaceholder={t('session.searchMember')}
                        options={db.members.filter((m) => m.active !== false).map((m) => ({
                          value: m.id,
                          label: m.name,
                          level: levelOf(m, s.date.slice(0, 7)),
                          sub: m.phone || undefined,
                        }))}
                        levels={db.levels}
                        clearable
                        value={g.invitedBy || ''}
                        onChange={(val) => a.setGuestInviter(g.id, val)}
                      />
                      <Mono weight={600} color="var(--text-primary)">{fmt(g.price)}</Mono>
                      <Switch label={g.paid ? t('session.guestPaid') : t('session.guestDebt')}
                        checked={g.paid} onChange={() => a.toggleGuestPaid(g.id)} />
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 2 }}>
                          <IconButton
                            icon="pencil"
                            size="sm"
                            variant="ghost"
                            label={t('common.edit')}
                            onClick={() => setEditingGuest(guestOf(db, g.guestId))}
                          />
                          <IconButton
                            icon="trash-2"
                            size="sm"
                            variant="ghost"
                            label={t('common.delete')}
                            onClick={() => a.confirm({
                              title: t('session.delGuestTitle'),
                              message: t('session.delGuestMsg', { name: guestOf(db, g.guestId).name }),
                              tone: 'danger',
                              confirmText: t('session.delGuestOk'),
                              onConfirm: () => a.removeGuest(g.id),
                            })}
                          />
                        </div>
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
                <SumRow label={t('session.sumGuestDebt')} value={fmt(revLive - paid)} color="var(--status-delayed)" />
                <div style={S.sumDivider} />
                <SumRow label={t('session.sumCost')} value={fmt(c.cost)} strong />
                <SumRow label={t('session.sumPerHead')} value={fmt(c.per)}
                  hint={t('session.sumPerHeadHint', { n: c.people })} />
                <SumRow label={t('session.sumSubsidy')} value={fmt(c.subsidy)} strong
                  color={c.subsidy > 0 ? 'var(--status-incident)' : 'var(--status-delivered)'} />
              </div>

              <div style={S.caption}>{t('session.costNote')}</div>

              {/* Trước khi chốt: chỉ cảnh báo, KHÔNG chặn nút Chốt. */}
              {s.status === 'open' && warns.length > 0 && (
                <Alert tone="warning" title={t('session.closeWarnTitle')}>
                  <div style={{ display: 'grid', gap: 3 }}>
                    {warns.map((w) => (
                      <span key={w.key}>{t('session.closeWarn.' + w.key, { n: w.n })}</span>
                    ))}
                  </div>
                </Alert>
              )}

              {/* Sau khi chốt: số đã đóng băng mà dữ liệu buổi đổi rồi — sửa đang vô ích. */}
              {drift && (
                <Alert tone="warning" title={t('session.driftTitle', { date: ddmy(s.costFrozenAt) })}>
                  <div style={{ display: 'grid', gap: 3 }}>
                    {drift.map((d) => (
                      <span key={d.key}>
                        {t('session.drift.' + d.key, { was: fmtK(d.was), now: fmtK(d.now) })}
                      </span>
                    ))}
                    <span style={{ marginTop: 4 }}>{t('session.driftNote')}</span>
                  </div>
                </Alert>
              )}
            </div>
          </Card>
        </div>
      </div>

      {editingGuest && (
        <EditGuestDialog
          guest={editingGuest}
          levels={db.levels}
          onClose={() => setEditingGuest(null)}
          onSave={(patch) => {
            a.updateGuest(editingGuest.id, patch)
            setEditingGuest(null)
          }}
          onDelete={() => {
            a.deleteGuest(editingGuest.id)
            setEditingGuest(null)
          }}
        />
      )}
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

  const extraOptions = rest.map((m) => ({
    value: m.id,
    label: m.name,
    level: levelOf(m, s.date.slice(0, 7)),
    sub: m.phone || undefined,
  }))

  const raw = ui.form.exMember
  const selectedMembers = Array.isArray(raw) ? raw : (raw ? [raw] : [])
  const count = selectedMembers.length

  const handleAdd = () => {
    selectedMembers.forEach((mid) => a.addExtra(s.id, mid))
    a.setF('exMember', [])
  }

  return (
    <div style={S.extraBox}>
      <SearchSelect
        multiple
        size="sm"
        style={{ flex: 1, minWidth: 200 }}
        menuWidth={280}
        value={selectedMembers}
        placeholder={t('session.extraPick')}
        searchPlaceholder={t('session.searchSolo')}
        options={extraOptions}
        levels={db.levels}
        clearable
        onChange={(vals) => a.setF('exMember', vals)}
      />
      <Button
        variant="secondary"
        size="sm"
        icon="user-round-plus"
        disabled={count === 0}
        onClick={handleAdd}
      >
        {count > 1 ? `+ Thêm ${count} người đi lẻ` : t('session.extraAdd')}
      </Button>
    </div>
  )
}

/* ---------------- form thêm khách ---------------- */

function GuestForm({ s }) {
  const { db, ui, a } = useApp()
  const [open, setOpen] = useState(false)
  const [showExtra, setShowExtra] = useState(false)
  const f = { ...guestForm(db), ...(ui.form || {}) }
  const set = (k, v) => a.setF(k, v)
  const price = guestPrice(db, f.gLevel, f.gGender)
  const companionPrice = f.gHasCompanion
    ? guestPrice(db, f.gCompanionLevel || f.gLevel, f.gCompanionGender || 'nu')
    : 0
  const totalPrice = price + companionPrice
  const noLevel = !f.gLevel
  const toSettings = () => { a.go('settings'); a.setTab('settings', 'money') }

  const selectedGuest = f.gGuestId ? db.guests.find((g) => g.id === f.gGuestId) : null
  const stats = selectedGuest ? guestStats(db, selectedGuest.id) : null

  // Gợi ý danh bạ khách
  const matchingGuests = useMemo(() => {
    const q = normalizeText(f.gName || '')
    if (!q) return db.guests.slice(0, 8)
    return db.guests.filter((g) => {
      const n = normalizeText(g.name)
      const p = (g.phone || '').replace(/\D/g, '')
      return n.includes(q) || (p && p.includes(q))
    }).slice(0, 8)
  }, [db.guests, f.gName])

  const selectGuest = (g) => {
    set('gGuestId', g.id)
    set('gName', g.name)
    set('gGender', g.gender)
    set('gLevel', g.level)
    set('gPhone', g.phone || '')
    set('gNote', g.note || '')
    if (g.invitedBy) set('gBy', g.invitedBy)
    setOpen(false)
  }

  const memberOptions = db.members.filter((m) => m.active !== false).map((m) => ({
    value: m.id,
    label: m.name,
    level: levelOf(m, (s?.date || new Date().toISOString()).slice(0, 7)),
    sub: m.phone || undefined,
  }))

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={S.guestForm}>
        {/* Ô Tìm / Nhập tên khách với Autocomplete */}
        <div style={{ position: 'relative' }}>
          <Input
            label={t('session.guestName')}
            placeholder={t('session.guestSearchPlaceholder')}
            value={f.gName || ''}
            onChange={(e) => {
              set('gName', e.target.value)
              set('gGuestId', '')
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
          />
          {open && matchingGuests.length > 0 && (
            <div style={S.guestDropdown}>
              {matchingGuests.map((g) => {
                const gs = guestStats(db, g.id)
                const lastDate = gs.lastSession ? ddmy(gs.lastSession.date) : ''
                return (
                  <button
                    key={g.id}
                    type="button"
                    style={S.guestOption}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectGuest(g)
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{g.name}</span>
                      <LevelChip level={g.level} levels={db.levels} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{genderTxt(g.gender)}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {gs.sessionCount > 0 ? `${gs.sessionCount} buổi · ${lastDate}` : 'Chưa có buổi'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {g.phone ? g.phone : t('members.guestNoPhone')}
                      {g.invitedBy ? ` · ${t('session.guestByShort')} ${memberOf(db, g.invitedBy).name}` : ''}
                      {g.note ? ` · ${g.note}` : ''}
                    </div>
                  </button>
                )
              })}
              {f.gName && (
                <button
                  type="button"
                  style={{ ...S.guestOption, color: 'var(--accent)', fontWeight: 600 }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    set('gGuestId', '')
                    setOpen(false)
                  }}
                >
                  {t('session.guestAddNew', { name: f.gName })}
                </button>
              )}
            </div>
          )}
        </div>

        <GenderSegment
          label={t('session.guestGender')}
          value={f.gGender || 'nam'}
          onChange={(val) => set('gGender', val)}
        />
        <Select
          label={t('session.guestLevel')}
          value={f.gLevel}
          options={db.levels.map((l) => ({ value: l, label: l }))}
          onChange={(e) => set('gLevel', e.target.value)}
        />
        <SearchSelect
          label={t('session.guestBy')}
          value={f.gBy || ''}
          placeholder={t('debts.clubRecruited')}
          searchPlaceholder={t('session.searchMember')}
          options={memberOptions}
          levels={db.levels}
          clearable
          onChange={(val) => set('gBy', val)}
        />
        <Button variant="accent" icon="plus" disabled={noLevel} onClick={() => { setOpen(false); a.addGuest() }}>
          {(f.gHasCompanion ? t('session.guestAddTwo') : t('common.add')) + (noLevel ? '' : ' · ' + fmt(totalPrice))}
        </Button>
      </div>

      {/* Tuỳ chọn +1 người đi kèm & Mở rộng SĐT/Note */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          fontSize: 12.5, fontWeight: 600, color: f.gHasCompanion ? 'var(--teal-700)' : 'var(--text-secondary)',
        }}>
          <input
            type="checkbox"
            checked={!!f.gHasCompanion}
            onChange={(e) => {
              const checked = e.target.checked
              set('gHasCompanion', checked)
              if (checked && !f.gCompanionName && f.gName) {
                set('gCompanionName', `Bạn ${f.gName.trim()}`)
              }
            }}
            style={{ cursor: 'pointer', accentColor: 'var(--teal-600)' }}
          />
          <span>{t('session.guestAddCompanion')}</span>
        </label>

        <button
          type="button"
          style={{
            border: 0, background: 'none', padding: 0, cursor: 'pointer',
            fontSize: 12, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
          onClick={() => setShowExtra(!showExtra)}
        >
          <Icon name={showExtra ? 'chevron-up' : 'plus'} size={12} />
          <span>{showExtra ? 'Thu gọn thông tin liên hệ' : '＋ SĐT / Link FB / Ghi chú'}</span>
        </button>
      </div>

      {/* Form người đi kèm */}
      {f.gHasCompanion && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr 1fr',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 8,
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(14, 165, 233, 0.08) 100%)',
          border: '1px solid rgba(2, 132, 199, 0.25)',
        }}>
          <Input
            label={t('session.companionName')}
            placeholder={`Bạn ${(f.gName || '').trim() || '...'}`}
            value={f.gCompanionName || ''}
            onChange={(e) => set('gCompanionName', e.target.value)}
          />
          <GenderSegment
            label={t('session.guestGender')}
            value={f.gCompanionGender || 'nu'}
            onChange={(val) => set('gCompanionGender', val)}
          />
          <Select
            label={t('session.guestLevel')}
            value={f.gCompanionLevel || f.gLevel || db.levels[0]}
            options={db.levels.map((l) => ({ value: l, label: l }))}
            onChange={(e) => set('gCompanionLevel', e.target.value)}
          />
        </div>
      )}

      {(showExtra || f.gPhone || f.gNote) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 9 }}>
          <Input
            label={t('members.guestPhone')}
            placeholder="0912... hoặc SĐT liên lạc"
            value={f.gPhone || ''}
            onChange={(e) => set('gPhone', e.target.value)}
          />
          <Input
            label={t('members.guestNote')}
            placeholder="Ghi chú: link FB, tay trái, bạn ai..."
            value={f.gNote || ''}
            onChange={(e) => set('gNote', e.target.value)}
          />
        </div>
      )}

      {/* Dòng nhắc SĐT nếu khách quen (>= 3 buổi) chưa có SĐT */}
      {selectedGuest && stats && stats.sessionCount >= 3 && !selectedGuest.phone && !showExtra && !f.gPhone && (
        <div style={S.phonePrompt}>
          <Icon name="phone" size={14} style={{ color: 'var(--status-delayed-fg)' }} />
          <span>{t('session.guestPhonePrompt', { name: selectedGuest.name, n: stats.sessionCount })}</span>
          <input
            type="text"
            placeholder={t('session.guestPhone')}
            value={f.gPhone || ''}
            onChange={(e) => set('gPhone', e.target.value)}
            style={S.miniInput}
          />
        </div>
      )}

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
  guestDropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
    background: 'var(--surface-overlay, #fff)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.1))',
    maxHeight: 240, overflowY: 'auto', marginTop: 4, display: 'grid',
  },
  guestOption: {
    display: 'grid', gap: 2, padding: '8px 12px', border: 0, borderBottom: '1px solid var(--border-subtle)',
    background: 'transparent', textAlign: 'left', cursor: 'pointer', font: 'inherit',
  },
  phonePrompt: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
    background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', flexWrap: 'wrap',
  },
  miniInput: {
    padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)',
    background: 'var(--surface-card)', font: 'inherit', fontSize: 13, width: 140,
  },
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
