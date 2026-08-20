// Cài đặt: Chung · Cách chia tiền · Sân · Cầu · Nhóm cố định · Tài khoản & quyền (handoff 02 §7).

import { Alert, Avatar, Button, Card, Input, Select, Switch, Tabs } from '#ds'
import { Empty, GRID_PAIR, Mono, Overline } from '#ui'
import { courtForm, groupForm } from '#lib/forms.js'
import { useApp } from '#contexts/AppContext.jsx'
import { WD, dd, ddmy } from '#utils/dates.js'
import { ROLES, can, roleDesc } from '#lib/roles.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

const TABS = ['general', 'money', 'courts', 'shuttles', 'groups', 'access']

export default function Settings() {
  const { db, ui, a } = useApp()
  const tab = ui.tab.settings || 'general'
  const canEdit = can(db.viewAs || 'owner', 'settings')
  const pending = db.joinRequests || []

  return (
    <>
      <Tabs
        variant="underline"
        items={TABS.map((k) => ({
          value: k,
          label: t('settings.tab' + k[0].toUpperCase() + k.slice(1)),
          count: k === 'access' ? pending.length : undefined,
        }))}
        value={tab}
        onChange={(v) => a.setTab('settings', v)}
      />
      {tab === 'general' && <General canEdit={canEdit} />}
      {tab === 'money' && <MoneyTab canEdit={canEdit} />}
      {tab === 'courts' && <Courts canEdit={canEdit} />}
      {tab === 'shuttles' && <ShuttleTab canEdit={canEdit} />}
      {tab === 'groups' && <Groups canEdit={canEdit} />}
      {tab === 'access' && <Access canEdit={canEdit} pending={pending} />}
    </>
  )
}

/* ---------------- Chung ---------------- */

function General({ canEdit }) {
  const { db, a } = useApp()
  const c = db.club
  const bank = c.bank || {}

  return (
    <>
      <div style={GRID_PAIR}>
        <Card title={t('settings.clubTitle')} subtitle={t('settings.clubSub')} icon="building-2" padding="14px 16px">
          <div style={{ display: 'grid', gap: 12 }}>
            <Input label={t('settings.fClubName')} value={c.name} disabled={!canEdit}
              onChange={(e) => a.setClub('name', e.target.value)} />
            <div style={{ display: 'grid', gap: 4 }}>
              <Overline>{t('settings.fClubCode')}</Overline>
              <div style={S.codeBox}>
                <Mono weight={600} size={16} color="var(--navy-700)">{c.code}</Mono>
              </div>
              <div style={S.caption}>{t('settings.codeNote')}</div>
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <Input label={t('settings.fLockDay')} mono value={String(c.lockDay || cfg.club.defaultLockDay)}
                disabled={!canEdit} onChange={(e) => a.setLockDay(e.target.value)} style={{ width: 120 }} />
              <div style={S.caption}>{t('settings.lockDayNote')}</div>
            </div>
          </div>
        </Card>

        <Card title={t('settings.privacyTitle')} subtitle={t('settings.privacySub')} icon="shield" padding="14px 16px">
          <div style={{ display: 'grid', gap: 14 }}>
            <Toggle label={t('settings.seeDebt')} note={t('settings.seeDebtNote')} checked={!!c.seeDebtEachOther}
              disabled={!canEdit} onChange={() => a.setClub('seeDebtEachOther', !c.seeDebtEachOther)} />
            <Toggle label={t('settings.seeFund')} note={t('settings.seeFundNote')} checked={!!c.seeFund}
              disabled={!canEdit} onChange={() => a.setClub('seeFund', !c.seeFund)} />
            <Toggle label={t('settings.roundUnit')} note={t('settings.roundUnitNote')} checked={!!c.roundUnit}
              disabled={!canEdit} onChange={() => a.setClub('roundUnit', !c.roundUnit)} />
          </div>
        </Card>
      </div>

      <div style={GRID_PAIR}>
        <Card title={t('settings.bankTitle')} subtitle={t('settings.bankSub')} icon="landmark" padding="14px 16px">
          <div style={{ display: 'grid', gap: '9px 12px', gridTemplateColumns: '120px 1fr', alignItems: 'center' }}>
            <Overline>{t('settings.fBankHolder')}</Overline>
            <Mono color="var(--text-primary)">{bank.holder || t('common.unknown')}</Mono>
            <Overline>{t('settings.fBankNo')}</Overline>
            <Mono color="var(--text-primary)">{bank.no || t('common.unknown')}</Mono>
            <Overline>{t('settings.fBankName')}</Overline>
            <Mono color="var(--text-primary)">{bank.bank || t('common.unknown')}</Mono>
          </div>
        </Card>

        <LevelsCard canEdit={canEdit} />
      </div>
    </>
  )
}

