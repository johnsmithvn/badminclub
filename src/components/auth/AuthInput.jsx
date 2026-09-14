// Input cho trang auth — style giống video:
//   Unfocused: label trên + gạch chân mỏng, nền trong suốt
//   Focused / có giá trị: white box xuất hiện với transition mượt
// rightSlot: checkbox "Hiện" cùng hàng với label (góc phải)

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
      {/* Label row: label trái, rightSlot (checkbox) phải */}
      <div style={S.labelRow}>
        <span style={S.label}>{label}</span>
        {rightSlot}
      </div>

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
    gap: 8,
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    font: '400 13px/1 var(--font-sans, sans-serif)',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.02em',
  },

  // Unfocused: trong suốt + gạch chân
  input: {
    width: '100%',
    height: 44,
    padding: '0 4px',
    background: 'transparent',
    border: 'none',
    borderBottom: '1.5px solid rgba(255,255,255,0.18)',
    borderRadius: 0,
    outline: 'none',
    font: '400 14px/1.4 var(--font-sans, sans-serif)',
    color: 'rgba(255,255,255,0.85)',
    transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
    boxSizing: 'border-box',
  },

  // Focused: white box xuất hiện
  inputFocused: {
    background: 'rgba(255,255,255,0.93)',
    border: '1px solid rgba(255,255,255,0.85)',
    borderRadius: 8,
    padding: '0 14px',
    color: '#111827',                                    // text tối trên nền trắng
    boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
  },
}
