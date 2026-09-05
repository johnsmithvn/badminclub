import React, { useState } from 'react'
import { Alert, Avatar, Button, Checkbox, Icon, Input, Select } from '#ds'
import { SearchSelect } from '#ui'
import {
  FormRow,
  ToggleSwitch,
  SettingsCard,
  InfoBox,
  EmptyState,
} from '#components/settings/SettingsComponents.jsx'
import { ROLES, roleDesc } from '#lib/roles.js'
import { digits, mergeRows } from '#lib/members.js'
import { levelOf, genderTxt } from '#lib/money.js'
import { ddmy } from '#utils/dates.js'
import { t } from '#i18n'

const showVal = (field, v) => {
  if (!v) return ''
  if (field === 'gender') return genderTxt(v)
  if (field === 'avatarUrl') return t('settings.fAvatar')
  if (field === 'qrUrl') return t('settings.qrModalTitle')
  return v
}

function JoinRow({ r, canEdit, unlinked, db, ui, a }) {
  const u = (db.users || []).find((x) => x.id === r.userId) || {}
  const dup = unlinked.find((m) => digits(m.phone) && digits(m.phone) === digits(u.phone))
  const pick = ui.form['join_' + r.id] ?? (dup ? dup.id : '')
  const target = unlinked.find((m) => m.id === pick) || null
  const rows = target ? mergeRows(target, u, db.levels) : []
  const ticked = ui.form['jf_' + r.id] || []
  const take = rows.filter((x) => !x.block && ticked.indexOf(x.field) >= 0).map((x) => x.field)

  const setPick = (id) => {
    a.setF('join_' + r.id, id)
    a.setF('jf_' + r.id, [])
  }
  const toggle = (field) => {
    a.setF(
      'jf_' + r.id,
      ticked.indexOf(field) >= 0 ? ticked.filter((x) => x !== field) : ticked.concat([field])
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-inset)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={u.name || ''} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{u.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {t('settings.joinMeta', { phone: u.phone || '—', code: r.code, date: ddmy(r.at) })}
          </div>
          {r.note && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{r.note}</div>}
        </div>
      </div>

      {canEdit && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
          {dup && (
            <div style={{ fontSize: 12, color: 'var(--amber-600)', fontWeight: 600 }}>
              {t('settings.joinDupWarn', { name: dup.name })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <SearchSelect
              size="sm"
              style={{ width: 240 }}
              menuWidth={280}
              placeholder={t('settings.joinPickMember')}
              options={unlinked.map((m) => ({
                value: m.id,
                label: m.name,
                sub: m.phone || undefined,
                level: levelOf(m, db.month),
              }))}
              levels={db.levels}
              clearable
              value={pick}
              onChange={(val) => setPick(val || '')}
            />
            <Button
              variant="primary"
              size="sm"
              icon="link"
              disabled={!pick}
              onClick={() => a.approveJoin(r.id, pick, take)}
            >
              {t('settings.joinLink')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="user-round-plus"
              onClick={() => a.approveJoin(r.id, null)}
            >
              {t('settings.joinCreate')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon="circle-x"
              onClick={() => a.rejectJoin(r.id)}
            >
              {t('settings.joinReject')}
            </Button>
          </div>

          {target && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--surface-card)',
                border: '1px dashed var(--border-default)',
                marginTop: 4,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.07em' }}>
                {t('settings.mergeFieldTitle')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {t('settings.mergeFieldDesc')}
              </div>
              {rows.map((x) => (
                <div
                  key={x.field}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    fontSize: 12.5,
                  }}
                >
                  <Checkbox
                    label={t('settings.mergeField.' + x.field) || t('members.changeField.' + x.field) || x.field}
                    checked={ticked.indexOf(x.field) >= 0 && !x.block}
                    disabled={Boolean(x.block)}
                    onChange={() => toggle(x.field)}
                  />
                  {x.block ? (
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {t('settings.mergeBlock.' + x.block)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {t('settings.mergeArrow', {
                        from: showVal(x.field, x.from) || t('common.notYet'),
                        to: showVal(x.field, x.to),
                      })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AccessTab({
  db,
  ui,
  a,
  canEdit = true,
  pending = [],
  onLinkModeToggle,
  onMemberRoleChange,
}) {
  const lm = { code: true, phone: true, ...db.club.linkModes }
  const takenUserIds = new Set((db.members || []).filter((m) => m.userId).map((m) => m.userId))

  const [found, setFound] = useState([])
  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupErr, setLookupErr] = useState('')
  const [looking, setLooking] = useState(false)

  const lookup = async () => {
    setLookupErr('')
    setLooking(true)
    try {
      const r = await a.findMemberCandidate(lookupEmail)
      if (!r) setLookupErr(t('settings.lookupNone'))
      else if (r.alreadyInClub) setLookupErr(t('settings.lookupTaken', { name: r.name }))
      else {
        setFound((prev) => (prev.some((x) => x.id === r.id) ? prev : prev.concat([{ ...r, email: lookupEmail.trim() }])))
        setLookupEmail('')
      }
    } catch (e) {
      setLookupErr(e.message)
    }
    setLooking(false)
  }

  const freeUsers = (db.users || [])
    .filter((u) => !takenUserIds.has(u.id))
    .concat(found.filter((u) => !takenUserIds.has(u.id) && !(db.users || []).some((x) => x.id === u.id)))

  const suggestFor = (m) => {
    if (!lm.phone || m.userId || !digits(m.phone)) return null
    return freeUsers.find((u) => digits(u.phone) === digits(m.phone)) || null
  }

  const unlinked = (db.members || []).filter((m) => !m.userId && m.active !== false)
  const linkDeadEnd = unlinked.length > 0 && freeUsers.length === 0
  const linkedCount = (db.members || []).filter((m) => m.userId).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Yêu cầu vào CLB (Full width) */}
      <SettingsCard
        title={t('settings.joinTitle')}
        subtitle={t('settings.joinSub')}
        icon="user-round-plus"
        fullWidth
        bodyPadding="0 20px 16px"
      >
        {pending.length === 0 ? (
          <EmptyState
            icon="circle-check"
            title={t('settings.joinEmpty')}
            hint={t('settings.joinEmptyHint', { code: db.club.code })}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            {pending.map((r) => (
              <JoinRow key={r.id} r={r} canEdit={canEdit} unlinked={unlinked} db={db} ui={ui} a={a} />
            ))}
          </div>
        )}
      </SettingsCard>

      {/* Lưới 2 cột: Cách cho người mới vào + Các vai và quyền */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, alignItems: 'start' }}>
        {/* Card 2: Cách cho người mới vào */}
        <SettingsCard
          title={t('settings.linkModesTitle')}
          subtitle={t('settings.linkModesSub')}
          icon="settings-2"
        >
          <FormRow
            isToggle
            label={t('settings.modeCode')}
            note={t('settings.modeCodeNote', { code: db.club.code })}
          >
            <ToggleSwitch
              checked={lm.code}
              disabled={!canEdit}
              onChange={() => onLinkModeToggle('code')}
            />
          </FormRow>

          <FormRow
            isToggle
            label={t('settings.modePhone')}
            note={t('settings.modePhoneNote')}
            last
          >
            <ToggleSwitch
              checked={lm.phone}
              disabled={!canEdit}
              onChange={() => onLinkModeToggle('phone')}
            />
          </FormRow>
        </SettingsCard>

        {/* Card 3: Các vai và quyền */}
        <SettingsCard
          title={t('settings.rolesTitle')}
          subtitle={t('settings.rolesSub')}
          icon="shield"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 0' }}>
            {ROLES.map((r) => (
              <div key={r.value} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'var(--surface-accent-soft)',
                    color: 'var(--teal-700)',
                    whiteSpace: 'nowrap',
                    width: 92,
                    textAlign: 'center',
                    flexShrink: 0,
                  }}
                >
                  {r.label}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {roleDesc(r.value)}
                </span>
              </div>
            ))}
          </div>
        </SettingsCard>
      </div>

      {/* 4. Thành viên · tài khoản · quyền (Full width) */}
      <SettingsCard
        title={t('settings.membersTitle')}
        subtitle={t('settings.membersSub', { linked: linkedCount, total: db.members.length })}
        icon="users"
        fullWidth
        bodyPadding="0 20px 20px"
      >
        {canEdit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0 6px' }}>
            {linkDeadEnd && (
              <InfoBox title={t('settings.linkNoFree')}>
                {t('settings.linkHint', { code: db.club.code })}
              </InfoBox>
            )}

            {/* Tìm kiếm email chính xác */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {t('settings.lookupLabel')}
                </div>
                <Input
                  placeholder="ten@email.com"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') lookup()
                  }}
                />
              </div>
              <Button
                variant="secondary"
                icon="search"
                disabled={!lookupEmail.trim() || looking}
                onClick={lookup}
              >
                {t(looking ? 'settings.lookupBusy' : 'settings.lookupDo')}
              </Button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -2 }}>
              {t('settings.exactEmailHint')}
            </div>

            {lookupErr && <Alert tone="warning">{lookupErr}</Alert>}

            {found.length > 0 && (
              <Alert tone="success" title={t('settings.lookupFound')}>
                {t('settings.foundAccountsDesc', { names: found.map((u) => u.name).join(', ') })}
              </Alert>
            )}
          </div>
        )}

        {/* Bảng thành viên */}
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1.2fr 1.3fr 130px 1.5fr',
              background: 'var(--surface-inset)',
              borderRadius: 8,
              padding: '9px 14px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.07em',
              color: 'var(--text-muted)',
            }}
          >
            <div>{t('settings.colMemberCaps')}</div>
            <div>{t('settings.colPhoneCaps')}</div>
            <div>{t('settings.colAccountCaps')}</div>
            <div>{t('settings.colRoleCaps')}</div>
            <div>{t('settings.colTodoCaps')}</div>
          </div>

          {(db.members || [])
            .filter((m) => m.active !== false)
            .map((m) => {
              const user = m.userId && (db.users || []).find((u) => u.id === m.userId)
              const sug = suggestFor(m)

              return (
                <div
                  key={m.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr 1.2fr 1.3fr 130px 1.5fr',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <Avatar name={m.name} size={30} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                      {m.fullName && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{m.fullName}</div>}
                    </div>
                  </div>

                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {m.phone || '—'}
                  </div>

                  <div>
                    {user ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: 'var(--surface-accent-soft)',
                          color: 'var(--teal-700)',
                          display: 'inline-block',
                        }}
                      >
                        {user.nick || user.name}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: 'var(--gray-100)',
                          color: 'var(--text-muted)',
                          display: 'inline-block',
                        }}
                      >
                        {t('settings.noAccount')}
                      </span>
                    )}
                  </div>

                  <div>
                    <Select
                      size="sm"
                      value={m.role}
                      disabled={!canEdit}
                      options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
                      onChange={(e) => onMemberRoleChange(m.id, e.target.value)}
                    />
                  </div>

                  <div>
                    {canEdit && user && (
                      <button
                        type="button"
                        onClick={() =>
                          a.confirm({
                            title: t('settings.unlinkTitle', { name: m.name }),
                            message: t('settings.unlinkMsg', { account: user.nick || user.name, name: m.name }),
                            tone: 'warning',
                            confirmText: t('settings.doUnlink'),
                            onConfirm: () => a.unlinkMember(m.id),
                          })
                        }
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--red-600)',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {t('settings.doUnlink')}
                      </button>
                    )}

                    {canEdit && !user && (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <SearchSelect
                          size="sm"
                          style={{ minWidth: 160 }}
                          menuWidth={280}
                          placeholder={freeUsers.length ? t('settings.chooseAccount') : t('settings.noAccount')}
                          disabled={freeUsers.length === 0}
                          options={freeUsers.map((u) => ({
                            value: u.id,
                            label: u.name || u.nick || u.id,
                            sub: [u.email, u.phone].filter(Boolean).join(' · ') || undefined,
                          }))}
                          clearable
                          value={ui.form['link_u_' + m.id] ?? (sug ? sug.id : '')}
                          onChange={(val) => a.setF('link_u_' + m.id, val || '')}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={!(ui.form['link_u_' + m.id] ?? (sug ? sug.id : ''))}
                          onClick={() => {
                            const targetUid = ui.form['link_u_' + m.id] ?? (sug ? sug.id : '')
                            if (targetUid) {
                              a.linkMemberUser(m.id, targetUid)
                              a.setF('link_u_' + m.id, undefined)
                            }
                          }}
                        >
                          {t('settings.doLink')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </SettingsCard>
    </div>
  )
}
