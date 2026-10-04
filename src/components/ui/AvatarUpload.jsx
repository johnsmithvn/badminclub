import { useRef, useState } from 'react'
import { Avatar, Button, Icon, IconButton } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { uploadImage } from '#utils/image.js'
import { t } from '#i18n'

/**
 * Component Upload & Quản lý Avatar (Ảnh đại diện).
 * Dùng chung cho CLB, Profile tài khoản cá nhân và Thành viên.
 *
 * @param {object} props
 * @param {string} [props.name] Tên để hiển thị chữ cái đầu khi chưa có ảnh
 * @param {string} [props.value] URL ảnh hiện tại (Base64 hoặc link)
 * @param {string} [props.fallbackSrc] Ảnh chỉ để HIỂN THỊ khi chưa có `value` (vd. ảnh tài khoản) — không
 *   tính là đã có ảnh, nên không hiện nút Xoá
 * @param {number} [props.size=64] Kích thước hiển thị pixel
 * @param {boolean} [props.disabled=false]
 * @param {function} props.onChange Callback khi đổi ảnh (trả về dataUrl hoặc '')
 */
export function AvatarUpload({ name = '', value = '', fallbackSrc = '', size = 64, disabled = false, onChange }) {
  // Điện thoại: hai nút chỉ còn icon (máy ảnh / thùng rác) — chữ "Đổi ảnh đại diện" chiếm hết hàng,
  // đẩy ô tên bên cạnh ra ngoài màn hình
  const isMobile = useMobile()
  const fileRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setLoading(true)
    setErr('')
    try {
      const url = await uploadImage(file, { folder: 'avatars', maxWidth: 400, maxHeight: 400, quality: 0.85 })
      onChange(url)
    } catch (error) {
      setErr(error.message || t('common.imageError'))
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          cursor: disabled ? 'default' : 'pointer',
          flexShrink: 0,
        }}
        onClick={() => !disabled && fileRef.current && fileRef.current.click()}
        title={disabled ? '' : t('common.changeAvatar')}
      >
        <Avatar name={name} src={value || fallbackSrc} size={size} />

        {!disabled && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
              transition: 'opacity 0.15s ease',
              color: '#fff',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0' }}
          >
            <Icon name="camera" size={Math.max(16, Math.round(size * 0.32))} />
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        disabled={disabled || loading}
        onChange={handleFileChange}
      />

      {!disabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isMobile ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <IconButton
                icon="camera"
                variant="outline"
                label={value ? t('common.changeAvatar') : t('common.uploadAvatar')}
                disabled={loading}
                onClick={() => fileRef.current && fileRef.current.click()}
              />
              {value && (
                <IconButton
                  icon="trash-2"
                  label={t('common.removeAvatar')}
                  style={{ color: 'var(--status-incident)' }}
                  disabled={loading}
                  onClick={() => onChange('')}
                />
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button
                variant="secondary"
                size="sm"
                icon="camera"
                disabled={loading}
                onClick={() => fileRef.current && fileRef.current.click()}
              >
                {value ? t('common.changeAvatar') : t('common.uploadAvatar')}
              </Button>
              {value && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon="trash-2"
                  style={{ color: 'var(--status-incident)' }}
                  disabled={loading}
                  onClick={() => onChange('')}
                >
                  {t('common.removeAvatar')}
                </Button>
              )}
            </div>
          )}
          {err && <span style={{ fontSize: 11, color: 'var(--status-incident)' }}>{err}</span>}
        </div>
      )}
    </div>
  )
}
