import { useState, useRef, useEffect, useMemo } from 'react'
import { Icon } from '#ds'
import { LevelChip } from './index.jsx'

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
 * Dropdown chọn có tìm kiếm (Combobox / Searchable Select) có lazy load.
 *
 * Props:
 * - `options`: Array<{ value, label, sub?, level?, levels?, icon? }>
 * - `value`: giá trị đang chọn
 * - `onChange`: (value: string, option: object) => void
 * - `placeholder`: chữ gợi ý khi chưa chọn
 * - `searchPlaceholder`: chữ gợi ý trong ô tìm kiếm
 * - `label`: nhãn phía trên dropdown
 * - `size`: 'sm' (32px) | 'md' (38px)
 * - `disabled`: vô hiệu hoá
 * - `clearable`: cho phép xoá chọn về ''
 * - `style`: style của container
 * - `menuWidth`: độ rộng tối thiểu của menu dropdown (mặc định 100%, tối thiểu 220px)
 */
export function SearchSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Chọn...',
  searchPlaceholder = 'Tìm kiếm nhanh...',
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
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)
  const listRef = useRef(null)

  // Tìm option hiện tại
  const selectedOption = useMemo(() => {
    return options.find((o) => String(o.value) === String(value)) || null
  }, [options, value])

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

  // Focus ô tìm kiếm khi mở
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  // Đóng khi click ngoài
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const toggleOpen = () => {
    if (disabled) return
    setIsOpen((prev) => {
      if (!prev) {
        setSearch('')
        setVisibleCount(30)
      }
      return !prev
    })
  }

  const handleSearchChange = (e) => {
    setSearch(e.target.value)
    setVisibleCount(30)
    if (listRef.current) {
      listRef.current.scrollTop = 0
    }
  }

  // Xử lý lazy scroll
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    if (scrollHeight - scrollTop - clientHeight < 40) {
      setVisibleCount((prev) => Math.min(prev + 25, filteredOptions.length))
    }
  }

  const handleSelect = (opt) => {
    if (disabled || opt.disabled) return
    onChange?.(opt.value, opt)
    setIsOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    if (disabled) return
    onChange?.('', null)
  }

  const h = size === 'sm' ? 32 : 'var(--target-web, 38px)'
  const visibleItems = filteredOptions.slice(0, visibleCount)

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
            userSelect: 'none',
          }}
        >
          {label}
        </label>
      )}

      {/* Nút bấm hiển thị dropdown */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            toggleOpen()
          } else if (e.key === 'Escape') {
            setIsOpen(false)
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          height: h,
          padding: '0 10px',
          background: disabled ? 'var(--field-bg-disabled)' : 'var(--field-bg)',
          border: `1px solid ${isOpen ? 'var(--border-focus-color)' : 'var(--field-border)'}`,
          borderRadius: 'var(--radius-control)',
          boxShadow: isOpen ? 'var(--ring-focus)' : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.65 : 1,
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          userSelect: 'none',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {selectedOption ? (
            <>
              {selectedOption.level && (
                <LevelChip level={selectedOption.level} levels={levels || selectedOption.levels} />
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
                {selectedOption.label}
              </span>
              {selectedOption.sub && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  ({selectedOption.sub})
                </span>
              )}
            </>
          ) : (
            <span
              style={{
                fontSize: size === 'sm' ? 12 : 13,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {placeholder}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {clearable && selectedOption && !disabled && (
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
              title="Xoá chọn"
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
            top: 'calc(100% + 4px)',
            left: 0,
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
          {/* Ô tìm kiếm */}
          <div
            style={{
              padding: '7px 8px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--surface-card)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderRadius: 6,
                background: 'var(--surface-inset)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Icon name="search" size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                value={search}
                placeholder={searchPlaceholder}
                onChange={handleSearchChange}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  width: '100%',
                  fontSize: 12,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text-primary)',
                  padding: 0,
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Danh sách options (có lazy load khi cuộn) */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            style={{
              maxHeight: 220,
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
                Không tìm thấy kết quả nào
              </div>
            ) : (
              visibleItems.map((opt) => {
                const isSelected = String(opt.value) === String(value)
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
                      background: isSelected ? 'var(--surface-accent-soft)' : 'transparent',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      opacity: opt.disabled ? 0.5 : 1,
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !opt.disabled) {
                        e.currentTarget.style.background = 'var(--surface-inset)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !opt.disabled) {
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                      {opt.level && (
                        <LevelChip level={opt.level} levels={levels || opt.levels} />
                      )}
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? 'var(--teal-700)' : 'var(--text-primary)',
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
                Đang hiển thị {visibleCount}/{filteredOptions.length} kết quả (cuộn để xem tiếp)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
