// Đăng ký: email + tên đăng nhập + mật khẩu BẮT BUỘC; SĐT không bắt buộc.
// Không gửi email xác thực, không OTP — tạo xong là vào được luôn.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Input, Select } from '#ds'
import AuthLayout from '#components/layout/AuthLayout.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { hasSupabase } from '#supabase'
import { genderTxt } from '#lib/money.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

const EMPTY = {
  email: '', username: '', password: '', password2: '',
  name: '', phone: '', gender: 'nam', level: cfg.levelsDefault[1],
}

export default function Register() {
  const { signUp, usernameAvailable } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState(EMPTY)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [uname, setUname] = useState(null) // null chưa kiểm · true trống · false đã có
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const checkUsername = async () => {
    setUname(null)
    const v = f.username.trim()
    if (v.length < 3) return
    try {
      setUname(await usernameAvailable(v))
    } catch { /* không kiểm được thì thôi, submit sẽ báo */ }
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!f.email.trim() || !f.username.trim() || !f.password) return setErr(t('auth.errRequired'))
    if (f.password.length < 6) return setErr(t('auth.errPasswordShort'))
    if (f.password !== f.password2) return setErr(t('auth.errPasswordMismatch'))

    setBusy(true)
    try {
      await signUp(f)
      navigate('/clb', { replace: true })
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.registerTitle')}
      sub={t('auth.registerSub')}
      footer={<Link to="/dang-nhap" style={{ color: '#fff' }}>{t('auth.toLogin')}</Link>}
    >
      {!hasSupabase && (
        <div style={{ marginBottom: 14 }}>
          <Alert tone="warning" title={t('auth.noDbTitle')}>{t('auth.noDbHint')}</Alert>
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'grid', gap: 13 }}>
        <Input label={t('auth.fEmail')} type="email" value={f.email} onChange={set('email')}
          autoComplete="email" autoFocus />

        <div style={{ display: 'grid', gap: 4 }}>
          <Input label={t('auth.fUsername')} value={f.username} onChange={set('username')}
            onBlur={checkUsername} autoComplete="username" hint={t('auth.usernameRule')} />
          {uname === true && (
            <span style={{ font: 'var(--type-caption)', color: 'var(--status-delivered)' }}>
              {t('auth.usernameFree')}
            </span>
          )}
          {uname === false && (
            <span style={{ font: 'var(--type-caption)', color: 'var(--status-incident)' }}>
              {t('auth.usernameTaken')}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Input label={t('auth.fPassword')} type="password" value={f.password} onChange={set('password')}
            autoComplete="new-password" />
          <Input label={t('auth.fPassword2')} type="password" value={f.password2} onChange={set('password2')}
            autoComplete="new-password" />
        </div>

        <div style={S.divider}>{t('auth.optional')}</div>

        <Input label={t('auth.fName')} value={f.name} onChange={set('name')} autoComplete="name" />
        <Input label={t('auth.fPhone')} mono value={f.phone} onChange={set('phone')}
          autoComplete="tel" hint={t('auth.fPhoneOptional')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Select label={t('auth.fGender')} value={f.gender} onChange={set('gender')}
            options={cfg.genders.map((g) => ({ value: g, label: genderTxt(g) }))} />
          <Select label={t('auth.fLevel')} value={f.level} onChange={set('level')}
            options={cfg.levelsDefault.map((l) => ({ value: l, label: l }))} />
        </div>

        {err && <Alert tone="critical">{err}</Alert>}

        <Button type="submit" variant="primary" size="lg" block icon="user-round-plus"
          loading={busy} disabled={busy || !hasSupabase}>
          {t('auth.doRegister')}
        </Button>
      </form>
    </AuthLayout>
  )
}

const S = {
  divider: {
    display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0',
    font: 'var(--type-overline)', textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-caps)', color: 'var(--text-muted)',
  },
}
