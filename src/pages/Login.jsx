// Đăng nhập bằng email HOẶC tên đăng nhập HOẶC số điện thoại + mật khẩu.
// Không OTP, không xác thực email (config.toml: enable_confirmations = false).
// Lottie avatar tương tác: dõi theo khi nhập username, che mắt khi nhập password.

import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Input } from '#ds'
import AuthLayout from '#components/layout/AuthLayout.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { t } from '#i18n'
import LottieLoginAvatar from '#components/auth/LottieLoginAvatar.jsx'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState({ identifier: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const lottieRef = useRef(null)
  const isPasswordFocused = useRef(false)

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  // Điều khiển animation state
  const switchState = (stateName) => {
    lottieRef.current?.interactivity?.goToState(stateName, { duration: 0.1 })
  }

  const handleIdentifierFocus = () => switchState('Following')
  const handlePasswordFocus = () => {
    isPasswordFocused.current = true
    switchState(showPassword ? 'Peeking' : 'Covering')
  }
  const handleBlur = () => {
    isPasswordFocused.current = false
    switchState('Blinking')
  }

  // Khi toggle show/hide password — chỉ đổi state nếu đang focus vào password field
  useEffect(() => {
    if (isPasswordFocused.current) {
      switchState(showPassword ? 'Peeking' : 'Covering')
    }
  }, [showPassword])

  // Avatar dõi theo độ dài username (0..1)
  useEffect(() => {
    lottieRef.current?.interactivity?.inputs.set(
      'name_length',
      Math.min(f.identifier.length / 32, 1)
    )
  }, [f.identifier])

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
      {/* Avatar Lottie tương tác */}
      <LottieLoginAvatar lottieRef={lottieRef} />

      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        {/* Wrapper div để bắt focus event mà không ghi đè internal handler của Input */}
        <div onFocus={handleIdentifierFocus} onBlur={handleBlur}>
          <Input
            label={t('auth.fIdentifier')}
            value={f.identifier}
            onChange={set('identifier')}
            autoComplete="username"
            autoFocus
          />
        </div>

        {/* Password field với toggle show/hide */}
        <div style={{ position: 'relative' }} onFocus={handlePasswordFocus} onBlur={handleBlur}>
          <Input
            label={t('auth.fPassword')}
            type={showPassword ? 'text' : 'password'}
            value={f.password}
            onChange={set('password')}
            autoComplete="current-password"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()} // giữ focus ở input, không trigger onBlur
            onClick={() => setShowPassword((v) => !v)}
            style={S.eyeBtn}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            tabIndex={-1}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>

        {err && <Alert tone="danger">{err}</Alert>}

        <Button type="submit" variant="primary" size="lg" block icon="arrow-left"
          loading={busy} disabled={busy}>
          {t('auth.doLogin')}
        </Button>
      </form>
    </AuthLayout>
  )
}

const S = {
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    padding: '4px 6px',
    lineHeight: 1,
    // Đẩy xuống dưới label (label cao ~20px + gap)
    marginTop: 10,
  },
}
