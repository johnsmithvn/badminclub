// Hồ sơ TRONG CLB đang xem — bảng `club_members`. Màn này KHÔNG sửa hồ sơ tài khoản
// (`profiles`); cái đó ở `/tai-khoan` (`Account.jsx`), ngoài CLB.
//
// Sửa được gì, không sửa được gì — ranh giới nằm dưới DB, không phải quy ước của client:
//   · TÊN (hiển thị + đầy đủ): tự đổi, không cần duyệt. Policy `cm_update_self_name` + trigger
//     `cm_guard_self_update` (0010) cho đúng hai cột đó, mọi cột khác trigger chặn.
//   · `level` là dữ liệu tính tiền và xếp sân. `money.js: levelOf` suy trình độ của MỌI tháng
//     từ đúng ô `member.level`, nên tự sửa nó là sửa lại cả những buổi đã chốt xong. Đường đúng
//     là xin đổi → `member_changes` → chủ CLB duyệt, và trình độ áp dụng TỪ THÁNG SAU.
//   · `phone` chủ CLB dùng để đối chiếu chuyển khoản và gợi ý ghép tài khoản → cũng phải duyệt.
//   · `role` không nằm trong tầm tay chủ nhân bản ghi, không bao giờ.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Button, Card, Icon, Input, Select } from '#ds'
import { Empty, LevelChip, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { genderTxt, nextLevelStep } from '#lib/money.js'
import { roleName } from '#lib/roles.js'
import { ddmy } from '#utils/dates.js'
import { PUBLIC_PATHS } from '#routes'
import { t } from '#i18n'

export default function Profile() {
  const { db, a } = useApp()
  const { clubs: myClubs, setActiveClub } = useAuth()
  const navigate = useNavigate()

  const me = (db.members || []).find((m) => m.userId === db.currentUserId) || null
  const myGroups = me ? (db.groups || []).filter((g) => (me.groupIds || []).includes(g.id)) : []
  const pending = me ? (db.changes || []).filter((c) => c.status === 'pending' && c.memberId === me.id) : []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 16, alignItems: 'start' }}>
      {/* 1. Bản ghi thành viên trong CLB này */}
      <MeCard me={me} myGroups={myGroups} db={db} a={a} />

      {/* 2. Xin đổi thông tin trong CLB — chủ CLB duyệt */}
      <ChangeCard me={me} pending={pending} db={db} a={a} />

      {/* 3. Hồ sơ tài khoản + danh sách CLB */}
      <Card title={t('profile.accountTitle')} subtitle={t('profile.accountSub')} icon="building-2" padding="14px">
        <div style={{ display: 'grid', gap: 10 }}>
          <Button variant="secondary" icon="user-round-cog" onClick={() => navigate(PUBLIC_PATHS.account)}>
            {t('profile.accountBtn')}
          </Button>
          <span style={S.caption}>{t('profile.accountNote')}</span>

          {myClubs.length === 0
            ? <Empty icon="building-2" title={t('profile.noClub')} hint={t('profile.noClubHint')} />
            : myClubs.map((c) => {
                const here = c.id === db.clubId
                return (
                  <button key={c.id} type="button" onClick={() => setActiveClub(c.id)} style={{
                    ...S.clubRow, borderColor: here ? 'var(--navy-700)' : 'var(--border-subtle)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={S.label}>{c.name}</div>
                      <Mono color="var(--text-muted)">{t('profile.clubMeta', { code: c.code, n: c.member_count })}</Mono>
                    </div>
                    <span style={S.rolePill}>{roleName(c.role)}</span>
                    {here && <span style={{ font: 'var(--type-caption)', color: 'var(--status-delivered)' }}>{t('profile.viewing')}</span>}
                  </button>
                )
              })}
        </div>
      </Card>
    </div>
  )
}

/* ---------------- bản ghi của tôi + đổi tên ---------------- */

/**
 * Hai tên, và chỉ hai tên này là tự sửa được:
 *   · TÊN HIỂN THỊ (`name`) — cái nằm trên bảng điểm danh, bảng chia tiền, báo cáo Zalo;
 *   · TÊN ĐẦY ĐỦ (`full_name`) — chỉ để đối chiếu, hiện nhỏ bên dưới, không thay tên hiển thị
 *     ở bất cứ đâu.
 *
 * `a.renameMe` ghi thẳng DB rồi `reload()` chứ không đi qua đồng bộ ngầm — lý do nằm ở chính
 * action đó (upsert cần policy INSERT mà thành viên thường không có).
 */
