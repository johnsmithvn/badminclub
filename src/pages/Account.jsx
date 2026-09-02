// Hồ sơ TÀI KHOẢN — bảng `profiles`. Nằm NGOÀI CLB (cùng tầng với màn "CLB của tôi"): một tài
// khoản dùng cho mọi CLB, nên sửa nó không được bắt phải vào một CLB nào trước.
//
// Ranh giới của màn này, đừng xoá dòng nào:
//   · Chỉ ghi `profiles`. KHÔNG đụng `club_members` của bất kỳ CLB nào — hồ sơ trong mỗi CLB là
//     BẢN SAO độc lập, sửa ở màn Hồ sơ trong CLB (`Profile.jsx`: tên thì tự đổi, trình độ và SĐT
//     thì xin qua `member_changes`). Đổi tên ở đây mà lan sang CLB là sửa lại tên trên mọi bảng
//     điểm danh và mọi dòng tiền cũ của người đó.
//   · `email` chỉ hiện để đối chiếu, KHÔNG đổi được: nó là tên đăng nhập và là danh tính bên
//     Supabase Auth, đổi phải qua luồng xác nhận thư riêng. Chưa làm, không giả vờ.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Button, Card, Icon, Input, Select, Skeleton } from '#ds'
import { Mono } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { genderTxt } from '#lib/money.js'
import { ddmy } from '#utils/dates.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

const formOf = (p) => ({
  name: p.name || '',
  nick: p.nick || '',
  phone: p.phone || '',
  gender: p.gender || cfg.genders[0],
  level: p.level || '',
})

export default function Account() {
  const { profile, updateProfile } = useAuth()
  const { toast } = useApp()
  const navigate = useNavigate()

  // Nạp giá trị ban đầu MỘT lần cho mỗi tài khoản, không dùng effect: sau khi lưu, `refresh()`
  // trả về profile mới với cùng id nên form giữ nguyên cái người dùng vừa gõ, không nhảy chữ.
  const [loadedFor, setLoadedFor] = useState(null)
  const [form, setForm] = useState(formOf({}))
  const [saving, setSaving] = useState(false)
  if (profile && loadedFor !== profile.id) {
    setLoadedFor(profile.id)
    setForm(formOf(profile))
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.name.trim()) return toast(t('account.errName'))
    setSaving(true)
    try {
      await updateProfile({
        name: form.name.trim(),
        nick: form.nick.trim() || null,
        // Rỗng → NULL chứ không phải chuỗi rỗng: cột UNIQUE, hai tài khoản cùng để trống mà lưu
        // '' là người thứ hai đâm vào ràng buộc và không hiểu vì sao.
        phone: form.phone.trim() || null,
        gender: form.gender,
        level: form.level || null,
      })
      toast(t('account.saved'))
    } catch (e) {
      toast(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.topbar}>
        <Button variant="ghost" size="sm" icon="chevron-left" onClick={() => navigate('/clb')}>
          {t('account.back')}
        </Button>
        <div style={{ flex: 1 }} />
      </div>

      <div style={S.wrap}>
        <div>
          <h1 style={S.title}>{t('account.title')}</h1>
          <span style={S.sub}>{t('account.sub')}</span>
        </div>

        {!profile ? <Skeleton height={280} /> : (
          <Card title={t('account.formTitle')} subtitle={t('account.formSub')} icon="user-round" padding="18px">
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={S.idRow}>
                <Avatar name={form.nick || form.name || profile.name} size={48} />
                <div style={{ minWidth: 0, display: 'grid', gap: 3 }}>
                  {/* Email LÀ tên đăng nhập (0010) — `username` vẫn còn dưới DB cho tài khoản
                      cũ đăng nhập, nhưng không còn là thứ người dùng phải nhớ nên không hiện. */}
                  <Mono>{profile.email}</Mono>
                  {profile.created_at && (
                    <span style={S.caption}>
                      {t('profile.since', { date: ddmy(String(profile.created_at).slice(0, 10)) })}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1 }} />
                <span style={S.roPill}>
                  <Icon name="lock" size={12} /> {t('account.readonly')}
                </span>
              </div>

              <Input label={t('auth.fName')} value={form.name} onChange={set('name')} />
              <Input label={t('auth.fNick')} value={form.nick} onChange={set('nick')} />

              <div style={{ display: 'grid', gap: 5 }}>
                <Input label={t('auth.fPhone')} mono value={form.phone} onChange={set('phone')} />
                <span style={S.caption}>{t('account.phoneNote')}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                <Select label={t('auth.fGender')} value={form.gender} onChange={set('gender')}
                  options={cfg.genders.map((g) => ({ value: g, label: genderTxt(g) }))} />
                {/* Thang trình độ của TỪNG CLB nằm ở `clubs.levels`, ngoài CLB không có thang nào
                    để chọn — dùng danh sách khởi tạo trong config, đúng như màn đăng ký. */}
                <Select label={t('auth.fLevel')} value={form.level} onChange={set('level')}
                  options={[{ value: '', label: t('account.levelNone') }]
                    .concat(cfg.levelsDefault.map((l) => ({ value: l, label: l })))} />
              </div>
              <span style={S.caption}>{t('account.levelNote')}</span>

              <div style={S.note}>
                <Icon name="info" size={14} />
                <span>{t('account.clubNote')}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" icon="circle-check" disabled={saving} onClick={save}>
                  {saving ? t('account.saving') : t('common.save')}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

const S = {
  page: { minHeight: '100vh', background: 'var(--surface-page)', font: 'var(--type-body)', color: 'var(--text-primary)' },
  topbar: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 22px', flexWrap: 'wrap',
    background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)',
  },
  wrap: { maxWidth: 720, margin: '0 auto', padding: '28px 22px 60px', display: 'grid', gap: 18 },
  title: { font: 'var(--type-h1)', margin: 0, color: 'var(--text-primary)' },
  sub: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  idRow: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)',
  },
  roPill: {
    display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
    font: '600 10px/1 var(--font-sans)', padding: '5px 9px', borderRadius: 99,
    background: 'var(--status-idle-bg)', color: 'var(--status-idle-fg)',
  },
  note: {
    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', borderRadius: 8,
    background: 'var(--surface-brand-soft)', color: 'var(--navy-700)', font: 'var(--type-caption)',
  },
}
