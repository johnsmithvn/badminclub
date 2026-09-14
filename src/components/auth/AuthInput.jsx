// Input cho trang auth — animation floating label & white box:
//   Idle (chưa focus + chưa có text):
//     - Label nằm BÊN TRONG ô input (vertically centered)
//     - Gạch dưới (underline) trắng sắc nét, nền trong suốt
//     - Cả 2 input đều hiện gạch dưới rõ ràng
//   Active (đang focus HOẶC ô đã có text):
//     - Label mượt mà bay LÊN TRÊN thành tiêu đề (floating label)
//     - Ô input biến thành white box nổi bật với chữ đen
//     - rightSlot (checkbox "Hiện" mật khẩu) xuất hiện ở góc trên phải
//   Khi xoá hết text và blur:
//     - Label mượt mà chui ngược LẠI VÀO TRONG ô input
//     - Ô input trở lại dạng gạch dưới trong suốt

import { useState } from 'react'

export default function AuthInput({
  label,
  rightSlot,
  type = 'text',
  value = '',
  onChange,
  autoComplete,
  inputRef,
  onFocus,
  onBlur,
}) {
  const [focused, setFocused] = useState(false)

  // Floating khi đang focus HOẶC khi ô đã có text
  const isFloating = focused || Boolean(value && String(value).length > 0)

  const handleFocus = (e) => {
    setFocused(true)
    onFocus?.(e)
  }

  const handleBlur = (e) => {
    // Nếu focus di chuyển sang phần tử khác trong cùng wrapper (ví dụ checkbox rightSlot) thì không coi là blur
    if (e.currentTarget.contains(e.relatedTarget)) return
    setFocused(false)
    onBlur?.(e)
  }

  return (
    <div style={S.container} onBlur={handleBlur}>
      <style>{`
        .auth-field-input:-webkit-autofill,
        .auth-field-input:-webkit-autofill:hover, 
        .auth-field-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #111827 !important;
          -webkit-box-shadow: 0 0 0px 1000px #ffffff inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* Label: khi idle thì nằm trong input; khi active thì bay lên thành tiêu đề */}
      <label
        style={{
          ...S.label,
          ...(isFloating ? S.labelActive : S.labelIdle),
        }}
      >
        {label}
      </label>

      {/* rightSlot (checkbox Hiện mật khẩu): chỉ hiện khi floating */}
      {rightSlot && (
        <div
          style={{
            ...S.rightSlot,
            ...(isFloating ? S.rightSlotActive : S.rightSlotIdle),
          }}
        >
          {rightSlot}
        </div>
      )}

      {/* Input box */}
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        onFocus={handleFocus}
        className="auth-field-input"
        style={{
          ...S.input,
          ...(isFloating ? S.inputActive : S.inputIdle),
        }}
      />
    </div>
  )
}

const S = {
  container: {
    position: 'relative',
    width: '100%',
    paddingTop: 22, // Dành khoảng trống 22px phía trên cho floating label & rightSlot
  },

  label: {
    position: 'absolute',
    pointerEvents: 'none',
    userSelect: 'none',
    fontFamily: 'var(--font-sans, sans-serif)',
    letterSpacing: '0.02em',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 2,
  },

  // Idle: nằm lọt vào trong ô input (chính giữa chiều cao 44px của ô)
  labelIdle: {
    top: 34,
    left: 8,
    fontSize: 14,
    lineHeight: '18px',
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: 400,
  },

  // Active: nhảy lên vị trí title phía trên ô input
  labelActive: {
    top: 0,
    left: 2,
    fontSize: 12,
    lineHeight: '18px',
    color: 'rgba(255, 255, 255, 0.88)',
    fontWeight: 500,
  },

  rightSlot: {
    position: 'absolute',
    top: 0,
    right: 2,
    lineHeight: '18px',
    transition: 'opacity 0.2s ease',
    zIndex: 2,
  },
  rightSlotIdle: {
    opacity: 0,
    pointerEvents: 'none',
  },
  rightSlotActive: {
    opacity: 1,
    pointerEvents: 'auto',
  },

  input: {
    width: '100%',
    height: 44,
    boxSizing: 'border-box',
    outline: 'none',
    font: '400 14px/1.4 var(--font-sans, sans-serif)',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Idle: nền trong suốt, gạch dưới trắng sáng rõ (2px)
  inputIdle: {
    background: 'transparent',
    border: '1px solid transparent',
    borderBottom: '2px solid rgba(255, 255, 255, 0.75)',
    borderRadius: 0,
    color: '#ffffff',
    padding: '0 8px',
  },

  // Active: white box nổi bật, bo góc 6px, chữ đen dễ đọc
  inputActive: {
    background: '#ffffff',
    border: '1px solid #ffffff',
    borderRadius: 6,
    color: '#111827',
    padding: '0 12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
  },
}
