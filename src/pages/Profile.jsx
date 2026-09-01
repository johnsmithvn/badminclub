// Trang cá nhân: chỉnh sửa thông tin cá nhân trực tiếp + thông tin thành viên trong CLB + danh sách CLB.

import { useState, useEffect } from 'react'
import { Avatar, Button, Card, Input, Select } from '#ds'
import { Empty, LevelChip, Mono, Overline } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { supabase } from '#supabase'
import { ddmy } from '#utils/dates.js'
import { roleName } from '#lib/roles.js'
import { t } from '#i18n'

export default function Profile() {
  const { db, a } = useApp()
  const { profile, clubs: myClubs, setActiveClub, refresh } = useAuth()

  // Tìm bản ghi thành viên của tài khoản này trong CLB hiện tại
  const currentMember = (db.members || []).find((m) => m.userId === db.currentUserId)

  // State form chỉnh sửa trực tiếp
  const [form, setForm] = useState({
    name: '',
    nick: '',
    phone: '',
    gender: 'nam',
    level: 'TB',
  })
  const [saving, setSaving] = useState(false)

  // Đồng bộ dữ liệu ban đầu
  useEffect(() => {
    if (profile) {
      setForm({
        name: (currentMember && currentMember.name) || profile.name || '',
        nick: profile.nick || '',
        phone: (currentMember && currentMember.phone) || profile.phone || '',
        gender: (currentMember && currentMember.gender) || profile.gender || 'nam',
        level: (currentMember && currentMember.level) || profile.level || (db.levels && db.levels[0]) || 'TB',
      })
    }
  }, [profile, currentMember, db.levels])

  const handleSave = async (e) => {
    if (e) e.preventDefault()
    if (!form.name.trim()) return a.toast('Vui lòng nhập họ và tên')
    setSaving(true)

    try {
      // 1. Cập nhật bảng profiles trong Supabase
      if (supabase && profile?.id) {
        const { error: pErr } = await supabase.from('profiles').update({
          name: form.name.trim(),
          nick: form.nick.trim() || null,
          phone: form.phone.trim() || null,
          gender: form.gender,
          level: form.level,
        }).eq('id', profile.id)
        if (pErr) throw pErr
      }

      // 2. Cập nhật bản ghi club_members của thành viên trong CLB này nếu đã ghép
      if (currentMember) {
        a.up((d) => ({
          members: d.members.map((m) =>
            m.id === currentMember.id
              ? {
                  ...m,
                  name: form.name.trim(),
                  phone: form.phone.trim(),
                  gender: form.gender,
                  level: form.level,
                }
              : m
          ),
        }))

        if (supabase) {
          const { error: mErr } = await supabase.from('club_members').update({
            name: form.name.trim(),
            phone: form.phone.trim(),
            gender: form.gender,
            level: form.level,
          }).eq('id', currentMember.id)
          if (mErr) console.warn('[profile] cập nhật club_members:', mErr.message)
        }
      }

      // 3. Tải lại profile từ Supabase
      if (refresh && profile?.id) {
        await refresh(profile.id)
      }

      a.toast('Đã cập nhật thông tin cá nhân thành công!')
    } catch (err) {
      a.toast(err.message || 'Lỗi khi lưu thông tin')
    } finally {
      setSaving(false)
    }
  }

  // Danh sách các ca cố định thành viên đang tham gia
  const myGroups = currentMember
    ? (db.groups || []).filter((g) => (currentMember.groupIds || []).includes(g.id))
    : []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 16, alignItems: 'start' }}>
      {/* 1. Form chỉnh sửa thông tin cá nhân */}
      <Card title="Hồ sơ cá nhân" subtitle="Chỉnh sửa thông tin tài khoản và hiển thị trong CLB" icon="user-round" padding="18px">
        <form onSubmit={handleSave} style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
            <Avatar name={form.name || profile?.name || 'U'} size={52} />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: 'var(--type-h3)', color: 'var(--text-primary)' }}>{form.name || 'Người dùng'}</div>
              <Mono color="var(--text-muted)">
                {profile?.created_at ? ddmy(String(profile.created_at).slice(0, 10)) : 'Tài khoản thành viên'}
              </Mono>
            </div>
          </div>

          <Input
            label="Họ và tên"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nhập họ và tên..."
          />

          <Input
            label="Biệt danh / Tên gọi thường dùng"
            value={form.nick}
            onChange={(e) => setForm({ ...form, nick: e.target.value })}
            placeholder="Ví dụ: Thắng Còi, Mai Anh..."
          />

          <Input
            label="Số điện thoại"
            mono
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Nhập số điện thoại..."
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Select
              label="Giới tính"
              value={form.gender}
              options={[
                { value: 'nam', label: 'Nam' },
                { value: 'nu', label: 'Nữ' },
              ]}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            />

            <Select
              label="Trình độ"
              value={form.level}
              options={(db.levels || ['Y', 'TB-', 'TB', 'TB+', 'K']).map((l) => ({ value: l, label: l }))}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <Button variant="primary" type="submit" icon="circle-check" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </Card>

      {/* 2. Thông tin trong CLB hiện tại */}
      <Card title="Vai trò & Tham gia trong CLB" subtitle={db.club.name} icon="shield" padding="16px 18px">
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-sunken)', borderRadius: 8 }}>
            <span style={{ font: 'var(--type-label)', fontWeight: 600 }}>Vai trò của bạn</span>
            <span style={S.rolePill}>{roleName(currentMember?.role || db.myRole || 'member')}</span>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Tình trạng liên kết bản ghi thành viên:</div>
            {currentMember ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--type-label)', color: 'var(--status-delivered)' }}>
                <span>✓ Đã liên kết với thành viên <b>{currentMember.name}</b></span>
              </div>
            ) : (
              <div style={{ font: 'var(--type-caption)', color: 'var(--status-delayed)' }}>
                ⚠️ Tài khoản chưa được ghép vào bản ghi thành viên nào trong CLB này. Vui lòng liên hệ Chủ CLB để ghép bản ghi.
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Các ca cố định tham gia:</div>
            {myGroups.length === 0 ? (
              <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Chưa cố định ca nào (đang đi lẻ)</div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {myGroups.map((g) => (
                  <span key={g.id} style={{
                    font: '600 11px var(--font-sans)', padding: '3px 8px', borderRadius: 6,
                    background: 'var(--teal-50)', color: 'var(--teal-700)',
                  }}>
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 3. Danh sách CLB đang tham gia */}
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