function MeCard({ me, myGroups, db, a }) {
  const [loadedFor, setLoadedFor] = useState(null)
  const [name, setName] = useState('')
  const [full, setFull] = useState('')
  const [saving, setSaving] = useState(false)

  // Nạp một lần cho mỗi bản ghi, không dùng effect: `me` là phần tử của `db.members` nên đổi
  // tham chiếu mỗi lần đồng bộ, effect sẽ hất mất chữ đang gõ dở.
  if (me && loadedFor !== me.id) {
    setLoadedFor(me.id)
    setName(me.name)
    setFull(me.fullName || '')
  }

  const dirty = me && (name.trim() !== me.name || full.trim() !== (me.fullName || ''))
  const save = async () => {
    setSaving(true)
    await a.renameMe(name, full)
    setSaving(false)
  }

  return (
    <Card title={t('profile.meTitle')} subtitle={db.club.name} icon="user-round" padding="16px 18px">
      {!me
        ? <Empty icon="unlink" title={t('profile.changeNoMember')} hint={t('profile.changeNoMemberHint')} />
        : <div style={{ display: 'grid', gap: 13 }}>
            <div style={S.idRow}>
              <Avatar name={me.name} size={46} />
              <div style={{ minWidth: 0 }}>
                <div style={S.h3}>{me.name}</div>
                {me.fullName && <div style={S.caption}>{me.fullName}</div>}
                <Mono color="var(--text-muted)">{me.phone || t('common.notYet')}</Mono>
              </div>
              <div style={{ flex: 1 }} />
              <span style={S.rolePill}>{roleName(me.role)}</span>
            </div>

            {me.email && <Row label={t('members.fEmail')}><Mono>{me.email}</Mono></Row>}
            <Row label={t('auth.fGender')}>{genderTxt(me.gender)}</Row>
            <Row label={t('auth.fLevel')}>
              <LevelChip level={me.level} levels={db.levels} />
              {nextLevelStep(me, db.month) && (
                <span style={S.caption}>
                  {t('profile.levelPending', {
                    level: nextLevelStep(me, db.month).level,
                    month: nextLevelStep(me, db.month).from,
                  })}
                </span>
              )}
            </Row>
            <Row label={t('profile.fJoined')}><Mono>{ddmy(me.joined)}</Mono></Row>
            <Row label={t('profile.fGroups')}>
              {myGroups.length === 0
                ? <span style={S.caption}>{t('profile.groupsNone')}</span>
                : myGroups.map((g) => <span key={g.id} style={S.groupPill}>{g.name}</span>)}
            </Row>

            <div style={{ display: 'grid', gap: 9, paddingTop: 11, borderTop: '1px solid var(--border-subtle)' }}>
              <Overline>{t('profile.renameTitle')}</Overline>
              <Input label={t('profile.fDisplayName')} hint={t('profile.fDisplayNameHint')}
                value={name} onChange={(e) => setName(e.target.value)} />
              <Input label={t('members.fFull')} hint={t('members.fFullHint')}
                value={full} onChange={(e) => setFull(e.target.value)} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm" icon="circle-check"
                  disabled={saving || !dirty || !name.trim()} onClick={save}>
                  {saving ? t('account.saving') : t('common.save')}
                </Button>
              </div>
            </div>

            <div style={S.note}>
              <Icon name="info" size={14} />
              <span>{t('profile.snapshotNote')}</span>
            </div>
          </div>}
    </Card>
  )
}

/* ---------------- xin đổi thông tin ---------------- */

/**
 * Hai trường thôi, đúng bộ mà `appActions.requestChange` + `approveChange` xử lý được:
 * SĐT (duyệt xong áp dụng ngay) và trình độ (áp dụng từ tháng sau). Thêm ô ở đây mà không thêm
 * nhánh ở `approveChange` thì yêu cầu gửi đi rồi duyệt xong không có gì đổi.
 */
function ChangeCard({ me, pending, db, a }) {
  const [level, setLevel] = useState('')
  const [phone, setPhone] = useState('')

  if (!me) return null

  return (
    <Card title={t('profile.changeTitle')} subtitle={t('profile.changeSub')} icon="settings-2" padding="16px 18px">
      <div style={{ display: 'grid', gap: 13 }}>
        {pending.length > 0 && (
          <div style={S.pendingBox}>
            {pending.map((c) => (
              <div key={c.id}>
                {t('profile.changePending', { field: t('members.changeField.' + c.field), to: c.to })}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gap: 6 }}>
          <Select label={t('profile.changeLevel')} value={level} onChange={(e) => setLevel(e.target.value)}
            options={[{ value: '', label: t('profile.changePick') }]
              .concat((db.levels || []).map((l) => ({ value: l, label: l })))} />
          <Button variant="secondary" size="sm" icon="send" disabled={!level}
            onClick={() => { a.requestChange('level', level); setLevel('') }}>
            {t('profile.changeSend')}
          </Button>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <Input label={t('profile.changePhone')} mono value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button variant="secondary" size="sm" icon="send" disabled={!phone.trim()}
            onClick={() => { a.requestChange('phone', phone); setPhone('') }}>
            {t('profile.changeSend')}
          </Button>
        </div>

        <span style={S.caption}>{t('profile.changeNote')}</span>
      </div>
    </Card>
  )
}

const Row = ({ label, children }) => (
  <div style={S.row}>
    <span style={S.rowLabel}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{children}</div>
  </div>
)

const S = {
  h3: { font: 'var(--type-h3)', color: 'var(--text-primary)' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  idRow: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)',
  },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  rowLabel: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  rolePill: {
    font: '600 10px/1 var(--font-sans)', padding: '5px 9px', borderRadius: 99, whiteSpace: 'nowrap',
    background: 'var(--surface-brand-soft)', color: 'var(--navy-700)',
  },
  groupPill: {
    font: '600 11px/1 var(--font-sans)', padding: '4px 8px', borderRadius: 6,
    background: 'var(--surface-accent-soft)', color: 'var(--teal-700)',
  },
  clubRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
    border: '1px solid', background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit',
  },
  note: {
    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', borderRadius: 8,
    background: 'var(--surface-brand-soft)', color: 'var(--navy-700)', font: 'var(--type-caption)',
  },
  pendingBox: {
    display: 'grid', gap: 4, padding: '9px 11px', borderRadius: 8,
    background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)', font: 'var(--type-caption)',
  },
}
