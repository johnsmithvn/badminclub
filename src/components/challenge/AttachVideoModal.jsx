import { useState } from 'react'
import { Button, Dialog, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { playerName, myMember } from '#lib/money.js'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import {
  parseVideoProvider,
  parseSecondsToParts,
  formatPartsToTimestamp,
  addSecondsToTimestamp,
  matchVideosOf,
} from '#utils/videoUtils.js'

/** Danh sách phần để sửa: phần đã lưu, mốc rỗng hiện 00:00; trận chưa có video thì một dòng trống. */
function editablePartsOf(match) {
  const parts = matchVideosOf(match).map((p) => ({ url: p.url, start: p.start || '00:00' }))
  return parts.length ? parts : [{ url: '', start: '00:00' }]
}


export function TimePickerSheet({ open, onClose, value, onSelect, isMobile }) {
  const [currentVal, setCurrentVal] = useState(value || '00:00')
  const [prev, setPrev] = useState({ value, open })

  if (prev.value !== value || prev.open !== open) {
    setPrev({ value, open })
    setCurrentVal(value || '00:00')
  }

  const parts = parseSecondsToParts(currentVal)

  const handleApply = () => {
    // Chuẩn hoá trước khi trả ra: ô gõ tự do bên dưới nhận mọi chuỗi, không lọc thì chuỗi rác
    // ('abc', '1:5') đi thẳng vào DB rồi hiển thị nguyên si ở danh sách trận.
    onSelect(formatPartsToTimestamp(parts))
    onClose()
  }

  const handleReset = () => {
    setCurrentVal('00:00')
  }

  const handlePreset = (presetTs) => {
    setCurrentVal(presetTs)
  }

  const handleAdjustMinutes = (deltaMins) => {
    setCurrentVal((prev) => addSecondsToTimestamp(prev, deltaMins * 60))
  }

  const handleAdjustSeconds = (deltaSec) => {
    setCurrentVal((prev) => addSecondsToTimestamp(prev, deltaSec))
  }

  const handleSetSecondsExact = (val) => {
    const sec = Math.max(0, Math.min(59, parseInt(val, 10) || 0))
    const newTs = formatPartsToTimestamp({
      hours: parts.hours,
      minutes: parts.minutes,
      seconds: sec,
    })
    setCurrentVal(newTs)
  }

  const handleSetMinutesExact = (val) => {
    const min = Math.max(0, parseInt(val, 10) || 0)
    const newTs = formatPartsToTimestamp({
      hours: parts.hours,
      minutes: min,
      seconds: parts.seconds,
    })
    setCurrentVal(newTs)
  }

  const handleSetHoursExact = (val) => {
    const hr = Math.max(0, parseInt(val, 10) || 0)
    const newTs = formatPartsToTimestamp({
      hours: hr,
      minutes: parts.minutes,
      seconds: parts.seconds,
    })
    setCurrentVal(newTs)
  }

  const PRESETS = [
    '00:00',
    '05:00',
    '10:00',
    '15:00',
    '20:00',
    '25:00',
    '30:00',
    '40:00',
    '50:00',
    '1:00:00',
    '1:15:00',
    '1:30:00',
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      sheet={isMobile}
      width={390}
      zIndex={75}
      title={t('matchVideo.timePickerTitle')}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
          <button
            type="button"
            onClick={handleReset}
            style={{
              height: 40,
              padding: '0 14px',
              borderRadius: 8,
              background: 'var(--surface-raised, #101927)',
              border: '1px solid var(--border-default, #2E3E5C)',
              font: "500 12.5px/1 'IBM Plex Sans', sans-serif",
              color: 'var(--text-secondary, #A8B7CB)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Icon name="rotate-ccw" size={13} />
            <span>{t('matchVideo.timePickerReset')}</span>
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{
              height: 40,
              padding: '0 20px',
              borderRadius: 8,
              background: 'var(--teal-500, #00B2A9)',
              border: 'none',
              font: "600 13.5px/1 'IBM Plex Sans', sans-serif",
              color: '#04302C',
              cursor: 'pointer',
            }}
          >
            {t('matchVideo.timePickerApply')}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
        {/* Màn hình số thời gian lớn & Cho phép nhập trực tiếp Phút:Giây */}
        <div
          style={{
            background: 'var(--surface-sunken, #0E1726)',
            border: '1px solid var(--border-subtle, #22304A)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {parts.hours > 0 && (
              <>
                <div style={{ textAlign: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={parts.hours}
                    onChange={(e) => handleSetHoursExact(e.target.value)}
                    style={{
                      width: 54,
                      background: 'var(--surface-raised, #101927)',
                      border: '1px solid var(--border-default, #2E3E5C)',
                      borderRadius: 6,
                      textAlign: 'center',
                      font: "700 24px/1 'IBM Plex Mono', monospace",
                      color: 'var(--teal-500, #00B2A9)',
                      padding: '4px 2px',
                    }}
                  />
                  <div style={{ font: "500 10px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', marginTop: 4 }}>
                    {t('matchVideo.unitHours')}
                  </div>
                </div>
                <span style={{ font: "700 22px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>:</span>
              </>
            )}

            <div style={{ textAlign: 'center' }}>
              <input
                type="number"
                min="0"
                max="999"
                value={parts.minutes}
                onChange={(e) => handleSetMinutesExact(e.target.value)}
                style={{
                  width: 60,
                  background: 'var(--surface-raised, #101927)',
                  border: '1px solid var(--border-default, #2E3E5C)',
                  borderRadius: 6,
                  textAlign: 'center',
                  font: "700 24px/1 'IBM Plex Mono', monospace",
                  color: 'var(--teal-500, #00B2A9)',
                  padding: '4px 2px',
                }}
              />
              <div style={{ font: "500 10px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', marginTop: 4 }}>
                {t('matchVideo.unitMinutes')}
              </div>
            </div>

            <span style={{ font: "700 22px/1 'IBM Plex Mono', monospace", color: 'var(--text-muted)' }}>:</span>

            <div style={{ textAlign: 'center' }}>
              <input
                type="number"
                min="0"
                max="59"
                value={parts.seconds}
                onChange={(e) => handleSetSecondsExact(e.target.value)}
                style={{
                  width: 60,
                  background: 'var(--surface-raised, #101927)',
                  border: '1px solid var(--border-default, #2E3E5C)',
                  borderRadius: 6,
                  textAlign: 'center',
                  font: "700 24px/1 'IBM Plex Mono', monospace",
                  color: 'var(--teal-500, #00B2A9)',
                  padding: '4px 2px',
                }}
              />
              <div style={{ font: "500 10px/1 'IBM Plex Sans', sans-serif", color: 'var(--text-muted)', marginTop: 4 }}>
                {t('matchVideo.unitSeconds')}
              </div>
            </div>
          </div>

          {/* Ô gõ tự do chuỗi thời gian */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {t('matchVideo.typeTimestamp')}
            </span>
            <input
              type="text"
              value={currentVal}
              onChange={(e) => setCurrentVal(e.target.value)}
              onBlur={() => setCurrentVal(formatPartsToTimestamp(parts))}
              placeholder={t('matchVideo.typeTimestampPlaceholder')}
              style={{
                flex: 1,
                minWidth: 0,
                height: 30,
                padding: '0 8px',
                borderRadius: 6,
                background: 'var(--field-bg, #0E1726)',
                border: '1px solid var(--border-default, #2E3E5C)',
                font: "600 12.5px/1 'IBM Plex Mono', monospace",
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Lưới mốc trận phổ biến */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {t('matchVideo.commonMatchPresets')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {PRESETS.map((ts) => {
              const active = currentVal === ts
              return (
                <button
                  key={ts}
                  type="button"
                  onClick={() => handlePreset(ts)}
                  style={{
                    height: 34,
                    padding: '0 4px',
                    borderRadius: 7,
                    background: active ? 'rgba(0, 178, 169, 0.2)' : 'var(--surface-raised, #101927)',
                    border: active ? '1px solid var(--teal-500, #00B2A9)' : '1px solid var(--border-default, #2E3E5C)',
                    color: active ? 'var(--teal-500, #00B2A9)' : 'var(--text-secondary)',
                    font: "600 12.5px/1 'IBM Plex Mono', monospace",
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {ts}
                </button>
              )
            })}
          </div>
        </div>

        {/* Bộ tăng giảm phút */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {t('matchVideo.adjustMinutes')}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[-10, -5, -1, 1, 5, 10].map((m) => {
              const label = m > 0 ? `+${m}′` : `${m}′`
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleAdjustMinutes(m)}
                  style={{
                    flex: 1,
                    minWidth: 46,
                    height: 34,
                    borderRadius: 7,
                    background: 'var(--surface-raised, #101927)',
                    border: '1px solid var(--border-default, #2E3E5C)',
                    color: m > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                    font: "600 12px/1 'IBM Plex Sans', sans-serif",
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Chọn & tinh chỉnh giây */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {t('matchVideo.adjustSeconds')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('matchVideo.exactSeconds')}</span>
              <input
                type="number"
                min="0"
                max="59"
                value={parts.seconds}
                onChange={(e) => handleSetSecondsExact(e.target.value)}
                style={{
                  width: 50,
                  height: 26,
                  textAlign: 'center',
                  background: 'var(--field-bg, #0E1726)',
                  border: '1px solid var(--border-default, #2E3E5C)',
                  borderRadius: 5,
                  font: "600 12.5px/1 'IBM Plex Mono', monospace",
                  color: 'var(--teal-500, #00B2A9)',
                }}
              />
            </div>
          </div>

          {/* Các nút nhích từng giây */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[-5, -1, 1, 5].map((sec) => {
              const label = sec > 0 ? `+${sec}s` : `${sec}s`
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => handleAdjustSeconds(sec)}
                  style={{
                    flex: 1,
                    height: 32,
                    borderRadius: 6,
                    background: 'var(--surface-raised, #101927)',
                    border: '1px solid var(--border-default, #2E3E5C)',
                    color: sec > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                    font: "600 12px/1 'IBM Plex Sans', sans-serif",
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[0, 15, 30, 45].map((s) => {
              const active = parts.seconds === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSetSecondsExact(s)}
                  style={{
                    height: 34,
                    borderRadius: 7,
                    background: active ? 'rgba(0, 178, 169, 0.2)' : 'var(--surface-raised, #101927)',
                    border: active ? '1px solid var(--teal-500, #00B2A9)' : '1px solid var(--border-default, #2E3E5C)',
                    color: active ? 'var(--teal-500, #00B2A9)' : 'var(--text-secondary)',
                    font: "600 12.5px/1 'IBM Plex Mono', monospace",
                    cursor: 'pointer',
                  }}
                >
                  {`:${String(s).padStart(2, '0')}`}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export function QuickTimestampPicker({ value, onChange, isMobile, compact = false, chips = true }) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const handleQuickAdd = (deltaSec) => {
    onChange(addSecondsToTimestamp(value || '00:00', deltaSec))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Ô nhập trực tiếp mốc thời gian (phút:giây) + nút mở Picker */}
      <div
        style={{
          height: compact ? 36 : 46,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 8px 0 10px',
          borderRadius: compact ? 7 : 10,
          background: 'var(--field-bg, #0E1726)',
          border: '1px solid var(--border-default, #2E3E5C)',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s ease',
        }}
      >
        <Icon name="clock" size={14} style={{ color: 'var(--teal-500, #00B2A9)', flexShrink: 0 }} />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onChange(formatPartsToTimestamp(parseSecondsToParts(value || '')))}
          placeholder="00:00"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            font: "600 13.5px/1 'IBM Plex Mono', monospace",
            color: value && value !== '00:00' ? '#5FDBD3' : 'var(--text-primary)',
            padding: 0,
          }}
          title={t('matchVideo.fieldTimestamp')}
        />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          title={t('matchVideo.timePickerTitle')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: compact ? 26 : 30,
            height: compact ? 26 : 30,
            borderRadius: 6,
            background: 'var(--surface-raised, #101927)',
            border: '1px solid var(--border-subtle, #22304A)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <Icon name="chevron-down" size={13} />
        </button>
      </div>

      {/* Dải chip tua nhanh 1 chạm — tắt khi có nhiều phần video cho form khỏi dài (vẫn còn nút mở bộ chọn) */}
      {chips && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onChange('00:00')}
          title={t('matchVideo.timePickerReset')}
          style={{
            height: 23,
            padding: '0 6px',
            borderRadius: 5,
            background: 'var(--surface-raised, #101927)',
            border: '1px solid var(--border-subtle, #22304A)',
            font: "600 10.5px/1 'IBM Plex Mono', monospace",
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          00:00
        </button>
        {[-5, -1, 1, 5].map((sec) => {
          const label = sec > 0 ? `+${sec}s` : `${sec}s`
          return (
            <button
              key={sec}
              type="button"
              onClick={() => handleQuickAdd(sec)}
              style={{
                height: 23,
                padding: '0 6px',
                borderRadius: 5,
                background: 'rgba(0, 178, 169, 0.08)',
                border: '1px solid rgba(0, 178, 169, 0.25)',
                font: "600 11px/1 'IBM Plex Sans', sans-serif",
                color: 'var(--teal-500, #00B2A9)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          )
        })}
        {[30, 60, 300].map((delta) => {
          const label = delta < 60 ? `+${delta}s` : `+${delta / 60}′`
          return (
            <button
              key={delta}
              type="button"
              onClick={() => handleQuickAdd(delta)}
              style={{
                height: 23,
                padding: '0 6px',
                borderRadius: 5,
                background: 'rgba(0, 178, 169, 0.08)',
                border: '1px solid rgba(0, 178, 169, 0.25)',
                font: "600 11px/1 'IBM Plex Sans', sans-serif",
                color: 'var(--teal-500, #00B2A9)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>}

      {pickerOpen && (
        <TimePickerSheet
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          value={value || '00:00'}
          onSelect={onChange}
          isMobile={isMobile}
        />
      )}
    </div>
  )
}

const PART_LABEL_STYLE = {
  font: '600 10.5px/1.2 "IBM Plex Sans", sans-serif',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

/**
 * Các dòng link video của một trận — video bị cắt nhiều phần (Part 1, Part 2…). Dùng chung cho modal
 * và khung gắn trong bảng. Một phần thì y như trước (ô link + mốc kèm nút tua); nhiều phần thì mỗi
 * dòng gọn: nhãn Part N, ô link, ô mốc, nút bỏ. Không đặt tên phần — xem thì tự hiện Part 1, Part 2.
 *
 * `lockCount`: số phần đầu KHÔNG cho bỏ (thành viên thường không được xoá phần đã lưu — RPC
 * attach_match_videos cũng chặn); phần vừa thêm thì bỏ thoải mái.
 * `large`: ô cao 46px như modal; mặc định 36px như khung trong bảng.
 */
function VideoPartsEditor({ parts, onChange, isMobile, lockCount = 0, large = false }) {
  const [pastedIdx, setPastedIdx] = useState(null)
  const multi = parts.length > 1
  const h = large ? 46 : 36
  const setPart = (i, patch) => onChange(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  const paste = async (i) => {
    try {
      const text = await navigator.clipboard?.readText?.()
      if (text) {
        setPart(i, { url: text.trim() })
        setPastedIdx(i)
        setTimeout(() => setPastedIdx(null), 2000)
      }
    } catch {
      // trình duyệt không cho đọc clipboard
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {parts.map((p, i) => {
        const provider = parseVideoProvider(p.url)
        return (
          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 260px', minWidth: 0, display: 'grid', gap: 6 }}>
              <div style={{ ...PART_LABEL_STYLE, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{multi ? t('matchVideo.partLabel', { n: i + 1 }) : t('matchVideo.fieldUrl')}</span>
                {provider === 'youtube' && <span style={{ color: '#FF4E45', font: '600 10px/1 "IBM Plex Sans", sans-serif' }}>● YouTube</span>}
                {provider === 'drive' && <span style={{ color: '#0F9D58', font: '600 10px/1 "IBM Plex Sans", sans-serif' }}>● Google Drive</span>}
                {provider === 'icloud' && <span style={{ color: '#AF52DE', font: '600 10px/1 "IBM Plex Sans", sans-serif' }}>● iCloud Photos</span>}
              </div>
              <div
                style={{
                  height: h,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 11px',
                  borderRadius: large ? 10 : 7,
                  background: 'var(--field-bg)',
                  border: `1px solid ${p.url ? 'var(--teal-500)' : 'var(--border-default)'}`,
                  boxSizing: 'border-box',
                }}
              >
                <input
                  type="text"
                  value={p.url}
                  onChange={(e) => setPart(i, { url: e.target.value })}
                  placeholder={t('matchVideo.urlPlaceholder')}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    font: '400 12.5px/1 "IBM Plex Mono", monospace',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => paste(i)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    font: '600 11.5px/1 "IBM Plex Sans", sans-serif',
                    color: pastedIdx === i ? '#8BEDE6' : '#5FDBD3',
                    cursor: 'pointer',
                    padding: '4px 4px',
                    flexShrink: 0,
                  }}
                >
                  {pastedIdx === i ? t('matchVideo.pastedSuccess') : t('matchVideo.pasteBtn')}
                </button>
              </div>
            </div>

            <div style={{ flex: multi ? '0 0 150px' : '0 1 330px', minWidth: 0, display: 'grid', gap: 6 }}>
              <div style={PART_LABEL_STYLE}>{t('matchVideo.fieldTimestamp')}</div>
              <QuickTimestampPicker
                value={p.start}
                onChange={(v) => setPart(i, { start: v })}
                isMobile={isMobile}
                compact={!large}
                chips={!multi}
              />
            </div>

            {multi && i >= lockCount && (
              <button
                type="button"
                onClick={() => onChange(parts.filter((_, j) => j !== i))}
                title={t('matchVideo.removePart')}
                aria-label={t('matchVideo.removePart')}
                style={{
                  alignSelf: 'flex-end',
                  width: 32,
                  height: large ? 46 : 36,
                  borderRadius: 7,
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => onChange([...parts, { url: '', start: '00:00' }])}
        style={{
          justifySelf: 'start',
          height: 30,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '0 12px',
          borderRadius: 999,
          background: 'transparent',
          border: '1px dashed var(--border-default)',
          font: '600 12px/1 "IBM Plex Sans", sans-serif',
          color: 'var(--teal-500)',
          cursor: 'pointer',
        }}
      >
        <Icon name="plus" size={13} />
        {t('matchVideo.addPart')}
      </button>
    </div>
  )
}

export function MatchVideoInlineExpander({
  match,
  matchCode,
  timeStr,
  courtVenueStr,
  teamText,
  scoreText,
  onSave,
  onCancel,
  lockCount = 0,
}) {
  const [parts, setParts] = useState(() => editablePartsOf(match))
  const [note, setNote] = useState(match?.videoNote || '')

  // Chuẩn hoá (bỏ dòng trống, mốc mm:ss) nằm ở appActions.attachMatchVideo → cleanVideoParts.
  const handleSave = () => {
    onSave({ videos: parts, videoNote: note.trim() })
  }

  return (
    <div
      style={{
        background: 'var(--surface-sunken)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        padding: '13px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        margin: '6px 12px 12px',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ font: '600 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-accent)' }}>
          {matchCode || match?.id?.slice(0, 6)}
        </div>
        <div style={{ font: '600 13px/1 "IBM Plex Mono", monospace', color: 'var(--text-primary)' }}>
          {timeStr || '19:00'}
        </div>
        {courtVenueStr && (
          <div style={{ font: '400 12px/1 "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>
            {courtVenueStr}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 160, font: '600 13.5px/1.3 "IBM Plex Sans", sans-serif', color: 'var(--text-primary)' }}>
          {teamText}
          {scoreText && (
            <span style={{ font: '600 14px/1 "IBM Plex Mono", monospace', color: 'var(--text-primary)', padding: '0 6px' }}>
              {scoreText}
            </span>
          )}
        </div>
      </div>

      {/* Hàng tự xuống dòng, canh mép TRÊN. Trước đây là lưới cột giờ 140px + canh đáy: 8 nút tua
          gãy thành 3 hàng, cột giờ cao vọt và kéo ô link / ghi chú tụt xuống đáy, để trống cả góc trên. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
        {/* Các phần video (link + mốc mỗi phần, nút Thêm part) */}
        <div style={{ flex: '1 1 600px', minWidth: 0 }}>
          <VideoPartsEditor parts={parts} onChange={setParts} isMobile={false} lockCount={lockCount} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 180px', minWidth: 0 }}>
          <div style={{ font: '600 10.5px/1.2 "IBM Plex Sans", sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {t('matchVideo.fieldNote')}
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('matchVideo.notePlaceholder')}
            style={{
              height: 36,
              padding: '0 11px',
              borderRadius: 7,
              background: 'var(--field-bg)',
              border: '1px solid var(--border-subtle)',
              font: '400 12px/1 "IBM Plex Sans", sans-serif',
              color: 'var(--text-primary)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240, font: '400 12px/1.5 "IBM Plex Sans", sans-serif', color: 'var(--text-muted)' }}>
          {t('matchVideo.storageNotice')}
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 32,
            padding: '0 12px',
            borderRadius: 7,
            border: 'none',
            background: 'transparent',
            font: '600 12.5px/1 "IBM Plex Sans", sans-serif',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={{
            height: 32,
            padding: '0 14px',
            borderRadius: 7,
            border: 'none',
            background: 'var(--action-accent-bg)',
            font: '600 12.5px/1 "IBM Plex Sans", sans-serif',
            color: 'var(--action-accent-fg)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {t('matchVideo.saveLink')}
        </button>
      </div>
    </div>
  )
}

/**
 * Modal / Bottom Sheet gắn link YouTube / Google Drive / iCloud cho trận đấu
 * Thiết kế chuẩn V3 từ mockup giao diện
 */
export default function AttachVideoModal({ match, matchCode, onClose, onSave, onSaved }) {
  const { db, a } = useApp()
  const isMobile = useMobile()
  const [parts, setParts] = useState(() => editablePartsOf(match))
  const [note, setNote] = useState(match?.videoNote || '')
  const savedCount = matchVideosOf(match).length
  const hasDrivePart = parts.some((p) => parseVideoProvider(p.url) === 'drive')

  // Thông tin 2 đội & tỷ số trận đấu để render preview box chuẩn V3
  const teamA = match?.teamA || []
  const teamB = match?.teamB || []
  const aWon = match?.winnerTeam === 'A'
  const winnerTeam = aWon ? teamA : teamB
  const loserTeam = aWon ? teamB : teamA
  const winnerNames = winnerTeam.map((id) => playerName(db, id)).join(' · ') || (aWon ? 'A' : 'B')
  const loserNames = loserTeam.map((id) => playerName(db, id)).join(' · ') || (aWon ? 'B' : 'A')

  const scoreSets = (match?.sets || []).map(([a, b]) => ({
    winPts: aWon ? a : b,
    losePts: aWon ? b : a,
  }))
  const isMultiSet = scoreSets.length > 1
  const winSetsCount = isMultiSet ? scoreSets.filter((s) => s.winPts > s.losePts).length : 0
  const loseSetsCount = isMultiSet ? scoreSets.filter((s) => s.losePts > s.winPts).length : 0

  const timeStr = match?.at
    ? new Date(match.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : ''
  const codeStr = matchCode || (match?.id ? `M-${String(match.id).slice(-4)}` : '')
  const subDesc = timeStr ? `${codeStr} · ${timeStr}` : codeStr

  const myMem = myMember(db)
  const role = db.viewAs || myMem?.role || 'member'
  const isAdmin = role === 'owner' || role === 'treasurer'

  // Chuẩn hoá (bỏ dòng trống, mốc mm:ss) nằm ở appActions.attachMatchVideo → cleanVideoParts.
  const handleSave = () => {
    const data = { videos: parts, videoNote: note.trim() }
    if (onSave) {
      onSave(data)
    } else if (a?.attachMatchVideo && match?.id) {
      a.attachMatchVideo(match.id, data)
    }
    if (onSaved) onSaved(data)
    onClose()
  }

  const handleRemove = () => {
    if (!isAdmin) return
    const data = { videos: [], videoNote: null }
    if (onSave) {
      onSave(data)
    } else if (a?.attachMatchVideo && match?.id) {
      a.attachMatchVideo(match.id, data)
    }
    if (onSaved) onSaved(data)
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      sheet={isMobile}
      width={460}
      title={t('matchVideo.sheetTitle')}
      description={subDesc}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
          {savedCount > 0 && isAdmin ? (
            <Button variant="danger" onClick={handleRemove}>
              {t('matchVideo.removeLink')}
            </Button>
          ) : (
            <div />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 44,
                padding: '0 18px',
                borderRadius: 10,
                background: 'var(--surface-raised, #101927)',
                border: '1px solid var(--border-default, #2E3E5C)',
                font: "600 13.5px/1 'IBM Plex Sans', sans-serif",
                color: 'var(--text-secondary, #A8B7CB)',
                cursor: 'pointer',
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                height: 44,
                padding: '0 24px',
                borderRadius: 10,
                background: 'var(--teal-500, #00B2A9)',
                border: 'none',
                font: "600 14px/1 'IBM Plex Sans', sans-serif",
                color: '#04302C',
                cursor: 'pointer',
              }}
            >
              {t('matchVideo.saveLink')}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13, padding: '4px 0' }}>
        {/* Preview box: 2 đội và điểm số chuẩn V3 */}
        <div
          style={{
            background: 'var(--surface-sunken, #101927)',
            border: '1px solid var(--border-subtle, #22304A)',
            borderRadius: 10,
            padding: '11px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0, font: "600 14px/1.25 'IBM Plex Sans', sans-serif", color: '#5FDBD3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {winnerNames}
            </span>
            <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: '#8BEDE6' }}>
              {isMultiSet ? winSetsCount : (scoreSets[0]?.winPts ?? '—')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0, font: "500 13.5px/1.25 'IBM Plex Sans', sans-serif", color: '#BFCDDE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {loserNames}
            </span>
            <span style={{ font: "600 20px/1 'IBM Plex Mono', monospace", color: '#B3C2D6' }}>
              {isMultiSet ? loseSetsCount : (scoreSets[0]?.losePts ?? '—')}
            </span>
          </div>
        </div>

        {/* Các phần video: Part 1, Part 2… (video bị cắt nhiều phần) */}
        <VideoPartsEditor
          parts={parts}
          onChange={setParts}
          isMobile={isMobile}
          lockCount={isAdmin ? 0 : savedCount}
          large
        />

        <div style={{ font: "400 11.5px/1.45 'IBM Plex Sans', sans-serif", color: 'var(--text-muted, #8494AA)' }}>
          {t('matchVideo.storageNotice')}
        </div>

        {hasDrivePart && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              padding: '7px 10px',
              borderRadius: 6,
              background: 'rgba(224, 138, 0, 0.12)',
              border: '1px solid rgba(224, 138, 0, 0.3)',
              font: "500 11.5px/1.4 'IBM Plex Sans', sans-serif",
              color: '#FFB84D',
            }}
          >
            <Icon name="alert-circle" size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{t('matchVideo.drivePermissionNotice')}</span>
          </div>
        )}

        {/* Ghi chú: một cho cả trận */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ font: "600 11px/1.2 'IBM Plex Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted, #8494AA)' }}>
            {t('matchVideo.fieldNote')}
          </div>
          <div
            style={{
              height: 46,
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              borderRadius: 10,
              background: 'var(--field-bg, #0E1726)',
              border: '1px solid var(--border-default, #2E3E5C)',
            }}
          >
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('matchVideo.notePlaceholder')}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                font: "400 13px/1 'IBM Plex Sans', sans-serif",
                color: 'var(--text-primary, #E9EFF7)',
              }}
            />
          </div>
        </div>

        {/* Banner chú ý */}
        <div
          style={{
            padding: '11px 12px',
            borderRadius: 9,
            background: 'rgba(0,178,169,.10)',
            border: '1px solid rgba(0,178,169,.35)',
            font: "400 12px/1.5 'IBM Plex Sans', sans-serif",
            color: '#A8B7CB',
          }}
        >
          {t('matchVideo.sessionVideosSub')}
        </div>
      </div>
    </Dialog>
  )
}
