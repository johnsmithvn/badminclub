import { useId, useMemo, useRef, useState } from 'react'
import { Button, Card, Dialog, Icon, Input } from '#ds'
import { banks, findBank, getVietQrUrl, parseVietQr, scanQrCodeFromImage } from '#utils/vietqr.js'
import { QrModal } from '#components/ui/QrModal.jsx'
import { SearchSelect } from '#components/ui/SearchSelect.jsx'
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
  canEdit = true,
  onChange,
  title,
  subtitle,
  card = true,
}) {
  const [showQrModal, setShowQrModal] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanErr, setScanErr] = useState(false)
  const [pendingScan, setPendingScan] = useState(null)
  const fileRef = useRef(null)
  const fileId = useId()

  const detectedBank = useMemo(() => findBank(bankName), [bankName])

  // Sinh link VietQR tự động khi có đủ ngân hàng và STK
  const autoVietQrUrl = useMemo(() => {
    if (!bankNo) return ''
    const bankCode = detectedBank ? detectedBank.bin : bankName
    return getVietQrUrl({
      bankCode,
      accountNo: bankNo,
      accountHolder: bankHolder,
    })
  }, [detectedBank, bankName, bankNo, bankHolder])

  const handleBankChange = (val) => {
    if (onChange) {
      onChange({ bankHolder, bankNo, bankName: val })
    }
  }

  const handleHolderChange = (val) => {
    if (onChange) {
      onChange({ bankHolder: val.toUpperCase(), bankNo, bankName })
    }
  }

  const handleNoChange = (val) => {
    if (onChange) {
      onChange({ bankHolder, bankNo: val.replace(/\s+/g, ''), bankName })
    }
  }

  // Ảnh QR CHỈ để đọc thông tin rồi điền vào form — không tải lên Storage, không lưu vào DB.
  // Mã QR hiển thị luôn được sinh lại từ ngân hàng + số tài khoản (xem `autoVietQrUrl`), nên
  // không có ảnh rác tích trong bucket và cũng không có đường ghi đè QR nhận tiền của người khác.
  const handleScanQr = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setScanning(true)
    setScanErr(false)
    try {
      const qrRaw = await scanQrCodeFromImage(file)
      const parsed = qrRaw ? parseVietQr(qrRaw) : null
      if (parsed && (parsed.bankNo || parsed.bankName)) {
        setPendingScan({
          bankName: parsed.bankName || '',
          bankNo: parsed.bankNo || '',
          bankHolder: parsed.bankHolder || '',
        })
      } else {
        setScanErr(true)
      }
    } catch {
      setScanErr(true)
    } finally {
      setScanning(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const applyPendingScan = () => {
    if (!pendingScan) return
    if (onChange) {
      onChange({
        bankName: pendingScan.bankName || bankName,
        bankNo: pendingScan.bankNo || bankNo,
        // QR không kèm tên thì XOÁ tên cũ. Giữ tên của chủ tài khoản trước bên cạnh số tài
        // khoản mới là kiểu sai lệch khiến người ta yên tâm chuyển nhầm.
        bankHolder: pendingScan.bankHolder || '',
      })
    }
    setPendingScan(null)
  }

  const cancelPendingScan = () => {
    setPendingScan(null)
  }

  const bankOptions = useMemo(() => {
    return banks.map((b) => ({
      value: b.shortName,
      label: `${b.shortName} (${b.code})`,
      sub: b.name,
      icon: 'building-2',
    }))
  }, [])

  const content = (
    <div style={{ display: 'grid', gap: 14 }}>
      {canEdit ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <SearchSelect
              label={t('settings.fBankName')}
              placeholder={t('bank.selectPrompt')}
              value={bankName || ''}
              options={bankOptions}
              onChange={(val) => handleBankChange(val || '')}
              clearable
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
            {autoVietQrUrl ? (
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
                onClick={() => setShowQrModal(true)}
                title={t('bank.clickToEnlarge')}
              >
                <img
                  src={autoVietQrUrl}
                  alt={t('bank.qrTitle')}
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

            <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
              <input
                ref={fileRef}
                id={fileId}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleScanQr}
              />
              <Button
                variant="secondary"
                size="sm"
                icon="scan-line"
                disabled={scanning}
                onClick={() => fileRef.current && fileRef.current.click()}
              >
                {t('bank.scanToFill')}
              </Button>
              {scanErr && (
                <div style={{ fontSize: 11.5, color: 'var(--status-incident)', textAlign: 'center' }}>
                  {t('bank.scanFailed')}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Chế độ chỉ đọc (Read-only view) */
        <div style={{ display: 'grid', gridTemplateColumns: autoVietQrUrl ? '1fr 140px' : '1fr', gap: 14, alignItems: 'center' }}>
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

          {autoVietQrUrl && (
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
              onClick={() => setShowQrModal(true)}
              title={t('bank.clickToEnlarge')}
            >
              <img
                src={autoVietQrUrl}
                alt={t('bank.qrTitle')}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Modal phóng to QR */}
      {showQrModal && autoVietQrUrl && (
        <QrModal
          title={title || t('bank.qrTitle')}
          qrUrl={autoVietQrUrl}
          bankName={bankName}
          accountNo={bankNo}
          accountHolder={bankHolder}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {/* Dialog xác nhận áp dụng thông tin quét từ ảnh QR */}
      {pendingScan && (
        <Dialog
          open
          title={t('bank.confirmScanTitle')}
          onClose={cancelPendingScan}
          actions={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%', flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={cancelPendingScan}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" icon="check" onClick={applyPendingScan}>
                {t('bank.confirmApply')}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'grid', gap: 12, fontSize: 13.5 }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              {t('bank.confirmScanDesc')}
            </p>

            <div style={{
              display: 'grid', gap: 8, padding: '12px 14px',
              background: 'var(--surface-inset)', borderRadius: 8,
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('settings.fBankName')}:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {pendingScan.bankName || t('common.unknown')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('settings.fBankNo')}:</span>
                <Mono weight={600} color="var(--navy-700)">
                  {pendingScan.bankNo || t('common.unknown')}
                </Mono>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('settings.fBankHolder')}:</span>
                <span style={{ fontWeight: 600, color: pendingScan.bankHolder ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {pendingScan.bankHolder || t('bank.noHolderInQr')}
                </span>
              </div>
            </div>
          </div>
        </Dialog>
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
