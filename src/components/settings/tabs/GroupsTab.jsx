import React, { useState } from 'react'
import { Button, Input } from '#ds'
import {
  SettingsCard,
  EmptyState,
} from '#components/settings/SettingsComponents.jsx'
import { groupForm } from '#lib/forms.js'
import { fmtK } from '#lib/money.js'
import { t } from '#i18n'

export default function GroupsTab({
  groups = [],
  courts = [],
  db,
  onGroupFieldChange,
  onOpenDialog,
  onDeleteGroup,
  canEdit = true,
}) {
  const noCourt = courts.length === 0
  const defaultFeeNam = db.groups[0]?.feeNam || 250000
  const defaultFeeNu = db.groups[0]?.feeNu || 200000
  const defaultUnitNam = db.groups[0]?.unitNam || 50000
  const defaultUnitNu = db.groups[0]?.unitNu || 45000

  // Track which group IDs are currently in "custom pricing" edit mode
  const [customPricing, setCustomPricing] = useState({})

  const toggleCustomPricing = (groupId) => {
    if (!canEdit) return
    setCustomPricing((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  return (
    <SettingsCard
      title={t('settings.groupsTitle')}
      subtitle={t('settings.groupsSub')}
      icon="users"
      fullWidth
      action={
        canEdit && (
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            disabled={noCourt}
            onClick={() => onOpenDialog('newGroup', groupForm(db))}
          >
            {t('settings.addGroup')}
          </Button>
        )
      }
      bodyPadding="0 20px 20px"
    >
      {groups.length === 0 ? (
        <EmptyState
          icon="users"
          title={t('settings.noGroup')}
          hint={noCourt ? t('settings.noCourtFirst') : t('settings.noGroupHint')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
          {groups.map((g, idx) => {
            const hasCustom = customPricing[g.id] || (g.customPricing && (g.feeNam || g.feeNu))
            const feeNamVal = g.feeNam !== undefined ? g.feeNam : defaultFeeNam
            const feeNuVal = g.feeNu !== undefined ? g.feeNu : defaultFeeNu
            const unitNamVal = g.unitNam !== undefined ? g.unitNam : defaultUnitNam
            const unitNuVal = g.unitNu !== undefined ? g.unitNu : defaultUnitNu

            return (
              <div
                key={g.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: '16px 18px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid #e4e9f1',
                }}
              >
                {/* Header nhóm */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#10203c' }}>
                      {g.name || t('settings.groupNo', { n: idx + 1 })}
                    </span>
                    {g.short && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 6,
                          background: '#eef1f6',
                          color: '#42526b',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {g.short}
                      </span>
                    )}
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onDeleteGroup && onDeleteGroup(g.id, g.name)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#c0392b',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {t('settings.groupDel')}
                    </button>
                  )}
                </div>

                {/* Form fields */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#8b98ab', marginBottom: 4 }}>
                      {t('settings.fGroupName')}
                    </div>
                    <Input
                      value={g.name || ''}
                      disabled={!canEdit}
                      placeholder={t('settings.fGroupName')}
                      onChange={(e) => onGroupFieldChange(g.id, 'name', e.target.value)}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8b98ab', marginBottom: 4 }}>
                      {t('settings.fGroupShort')}
                    </div>
                    <Input
                      mono
                      value={g.short || ''}
                      disabled={!canEdit}
                      placeholder="T6"
                      onChange={(e) => onGroupFieldChange(g.id, 'short', e.target.value.slice(0, 4))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8b98ab', marginBottom: 4 }}>
                      {t('settings.fGroupFrom')}
                    </div>
                    <Input
                      mono
                      value={g.from || ''}
                      disabled={!canEdit}
                      placeholder="20:30"
                      onChange={(e) => onGroupFieldChange(g.id, 'from', e.target.value)}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8b98ab', marginBottom: 4 }}>
                      {t('settings.fGroupTo')}
                    </div>
                    <Input
                      mono
                      value={g.to || ''}
                      disabled={!canEdit}
                      placeholder="22:30"
                      onChange={(e) => onGroupFieldChange(g.id, 'to', e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ fontSize: 12, color: '#8b98ab', lineHeight: 1.5 }}>
                  {t('settings.groupTimeNoteDesc')}
                </div>

                {/* Mức thu & Định mức cầu */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: '#fff',
                    border: '1px solid #e4e9f1',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleCustomPricing(g.id)}
                      style={{
                        border: 'none',
                        background: hasCustom ? '#fdf7e8' : '#eef7f6',
                        color: hasCustom ? '#8a6420' : '#0a6f6d',
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 999,
                        cursor: canEdit ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {hasCustom ? t('settings.customPricing') : t('settings.applyClubPricing')}
                    </button>

                    <span style={{ fontSize: 12.5, color: '#42526b' }}>
                      {t('settings.groupFeeSummary', {
                        feeNam: fmtK(feeNamVal),
                        feeNu: fmtK(feeNuVal),
                        unitNam: fmtK(unitNamVal),
                        unitNu: fmtK(unitNuVal),
                      })}
                    </span>

                    {hasCustom && canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          onGroupFieldChange(g.id, 'customPricing', false)
                          onGroupFieldChange(g.id, 'feeNam', undefined)
                          onGroupFieldChange(g.id, 'feeNu', undefined)
                          onGroupFieldChange(g.id, 'unitNam', undefined)
                          onGroupFieldChange(g.id, 'unitNu', undefined)
                          setCustomPricing((prev) => ({ ...prev, [g.id]: false }))
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#0d8b8a',
                          fontSize: 12,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                        }}
                      >
                        {t('settings.backToClubPricing')}
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: 12.5, color: '#8b98ab' }}>
                    {t('settings.groupQuota', { n: g.quota ?? 24 })}
                    <span style={{ fontSize: 11.5, marginLeft: 4 }}>{t('settings.quotaShuttleNote')}</span>
                  </div>
                </div>

                {/* Khối chỉnh mức phí riêng nếu mở */}
                {hasCustom && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 10,
                      padding: '12px 14px',
                      background: '#fff',
                      borderRadius: 8,
                      border: '1px solid #d4dce7',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8b98ab', marginBottom: 4 }}>
                        {t('settings.groupFeeMonthNam')}
                      </div>
                      <Input
                        size="sm"
                        mono
                        suffix={t('units.dong')}
                        value={String(feeNamVal)}
                        disabled={!canEdit}
                        onChange={(e) => onGroupFieldChange(g.id, 'feeNam', e.target.value)}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8b98ab', marginBottom: 4 }}>
                        {t('settings.groupFeeMonthNu')}
                      </div>
                      <Input
                        size="sm"
                        mono
                        suffix={t('units.dong')}
                        value={String(feeNuVal)}
                        disabled={!canEdit}
                        onChange={(e) => onGroupFieldChange(g.id, 'feeNu', e.target.value)}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8b98ab', marginBottom: 4 }}>
                        {t('settings.groupUnitNam')}
                      </div>
                      <Input
                        size="sm"
                        mono
                        suffix={t('units.dong')}
                        value={String(unitNamVal)}
                        disabled={!canEdit}
                        onChange={(e) => onGroupFieldChange(g.id, 'unitNam', e.target.value)}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8b98ab', marginBottom: 4 }}>
                        {t('settings.groupUnitNu')}
                      </div>
                      <Input
                        size="sm"
                        mono
                        suffix={t('units.dong')}
                        value={String(unitNuVal)}
                        disabled={!canEdit}
                        onChange={(e) => onGroupFieldChange(g.id, 'unitNu', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </SettingsCard>
  )
}
