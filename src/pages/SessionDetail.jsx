// Chi tiết buổi: điểm danh · sân buổi này · khách giao lưu · chốt tiền (handoff 02 §3).
// Nút "Chốt buổi" là hành động primary DUY NHẤT của trang.

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Icon, IconButton, Input, Select } from '#ds'
import { EditGuestDialog, Empty, GenderSegment, LevelChip, Mono, SearchSelect, SessionPill, TabTrack } from '#ui'
import CourtAssignmentTab from '#components/session/CourtAssignmentTab.jsx'
import SessionMatchesTab from '#components/session/SessionMatchesTab.jsx'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { ddmy, wd } from '#utils/dates.js'
import {
  courtOf, courtTxt, dueState, duesOf,
  fmt, fmtK, genderTxt, groupOf, guestOf, guestPrice, headCount, levelOf,
  isAdhoc, isMemberCharge, memberOf, presentCount, rowCost, sGuests, sGuestsOnly, sessionMembers,
  sessionOf, timeTxt, normalizeText, guestStats,
} from '#lib/money.js'
import { addCourtForm, guestForm } from '#lib/forms.js'
import { can } from '#lib/roles.js'
import { t } from '#i18n'

export default function SessionDetail() {
  const { db, a } = useApp()
  const isMobile = useMobile(768)
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [tabState, setTabState] = useState(tabFromUrl || 'attend')
  const activeTab = tabFromUrl || tabState
  const setActiveTab = (tab) => {
    setTabState(tab)
    setSearchParams({ tab }, { replace: true })
  }
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

  const allSold = (s.courts || []).length > 0 && (s.courts || []).every((court) => court.sold)
  const isCancelled = s.status === 'cancelled'
  const isClosed = s.status === 'closed'
  const isInactive = allSold || isCancelled

  const onCourtCount = Object.keys((db.lineups || {})[s.id] || {}).length
  const sessionMatches = (db.matches || []).filter((m) => m.sessionId === s.id)
  const pendingChallengesCount = (db.challenges || []).filter((c) => c.sessionId === s.id && c.status === 'pending').length

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
                {s.status === 'draft' && (
                  <Button variant="primary" icon="user-round-check"
                    style={{
                      background: 'linear-gradient(135deg, var(--blue-600) 0%, var(--status-scheduled) 100%)',
                      borderColor: 'var(--status-scheduled)',
                      boxShadow: '0 2px 10px rgba(14, 165, 233, 0.4)',
                      fontWeight: 700,
                      minHeight: isMobile ? 44 : 36,
                    }}
                    onClick={() => a.setSessionStatus(s.id, 'open')}>
                    {t('session.doOpen')}
                  </Button>
                )}
                {s.status === 'open' && (
                  <>
                    <Button
                      variant="primary"
                      icon="circle-check"
                      disabled={!canMoney}
                      style={{
                        background: !canMoney ? undefined : 'var(--action-success-bg)',
                        borderColor: !canMoney ? undefined : 'var(--action-success-border)',
                        boxShadow: !canMoney ? undefined : '0 2px 12px rgba(0, 135, 90, 0.35)',
                        fontWeight: 700,
                        padding: '0 16px',
                        minHeight: isMobile ? 44 : 36,
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
                    <Button
                      variant="secondary"
                      icon="undo-2"
                      onClick={() => a.confirm({
                        title: t('session.revertDraftTitle'),
                        message: t('session.revertDraftMsg'),
                        tone: 'info',
                        confirmText: t('session.revertDraftOk'),
                        onConfirm: () => a.setSessionStatus(s.id, 'draft'),
                      })}>
                      {t('session.doRevertDraft')}
                    </Button>
                  </>
                )}
                {(s.status === 'cancelled' || s.status === 'closed') && (
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

            {!isMobile && (
              <Button variant="secondary" size="sm" icon="send" onClick={() => a.copyZalo(s.id)}>
                {t('session.copyZalo')}
              </Button>
            )}
            {canEdit && s.status !== 'cancelled' && s.status !== 'closed' && (
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
            {/* Xoá HẲN chỉ mở khi chưa chốt và có quyền sửa */}
            {canEdit && s.status !== 'closed' && (
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

        {/* Copy Zalo trên mobile chuyển thành nút phụ trong thân */}
        {isMobile && (
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-start' }}>
            <Button variant="ghost" size="sm" icon="send" onClick={() => a.copyZalo(s.id)}>
              {t('session.copyZalo')}
            </Button>
          </div>
        )}

        {/* Ghi chú của buổi. Vô hiệu hóa khi buổi đã chốt. */}
        <div style={{ marginTop: 12 }}>
          <Input label={t('session.note')} placeholder={t('session.notePh')}
            value={s.note || ''} disabled={!canEdit || isClosed}
            onChange={(e) => a.setSessionNote(s.id, e.target.value)} />
        </div>
      </Card>

      {/* ---------------- Segmented Tab Bar (Handoff 02 / 05) ---------------- */}
      <TabTrack style={S.tabBarWrap}>
        <div style={S.tabTrack}>
          <button
            type="button"
            onClick={() => setActiveTab('attend')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'attend' ? S.tabBtnActive : {}),
            }}
          >
            <span>{t('sessionTabs.attend')}</span>
            <span style={S.tabBadgeMono}>{presentCount(db, s)}/{members.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('courts')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'courts' ? S.tabBtnActive : {}),
            }}
          >
            <span>{t('sessionTabs.courts')}</span>
            <span style={{ ...S.tabBadgeMono, color: 'var(--status-transit-fg)' }}>{onCourtCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matches')}
            style={{
              ...S.tabBtn,
              ...(activeTab === 'matches' ? S.tabBtnActive : {}),
            }}
          >
            <span>{t('sessionTabs.matches')}</span>
            <span style={{ ...S.tabBadgeMono, color: 'var(--status-delayed-fg)' }}>
              {sessionMatches.length}{pendingChallengesCount > 0 ? `/${pendingChallengesCount}` : ''}
            </span>
          </button>
        </div>
      </TabTrack>

      {activeTab === 'attend' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit,minmax(380px,1fr))', gap: 16, alignItems: 'start' }}>
        {/* ---------------- điểm danh ---------------- */}
        <Card
          title={t('session.attendTitle')}
          subtitle={t('session.attendSub')}
          icon="user-round-check"
          padding="14px 16px"
          actions={canEdit && !isInactive && !isClosed && (
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="secondary" size="sm" onClick={() => a.markAll(s.id, true)}>{t('session.allPresent')}</Button>
              <Button variant="ghost" size="sm" onClick={() => a.markAll(s.id, false)}>{t('session.allAbsent')}</Button>
            </div>
          )}
        >
          <div style={{ display: 'grid', gap: 7 }}>
            {isCancelled && <Alert tone="danger">{t('session.cancelledNotice')}</Alert>}
            {allSold && <Alert tone="warning">{t('session.allSoldNotice')}</Alert>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
              <span style={{
                font: '700 11.5px/1 var(--font-sans)',
                color: 'var(--teal-700)',
                background: 'var(--teal-50)',
                padding: '3px 8px',
                borderRadius: 4,
                border: '1px solid var(--teal-200)',
              }}>
                {t('session.attendSummary', { total: headCount(db, s) })}
              </span>
              <span style={{ font: '600 12px/1 var(--font-sans)', color: 'var(--text-secondary)' }}>
                {t('session.attendCount', { present: presentCount(db, s), total: members.length })}
              </span>
              {guests.length > 0 && (
                <span style={{
                  font: '700 11.5px/1 var(--font-sans)',
                  color: 'var(--amber-700)',
                  background: 'var(--amber-100)',
                  padding: '2px 7px',
                  borderRadius: 4,
                }}>
                  {t('session.guestCountTag', { n: guests.length })}
                </span>
              )}
            </div>
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
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  gap: isMobile ? 6 : 10,
                  background: allSold ? 'var(--surface-sunken)' : state === true ? 'var(--surface-accent-soft)'
                    : extra ? 'var(--status-scheduled-bg)'
                      : state === false ? 'var(--surface-sunken)' : 'var(--surface-card)',
                  borderColor: allSold ? 'var(--border-subtle)' : state === true ? 'var(--teal-500)'
                    : extra ? 'var(--status-scheduled-fg)' : 'var(--border-subtle)',
                  opacity: isInactive ? 0.75 : 1,
                }}>
                  <button type="button" disabled={!canEdit || extra || isInactive || isClosed}
                    onClick={() => a.toggleAtt(s.id, m.id)}
                    style={{
                      ...S.attBtn,
                      cursor: canEdit && !extra && !isInactive && !isClosed ? 'pointer' : 'default',
                      width: '100%',
                    }}>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={S.label}>{m.name}</div>
                      <div style={S.caption}>{genderTxt(m.gender) + ' · ' + levelOf(m, month)}</div>
                    </div>
                    <LevelChip level={levelOf(m, month)} levels={db.levels} />
                    <span style={{
                      font: 'var(--type-label)', minWidth: 74, textAlign: 'right',
                      color: allSold ? 'var(--text-muted)' : state === true ? 'var(--status-transit)'
                        : extra ? 'var(--status-scheduled-fg)'
                          : state === false ? 'var(--text-muted)' : 'var(--text-disabled)',
                    }}>
                      {allSold ? t('attend.absent') : extra ? t('attend.extra')
                        : state === true ? t('attend.present')
                          : state === false ? t('attend.absent') : t('attend.unmarked')}
                    </span>
                  </button>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isMobile ? 'space-between' : 'flex-end',
                    borderTop: isMobile ? '1px dashed var(--border-subtle)' : 'none',
                    paddingTop: isMobile ? 4 : 0,
                    gap: 8,
                  }}>
                    {charge
                      ? <>
                          <Mono weight={600} color="var(--text-primary)">{fmt(charge.price)}</Mono>
                          {/* CHỈ HIỂN THỊ. Thu tiền và gạch nợ nằm hết ở màn Công nợ — một khoản
                              tiền chỉ được sửa ở MỘT chỗ, không thì hai màn nói hai kiểu. */}
                          <span style={charge.paid ? S.tagGreen : S.tagAmber}>
                            {t(charge.paid ? 'session.guestPaid' : 'session.guestDebt')}
                          </span>
                          {extra && canEdit && !isClosed && (
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
                      ? <span style={{ ...S.caption, minWidth: isMobile ? 0 : 96, textAlign: 'right' }} />
                      : extra
                      ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ ...S.caption, minWidth: isMobile ? 0 : 96, textAlign: 'right' }}>{t('session.extraDueTag')}</span>
                          {canEdit && !isClosed && (
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
                          font: 'var(--type-caption)', minWidth: isMobile ? 0 : 96, textAlign: 'right',
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
                </div>
              )
            })}
            {canEdit && !isInactive && !isClosed && <ExtraPicker s={s} members={members} />}
          </div>
        </Card>

        {/* ---------------- cột phải ---------------- */}
        <div style={{ display: 'grid', gap: 16 }}>
          <Card
            title={t('session.courtsTitle')}
            subtitle={t('session.courtsSub')}
            icon="map-pin"
            padding="14px 16px"
            actions={canEdit && !isClosed && (
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
                      <span style={S.label}>
                        {c.label ? (
                          <>
                            <span style={{ color: 'var(--teal-600)', fontWeight: 700 }}>{c.label}</span>
                            <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>·</span>
                            <span>{courtOf(db, c.courtId).name}</span>
                          </>
                        ) : (
                          (s.courts || []).length > 1 ? (
                            <>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('session.courtNum', { n: i + 1 })}</span>
                              <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>·</span>
                              <span>{courtOf(db, c.courtId).name}</span>
                            </>
                          ) : (
                            courtOf(db, c.courtId).name
                          )
                        )}
                      </span>
                      {canEdit && !isClosed && (
                        <IconButton
                          icon="pencil"
                          size="sm"
                          variant="ghost"
                          label={t('session.editCourtLabel')}
                          onClick={() => a.openDialog('editCourtLabel', { sid: s.id, courtIndex: i, label: c.label || '' })}
                        />
                      )}
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
                  {canEdit && !isClosed && (
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
                        value={String(c.soldAmount || 0)} disabled={!canEdit || isClosed}
                        onChange={(e) => a.setSold(s.id, i, 'soldAmount', e.target.value)}
                        style={{ width: 140 }} />
                      <Input label={t('session.soldTo')} value={c.soldTo || ''} disabled={!canEdit || isClosed}
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
            {isCancelled && <Alert tone="danger">{t('session.cancelledGuestNotice')}</Alert>}
            {allSold && <Alert tone="warning">{t('session.allSoldGuestNotice')}</Alert>}
            {canEdit && !isInactive && !isClosed && <GuestForm s={s} />}
            <div style={{ display: 'grid', gap: 8, marginTop: guests.length ? 12 : 0 }}>
              {guests.length === 0
                ? <Empty icon="user-round-plus" title={t('session.guestEmpty')} hint={t('session.guestEmptyHint')} />
                : guests.map((g) => (
                    <div key={g.id} style={{ ...S.guestRow, opacity: isInactive ? 0.75 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.label}>{guestOf(db, g.guestId).name}</div>
                        <div style={S.caption}>{genderTxt(g.gender) + ' · ' + g.level}</div>
                      </div>
                      <SearchSelect
                        size="sm"
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
                        disabled={!canEdit || isInactive || isClosed}
                        value={g.invitedBy || ''}
                        onChange={(val) => a.setGuestInviter(g.id, val)}
                      />
                      <Mono weight={600} color="var(--text-primary)">{fmt(g.price)}</Mono>
                      <span style={g.paid ? S.tagGreen : S.tagAmber}>
                        {t(g.paid ? 'session.guestPaid' : 'session.guestDebt')}
                      </span>
                      {canEdit && !isInactive && !isClosed && (
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

        </div>
      </div>
      )}

      {activeTab === 'courts' && <CourtAssignmentTab s={s} />}
      {activeTab === 'matches' && <SessionMatchesTab s={s} />}

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
            a.confirm({
              title: t('session.delGuestTitle'),
              message: t('session.delGuestMsg', { name: editingGuest.name }),
              tone: 'danger',
              confirmText: t('session.delGuestOk'),
              onConfirm: () => {
                a.deleteGuest(editingGuest.id)
                setEditingGuest(null)
              },
            })
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
        {count > 1 ? t('session.extraAddMany', { n: count }) : t('session.extraAdd')}
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
    setShowExtra(Boolean(g.phone || g.note))
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
                        {gs.sessionCount > 0
                          ? t('session.guestSessionMeta', { n: gs.sessionCount, date: lastDate })
                          : t('session.guestNoSession')}
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
                  style={{ ...S.guestOption, color: 'var(--text-accent, var(--teal-500))', fontWeight: 600 }}
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
        <Button
          variant="primary"
          icon="plus"
          disabled={noLevel}
          style={{
            whiteSpace: 'nowrap',
            fontWeight: 600,
            minWidth: 90,
            justifyContent: 'center',
          }}
          onClick={() => { setOpen(false); a.addGuest() }}
        >
          {noLevel
            ? t('common.add')
            : (f.gHasCompanion ? t('session.addTwoGuests', { amount: fmt(totalPrice) }) : fmt(totalPrice))}
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
                set('gCompanionName', t('session.companionDefault', { name: f.gName.trim() }))
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
            fontSize: 12, color: 'var(--text-accent, var(--teal-500))', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
          onClick={() => setShowExtra(!showExtra)}
        >
          <Icon name={showExtra ? 'chevron-up' : 'plus'} size={12} />
          <span>{t(showExtra ? 'session.extraLess' : 'session.extraMore')}</span>
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
            placeholder={t('session.companionDefault', { name: (f.gName || '').trim() || '...' })}
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

      {showExtra && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 9 }}>
          <Input
            label={t('members.guestPhone')}
            placeholder={t('session.phGuestPhone2')}
            value={f.gPhone || ''}
            onChange={(e) => set('gPhone', e.target.value)}
          />
          <Input
            label={t('members.guestNote')}
            placeholder={t('session.phGuestNote2')}
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

const S = {
  tabBarWrap: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '14px 0 16px' },
  tabTrack: { display: 'flex', padding: 3, borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', gap: 2 },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px',
    borderRadius: 6, border: 'none', background: 'transparent',
    font: '600 13px/1 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)',
    cursor: 'pointer', transition: 'all 0.15s ease',
  },
  tabBtnActive: { background: 'var(--surface-card)', color: 'var(--text-primary)', boxShadow: '0 1px 1px rgba(0,0,0,.30)' },
  tabBadgeMono: { font: '400 11.5px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' },
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
  guestForm: { display: 'grid', gridTemplateColumns: '1.4fr 110px 95px minmax(180px, 1.6fr) auto', gap: 9, alignItems: 'flex-end' },
  guestDropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
    background: 'var(--surface-overlay, var(--surface-card))', border: '1px solid var(--border-subtle)',
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
  guestWarn: {
    textAlign: 'left', border: 0, padding: 0, cursor: 'pointer', background: 'transparent',
    font: 'var(--type-caption)', color: 'var(--status-delayed-fg)', textDecoration: 'underline',
  },
  guestRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 1.2fr) minmax(130px, 1.2fr) auto auto auto',
    gap: 12,
    alignItems: 'center',
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    background: 'var(--surface-card)',
  },
  tagAmber: {
    font: '600 10px/1 var(--font-sans)', padding: '4px 8px', borderRadius: 99,
    background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)', whiteSpace: 'nowrap',
  },
  tagGreen: {
    font: '600 10px/1 var(--font-sans)', padding: '4px 8px', borderRadius: 99,
    background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)', whiteSpace: 'nowrap',
  },
}
