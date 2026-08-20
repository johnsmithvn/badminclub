// Đăng nhập bằng email HOẶC tên đăng nhập HOẶC số điện thoại + mật khẩu.
// Không OTP, không xác thực email (config.toml: enable_confirmations = false).

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Input } from '#ds'
import AuthLayout from '#components/layout/AuthLayout.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { t } from '#i18n'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState({ identifier: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!f.identifier.trim() || !f.password) return setErr(t('auth.errRequired'))
    setBusy(true)
    try {
      await signIn(f)
      navigate('/clb', { replace: true })
    } catch (ex) {
      setErr(ex.message === 'Invalid login credentials' ? t('auth.errWrong') : ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.loginTitle')}
      sub={t('auth.loginSub')}
      footer={<Link to="/dang-ky" style={{ color: '#fff' }}>{t('auth.toRegister')}</Link>}
    >
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <Input label={t('auth.fIdentifier')} value={f.identifier} onChange={set('identifier')}
          autoComplete="username" autoFocus />
        <Input label={t('auth.fPassword')} type="password" value={f.password} onChange={set('password')}
          autoComplete="current-password" />

        {err && <Alert tone="critical">{err}</Alert>}

        <Button type="submit" variant="primary" size="lg" block icon="arrow-left"
          loading={busy} disabled={busy}>
          {t('auth.doLogin')}
        </Button>
      </form>
    </AuthLayout>
  )
}
