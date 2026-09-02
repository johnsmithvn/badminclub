import { useState, useRef, useEffect, useMemo } from 'react'
import { Icon } from '#ds'
import { LevelChip } from './index.jsx'
import { t } from '#i18n'

/**
 * Chuẩn hoá chuỗi tiếng Việt để tìm kiếm không dấu, không phân biệt hoa thường.
 */
function normalizeStr(str) {
  if (!str) return ''
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim()
}

/**
 * Combobox / Searchable Select & Tag Multi-Select trực tiếp.
 *
 * Props:
 * - `options`: Array<{ value, label, sub?, level?, levels?, icon? }>
 * - `value`: giá trị đang chọn (string hoặc Array<string> nếu multiple)
 * - `onChange`: (value, optionOrOptions) => void
 * - `multiple`: boolean (cho phép chọn nhiều dưới dạng tag chip)
 * - `placeholder`: chữ gợi ý khi chưa chọn
 * - `searchPlaceholder`: chữ gợi ý khi tìm kiếm
 * - `label`: nhãn phía trên dropdown
 * - `size`: 'sm' (32px) | 'md' (38px)
 * - `disabled`: vô hiệu hoá
 * - `clearable`: cho phép xoá chọn
 * - `style`: style của container
 * - `menuWidth`: độ rộng menu dropdown
 * - `levels`: thang trình độ truyền vào LevelChip
 */
