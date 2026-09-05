import React, { useState, useMemo, useRef } from 'react'
import { Button, Icon, Input, Select } from '#ds'
import { AvatarUpload, SearchSelect, DeleteClubDialog, QrModal } from '#ui'
import {
  FormRow,
  ToggleSwitch,
  Stepper,
  SettingsCard,
  DangerZoneCard,
  LevelPillsManager,
} from '#components/settings/SettingsComponents.jsx'
import { banks, findBank, getVietQrUrl, parseVietQr, scanQrCodeFromImage } from '#utils/vietqr.js'
import { t } from '#i18n'

export default function GeneralTab({
  data,
  onChange,
  canEdit = true,
  usedLevels = [],
  activeClub,
  onClubDeleted,
}) {
  const [showQrModal, setShowQrModal] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanErr, setScanErr] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const fileRef = useRef(null)

  const bank = data.bank || {}
  const detectedBank = useMemo(() => findBank(bank.bank), [bank.bank])

  const autoVietQrUrl = useMemo(() => {
    if (!bank.no) return ''
    const bankCode = detectedBank ? detectedBank.bin : bank.bank
    return getVietQrUrl({
      bankCode,
      accountNo: bank.no,
      accountHolder: bank.holder,
    })
  }, [detectedBank, bank.bank, bank.no, bank.holder])

  const handleCopyCode = () => {
    if (!data.code) return
    navigator.clipboard?.writeText(data.code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleScanQr = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setScanning(true)
    setScanErr('')
    try {
      const qrRaw = await scanQrCodeFromImage(file)
      const parsed = qrRaw ? parseVietQr(qrRaw) : null
      if (parsed && (parsed.bankNo || parsed.bankName)) {
        onChange('bank', {
          holder: (parsed.bankHolder || bank.holder || '').toUpperCase(),
          no: parsed.bankNo || bank.no || '',
          bank: parsed.bankName || bank.bank || '',
        })
      } else {
        setScanErr(t('settings.qrScanError'))
      }
    } catch (err) {
      setScanErr(err.message || t('settings.qrScanError'))
    }
    setScanning(false)
  }

  const debtBannerOptions = [
    { value: 'slim', label: t('settings.debtBannerOpt.slim') },
    { value: 'alert', label: t('settings.debtBannerOpt.alert') },
    { value: 'bar', label: t('settings.debtBannerOpt.bar') },
    { value: 'off', label: t('settings.debtBannerOpt.off') },
  ]

  const bankOptions = useMemo(() => {
    return banks.map((b) => ({
      value: b.code,
      label: `${b.shortName} - ${b.name}`,
      sub: b.code,
    }))
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, alignItems: 'start' }}>
      {/* 1. Thông tin CLB */}
      <SettingsCard
        title={t('settings.clubTitle')}
        subtitle={t('settings.clubSub')}
        icon="building-2"
      >
        <FormRow label={t('settings.fAvatar')} labelWidth={170} alignTop>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <AvatarUpload
              name={data.name || ''}
              value={data.avatarUrl || ''}
              size={52}
              disabled={!canEdit}
              onChange={(url) => onChange('avatarUrl', url)}
            />
            {data.avatarUrl && canEdit && (
              <button
                type="button"
                onClick={() => onChange('avatarUrl', '')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#c0392b',
                  fontSize: 12.5,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {t('settings.fAvatarDel')}
              </button>
            )}
          </div>
        </FormRow>

        <FormRow label={t('settings.fClubName')} labelWidth={170}>
          <Input
            value={data.name || ''}
            disabled={!canEdit}
            placeholder={t('settings.fClubName')}
            onChange={(e) => onChange('name', e.target.value)}
          />
        </FormRow>

        <FormRow
          label={t('settings.fClubCode')}
          labelWidth={170}
          note={t('settings.codeNote')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: '#f4f6f9',
                border: '1px solid #d4dce7',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                fontSize: 14,
                color: '#10203c',
                letterSpacing: '.1em',
              }}
            >
              {data.code || '—'}
            </div>
            {data.code && (
              <Button
                variant="ghost"
                size="sm"
                icon={copiedCode ? 'check' : 'copy'}
                onClick={handleCopyCode}
              >
                {copiedCode ? t('common.copied') : t('common.copy')}
              </Button>
            )}
          </div>
        </FormRow>

        <FormRow
          label={t('settings.fLockDay')}
          labelWidth={170}
          note={t('settings.lockDayNote')}
          last
        >
          <Stepper
            value={data.lockDay ?? 25}
            min={1}
            max={28}
            disabled={!canEdit}
            onChange={(val) => onChange('lockDay', val)}
          />
        </FormRow>
      </SettingsCard>

      {/* 2. Quyền riêng tư */}
      <SettingsCard
        title={t('settings.privacyTitle')}
        subtitle={t('settings.privacySub')}
        icon="shield"
      >
        <FormRow
          isToggle
          label={t('settings.seeDebt')}
          note={t('settings.seeDebtNote')}
        >
          <ToggleSwitch
            checked={Boolean(data.seeDebtEachOther)}
            disabled={!canEdit}
            onChange={(checked) => onChange('seeDebtEachOther', checked)}
          />
        </FormRow>

        <FormRow
          isToggle
          label={t('settings.seeFund')}
          note={t('settings.seeFundNote')}
        >
          <ToggleSwitch
            checked={Boolean(data.seeFund)}
            disabled={!canEdit}
            onChange={(checked) => onChange('seeFund', checked)}
          />
        </FormRow>

        <FormRow
          isToggle
          label={t('settings.roundUnit')}
          note={t('settings.roundUnitNote')}
        >
          <ToggleSwitch
            checked={Boolean(data.roundUnit)}
            disabled={!canEdit}
            onChange={(checked) => onChange('roundUnit', checked)}
          />
        </FormRow>

        <FormRow
          label={t('settings.debtBanner')}
          labelWidth={170}
          note={t('settings.debtBannerNote')}
          last
        >
          <Select
            value={data.debtBanner || 'slim'}
            disabled={!canEdit}
            options={debtBannerOptions}
            onChange={(e) => onChange('debtBanner', e.target.value)}
          />
        </FormRow>
      </SettingsCard>

      {/* 3. Chuyển khoản (Card hẹp: nhãn 130px) */}
      <SettingsCard
        title={t('settings.bankTitle')}
        subtitle={t('settings.bankSub')}
        icon="landmark"
      >
        <FormRow label={t('settings.fBankName')} labelWidth={130}>
          <SearchSelect
            value={bank.bank || ''}
            disabled={!canEdit}
            placeholder={t('settings.fBankName')}
            options={bankOptions}
            clearable
            onChange={(val) => onChange('bank', { ...bank, bank: val || '' })}
          />
        </FormRow>

        <FormRow label={t('settings.fBankNo')} labelWidth={130}>
          <Input
            value={bank.no || ''}
            disabled={!canEdit}
            mono
            placeholder={t('settings.fBankNo')}
            onChange={(e) => onChange('bank', { ...bank, no: e.target.value.replace(/\s+/g, '') })}
          />
        </FormRow>

        <FormRow label={t('settings.fBankHolder')} labelWidth={130}>
          <Input
            value={bank.holder || ''}
            disabled={!canEdit}
            mono
            placeholder={t('settings.fBankHolder')}
            onChange={(e) => onChange('bank', { ...bank, holder: e.target.value.toUpperCase() })}
          />
        </FormRow>

        <FormRow
          label={t('bank.qrTitle')}
          labelWidth={130}
          alignTop
          note={t('bank.qrAutoHint')}
          last
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {autoVietQrUrl ? (
              <div
                style={{
                  width: 120,
                  height: 120,
                  background: '#fff',
                  borderRadius: 8,
                  padding: 4,
                  border: '1px solid #d4dce7',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
                onClick={() => setShowQrModal(true)}
                title={t('settings.qrEnlarge')}
              >
                <img
                  src={autoVietQrUrl}
                  alt={t('bank.qrTitle')}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    padding: '2px 4px',
                    borderRadius: 4,
                    fontSize: 10,
                  }}
                >
                  <Icon name="maximize-2" size={10} />
                </span>
              </div>
            ) : (
              <div
                style={{
                  width: 120,
                  height: 120,
                  background: '#f8fafc',
                  border: '1px dashed #d4dce7',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  color: '#8b98ab',
                }}
              >
                <Icon name="qr-code" size={32} />
                <span style={{ fontSize: 11, textAlign: 'center' }}>{t('settings.qrPlaceholder')}</span>
              </div>
            )}

            {canEdit && (
              <div>
                <input
                  ref={fileRef}
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
                  {scanning ? t('settings.qrScanning') : t('settings.qrScanBtn')}
                </Button>
                {scanErr && (
                  <div style={{ fontSize: 11.5, color: '#c0392b', marginTop: 4 }}>
                    {scanErr}
                  </div>
                )}
              </div>
            )}
          </div>
        </FormRow>

        {showQrModal && autoVietQrUrl && (
          <QrModal
            title={t('settings.qrModalTitle')}
            qrUrl={autoVietQrUrl}
            bankName={bank.bank}
            accountNo={bank.no}
            accountHolder={bank.holder}
            onClose={() => setShowQrModal(false)}
          />
        )}
      </SettingsCard>

      {/* 4. Thang trình độ */}
      <SettingsCard
        title={t('settings.levelsTitle')}
        subtitle={t('settings.levelsSub')}
        icon="layers"
      >
        <div style={{ padding: '10px 0' }}>
          <LevelPillsManager
            levels={data.levels || []}
            onChange={(updated) => onChange('levels', updated)}
            disabled={!canEdit}
            usedLevels={usedLevels}
          />
        </div>
      </SettingsCard>

      {/* 5. Vùng nguy hiểm (Full width) */}
      {activeClub && activeClub.role === 'owner' && (
        <DangerZoneCard
          title={t('settings.delClubTitle')}
          desc={t('settings.delClubDesc')}
          actionLabel={t('clubs.delBtn')}
          onAction={() => setOpenDelete(true)}
        />
      )}

      {openDelete && (
        <DeleteClubDialog
          club={{ id: activeClub.id, name: data.name, code: data.code }}
          onClose={() => setOpenDelete(false)}
          onDone={() => {
            setOpenDelete(false)
            onClubDeleted && onClubDeleted()
          }}
        />
      )}
    </div>
  )
}
