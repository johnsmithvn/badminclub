// Input dành riêng cho trang auth (Login/Register).
// Unfocused: chỉ gạch chân — gọn, không chiếm không gian.
// Focused: full box với border xuất hiện mượt qua transition.
// rightSlot: dùng để đặt checkbox "Hiện mật khẩu" cùng hàng với label.

import { useState } from 'react'

export default function AuthInput({
  label,
  rightSlot,
  type = 'text',
  value,
  onChange,
  autoComplete,
  inputRef,
}) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={S.wrapper}>
      {(label || rightSlot) && (
        <div style={S.labelRow}>
          {label && <label style={S.label}>{label}</label>}
          {rightSlot}
        </div>
      )}
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={focused ? { ...S.input, ...S.inputFocused } : S.input}
      />
    </div>
  )
}

const S = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    font: 'var(--type-label)',
    color: 'var(--text-secondary)',
  },
  input: {
    width: '100%',
    height: 'var(--target-web, 40px)',
    padding: '0 2px',
    background: 'transparent',
    border: 'none',
    borderBottom: '1.5px solid var(--border-subtle)',
    borderRadius: 0,
    outline: 'none',
    font: `400 var(--text-sm, 14px)/1.4 var(--font-sans)`,
    color: 'var(--text-primary)',
    // transition toàn bộ để animation mượt
    transition: 'border 0.22s ease, border-radius 0.22s ease, padding 0.22s ease, background 0.22s ease, box-shadow 0.22s ease',
    boxSizing: 'border-box',
  },
  inputFocused: {
    background: 'var(--field-bg)',
    border: '1px solid var(--border-focus-color)',
    borderRadius: 'var(--radius-control, 8px)',
    padding: '0 12px',
    boxShadow: 'var(--ring-focus)',
  },
}
