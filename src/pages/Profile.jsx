// Trang cá nhân: tài khoản dùng cho mọi CLB + danh sách CLB đang tham gia (handoff 02 §6).

import { Avatar, Card } from '#ds'
import { Empty, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { ddmy } from '#utils/dates.js'
import { genderTxt } from '#lib/money.js'
import { roleName } from '#lib/roles.js'
import { t } from '#i18n'

export default function Profile() {
  const { db } = useApp()
  // Tài khoản và danh sách CLB là dữ liệu XUYÊN CLB → lấy từ AuthContext (RPC my_clubs),
  // không lấy từ db (db chỉ chứa một CLB).
  const { profile, clubs: myClubs, setActiveClub } = useAuth()
  const me = profile

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 16, alignItems: 'start' }}>
      <Card title={t('profile.accountTitle')} subtitle={t('profile.accountSub')} icon="user-round" padding="18px">
        {!me
          ? <Empty icon="user-round" title={t('common.notYet')} />
          : <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={me.name} size={52} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: 'var(--type-h3)', color: 'var(--text-primary)' }}>{me.name}</div>
                  <Mono color="var(--text-muted)">{t('profile.since', { date: ddmy(String(me.created_at || '').slice(0, 10)) })}</Mono>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '9px 12px', alignItems: 'center' }}>
                <Overline>{t('profile.fNick')}</Overline>
                <span style={S.value}>{me.nick || t('common.unknown')}</span>
                <Overline>{t('profile.fPhone')}</Overline>
                <Mono color="var(--text-primary)">{me.phone || t('common.unknown')}</Mono>
                <Overline>{t('profile.fGender')}</Overline>
                <span style={S.value}>{genderTxt(me.gender)}</span>
                <Overline>{t('profile.fLevel')}</Overline>
                <span style={S.value}>{me.level || t('common.unknown')}</span>
              </div>
            </div>}
      </Card>

      <Card title={t('profile.clubsTitle')} subtitle={t('profile.clubsSub')} icon="building-2" padding="14px">
        {myClubs.length === 0
          ? <Empty icon="building-2" title={t('profile.noClub')} hint={t('profile.noClubHint')} />
          : <div style={{ display: 'grid', gap: 8 }}>
              {myClubs.map((c) => {
                const here = c.id === db.clubId
                return (
                  <button key={c.id} type="button" onClick={() => setActiveClub(c.id)} style={{
                    ...S.clubRow,
                    borderColor: here ? 'var(--navy-700)' : 'var(--border-subtle)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={S.value}>{c.name}</div>
                      <Mono color="var(--text-muted)">
                        {t('profile.clubMeta', { code: c.code, n: c.member_count })}
                      </Mono>
                    </div>
                    <span style={S.rolePill}>{roleName(c.role)}</span>
                    {here && (
                      <span style={{ font: 'var(--type-caption)', color: 'var(--status-delivered)' }}>
                        {t('profile.viewing')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>}
      </Card>
    </div>
  )
}

const S = {
  value: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  clubRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
    border: '1px solid', background: 'var(--surface-card)', cursor: 'pointer', font: 'inherit',
  },
  rolePill: {
    font: '600 10px/1 var(--font-sans)', padding: '5px 9px', borderRadius: 99, whiteSpace: 'nowrap',
    background: 'var(--surface-brand-soft)', color: 'var(--navy-700)',
  },
}
