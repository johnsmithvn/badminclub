import React, { useState, useRef, useEffect } from 'react'
import { Icon } from '#ds'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

/**
 * Hàng dữ liệu chuẩn theo ngữ pháp handoff 2c:
 * - Nhãn cố định 170px (hoặc 130px)
 * - Điều khiển cao 38px (flex: 1)
 * - Chú thích 12px căn theo cột điều khiển (KHÔNG thụt theo nhãn)
 * - Kẻ 1px giữa các hàng (hàng cuối không kẻ)
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
  htmlFor,
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
          borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
          ...style,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label
            htmlFor={htmlFor}
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, cursor: htmlFor ? 'pointer' : 'default' }}
          >
            {label}
          </label>
          {note && !error && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {note}
            </div>
          )}
          {error && (
            <div style={{ fontSize: 12, color: 'var(--red-600)', lineHeight: 1.5 }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ flex: 'none', marginTop: 2, minHeight: 38, display: 'flex', alignItems: 'center' }}>
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
        borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
        ...style,
      }}
    >
      <label
        htmlFor={htmlFor}
        className="settings-form-label"
        style={{
          width: labelWidth,
          flex: 'none',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          paddingTop: needsTopAlign ? 9 : 0,
          lineHeight: 1.4,
          wordBreak: 'break-word',
          cursor: htmlFor ? 'pointer' : 'default',
        }}
      >
        {label}
      </label>
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
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 38 }}>
          {children}
        </div>
        {note && !error && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {note}
          </div>
        )}
        {error && (
          <div style={{ fontSize: 12, color: 'var(--red-600)', lineHeight: 1.5 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Toggle Switch chuẩn:
 * - 40x23 (mobile 44x26), thumb 19px, inset 2px
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
        width: 42,
        height: 24,
        borderRadius: 999,
        background: checked ? 'var(--teal-600)' : 'var(--border-default)',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        padding: 0,
        outlineColor: 'var(--teal-500)',
        transition: 'background 0.18s ease',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 20 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--surface-card)',
          boxShadow: '0 1px 3px rgba(13, 43, 94, 0.28)',
          transition: 'left 0.18s ease',
        }}
      />
    </button>
  )
}

/**
 * Stepper chuẩn handoff:
 * - width 150px, cao 38px
 * - Ô - (38px), ô số tabular-nums (cho phép nhập tay), ô + (38px)
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
        border: '1px solid var(--border-default)',
        borderRadius: 9,
        overflow: 'hidden',
        width,
        height: 38,
        background: disabled ? 'var(--surface-inset)' : 'var(--surface-card)',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <button
        type="button"
        disabled={disabled || numVal <= min}
        onClick={handleDec}
        style={{
          width: 38,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          border: 'none',
          background: 'transparent',
          borderRight: '1px solid var(--border-subtle)',
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
            color: 'var(--text-primary)',
            border: 'none',
            outlineColor: 'var(--teal-500)',
            background: 'transparent',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'var(--font-mono)',
          }}
        />
        {suffix && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 6 }}>{suffix}</span>
        )}
      </div>
      <button
        type="button"
        disabled={disabled || numVal >= max}
        onClick={handleInc}
        style={{
          width: 38,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          border: 'none',
          background: 'transparent',
          borderLeft: '1px solid var(--border-subtle)',
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
 * - Viền 1px, radius 12px, background var(--surface-card)
 * - Header 15px/700 var(--text-primary) + phụ đề 12.5px var(--text-muted) + action góc phải
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
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
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
            borderBottom: '1px solid var(--border-subtle)',
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
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--surface-page)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--teal-600)',
                }}
              >
                <Icon name={icon} size={16} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {title && (
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  {title}
                </div>
              )}
              {subtitle && (
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
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
 * - Sử dụng transform + opacity để giữ mượt mà khi ẩn/hiện, không unmount đột ngột
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
        background: 'var(--surface-card)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '0 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'transform 0.22s ease, opacity 0.22s ease',
        boxShadow: '0 -4px 20px rgba(13, 43, 94, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isSaved ? 'var(--teal-600)' : isSaving ? 'var(--text-muted)' : 'var(--amber-500)',
            flexShrink: 0,
            transition: 'background 0.2s ease',
          }}
        />
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isSaved ? (
            <span style={{ color: 'var(--teal-700)', fontWeight: 600 }}>{t('settings.allSaved')}</span>
          ) : isSaving ? (
            <span>{t('settings.saving')}</span>
          ) : (
            <>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('settings.dirtyCount', { count: dirtyCount })}</strong> {t('settings.dirtySummary')}
              {namesSummary && <span> · {namesSummary}</span>}
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {saveError && (
          <span style={{ fontSize: 12, color: 'var(--red-600)', marginRight: 6 }}>
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
              color: 'var(--text-muted)',
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
            background: 'var(--navy-700)',
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
 * - Không set-state-in-effect để đảm bảo lint sạch
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
  const [prevValue, setPrevValue] = useState(value)
  const inputRef = useRef(null)
  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(value)
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEditing = () => {
    if (disabled) return
    setDraft(value ?? '')
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    if (draft !== value) {
      onChange && onChange(draft)
    }
  }

  const cancel = () => {
    setEditing(false)
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
            border: '1.5px solid var(--teal-500)',
            borderRadius: 6,
            padding: '0 8px',
            fontSize: 13,
            width: type === 'number' ? 100 : '100%',
            textAlign: align,
            fontFamily: type === 'number' ? 'var(--font-mono)' : 'var(--font-sans)',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--text-primary)',
            background: 'var(--surface-card)',
            outline: 'none',
          }}
        />
        {suffix && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{suffix}</span>}
      </div>
    )
  }

  const display = formatDisplay ? formatDisplay(value) : (value || placeholder)

  return (
    <div
      onClick={startEditing}
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          startEditing()
        }
      }}
      title={disabled ? undefined : t('settings.clickToEdit')}
      style={{
        cursor: disabled ? 'default' : 'pointer',
        textAlign: align,
        fontSize: 13,
        fontWeight: value ? 600 : 400,
        color: value ? 'var(--text-primary)' : 'var(--text-muted)',
        fontVariantNumeric: type === 'number' ? 'tabular-nums' : undefined,
        fontFamily: type === 'number' ? 'var(--font-mono)' : 'var(--font-sans)',
        padding: '6px 4px',
        borderRadius: 6,
        transition: 'background 0.15s ease',
        userSelect: 'none',
      }}
    >
      {display}
    </div>
  )
}

/**
 * Trình quản lý Thang trình độ dạng Pill (mục 3.6):
 * - Kéo-thả (HTML5 Drag & Drop) hoặc dùng nút mũi tên ◀ ▶
 * - Thêm bậc mới
 * - Gợi ý thang chuẩn
 * - Không cho xoá bậc đang có thành viên
 */