/** Thang trình độ của CLB. Một ô chữ, phân cách bằng dấu phẩy, YẾU trước MẠNH sau. */
function LevelsCard({ canEdit }) {
  const { db, ui, a } = useApp()
  const saved = (db.levels || []).join(', ')
  const draft = ui.form.levelsText === undefined ? saved : ui.form.levelsText

  return (
    <Card title={t('settings.levelsTitle')} subtitle={t('settings.levelsSub')} icon="layers" padding="14px 16px">
      <div style={{ display: 'grid', gap: 9 }}>
        <Input label={t('settings.fLevels')} value={draft} disabled={!canEdit}
          onChange={(e) => a.setF('levelsText', e.target.value)} />
        <div style={S.caption}>{t('settings.levelsNote')}</div>
        <div>
          <Button variant="primary" size="sm" icon="check" disabled={!canEdit || draft === saved}
            onClick={() => a.setLevels(draft)}>{t('common.save')}</Button>
        </div>
      </div>
    </Card>
  )
}

const Toggle = ({ label, note, checked, onChange, disabled }) => (
  <div style={{ display: 'grid', gap: 3 }}>
    <Switch label={label} checked={checked} onChange={onChange} disabled={disabled} />
    <div style={S.caption}>{note}</div>
  </div>
)

/* ---------------- Cách chia tiền ---------------- */

