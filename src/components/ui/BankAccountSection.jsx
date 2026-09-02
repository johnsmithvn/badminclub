import { useId, useMemo, useRef, useState } from 'react'
import { Button, Card, Icon, Input, Select } from '#ds'
import { banks, findBank, getVietQrUrl } from '#utils/vietqr.js'
import { uploadImage } from '#utils/image.js'
import { QrModal } from '#components/ui/QrModal.jsx'
import { t } from '#i18n'

const Overline = ({ children, style }) => (
  <div style={{
    font: 'var(--type-overline)', textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-caps)', color: 'var(--text-muted)', ...style,
  }}>
    {children}
  </div>
)

const Mono = ({ children, color, weight, size, style }) => (
  <span style={{
    font: `${weight || 400} ${size || 13}px/1.2 var(--font-mono)`,
    color: color || 'inherit', letterSpacing: '-0.01em', ...style,
  }}>
    {children}
  </span>
)

/**
 * Component quản lý thông tin tài khoản chuyển khoản & mã QR chuẩn.
 * Dùng chung cho CLB (Settings), Profile tài khoản cá nhân, và Thành viên (Members).
 */
export function BankAccountSection({
  bankHolder = '',
  bankNo = '',
  bankName = '',
  qrUrl = '',
  canEdit = true,
  onChange,
  title,
  subtitle,
  card = true,
}) {
  const fileRef = useRef(null)
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const uploadInputId = useId()

  // Tìm ngân hàng hiện tại
  const currentBank = useMemo(() => findBank(bankName), [bankName])

  // Sinh mã VietQR tự động nếu có đủ ngân hàng và STK
  const autoQrUrl = useMemo(() => {
    if (!currentBank || !bankNo) return null
    return getVietQrUrl({
      bankCode: currentBank.bin,
      accountNo: bankNo,
      accountHolder: bankHolder,
    })
  }, [currentBank, bankNo, bankHolder])

  // QR hiển thị ưu tiên ảnh upload riêng, nếu không có thì dùng VietQR tự động
  const displayQrUrl = qrUrl || autoQrUrl

  const handleBankChange = (val) => {
    const b = findBank(val)
    const newName = b ? b.shortName : val
    if (onChange) {
      onChange({ bankHolder, bankNo, bankName: newName, qrUrl })
    }
  }

  const handleHolderChange = (val) => {
    if (onChange) {
      onChange({ bankHolder: val.toUpperCase(), bankNo, bankName, qrUrl })
    }
  }

  const handleNoChange = (val) => {
    if (onChange) {
      onChange({ bankHolder, bankNo: val.replace(/\s+/g, ''), bankName, qrUrl })
    }
  }

  const handleCustomQrUpload = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadImage(file, { folder: 'qrcodes', maxWidth: 800, maxHeight: 800, quality: 0.85 })
      if (onChange) {
        onChange({ bankHolder, bankNo, bankName, qrUrl: url })
      }
    } catch {
      // Bỏ qua lỗi
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleRemoveCustomQr = () => {
    if (onChange) {
      onChange({ bankHolder, bankNo, bankName, qrUrl: '' })
    }
  }

  const bankOptions = useMemo(() => {
    const list = banks.map((b) => ({
      value: b.shortName,
      label: `${b.shortName} (${b.code}) — ${b.name}`,
    }))
    return [{ value: '', label: t('bank.selectPrompt') }].concat(list)
  }, [])

  const content = (
    <div style={{ display: 'grid', gap: 14 }}>
      {canEdit ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <Select
              label={t('settings.fBankName')}
              value={bankName || ''}
              options={bankOptions}
              onChange={(e) => handleBankChange(e.target.value)}
            />
            <Input
              label={t('settings.fBankNo')}
              mono
              placeholder="0912345678"
              value={bankNo || ''}
              onChange={(e) => handleNoChange(e.target.value)}
            />
            <Input
              label={t('settings.fBankHolder')}
              placeholder="NGUYEN VAN A"
              value={bankHolder || ''}
              onChange={(e) => handleHolderChange(e.target.value)}
            />
          </div>

          {/* Cột hiển thị & Upload QR */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 12,
            borderRadius: 8,
            background: 'var(--surface-inset)',
            border: '1px solid var(--border-subtle)',
          }}>
            {displayQrUrl ? (
              <div
                style={{
                  position: 'relative',
                  width: 140,
                  height: 140,
                  background: '#fff',
                  borderRadius: 8,
                  padding: 6,
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => setShowModal(true)}
                title={t('bank.clickToEnlarge')}
              >
                <img
                  src={displayQrUrl}
                  alt="QR Code"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
                <span style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  padding: '2px 4px',
                  borderRadius: 4,
                  fontSize: 10,
                }}>
                  <Icon name="maximize-2" size={10} />
                </span>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px 8px' }}>
                <Icon name="qr-code" size={36} />
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  {t('bank.qrAutoHint')}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              <input
                ref={fileRef}
                id={uploadInputId}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleCustomQrUpload}
              />
              <Button
                variant="secondary"
                size="sm"
                icon="upload"
                disabled={uploading}
                onClick={() => fileRef.current && fileRef.current.click()}
              >
                {qrUrl ? t('bank.changeCustomQr') : t('bank.uploadCustomQr')}
              </Button>
              {qrUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  style={{ color: 'var(--status-incident)' }}
                  onClick={handleRemoveCustomQr}
                >
                  {t('bank.useAutoQr')}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Chế độ chỉ đọc (Read-only view) */
        <div style={{ display: 'grid', gridTemplateColumns: displayQrUrl ? '1fr 140px' : '1fr', gap: 14, alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gap: 2 }}>
              <Overline>{t('settings.fBankHolder')}</Overline>
              <Mono weight={600} color="var(--text-primary)">
                {bankHolder ? bankHolder.toUpperCase() : t('common.unknown')}
              </Mono>
            </div>
            <div style={{ display: 'grid', gap: 2 }}>
              <Overline>{t('settings.fBankNo')}</Overline>
              <Mono weight={600} color="var(--navy-700)">
                {bankNo || t('common.unknown')}
              </Mono>
            </div>
            <div style={{ display: 'grid', gap: 2 }}>
              <Overline>{t('settings.fBankName')}</Overline>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {bankName || t('common.unknown')}
              </span>
            </div>
          </div>

          {displayQrUrl && (
            <div
              style={{
                width: 120,
                height: 120,
                background: '#fff',
                borderRadius: 8,
                padding: 4,
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
              onClick={() => setShowModal(true)}
              title={t('bank.clickToEnlarge')}
            >
              <img
                src={displayQrUrl}
                alt="QR Code"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Modal phóng to QR */}
      {showModal && displayQrUrl && (
        <QrModal
          title={title || t('bank.qrTitle')}
          qrUrl={displayQrUrl}
          bankName={bankName}
          accountNo={bankNo}
          accountHolder={bankHolder}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )

  if (!card) return content

  return (
    <Card
      title={title || t('settings.bankTitle')}
      subtitle={subtitle || t('settings.bankSub')}
      icon="landmark"
      padding="14px 16px"
    >
      {content}
    </Card>
  )
}
