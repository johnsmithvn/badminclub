import { useState } from 'react'
import { Button, Dialog, Icon } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'

const Mono = ({ children, color, weight, size, style }) => (
  <span style={{
    font: `${weight || 400} ${size || 13}px/1.2 var(--font-mono)`,
    color: color || 'inherit', letterSpacing: '-0.01em', ...style,
  }}>
    {children}
  </span>
)

/**
 * Modal hiển thị phóng to mã QR thanh toán kèm thông tin tài khoản và nút Copy nhanh.
 *
 * Truyền `onConfirm` thì có thêm nút xác nhận — dùng cho luồng thành viên tự khai đã chuyển
 * tiền. Không truyền thì modal chỉ để xem, đúng như mọi chỗ đang gọi.
 */
export function QrModal({
  title, qrUrl, bankName, accountNo, accountHolder, amount, memo, onClose,
  onConfirm, confirmLabel, confirming,
}) {
  const isMobile = useMobile()
  const [copied, setCopied] = useState(false)

  const copyAccountNo = () => {
    if (!accountNo) return
    navigator.clipboard.writeText(String(accountNo).replace(/\s+/g, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog
      open
      sheet={isMobile}
      title={title || t('bank.qrTitle')}
      onClose={onClose}
      footer={
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          alignItems: 'center',
          paddingBottom: isMobile ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : 0,
        }}>
          <Button variant="secondary" icon={copied ? 'check' : 'copy'} onClick={copyAccountNo}>
            {copied ? t('common.copied') : t('bank.copyNo')}
          </Button>
          {onConfirm ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
              <Button variant="primary" icon="circle-check" disabled={confirming} onClick={onConfirm}>
                {confirmLabel || t('common.confirm')}
              </Button>
            </div>
          ) : (
            <Button variant="primary" onClick={onClose}>
              {t('common.close')}
            </Button>
          )}
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 14, textAlign: 'center', padding: '4px 0' }}>
        {qrUrl ? (
          <div style={{
            display: 'inline-flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 10,
            borderRadius: 12,
            background: 'var(--gray-0)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
            maxWidth: 300,
            margin: '0 auto',
          }}>
            <img
              src={qrUrl}
              alt={t('bank.qrTitle')}
              style={{ width: '100%', height: 'auto', maxHeight: 300, objectFit: 'contain', borderRadius: 8 }}
            />
          </div>
        ) : (
          <div style={{ padding: 24, color: 'var(--text-muted)' }}>
            <Icon name="qr-code" size={48} />
            <div style={{ marginTop: 8 }}>{t('bank.noQr')}</div>
          </div>
        )}

        <div style={{
          display: 'grid',
          gap: 6,
          padding: '10px 14px',
          borderRadius: 8,
          background: 'var(--surface-inset)',
          textAlign: 'left',
          fontSize: 13,
        }}>
          {accountHolder && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('settings.fBankHolder')}:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{accountHolder.toUpperCase()}</span>
            </div>
          )}
          {accountNo && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('settings.fBankNo')}:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mono weight={600} color="var(--navy-700)">{accountNo}</Mono>
                <button
                  type="button"
                  onClick={copyAccountNo}
                  style={{
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    color: copied ? 'var(--status-delivered)' : 'var(--teal-600)',
                    padding: 2,
                  }}
                  title={t('bank.copyNo')}
                >
                  <Icon name={copied ? 'check' : 'copy'} size={14} />
                </button>
              </div>
            </div>
          )}
          {bankName && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('settings.fBankName')}:</span>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{bankName}</span>
            </div>
          )}
          {amount && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('bank.amount')}:</span>
              <Mono weight={600} color="var(--status-delivered)">{amount}</Mono>
            </div>
          )}
          {memo && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('bank.memo')}:</span>
              <span style={{ color: 'var(--text-primary)' }}>{memo}</span>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
