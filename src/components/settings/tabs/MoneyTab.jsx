import React, { useState } from 'react'
import { Alert, Button, Input, Select } from '#ds'
import { LevelChip } from '#ui'
import {
  FormRow,
  ToggleSwitch,
  SettingsCard,
  InlineTextCell,
} from '#components/settings/SettingsComponents.jsx'
import { fmtK, intOf } from '#lib/money.js'
import { t } from '#i18n'

export default function MoneyTab({
  data,
  onChange,
  canEdit = true,
  levels = [],
  noGroup = false,
  defGroup = {},
  sessionsPerMonth = 4,
}) {
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkWho, setBulkWho] = useState('both')
  const [bulkLevels, setBulkLevels] = useState([])

  const hasMonthlyFee = Boolean(data.hasMonthlyFee)
  const feeNam = data.feeNam ?? ''
  const feeNu = data.feeNu ?? ''

  const hasRefund = Boolean(data.hasRefund)
  const customRefundUnit = Boolean(data.customRefundUnit)
  const unitNam = data.unitNam ?? ''
  const unitNu = data.unitNu ?? ''

  const hasMemberExtraDiscount = Boolean(data.hasMemberExtraDiscount)
  const memberExtraDiscount = data.memberExtraDiscount ?? ''

  const guestPrices = data.guestPrices || []

  const toggleBulkLevel = (lv) => {
    setBulkLevels((prev) =>
      prev.indexOf(lv) >= 0 ? prev.filter((x) => x !== lv) : prev.concat([lv])
    )
  }

  const applyBulk = () => {
    const pr = intOf(bulkPrice)
    const updated = guestPrices.map((p) => {
      if (bulkLevels.indexOf(p.level) < 0) return p
      return {
        ...p,
        nam: bulkWho === 'both' || bulkWho === 'nam' ? pr : p.nam,
        nu: bulkWho === 'both' || bulkWho === 'nu' ? pr : p.nu,
      }
    })
    onChange('guestPrices', updated)
    setBulkLevels([])
    setBulkPrice('')
  }

  const setSinglePrice = (level, gender, val) => {
    const pr = intOf(val)
    const updated = guestPrices.map((p) =>
      p.level === level ? { ...p, [gender]: pr } : p
    )
    onChange('guestPrices', updated)
  }

  // Lấy giá của bậc trung bình CLB theo spec §6
  const midLevel = levels[Math.floor(levels.length / 2)]
  const sample = (guestPrices || []).find((p) => p.level === midLevel) || (guestPrices || []).find((p) => p.nam > 0 || p.nu > 0)
  const sampleNam = sample?.nam || 0
  const sampleNu = sample?.nu || 0

  const isMaleUnitHigh = intOf(feeNam) > 0 && intOf(unitNam) > Math.round(intOf(feeNam) / sessionsPerMonth)
  const isFemaleUnitHigh = intOf(feeNu) > 0 && intOf(unitNu) > Math.round(intOf(feeNu) / sessionsPerMonth)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Mức phí thành viên cố định */}
      <SettingsCard
        title={t('settings.generalFeeTitle')}
        subtitle={t('settings.generalFeeSub')}
        icon="banknote"
        fullWidth
        bodyPadding="0 20px 16px"
      >
        {noGroup && (
          <div style={{ padding: '14px 0 6px' }}>
            <Alert tone="warning" title={t('settings.feeNoGroupTitle')}>
              {t('settings.feeNoGroup')}
            </Alert>
          </div>
        )}

        {/* Khối 1: Thu quỹ tháng cố định */}
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <FormRow
            isToggle
            label={t('settings.toggleFixedFee')}
            note={t('settings.toggleFixedFeeNote')}
          >
            <ToggleSwitch
              checked={hasMonthlyFee}
              disabled={!canEdit || noGroup}
              onChange={(checked) => {
                onChange('hasMonthlyFee', checked)
                if (checked && !feeNam && !feeNu) {
                  if (defGroup.feeNam) onChange('feeNam', String(defGroup.feeNam))
                  if (defGroup.feeNu) onChange('feeNu', String(defGroup.feeNu))
                }
              }}
            />
          </FormRow>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
              padding: '14px 16px',
              borderRadius: 10,
              background: hasMonthlyFee ? 'var(--surface-inset)' : 'var(--surface-page)',
              border: '1px solid var(--border-subtle)',
              marginTop: 10,
              opacity: hasMonthlyFee ? 1 : 0.6,
            }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                {t('settings.feeMaleLabel')}
              </div>
              <Input
                mono
                suffix={t('units.dong')}
                placeholder={String(defGroup.feeNam || 0)}
                value={String(feeNam)}
                disabled={!canEdit || !hasMonthlyFee || noGroup}
                onChange={(e) => onChange('feeNam', e.target.value)}
              />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                {t('settings.feeFemaleLabel')}
              </div>
              <Input
                mono
                suffix={t('units.dong')}
                placeholder={String(defGroup.feeNu || 0)}
                value={String(feeNu)}
                disabled={!canEdit || !hasMonthlyFee || noGroup}
                onChange={(e) => onChange('feeNu', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Khối 2: Hoàn tiền khi vắng mặt (Back tiền) */}
        <div style={{ padding: '14px 0 4px' }}>
          <FormRow
            isToggle
            label={t('settings.toggleRefund')}
            note={t('settings.toggleRefundNote')}
          >
            <ToggleSwitch
              checked={hasRefund}
              disabled={!canEdit || noGroup}
              onChange={(checked) => onChange('hasRefund', checked)}
            />
          </FormRow>

          {hasRefund && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 10,
                background: 'var(--surface-inset)',
                border: '1px solid var(--border-subtle)',
                marginTop: 10,
              }}
            >
              <FormRow
                isToggle
                label={t('settings.toggleCustomRefund')}
                note={customRefundUnit ? t('settings.refundCustomLabel') : t('settings.refundAutoLabel')}
              >
                <ToggleSwitch
                  checked={customRefundUnit}
                  disabled={!canEdit || noGroup}
                  onChange={(checked) => {
                    onChange('customRefundUnit', checked)
                    if (checked && !unitNam && !unitNu) {
                      if (defGroup.unitNam > 0) onChange('unitNam', String(defGroup.unitNam))
                      if (defGroup.unitNu > 0) onChange('unitNu', String(defGroup.unitNu))
                    }
                  }}
                />
              </FormRow>

              {customRefundUnit && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                        {t('settings.refundMale')}
                      </div>
                      <Input
                        mono
                        suffix={t('units.dong')}
                        placeholder={String(defGroup.unitNam > 0 ? defGroup.unitNam : 0)}
                        value={String(unitNam)}
                        disabled={!canEdit || noGroup}
                        onChange={(e) => onChange('unitNam', e.target.value)}
                      />
                      {isMaleUnitHigh && (
                        <div style={{ fontSize: 11.5, color: 'var(--status-delayed-fg)', marginTop: 4 }}>
                          {t('settings.refundExceedWarn')}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                        {t('settings.refundFemale')}
                      </div>
                      <Input
                        mono
                        suffix={t('units.dong')}
                        placeholder={String(defGroup.unitNu > 0 ? defGroup.unitNu : 0)}
                        value={String(unitNu)}
                        disabled={!canEdit || noGroup}
                        onChange={(e) => onChange('unitNu', e.target.value)}
                      />
                      {isFemaleUnitHigh && (
                        <div style={{ fontSize: 11.5, color: 'var(--status-delayed-fg)', marginTop: 4 }}>
                          {t('settings.refundExceedWarn')}
                        </div>
                      )}
                    </div>
                  </div>

                  {(sampleNam > 0 || sampleNu > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (sampleNam) onChange('unitNam', String(sampleNam))
                          if (sampleNu) onChange('unitNu', String(sampleNu))
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-accent)',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                        }}
                      >
                        {t('settings.unitFromGuest')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Khối 3: Chênh lệch thành viên đi thêm so với giao lưu */}
        <div style={{ padding: '14px 0 4px', borderTop: '1px solid var(--border-subtle)', marginTop: 14 }}>
          <FormRow
            isToggle
            label={t('settings.toggleMemberExtraDiscount')}
            note={t('settings.toggleMemberExtraDiscountNote')}
          >
            <ToggleSwitch
              checked={hasMemberExtraDiscount}
              disabled={!canEdit}
              onChange={(checked) => {
                onChange('hasMemberExtraDiscount', checked)
                if (checked && (!memberExtraDiscount || intOf(memberExtraDiscount) === 0)) {
                  onChange('memberExtraDiscount', '5000')
                }
              }}
            />
          </FormRow>

          {hasMemberExtraDiscount && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 10,
                background: 'var(--surface-inset)',
                border: '1px solid var(--border-subtle)',
                marginTop: 10,
              }}
            >
              <div style={{ maxWidth: 320 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {t('settings.memberExtraDiscountAmount')}
                </div>
                <Input
                  mono
                  suffix={t('units.dong')}
                  placeholder="5000"
                  value={String(memberExtraDiscount)}
                  disabled={!canEdit}
                  onChange={(e) => onChange('memberExtraDiscount', e.target.value)}
                />
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                  {t('settings.memberExtraDiscountHint')}
                </div>
              </div>
            </div>
          )}
        </div>
      </SettingsCard>

      {/* 2. Giá khách giao lưu */}
      <SettingsCard
        title={t('settings.guestPriceTitle')}
        subtitle={t('settings.guestPriceSub')}
        icon="tags"
        fullWidth
        bodyPadding="0 20px 20px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Khối áp hàng loạt */}
          {canEdit && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 10,
                background: 'var(--surface-inset)',
                border: '1px dashed var(--border-default)',
                marginTop: 14,
              }}
            >
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ width: 140 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {t('settings.bulkPriceLabel')}
                    </div>
                    <Input
                      mono
                      suffix={t('units.dong')}
                      placeholder="60000"
                      value={bulkPrice}
                      onChange={(e) => setBulkPrice(e.target.value)}
                    />
                  </div>
                  <div style={{ width: 150 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {t('settings.bulkWhoLabel')}
                    </div>
                    <Select
                      value={bulkWho}
                      options={[
                        { value: 'both', label: t('settings.whoBoth') },
                        { value: 'nam', label: t('settings.whoNam') },
                        { value: 'nu', label: t('settings.whoNu') },
                      ]}
                      onChange={(e) => setBulkWho(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon="check"
                    disabled={!bulkLevels.length || !bulkPrice.trim()}
                    onClick={applyBulk}
                  >
                    {bulkLevels.length
                      ? t('settings.bulkApplyN', { n: bulkLevels.length })
                      : t('settings.bulkApplySelected')}
                  </Button>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setBulkLevels(levels)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-accent)',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '4px 6px',
                    }}
                  >
                    {t('settings.bulkSelectAll')}
                  </button>
                  <button
                    type="button"
                    disabled={!bulkLevels.length}
                    onClick={() => setBulkLevels([])}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: bulkLevels.length ? 'var(--text-secondary)' : 'var(--text-disabled)',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: bulkLevels.length ? 'pointer' : 'not-allowed',
                      padding: '4px 6px',
                    }}
                  >
                    {t('settings.bulkDeselect')}
                  </button>
                </div>
              </div>

              {/* Danh sách chip các bậc */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {levels.map((lv) => {
                  const isSelected = bulkLevels.indexOf(lv) >= 0
                  return (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => toggleBulkLevel(lv)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: `1px solid ${isSelected ? 'var(--action-accent-bg)' : 'var(--border-default)'}`,
                        background: isSelected ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
                        color: isSelected ? 'var(--text-accent)' : 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {lv}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Bảng giá 3 cột chuẩn */}
          <div className="settings-table-scroll" style={{ overflowX: 'auto' }}>
            <div
              className="settings-table-head"
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr',
                background: 'var(--surface-inset)',
                borderRadius: 8,
                padding: '9px 14px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '.07em',
                color: 'var(--text-muted)',
                marginTop: canEdit ? 4 : 14,
              }}
            >
              <div>{t('settings.colLevelCaps')}</div>
              <div style={{ textAlign: 'right' }}>{t('settings.colMalePriceCaps')}</div>
              <div style={{ textAlign: 'right' }}>{t('settings.colFemalePriceCaps')}</div>
            </div>

            {guestPrices.map((p) => {
              return (
                <div
                  key={p.level}
                  className="settings-table-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 1fr',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 13.5,
                  }}
                >
                  <div data-label={t('settings.colLevelCaps')} style={{ display: 'flex', alignItems: 'center' }}>
                    <LevelChip level={p.level} levels={levels} />
                  </div>
                  <div data-label={t('settings.colMalePriceCaps')} style={{ textAlign: 'right' }}>
                    <InlineTextCell
                      value={p.nam}
                      type="number"
                      align="right"
                      disabled={!canEdit}
                      suffix={t('units.dong')}
                      formatDisplay={(v) => (v ? `${fmtK(v)}${t('units.dong')}` : t('settings.priceUnset'))}
                      onChange={(newVal) => setSinglePrice(p.level, 'nam', newVal)}
                    />
                  </div>
                  <div data-label={t('settings.colFemalePriceCaps')} style={{ textAlign: 'right' }}>
                    <InlineTextCell
                      value={p.nu}
                      type="number"
                      align="right"
                      disabled={!canEdit}
                      suffix={t('units.dong')}
                      formatDisplay={(v) => (v ? `${fmtK(v)}${t('units.dong')}` : t('settings.priceUnset'))}
                      onChange={(newVal) => setSinglePrice(p.level, 'nu', newVal)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </SettingsCard>
    </div>
  )
}