function MoneyTab({ canEdit }) {
  const { db, a } = useApp()
  return (
    <>
      <Alert tone="info" title={t('settings.moneyAlertTitle')}>{t('settings.moneyAlert')}</Alert>
      <Card title={t('settings.guestPriceTitle')} subtitle={t('settings.guestPriceSub')} icon="tags" padding="14px 16px">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ ...S.priceGrid, ...S.headRow }}>
            <span>{t('settings.colLevel')}</span>
            <span>{t('settings.colMale')}</span>
            <span>{t('settings.colFemale')}</span>
          </div>
          {db.guestPrices.map((p) => (
            <div key={p.level} style={S.priceGrid}>
              <span style={S.label}>{p.level}</span>
              <Input mono suffix={t('units.dong')} value={String(p.nam)} disabled={!canEdit}
                onChange={(e) => a.setPrice(p.level, 'nam', e.target.value)} />
              <Input mono suffix={t('units.dong')} value={String(p.nu)} disabled={!canEdit}
                onChange={(e) => a.setPrice(p.level, 'nu', e.target.value)} />
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

/* ---------------- Sân ---------------- */

function Courts({ canEdit }) {
  const { db, a } = useApp()
  return (
    <Card title={t('settings.courtsTitle')} subtitle={t('settings.courtsSub')} icon="map-pin" padding="14px 16px"
      actions={canEdit && (
        <Button variant="secondary" size="sm" icon="plus"
          onClick={() => a.openDialog('newCourt', courtForm())}>{t('settings.addCourt')}</Button>
      )}>
      {db.courts.length === 0
        ? <Empty icon="map-pin" title={t('settings.noCourt')} hint={t('settings.noCourtHint')} />
        : <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ ...S.courtGrid, ...S.headRow }}>
              <span>{t('settings.colCourt')}</span>
              <span>{t('settings.colAddress')}</span>
              <span>{t('settings.colPrice')}</span>
              <span>{t('settings.colActive')}</span>
            </div>
            {db.courts.map((c) => (
              <div key={c.id} style={S.courtGrid}>
                <Input value={c.name} disabled={!canEdit}
                  onChange={(e) => a.setCourtField(c.id, 'name', e.target.value)} />
                <Input value={c.addr || ''} disabled={!canEdit}
                  onChange={(e) => a.setCourtField(c.id, 'addr', e.target.value)} />
                <Input mono suffix={t('units.dong')} value={String(c.price)} disabled={!canEdit}
                  onChange={(e) => a.setCourtField(c.id, 'price', e.target.value)} />
                <Switch checked={c.active !== false} disabled={!canEdit}
                  onChange={() => a.setCourtField(c.id, 'active', c.active === false)} />
              </div>
            ))}
          </div>}
    </Card>
  )
}

/* ---------------- Cầu ---------------- */

function ShuttleTab({ canEdit }) {
  const { db, a } = useApp()
  // So định mức với số cầu thực tế của các buổi đã chốt KHÔNG còn cờ ước lượng.
  const real = db.sessions.filter((s) => s.status === 'closed' && !s.shuttleEst)

  return (
    <>
      <Card title={t('settings.quotaTitle')} subtitle={t('settings.quotaSub')} icon="package" padding="14px 16px">
        <div style={{ display: 'grid', gap: 12 }}>
          {db.groups.map((g) => {
            const mine = real.filter((s) => s.groupId === g.id)
            const avg = mine.length ? Math.round(mine.reduce((x, s) => x + s.shuttleUsed, 0) / mine.length) : null
            return (
              <div key={g.id} style={{ display: 'grid', gap: 4 }}>
                <Input label={g.name} mono suffix={t('units.shuttle')} value={String(g.quota)} disabled={!canEdit}
                  onChange={(e) => a.setGroupField(g.id, 'quota', e.target.value)} style={{ maxWidth: 260 }} />
                <div style={S.caption}>
                  {avg === null ? t('settings.quotaNoData') : t('settings.quotaCompare', { avg })}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title={t('settings.typesTitle')} subtitle={t('settings.typesSub')} icon="package-open" padding="14px 16px">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ ...S.typeGrid, ...S.headRow }}>
            <span>{t('settings.colType')}</span>
            <span>{t('settings.colPerTube')}</span>
            <span>{t('settings.colRefPrice')}</span>
          </div>
          {db.shuttleTypes.map((x) => (
            <div key={x.id} style={S.typeGrid}>
              <Input value={x.name} disabled={!canEdit} onChange={(e) => a.setShuttleType(x.id, 'name', e.target.value)} />
              <Input mono suffix={t('units.shuttle')} value={String(x.perTube)} disabled={!canEdit}
                onChange={(e) => a.setShuttleType(x.id, 'perTube', e.target.value)} />
              <Input mono suffix={t('units.dong')} value={String(x.pricePerTube || 0)} disabled={!canEdit}
                onChange={(e) => a.setShuttleType(x.id, 'pricePerTube', e.target.value)} />
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

/* ---------------- Nhóm cố định ---------------- */

function Groups({ canEdit }) {
  const { db, a } = useApp()
  const noCourt = db.courts.length === 0
  return (
    <Card title={t('settings.groupsTitle')} subtitle={t('settings.groupsSub')} icon="users" padding="14px 16px"
      actions={canEdit && (
        <Button variant="secondary" size="sm" icon="plus" disabled={noCourt}
          onClick={() => a.openDialog('newGroup', groupForm(db))}>{t('settings.addGroup')}</Button>
      )}>
      {db.groups.length === 0
        ? <Empty icon="users" title={t('settings.noGroup')}
            hint={noCourt ? t('settings.noCourtFirst') : t('settings.noGroupHint')} />
        : <div style={{ display: 'grid', gap: 14 }}>
            {db.groups.map((g) => (
              <div key={g.id} style={S.groupBox}>
                <div style={S.groupRow}>
                  <Input label={t('settings.fGroupName')} value={g.name} disabled={!canEdit}
                    onChange={(e) => a.setGroupField(g.id, 'name', e.target.value)} />
                  <Input label={t('settings.fGroupShort')} value={g.short || ''} disabled={!canEdit}
                    onChange={(e) => a.setGroupField(g.id, 'short', e.target.value)} />
                  <Select label={t('settings.fGroupWeekday')} value={String(g.weekday)} disabled={!canEdit}
                    options={WD.map((w, i) => ({ value: String(i), label: w }))}
                    onChange={(e) => a.setGroupField(g.id, 'weekday', e.target.value)} />
                  <Input label={t('settings.fGroupFrom')} mono value={g.from} disabled={!canEdit}
                    onChange={(e) => a.setGroupField(g.id, 'from', e.target.value)} />
                  <Input label={t('settings.fGroupTo')} mono value={g.to} disabled={!canEdit}
                    onChange={(e) => a.setGroupField(g.id, 'to', e.target.value)} />
                </div>
                <div style={S.groupRow}>
                  <Input label={t('settings.colFeeMale')} mono suffix={t('units.dong')} value={String(g.feeNam)}
                    disabled={!canEdit} onChange={(e) => a.setGroupField(g.id, 'feeNam', e.target.value)} />
                  <Input label={t('settings.colFeeFemale')} mono suffix={t('units.dong')} value={String(g.feeNu)}
                    disabled={!canEdit} onChange={(e) => a.setGroupField(g.id, 'feeNu', e.target.value)} />
                  <Input label={t('settings.colQuota')} mono suffix={t('units.shuttle')} value={String(g.quota)}
                    disabled={!canEdit} onChange={(e) => a.setGroupField(g.id, 'quota', e.target.value)} />
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  <Overline>{t('settings.fGroupCourts')}</Overline>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {db.courts.map((c) => (
                      <button key={c.id} type="button" disabled={!canEdit}
                        onClick={() => a.toggleGroupCourt(g.id, c.id)}
                        style={{ ...S.pick, ...((g.courtIds || []).indexOf(c.id) >= 0 ? S.pickOn : null) }}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>}
    </Card>
  )
}

/* ---------------- Tài khoản & quyền ---------------- */

function Access({ canEdit, pending }) {
  const { db, ui, a } = useApp()
  const lm = { code: true, invite: true, phone: true, ...db.club.linkModes }
  const digits = (x) => (x || '').replace(/\D/g, '')

  /** Tài khoản có SĐT trùng và CHƯA gắn vào CLB này — chỉ gợi ý, không tự ghép. */
  const suggestFor = (m) => {
    if (!lm.phone || m.userId || !digits(m.phone)) return null
    return db.users.find((u) => digits(u.phone) === digits(m.phone) && !db.members.some((x) => x.userId === u.id)) || null
  }
  const inviteOf = (mid) =>
    (db.invites || []).filter((i) => i.clubId === db.clubId && i.memberId === mid).slice(-1)[0] || null

  const unlinked = db.members.filter((m) => !m.userId && m.active !== false)
  const linkedCount = db.members.filter((m) => m.userId).length

  return (
    <>
      <Card title={t('settings.joinTitle')} subtitle={t('settings.joinSub')} icon="user-round-plus" padding="14px">
        {pending.length === 0
          ? <Empty icon="circle-check" title={t('settings.joinEmpty')}
              hint={t('settings.joinEmptyHint', { code: db.club.code })} />
          : <div style={{ display: 'grid', gap: 12 }}>
              {pending.map((r) => {
                const u = db.users.find((x) => x.id === r.userId) || {}
                const pick = ui.form['join_' + r.id] || ''
                return (
                  <div key={r.id} style={{ display: 'grid', gap: 9, padding: '11px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={u.name || ''} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.label}>{u.name}</div>
                        <Mono color="var(--text-muted)">
                          {t('settings.joinMeta', { phone: u.phone, code: r.code, date: ddmy(r.at) })}
                        </Mono>
                        {r.note && <div style={S.caption}>{r.note}</div>}
                      </div>
                    </div>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Select size="sm" style={{ width: 240 }} value={pick}
                          options={[{ value: '', label: t('settings.joinPickMember') }].concat(
                            unlinked.map((m) => ({ value: m.id, label: m.name + ' · ' + (m.phone || '') }))
                          )}
                          onChange={(e) => a.setF('join_' + r.id, e.target.value)} />
                        <Button variant="primary" size="sm" icon="link"
                          onClick={() => a.approveJoin(r.id, pick)}>{t('settings.joinLink')}</Button>
                        <Button variant="secondary" size="sm" icon="user-round-plus"
                          onClick={() => a.approveJoin(r.id, null)}>{t('settings.joinCreate')}</Button>
                        <Button variant="ghost" size="sm" icon="circle-x"
                          onClick={() => a.rejectJoin(r.id)}>{t('settings.joinReject')}</Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>}
      </Card>

      <div style={{ ...GRID_PAIR, gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))' }}>
        <Card title={t('settings.linkModesTitle')} subtitle={t('settings.linkModesSub')} icon="settings-2" padding="14px 16px">
          <div style={{ display: 'grid', gap: 14 }}>
            <Toggle label={t('settings.modeCode')} note={t('settings.modeCodeNote', { code: db.club.code })}
              checked={lm.code} disabled={!canEdit} onChange={() => a.toggleLinkMode('code')} />
            <Toggle label={t('settings.modeInvite')} note={t('settings.modeInviteNote')}
              checked={lm.invite} disabled={!canEdit} onChange={() => a.toggleLinkMode('invite')} />
            <Toggle label={t('settings.modePhone')} note={t('settings.modePhoneNote')}
              checked={lm.phone} disabled={!canEdit} onChange={() => a.toggleLinkMode('phone')} />
          </div>
        </Card>

        <Card title={t('settings.rolesTitle')} subtitle={t('settings.rolesSub')} icon="shield" padding="14px 16px">
          <div style={{ display: 'grid', gap: 9 }}>
            {ROLES.map((r) => (
              <div key={r.value} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ ...S.rolePill, width: 92 }}>{r.label}</span>
                <span style={{ ...S.caption, flex: 1 }}>{roleDesc(r.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card
        title={t('settings.membersTitle')}
        subtitle={t('settings.membersSub', { linked: linkedCount, total: db.members.length })}
        icon="users"
        padding="0"
      >
        <div style={{ display: 'grid', overflowX: 'auto' }}>
          <div style={{ ...S.accGrid, ...S.accHead }}>
            <span>{t('settings.colMember')}</span>
            <span>{t('settings.colPhone')}</span>
            <span>{t('settings.colAccount')}</span>
            <span>{t('settings.colRole')}</span>
            <span>{t('settings.colTodo')}</span>
          </div>
          {db.members.filter((m) => m.active !== false).map((m) => {
            const user = m.userId && db.users.find((u) => u.id === m.userId)
            const inv = inviteOf(m.id)
            const sug = suggestFor(m)
            return (
              <div key={m.id} style={{ ...S.accGrid, ...S.accRow }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Avatar name={m.name} size={26} />
                  <span style={S.label}>{m.name}</span>
                </div>
                <Mono color="var(--text-muted)">{m.phone || t('common.unknown')}</Mono>
                <span>
                  {user
                    ? <span style={{ ...S.pill, background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)' }}>
                        {t('settings.accLinked', { name: user.nick || user.name })}
                      </span>
                    : inv && lm.invite
                      ? <span style={{ ...S.pill, background: 'var(--status-scheduled-bg)', color: 'var(--status-scheduled-fg)' }}>
                          {t('settings.accInvited', { date: dd(inv.at) })}
                        </span>
                      : <span style={{ ...S.pill, background: 'var(--status-idle-bg)', color: 'var(--status-idle-fg)' }}>
                          {t('settings.accNone')}
                        </span>}
                </span>
                <Select size="sm" value={m.role} disabled={!canEdit}
                  options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
                  onChange={(e) => a.setMemberRole(m.id, e.target.value)} />
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  {sug && (
                    <>
                      <span style={{ font: 'var(--type-caption)', color: 'var(--status-delayed)' }}>
                        {t('settings.suggestPhone', { name: sug.nick || sug.name })}
                      </span>
                      {canEdit && (
                        <Button variant="primary" size="sm" icon="link"
                          onClick={() => a.linkMemberUser(m.id, sug.id)}>{t('settings.doLink')}</Button>
                      )}
                    </>
                  )}
                  {canEdit && !user && lm.invite && !sug && (
                    <Button variant="secondary" size="sm" icon="send"
                      onClick={() => a.sendInvite(m.id)}>{t('settings.doInvite')}</Button>
                  )}
                  {canEdit && user && (
                    <Button variant="ghost" size="sm" icon="unlink"
                      onClick={() => a.unlinkMember(m.id)}>{t('settings.doUnlink')}</Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </>
  )
}

const S = {
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  headRow: {
    font: 'var(--type-overline)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
    color: 'var(--text-muted)', paddingBottom: 2,
  },
  codeBox: {
    padding: '9px 12px', borderRadius: 8, background: 'var(--surface-brand-soft)',
    border: '1px solid var(--border-subtle)', width: 'fit-content', letterSpacing: '.12em',
  },
  priceGrid: { display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 10, alignItems: 'center' },
  courtGrid: { display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1fr 70px', gap: 10, alignItems: 'center' },
  groupBox: { display: 'grid', gap: 8, padding: '11px 13px', borderRadius: 8, background: 'var(--surface-inset)' },
  groupRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 },
  pick: {
    padding: '7px 12px', borderRadius: 99, border: '1px solid var(--border-subtle)',
    background: 'var(--surface-card)', color: 'var(--text-primary)',
    font: '600 12px/1 var(--font-sans)', cursor: 'pointer',
  },
  pickOn: { borderColor: 'var(--teal-500)', background: 'var(--surface-accent-soft)' },
  typeGrid: { display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr', gap: 10, alignItems: 'center' },
  rolePill: {
    font: '600 10px/1 var(--font-sans)', padding: '6px 9px', borderRadius: 99, whiteSpace: 'nowrap',
    background: 'var(--surface-brand-soft)', color: 'var(--navy-700)', textAlign: 'center',
  },
  pill: {
    font: '600 10px/1 var(--font-sans)', padding: '5px 9px', borderRadius: 99, whiteSpace: 'nowrap',
    display: 'inline-block',
  },
  accGrid: { display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.3fr 150px 1.4fr', gap: 10, minWidth: 940 },
  accHead: {
    padding: '10px 18px', background: 'var(--surface-inset)', borderBottom: '1px solid var(--border-subtle)',
    font: 'var(--type-overline)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
    color: 'var(--text-muted)',
  },
  accRow: { padding: '11px 18px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' },
}
