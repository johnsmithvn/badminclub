import React, { useState, useRef, useMemo, useEffect } from 'react'
import { Button, Icon, Input, Select } from '#ds'
import { AvatarUpload, DeleteClubDialog, SearchSelect, QrModal } from '#ui'
import {
  FormRow,
  ToggleSwitch,
  Stepper,
  SettingsCard,
  LevelPillsManager,
  DangerZoneCard,
} from '#components/settings/SettingsComponents.jsx'
import { scanQrCodeFromImage, parseVietQr, getVietQrUrl, findBank } from '#utils/vietqr.js'
import banks from '#config/banks.json' with { type: 'json' }
import { myMember } from '#lib/money.js'
import { t } from '#i18n'
import { useAuth } from '#contexts/AuthContext.jsx'
import { useApp } from '#contexts/AppContext.jsx'
import { supabase } from '#supabase'
import {
  isPushSupported,
  getPushPermissionState,
  isPushSubscribed,
  subscribePush,
  unsubscribePush,
  sendTestPush,
} from '#lib/pushSubscription.js'

export default function GeneralTab({
  data,
  onChange,
  canEdit = true,
  usedLevels = [],
  activeClub,
  onClubDeleted,
}) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanErr, setScanErr] = useState('')
  const [showQrModal, setShowQrModal] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const fileRef = useRef(null)

  const { session } = useAuth()
  const { db, a } = useApp()
  const [pushState, setPushState] = useState({
    supported: false,
    subscribed: false,
    permission: 'default',
  })
  const [togglingPush, setTogglingPush] = useState(false)
  const [testingPush, setTestingPush] = useState(false)
  const [testTarget, setTestTarget] = useState('')

  /**
   * Người có THỂ nhận push: đã liên kết tài khoản và còn hoạt động.
   *
   * KHÔNG lọc được theo "đã đăng ký thiết bị hay chưa": RLS của `push_subscriptions` chỉ cho
   * mỗi người đọc dòng của chính mình, nên client không có cách nào biết ai đã bật. Thay vào
   * đó cứ gửi rồi đọc `sentCount` trong toast — 0 nghĩa là người đó chưa bật.
   */
  const pushTargets = useMemo(() => (db?.members || [])
    .filter((m) => m.userId && m.active !== false)
    .map((m) => ({ value: m.id, label: m.name })), [db?.members])

  /**
   * Bắn push thử cho chính mình. Bấm TRÊN MÁY TÍNH thì điện thoại rung — cách duy nhất thử được
   * trạng thái "app đã kill" mà vẫn bấm được nút.
   * Nói thẳng số thiết bị đã gửi ra toast: `sentCount: 0` nghĩa là lỗi nằm ở server, còn
   * `sentCount: 1` mà máy im thì lỗi ở thiết bị. Khỏi phải đi lục Dashboard để biết.
   */
  const handleTestPush = async () => {
    if (testingPush) return
    const targetId = testTarget || myMember(db)?.id
    if (!targetId) return
    const targetName = (db?.members || []).find((m) => m.id === targetId)?.name || ''
    setTestingPush(true)
    try {
      const res = await sendTestPush(supabase, {
        memberId: targetId,
        clubId: db?.clubId,
        title: db?.club?.name || 'BadminClub',
        body: t('settings.pushTestBody'),
      })
      const sent = res.sentCount ?? 0
      a?.toast?.(sent > 0
        ? t('toast.pushTestSent', { n: sent, name: targetName })
        : t('toast.pushTestNoDevice', { name: targetName }))
    } catch (err) {
      a?.toast?.(t('toast.pushTestFailed', { msg: err?.message || '' }))
    } finally {
      setTestingPush(false)
    }
  }

  useEffect(() => {
    let active = true
    const checkPush = async () => {
      if (!isPushSupported()) {
        if (active) setPushState({ supported: false, subscribed: false, permission: 'unsupported' })
        return
      }
      const perm = getPushPermissionState()
      // Kiểm cả dòng dưới DB, không chỉ trình duyệt — xem `isPushSubscribed`.
      const subbed = await isPushSubscribed(supabase, session?.user?.id)
      if (active) setPushState({ supported: true, subscribed: subbed, permission: perm })
    }
    checkPush()
    return () => { active = false }
  }, [session])

  const handleTogglePush = async (checked) => {
    if (togglingPush) return
    setTogglingPush(true)
    const uid = session?.user?.id
    try {
      if (checked) {
        await subscribePush(supabase, uid)
        setPushState((s) => ({ ...s, subscribed: true, permission: 'granted' }))
        a?.toast?.(t('toast.pushEnabled'))
      } else {
        await unsubscribePush(supabase, uid)
        setPushState((s) => ({ ...s, subscribed: false }))
        a?.toast?.(t('toast.pushDisabled'))
      }
    } catch (err) {
      if (err?.message === 'PERMISSION_DENIED') {
        setPushState((s) => ({ ...s, permission: 'denied', subscribed: false }))
        a?.toast?.(t('toast.pushDenied'))
      } else {
        a?.toast?.(t('toast.pushError'))
      }
    } finally {
      setTogglingPush(false)
    }
  }

  const bank = data.bank || {}

  // `club.bank.bank` có thể là mã ('TCB'), tên viết tắt hay tên đầy đủ — quét QR trả về `bankName`.
  // SearchSelect so khớp TUYỆT ĐỐI với `option.value` (= mã), nên giá trị dạng tên làm nó vừa
  // không tìm ra option vừa tưởng là đã chọn → ô hiện ra TRỐNG TRƠN. Quy về mã bằng findBank.
  const selectedBankCode = useMemo(() => findBank(bank.bank)?.code || bank.bank || '', [bank.bank])

  const autoVietQrUrl = useMemo(() => {
    if (!bank.no || !bank.bank) return ''
    return getVietQrUrl({
      bankCode: bank.bank,
      accountNo: bank.no,
      accountHolder: bank.holder,
    })
  }, [bank.bank, bank.no, bank.holder])

  const handleCopyCode = () => {
    if (!data.code) return
    navigator.clipboard.writeText(data.code)
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
    <div
      className="settings-general-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 20,
        alignItems: 'start',
      }}
    >
      {/* 1. Thông tin CLB */}
      <SettingsCard
        title={t('settings.clubTitle')}
        subtitle={t('settings.clubSub')}
        icon="building-2"
      >
        <FormRow label={t('settings.fAvatar')} labelWidth={170} alignTop>
          {/* AvatarUpload đã tự render nút Xoá ảnh (`common.removeAvatar`) — thêm một nút nữa ở
              đây là hai chữ "Xoá ảnh" nằm cạnh nhau, cùng làm một việc. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <AvatarUpload
              name={data.name || ''}
              value={data.avatarUrl || ''}
              size={52}
              disabled={!canEdit}
              onChange={(url) => onChange('avatarUrl', url)}
            />
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
                background: 'var(--surface-page)',
                border: '1px solid var(--border-default)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: 14,
                color: 'var(--text-primary)',
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

      {/* Thông báo đẩy thiết bị */}
      <SettingsCard
        title={t('settings.pushTitle')}
        subtitle={t('settings.pushSub')}
        icon="bell"
      >
        <FormRow
          isToggle
          label={t('settings.pushToggle')}
          note={
            !pushState.supported
              ? t('settings.pushUnsupported')
              : pushState.permission === 'denied'
                ? t('settings.pushDenied')
                : t('settings.pushToggleNote')
          }
        >
          <ToggleSwitch
            checked={pushState.subscribed}
            disabled={!pushState.supported || pushState.permission === 'denied' || togglingPush}
            onChange={handleTogglePush}
          />
        </FormRow>

        {/* Bắn thử — bấm TRÊN MÁY TÍNH thì điện thoại rung, đó là cách duy nhất thử được
            trạng thái app đã bị kill mà vẫn bấm được nút. */}
        <FormRow
          label={t('settings.pushTestLabel')}
          note={t('settings.pushTestNote')}
          last
          alignTop
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <SearchSelect
              size="sm"
              value={testTarget || myMember(db)?.id || ''}
              options={pushTargets}
              placeholder={t('settings.pushTestPick')}
              onChange={(val) => setTestTarget(val || '')}
              style={{ minWidth: 160 }}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={testingPush || !pushTargets.length}
              onClick={handleTestPush}
            >
              {t('settings.pushTestBtn')}
            </Button>
          </div>
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
            value={selectedBankCode}
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
                  background: 'var(--surface-card)',
                  borderRadius: 8,
                  padding: 4,
                  border: '1px solid var(--border-default)',
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
                  background: 'var(--surface-inset)',
                  border: '1px dashed var(--border-default)',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  color: 'var(--text-muted)',
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
                  <div style={{ fontSize: 11.5, color: 'var(--text-danger)', marginTop: 4 }}>
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
