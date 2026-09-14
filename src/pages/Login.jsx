// Đăng nhập bằng email HOẶC tên đăng nhập HOẶC số điện thoại + mật khẩu.
// Không OTP, không xác thực email (config.toml: enable_confirmations = false).
// Lottie avatar tương tác: dõi theo khi nhập username, che mắt khi nhập password.

import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button } from '#ds'
import AuthLayout from '#components/layout/AuthLayout.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { t } from '#i18n'
import LottieLoginAvatar from '#components/auth/LottieLoginAvatar.jsx'
import AuthInput from '#components/auth/AuthInput.jsx'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState({ identifier: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isPanic, setIsPanic] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const lottieRef = useRef(null)
  const isPasswordFocused = useRef(false)
  const identifierWrapperRef = useRef(null) // dùng để focus sau khi Lottie init xong

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
  const handleBlur = (e) => {
    // Nếu focus di chuyển sang element khác TRONG CÙNG wrapper div
    // (vd: password input → checkbox "Hiện") thì không trigger Blinking
    if (e.currentTarget.contains(e.relatedTarget)) return
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

  // Focus input sau khi Lottie kịp init (~400ms) để onFocus bubble đúng cách
  // identifierWrapperRef giờ trỏ thẳng tới <input> element qua inputRef prop của AuthInput
  useEffect(() => {
    const timer = setTimeout(() => {
      identifierWrapperRef.current?.focus()
    }, 400)
    return () => clearTimeout(timer)
  }, [])


  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!f.identifier.trim() || !f.password) return setErr(t('auth.errRequired'))
    setBusy(true)
    try {
      await signIn(f)
      // Hiện animation thành công trước khi navigate
      setIsSuccess(true)
      setTimeout(() => navigate('/clb', { replace: true }), 700)
    } catch (ex) {
      setErr(ex.message === 'Invalid login credentials' ? t('auth.errWrong') : ex.message)
      // Avatar rung lắc hoảng loạn khi sai tài khoản/mật khẩu
      setIsPanic(true)
      setTimeout(() => setIsPanic(false), 820)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      animated
      footer={<Link to="/dang-ky" style={{ color: '#fff' }}>{t('auth.toRegister')}</Link>}
      avatar={<LottieLoginAvatar lottieRef={lottieRef} isPanic={isPanic} isSuccess={isSuccess} isBusy={busy} />}
    >
      <form onSubmit={submit} style={{ display: 'grid', gap: 18 }}>
        {/* Identifier — wrapper div bắt focus bubble cho Lottie */}
        <div onFocus={handleIdentifierFocus} onBlur={handleBlur}>
          <AuthInput
            label={t('auth.fIdentifier')}
            value={f.identifier}
            onChange={set('identifier')}
            autoComplete="username"
            inputRef={identifierWrapperRef}
          />
        </div>

        {/* Password — checkbox "Hiện mật khẩu" nằm trong rightSlot cùng hàng label */}
        <div onFocus={handlePasswordFocus} onBlur={handleBlur}>
          <AuthInput
            label={t('auth.fPassword')}
            type={showPassword ? 'text' : 'password'}
            value={f.password}
            onChange={set('password')}
            autoComplete="current-password"
            rightSlot={
              <label style={S.showLabel}>
                <input
                  type="checkbox"
                  checked={showPassword}
                  onMouseDown={(e) => e.preventDefault()}
                  onChange={() => setShowPassword((v) => !v)}
                  style={{ cursor: 'pointer' }}
                />
                Hiện
              </label>
            }
          />
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
  showLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    font: 'var(--type-caption)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    userSelect: 'none',
  },
}