export function SearchSelect({
  options = [],
  value = '',
  onChange,
  multiple = false,
  placeholder = t('common.pick'),
  searchPlaceholder = t('common.searchQuick'),
  label,
  size = 'md',
  disabled = false,
  clearable = false,
  style,
  menuWidth,
  levels,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(30)
  const [placement, setPlacement] = useState('bottom')

  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Danh sách các ID đang chọn (chuẩn hoá thành Array)
  const selectedValues = useMemo(() => {
    if (multiple) {
      if (Array.isArray(value)) return value.map(String)
      if (typeof value === 'string' && value.trim()) return value.split(',').map((s) => s.trim())
      return []
    }
    return value ? [String(value)] : []
  }, [value, multiple])

  // Danh sách các options đang chọn
  const selectedOptions = useMemo(() => {
    const valSet = new Set(selectedValues)
    return options.filter((o) => valSet.has(String(o.value)))
  }, [options, selectedValues])

  const singleSelectedOption = !multiple ? selectedOptions[0] || null : null

  // Lọc options theo từ khoá tìm kiếm
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options
    const q = normalizeStr(search)
    return options.filter((o) => {
      const matchLabel = normalizeStr(o.label).includes(q)
      const matchSub = o.sub && normalizeStr(o.sub).includes(q)
      const matchLevel = o.level && normalizeStr(o.level).includes(q)
      return matchLabel || matchSub || matchLevel
    })
  }, [options, search])

  // Đóng khi click ngoài
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const checkPlacement = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      if (spaceBelow < 260 && spaceAbove > 200) {
        setPlacement('top')
      } else {
        setPlacement('bottom')
      }
    }
  }

  const handleContainerClick = () => {
    if (disabled) return
    if (!isOpen) {
      checkPlacement()
      setIsOpen(true)
      setVisibleCount(30)
    }
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearch(val)
    if (!isOpen) {
      checkPlacement()
      setIsOpen(true)
    }
    setVisibleCount(30)
    if (listRef.current) {
      listRef.current.scrollTop = 0
    }
  }

  const handleKeyDown = (e) => {
    if (disabled) return
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearch('')
      e.stopPropagation()
    } else if (e.key === 'Backspace' && !search && multiple && selectedValues.length > 0) {
      // Xoá tag cuối cùng khi bấm Backspace ở ô tìm kiếm rỗng
      const next = selectedValues.slice(0, -1)
      const nextOpts = options.filter((o) => next.includes(String(o.value)))
      onChange?.(next, nextOpts)
    } else if (e.key === 'ArrowDown') {
      if (!isOpen) {
        checkPlacement()
        setIsOpen(true)
      }
    }
  }

  const handleSelect = (opt) => {
    if (disabled || opt.disabled) return
    if (multiple) {
      const isAlready = selectedValues.includes(String(opt.value))
      const next = isAlready
        ? selectedValues.filter((v) => v !== String(opt.value))
        : [...selectedValues, String(opt.value)]
      const nextOpts = options.filter((o) => next.includes(String(o.value)))
      onChange?.(next, nextOpts)
      setSearch('')
      if (inputRef.current) inputRef.current.focus()
    } else {
      onChange?.(opt.value, opt)
      setSearch('')
      setIsOpen(false)
    }
  }

  const handleRemoveTag = (e, valToRemove) => {
    e.stopPropagation()
    if (disabled) return
    if (multiple) {
      const next = selectedValues.filter((v) => v !== String(valToRemove))
      const nextOpts = options.filter((o) => next.includes(String(o.value)))
      onChange?.(next, nextOpts)
    } else {
      onChange?.('', null)
    }
    if (inputRef.current) inputRef.current.focus()
  }

  const handleClear = (e) => {
    e.stopPropagation()
    if (disabled) return
    onChange?.(multiple ? [] : '', multiple ? [] : null)
    setSearch('')
    if (inputRef.current) inputRef.current.focus()
  }

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    if (scrollHeight - scrollTop - clientHeight < 40) {
      setVisibleCount((prev) => Math.min(prev + 25, filteredOptions.length))
    }
  }

  const minH = size === 'sm' ? 32 : 38
  const visibleItems = filteredOptions.slice(0, visibleCount)
  const showClear = clearable && !disabled && (selectedValues.length > 0 || search.length > 0)

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        minWidth: 0,
        ...style,
      }}
    >
      {label && (
        <label
          style={{
            font: 'var(--type-label)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            userSelect: 'none',
          }}
        >
          {label}
        </label>
      )}

      {/* Input container trực tiếp có hiển thị Tags */}
      <div
        onClick={handleContainerClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: multiple ? 'wrap' : 'nowrap',
          gap: 4,
          minHeight: minH,
          padding: multiple ? '3px 8px' : '0 10px',
          background: disabled ? 'var(--field-bg-disabled)' : 'var(--field-bg, #fff)',
          border: `1px solid ${isOpen ? 'var(--border-focus-color, #0284c7)' : 'var(--field-border, #cbd5e1)'}`,
          borderRadius: 'var(--radius-control, 8px)',
          boxShadow: isOpen ? 'var(--ring-focus, 0 0 0 3px rgba(2, 132, 199, 0.15))' : 'none',
          cursor: disabled ? 'not-allowed' : 'text',
          opacity: disabled ? 0.65 : 1,
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxSizing: 'border-box',
        }}
      >
        {/* Render danh sách tags (cho multi-select) */}
        {multiple &&
          selectedOptions.map((opt) => (
            <span
              key={String(opt.value)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                borderRadius: 99,
                background: 'var(--surface-brand-soft, #e0f2fe)',
                color: 'var(--teal-800, #0369a1)',
                border: '1px solid var(--teal-200, #bae6fd)',
                fontSize: size === 'sm' ? 11 : 12,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
                animation: 'fadeIn 0.12s ease',
              }}
            >
              {opt.level && <LevelChip level={opt.level} levels={levels || opt.levels} />}
              <span>{opt.label}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemoveTag(e, opt.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--teal-700, #0284c7)',
                    borderRadius: '50%',
                    marginLeft: 2,
                  }}
                  title={t('common.delete')}
                >
                  <Icon name="x" size={11} />
                </button>
              )}
            </span>
          ))}

        {/* Single select: Hiển thị giá trị đã chọn khi không đang gõ search */}
        {!multiple && singleSelectedOption && !search && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
            overflow: 'hidden',
          }}>
            {singleSelectedOption.level && (
              <LevelChip level={singleSelectedOption.level} levels={levels || singleSelectedOption.levels} />
            )}
            <span
              style={{
                fontSize: size === 'sm' ? 12 : 13,
                color: 'var(--text-primary)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {singleSelectedOption.label}
            </span>
          </div>
        )}

        {/* Ô gõ tìm kiếm trực tiếp tại input */}
        <input
          ref={inputRef}
          type="text"
          value={search}
          disabled={disabled}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedValues.length === 0 || (multiple && search.length === 0)
              ? (isOpen ? searchPlaceholder : placeholder)
              : ''
          }
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            font: 'inherit',
            fontSize: size === 'sm' ? 12 : 13,
            color: 'var(--text-primary)',
            padding: 0,
            minWidth: 50,
            flex: 1,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />

        {/* Nút Clear & Chevron Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
          {showClear && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 2,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-muted)',
              }}
              title={t('common.clearPick')}
            >
              <Icon name="x" size={13} />
            </button>
          )}
          <Icon
            name="chevron-down"
            size={14}
            style={{
              color: 'var(--text-muted)',
              transition: 'transform 0.2s ease',
              transform: isOpen ? 'rotate(180deg)' : 'none',
            }}
          />
        </div>
      </div>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            ...(placement === 'top'
              ? { bottom: 'calc(100% + 4px)', left: 0 }
              : { top: 'calc(100% + 4px)', left: 0 }),
            zIndex: 100,
            width: menuWidth || '100%',
            minWidth: 240,
            background: 'var(--surface-card, #ffffff)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* Danh sách options (lazy load khi cuộn) */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            style={{
              maxHeight: 230,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: 4,
            }}
          >
            {visibleItems.length === 0 ? (
              <div
                style={{
                  padding: '14px 10px',
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                }}
              >
                {t('common.noResult')}
              </div>
            ) : (
              visibleItems.map((opt) => {
                const isSelected = selectedValues.includes(String(opt.value))
                return (
                  <div
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '7px 9px',
                      borderRadius: 6,
                      background: isSelected ? 'var(--surface-accent-soft, #f0fdfa)' : 'transparent',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      opacity: opt.disabled ? 0.5 : 1,
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !opt.disabled) {
                        e.currentTarget.style.background = 'var(--surface-inset, #f8fafc)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !opt.disabled) {
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                      {opt.level && <LevelChip level={opt.level} levels={levels || opt.levels} />}
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? 'var(--teal-700, #0f766e)' : 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {opt.label}
                      </span>
                      {opt.sub && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          · {opt.sub}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Icon name="check" size={14} style={{ color: 'var(--teal-600)', flexShrink: 0 }} />
                    )}
                  </div>
                )
              })
            )}

            {filteredOptions.length > visibleCount && (
              <div style={{ padding: '6px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                {t('common.showingOf', { n: visibleCount, total: filteredOptions.length })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
