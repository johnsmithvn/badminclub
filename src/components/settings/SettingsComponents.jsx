import React, { useState, useRef, useEffect } from 'react'
import { Icon, Button } from '#ds'
import { t } from '#i18n'

/**
 * Hàng dữ liệu chuẩn theo ngữ pháp handoff 2c:
 * - Nhãn cố định 170px (hoặc 130px)
 * - Điều khiển cao 38px (flex: 1)
 * - Chú thích 12px #8b98ab căn theo cột điều khiển (KHÔNG thụt theo nhãn)
 * - Kẻ 1px #f6f8fb giữa các hàng (hàng cuối không kẻ)
 */
export function FormRow({
  label,
  labelWidth = 170,
  note,
  error,
  children,
  isToggle = false,
  alignTop = false,
  last = false,
  style = {},
}) {
  const needsTopAlign = alignTop || Boolean(note) || Boolean(error)

  if (isToggle) {
    return (
      <div
        className="settings-form-row settings-form-row--toggle"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 18,
          padding: '13px 0',
          borderBottom: last ? 'none' : '1px solid #f6f8fb',
          ...style,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2a3a54', lineHeight: 1.4 }}>
            {label}
          </div>
          {note && !error && (
            <div style={{ fontSize: 12, color: '#8b98ab', lineHeight: 1.5 }}>
              {note}
            </div>
          )}
          {error && (
            <div style={{ fontSize: 12, color: '#c0392b', lineHeight: 1.5 }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ flex: 'none', marginTop: 2 }}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div
      className="settings-form-row"
      style={{
        display: 'flex',
        alignItems: needsTopAlign ? 'flex-start' : 'center',
        gap: 18,
        padding: '14px 0',
        borderBottom: last ? 'none' : '1px solid #f6f8fb',
        ...style,
      }}
    >
      <div
        className="settings-form-label"
        style={{
          width: labelWidth,
          flex: 'none',
          fontSize: 13,
          fontWeight: 600,
          color: '#2a3a54',
          paddingTop: needsTopAlign ? 9 : 0,
          lineHeight: 1.4,
          wordBreak: 'break-word',
        }}
      >
        {label}
      </div>
      <div
        className="settings-form-control"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          {children}
        </div>
        {note && !error && (
          <div style={{ fontSize: 12, color: '#8b98ab', lineHeight: 1.5 }}>
            {note}
          </div>
        )}
        {error && (
          <div style={{ fontSize: 12, color: '#c0392b', lineHeight: 1.5 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Toggle Switch chuẩn:
 * - 40x23, thumb 19px, inset 2px
 * - Bật: #0d8b8a, Tắt: #d9dfe8
 */
export function ToggleSwitch({ checked, onChange, disabled, id, 'aria-label': ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      id={id}
      onClick={() => !disabled && onChange && onChange(!checked)}
      style={{
        width: 40,
        height: 23,
        borderRadius: 999,
        background: checked ? '#0d8b8a' : '#d9dfe8',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        padding: 0,
        outline: 'none',
        transition: 'background 0.18s ease',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 19 : 2,
          width: 19,
          height: 19,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(16, 32, 60, 0.28)',
          transition: 'left 0.18s ease',
        }}
      />
    </button>
  )
}

/**
 * Stepper chuẩn handoff:
 * - width 150px, cao 36px
 * - Ô - (36px), ô số tabular-nums (cho phép nhập tay), ô + (36px)
 */
export function Stepper({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  suffix = '',
  width = 150,
}) {
  const numVal = Number(value) || 0

  const handleDec = () => {
    if (disabled) return
    const next = Math.max(min, numVal - step)
    onChange && onChange(next)
  }

  const handleInc = () => {
    if (disabled) return
    const next = Math.min(max, numVal + step)
    onChange && onChange(next)
  }

  const handleInput = (e) => {
    if (disabled) return
    const raw = e.target.value.replace(/\D/g, '')
    if (raw === '') {
      onChange && onChange('')
      return
    }
    const n = Number(raw)
    onChange && onChange(Math.min(max, Math.max(min, n)))
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: '1px solid #d4dce7',
        borderRadius: 9,
        overflow: 'hidden',
        width,
        height: 36,
        background: disabled ? '#f6f8fb' : '#fff',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <button
        type="button"
        disabled={disabled || numVal <= min}
        onClick={handleDec}
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 600,
          color: '#6b7a90',
          border: 'none',
          background: 'transparent',
          borderRight: '1px solid #e7ebf2',
          cursor: disabled || numVal <= min ? 'not-allowed' : 'pointer',
          padding: 0,
        }}
      >
        −
      </button>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <input
          type="text"
          value={value ?? ''}
          disabled={disabled}
          onChange={handleInput}
          style={{
            width: '100%',
            textAlign: 'center',
            fontSize: 13.5,
            fontWeight: 600,
            color: '#10203c',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        />
        {suffix && (
          <span style={{ fontSize: 12, color: '#8b98ab', marginRight: 6 }}>{suffix}</span>
        )}
      </div>
      <button
        type="button"
        disabled={disabled || numVal >= max}
        onClick={handleInc}
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 600,
          color: '#6b7a90',
          border: 'none',
          background: 'transparent',
          borderLeft: '1px solid #e7ebf2',
          cursor: disabled || numVal >= max ? 'not-allowed' : 'pointer',
          padding: 0,
        }}
      >
        +
      </button>
    </div>
  )
}

/**
 * Card bao bọc theo chuẩn handoff:
 * - Viền 1px #e4e9f1, radius 12px, background #fff
 * - Header 15px/700 #10203c + phụ đề 12.5px #8b98ab + action góc phải
 */
export function SettingsCard({
  title,
  subtitle,
  action,
  icon,
  children,
  fullWidth = false,
  bodyPadding = '4px 20px 12px',
  style = {},
}) {
  return (
    <div
      className="settings-card"
      style={{
        background: '#fff',
        border: '1px solid #e4e9f1',
        borderRadius: 12,
        gridColumn: fullWidth ? '1 / -1' : undefined,
        overflow: 'hidden',
        ...style,
      }}
    >
      {(title || subtitle || action) && (
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f2f5f9',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {icon && (
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: '#f4f6f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0d8b8a',
                }}
              >
                <Icon name={icon} size={16} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {title && (
                <div style={{ fontSize: 15, fontWeight: 700, color: '#10203c', letterSpacing: '-0.01em' }}>
                  {title}
                </div>
              )}
              {subtitle && (
                <div style={{ fontSize: 12.5, color: '#8b98ab', lineHeight: 1.4 }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}
      <div style={{ padding: bodyPadding }}>
        {children}
      </div>
    </div>
  )
}

/**
 * Thanh lưu nổi (Floating Save Bar) theo chuẩn mục 5:
 * - Hiện khi có thay đổi chưa lưu
 * - Đếm số thay đổi theo field
 * - Nút Hoàn tác & Lưu thay đổi
 */
export function FloatingSaveBar({
  dirtyCount = 0,
  fieldNames = [],
  onSave,
  onRevert,
  isSaving = false,
  isSaved = false,
  saveError = null,
}) {
  const visible = dirtyCount > 0 || isSaving || isSaved

  if (!visible) return null

  const namesSummary =
    fieldNames.length <= 2
      ? fieldNames.join(', ')
      : `${fieldNames.slice(0, 2).join(', ')} ${t('settings.otherFields', { count: fieldNames.length - 2 })}`

  return (
    <div
      className="settings-save-bar"
      role="region"
      aria-live="polite"
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 68,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid #e0e6ee',
        padding: '0 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        animation: 'slideUpSaveBar 0.22s ease',
        boxShadow: '0 -4px 20px rgba(16, 32, 60, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isSaved ? '#0d8b8a' : isSaving ? '#6b7a90' : '#e8a33d',
            flexShrink: 0,
            transition: 'background 0.2s ease',
          }}
        />
        <div style={{ fontSize: 13.5, color: '#42526b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isSaved ? (
            <span style={{ color: '#0a6f6d', fontWeight: 600 }}>{t('settings.allSaved')}</span>
          ) : isSaving ? (
            <span>{t('settings.saving')}</span>
          ) : (
            <>
              <strong style={{ color: '#10203c', fontWeight: 600 }}>{t('settings.dirtyCount', { count: dirtyCount })}</strong> {t('settings.dirtySummary')}
              {namesSummary && <span> · {namesSummary}</span>}
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {saveError && (
          <span style={{ fontSize: 12, color: '#c0392b', marginRight: 6 }}>
            {saveError}
          </span>
        )}
        {!isSaved && !isSaving && (
          <button
            type="button"
            onClick={onRevert}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 13.5,
              fontWeight: 600,
              color: '#6b7a90',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: 8,
              transition: 'color 0.18s ease',
            }}
          >
            {t('settings.revert')}
          </button>
        )}
        <button
          type="button"
          disabled={isSaving || isSaved}
          onClick={onSave}
          style={{
            background: '#10203c',
            color: '#fff',
            height: 38,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 20px',
            borderRadius: 10,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: isSaving || isSaved ? 'not-allowed' : 'pointer',
            border: 'none',
            opacity: isSaving || isSaved ? 0.7 : 1,
            transition: 'background 0.18s ease',
          }}
        >
          {isSaving ? t('settings.saving') : t('settings.saveChanges')}
        </button>
      </div>
    </div>
  )
}

/**
 * Ô sửa giá trị tại chỗ trong bảng (Inline Edit Cell)
 */
export function InlineTextCell({
  value,
  onChange,
  type = 'text',
  align = 'left',
  suffix = '',
  disabled = false,
  formatDisplay,
  placeholder = '—',
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== value) {
      onChange && onChange(draft)
    }
  }

  const cancel = () => {
    setEditing(false)
    setDraft(value)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') cancel()
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        <input
          ref={inputRef}
          type={type}
          value={draft ?? ''}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          style={{
            height: 32,
            border: '1.5px solid #0d8b8a',
            borderRadius: 6,
            padding: '0 8px',
            fontSize: 13,
            color: '#10203c',
            textAlign: align,
            width: '100%',
            maxWidth: 160,
            outline: 'none',
            fontVariantNumeric: type === 'number' || align === 'right' ? 'tabular-nums' : undefined,
            fontFamily: type === 'number' || align === 'right' ? "'JetBrains Mono', monospace" : undefined,
            background: '#fff',
          }}
        />
      </div>
    )
  }

  const displayVal = formatDisplay ? formatDisplay(value) : (value ? `${value}${suffix}` : placeholder)

  return (
    <div
      onClick={() => !disabled && setEditing(true)}
      title={disabled ? undefined : t('settings.clickToEdit')}
      style={{
        padding: '6px 8px',
        margin: '-6px -8px',
        borderRadius: 6,
        cursor: disabled ? 'default' : 'pointer',
        textAlign: align,
        fontSize: 13.5,
        fontWeight: align === 'right' ? 600 : 400,
        color: value ? '#10203c' : '#8b98ab',
        fontVariantNumeric: align === 'right' ? 'tabular-nums' : undefined,
        fontFamily: align === 'right' ? "'JetBrains Mono', monospace" : undefined,
        transition: 'background 0.15s ease',
      }}
      className={disabled ? '' : 'hover-cell'}
    >
      {displayVal}
    </div>
  )
}

/**
 * Trình quản lý Thang trình độ dạng pill (mục 3.6):
 * - Pill có badge số thứ tự (1, 2, 3...)
 * - Kéo hoặc nút di chuyển thứ tự (yếu trước, mạnh dần)
 * - Nút thêm bậc & Dùng thang gợi ý
 */
export function LevelPillsManager({
  levels = [],
  onChange,
  disabled = false,
  usedLevels = [],
  defaultLevels = ['Y', 'Y+', 'TB-', 'TB', 'TB+', 'K-', 'K', 'K+', 'G'],
}) {
  const [adding, setAdding] = useState(false)
  const [newLevelName, setNewLevelName] = useState('')

  const handleMove = (index, direction) => {
    if (disabled) return
    const targetIdx = index + direction
    if (targetIdx < 0 || targetIdx >= levels.length) return
    const updated = [...levels]
    const temp = updated[index]
    updated[index] = updated[targetIdx]
    updated[targetIdx] = temp
    onChange && onChange(updated)
  }

  const handleDelete = (index) => {
    if (disabled) return
    const lv = levels[index]
    if (usedLevels.indexOf(lv) >= 0) return
    const updated = levels.filter((_, i) => i !== index)
    onChange && onChange(updated)
  }

  const handleAdd = () => {
    const trimmed = newLevelName.trim()
    if (!trimmed || levels.indexOf(trimmed) >= 0) {
      setAdding(false)
      setNewLevelName('')
      return
    }
    const updated = [...levels, trimmed]
    onChange && onChange(updated)
    setNewLevelName('')
    setAdding(false)
  }

  const handleSuggest = () => {
    if (disabled) return
    onChange && onChange(defaultLevels)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {levels.map((lv, idx) => {
          const isUsed = usedLevels.indexOf(lv) >= 0
          return (
            <div
              key={`${lv}_${idx}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid #dde3ec',
                background: '#f8fafc',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 13,
                fontWeight: 600,
                color: '#10203c',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#a9b4c4',
                  background: '#eef1f6',
                  borderRadius: 4,
                  padding: '2px 5px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {idx + 1}
              </span>
              <span>{lv}</span>

              {!disabled && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 2 }}>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => handleMove(idx, -1)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px', color: '#8b98ab', fontSize: 11 }}
                      title={t('settings.levelMoveEarlier')}
                    >
                      ◀
                    </button>
                  )}
                  {idx < levels.length - 1 && (
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 1)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px', color: '#8b98ab', fontSize: 11 }}
                      title={t('settings.levelMoveLater')}
                    >
                      ▶
                    </button>
                  )}
                  {!isUsed && (
                    <button
                      type="button"
                      onClick={() => handleDelete(idx)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px', color: '#c0392b', fontSize: 13, marginLeft: 2 }}
                      title={t('settings.levelDelete')}
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {adding ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="text"
              autoFocus
              value={newLevelName}
              placeholder={t('settings.levelPlaceholder')}
              onChange={(e) => setNewLevelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') setAdding(false)
              }}
              style={{
                height: 32,
                border: '1.5px solid #0d8b8a',
                borderRadius: 8,
                padding: '0 8px',
                fontSize: 12.5,
                width: 90,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleAdd}
              style={{
                background: '#0d8b8a',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b98ab',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          !disabled && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              style={{
                border: '1px dashed #cdd6e2',
                borderRadius: 8,
                padding: '6px 11px',
                fontSize: 12.5,
                fontWeight: 600,
                color: '#0d8b8a',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              {t('settings.addLevelBtn')}
            </button>
          )
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#8b98ab' }}>
          {t('settings.levelOrderNote')}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleSuggest}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 12,
              fontWeight: 600,
              color: '#0d8b8a',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            {t('settings.suggestLevelBtn')}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * InfoBox (mục 3.9):
 * Khung ghi chú giải thích quy tắc hệ thống
 */
export function InfoBox({ title, children, style = {} }) {
  return (
    <div
      style={{
        background: '#f2f7fc',
        border: '1px solid #d8e6f2',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        ...style,
      }}
    >
      {title && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2a4a6b' }}>
          {title}
        </div>
      )}
      <div style={{ fontSize: 12.5, color: '#4d6a88', lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  )
}

/**
 * DangerZoneCard (mục 3.10):
 * Vùng nguy hiểm dành riêng cho Chủ CLB
 */
export function DangerZoneCard({ title, desc, actionLabel, onAction }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #f0d7d4',
        borderRadius: 10,
        overflow: 'hidden',
        gridColumn: '1 / -1',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f9edeb',
          fontSize: 13.5,
          fontWeight: 700,
          color: '#a13228',
        }}
      >
        {title || t('settings.delClubTitle')}
      </div>
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 12.5, color: '#5c6b81', flex: 1, minWidth: 200 }}>
          {desc || t('settings.delClubDesc')}
        </div>
        <button
          type="button"
          onClick={onAction}
          style={{
            background: '#c0392b',
            color: '#fff',
            height: 32,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 14px',
            borderRadius: 9,
            fontSize: 12.5,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {actionLabel || t('clubs.delBtn')}
        </button>
      </div>
    </div>
  )
}

/**
 * EmptyState chuẩn (mục 3.8):
 * Trạng thái rỗng hình tròn tích xanh
 */
export function EmptyState({ title, hint, icon = 'circle-check' }) {
  return (
    <div
      style={{
        padding: '32px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '1.5px solid #cfd7e3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0d8b8a',
          fontSize: 14,
          marginBottom: 2,
        }}
      >
        <Icon name={icon} size={18} />
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#42526b' }}>
        {title}
      </div>
      {hint && (
        <div style={{ fontSize: 12.5, color: '#8b98ab', textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  )
}