export function LevelPillsManager({
  levels = [],
  onChange,
  disabled = false,
  usedLevels = [],
  defaultLevels = cfg.levelsDefault,
}) {
  const [adding, setAdding] = useState(false)
  const [newLevelName, setNewLevelName] = useState('')
  const [draggedIdx, setDraggedIdx] = useState(null)

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

  const handleDropReorder = (fromIdx, toIdx) => {
    if (disabled || fromIdx === toIdx || fromIdx == null || toIdx == null) return
    const updated = [...levels]
    const [moved] = updated.splice(fromIdx, 1)
    updated.splice(toIdx, 0, moved)
    onChange && onChange(updated)
    setDraggedIdx(null)
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
              draggable={!disabled}
              onDragStart={(e) => {
                setDraggedIdx(idx)
                e.dataTransfer.setData('text/plain', String(idx))
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const from = draggedIdx != null ? draggedIdx : Number(e.dataTransfer.getData('text/plain'))
                handleDropReorder(from, idx)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-inset)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: disabled ? 'default' : 'grab',
                userSelect: 'none',
              }}
            >
              {!disabled && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'grab' }}>⠿</span>
              )}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  background: 'var(--surface-page)',
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
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px', color: 'var(--text-muted)', fontSize: 11 }}
                      title={t('settings.levelMoveEarlier')}
                    >
                      ◀
                    </button>
                  )}
                  {idx < levels.length - 1 && (
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 1)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px', color: 'var(--text-muted)', fontSize: 11 }}
                      title={t('settings.levelMoveLater')}
                    >
                      ▶
                    </button>
                  )}
                  {!isUsed && (
                    <button
                      type="button"
                      onClick={() => handleDelete(idx)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 2px', color: 'var(--red-600)', fontSize: 13, marginLeft: 2 }}
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
                border: '1.5px solid var(--teal-500)',
                borderRadius: 8,
                padding: '0 8px',
                fontSize: 12.5,
                width: 90,
                outline: 'none',
                color: 'var(--text-primary)',
                background: 'var(--surface-card)',
              }}
            />
            <button
              type="button"
              onClick={handleAdd}
              style={{
                background: 'var(--teal-600)',
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
                color: 'var(--text-muted)',
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
                border: '1px dashed var(--border-default)',
                borderRadius: 8,
                padding: '6px 11px',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--teal-600)',
                background: 'var(--surface-card)',
                cursor: 'pointer',
              }}
            >
              {t('settings.addLevelBtn')}
            </button>
          )
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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
              color: 'var(--teal-600)',
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
        background: 'var(--surface-brand-soft)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        ...style,
      }}
    >
      {title && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-800)' }}>
          {title}
        </div>
      )}
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
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
        background: 'var(--surface-card)',
        border: '1px solid var(--surface-danger-soft)',
        borderRadius: 10,
        overflow: 'hidden',
        gridColumn: '1 / -1',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--surface-danger-soft)',
          fontSize: 13.5,
          fontWeight: 700,
          color: 'var(--red-600)',
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
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1, minWidth: 200 }}>
          {desc || t('settings.delClubDesc')}
        </div>
        <button
          type="button"
          onClick={onAction}
          style={{
            background: 'var(--red-600)',
            color: '#fff',
            height: 34,
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
          border: '1.5px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--teal-600)',
          fontSize: 14,
          marginBottom: 2,
        }}
      >
        <Icon name={icon} size={18} />
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
        {title}
      </div>
      {hint && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  )
}
