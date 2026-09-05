import React from 'react'
import { Button, Icon } from '#ds'
import {
  SettingsCard,
  ToggleSwitch,
  Stepper,
  InlineTextCell,
  EmptyState,
} from '#components/settings/SettingsComponents.jsx'
import { courtForm } from '#lib/forms.js'
import { fmtK } from '#lib/money.js'
import { t } from '#i18n'

export default function CourtsTab({
  courts = [],
  shuttleTypes = [],
  groups = [],
  sessions = [],
  onCourtChange,
  onShuttleTypeChange,
  onGroupQuotaChange,
  onOpenDialog,
  onDeleteCourt,
  onDeleteShuttleType,
  canEdit = true,
}) {
  // Tính số cầu trung bình thực tế cho các buổi đã chốt không ước lượng
  const closedSessions = sessions.filter((s) => s.status === 'closed' && !s.shuttleEst)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Sân bãi & Giá thuê */}
      <SettingsCard
        title={t('settings.courtsTitle')}
        subtitle={t('settings.courtsSub')}
        icon="map-pin"
        fullWidth
        action={
          canEdit && (
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              onClick={() => onOpenDialog('newCourt', courtForm())}
            >
              {t('settings.addCourt')}
            </Button>
          )
        }
        bodyPadding="0 20px 16px"
      >
        {courts.length === 0 ? (
          <EmptyState
            icon="map-pin"
            title={t('settings.noCourt')}
            hint={t('settings.noCourtHint')}
          />
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1.6fr 1.2fr 130px 90px 70px',
                background: '#f7f9fc',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '.07em',
                color: '#8b98ab',
              }}
            >
              <div>{t('settings.colCourtName')}</div>
              <div>{t('settings.colAddressCaps')}</div>
              <div>{t('settings.colMapUrlCaps')}</div>
              <div style={{ textAlign: 'right' }}>{t('settings.colPricePerHour')}</div>
              <div style={{ textAlign: 'center' }}>{t('settings.colActiveCaps')}</div>
              <div style={{ textAlign: 'right' }}></div>
            </div>

            {courts.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1.6fr 1.2fr 130px 90px 70px',
                  alignItems: 'center',
                  padding: '12px 12px',
                  borderBottom: '1px solid #f6f8fb',
                  fontSize: 13.5,
                }}
              >
                <div>
                  <InlineTextCell
                    value={c.name}
                    disabled={!canEdit}
                    placeholder={t('settings.phCourt')}
                    onChange={(val) => onCourtChange(c.id, 'name', val)}
                  />
                </div>
                <div>
                  <InlineTextCell
                    value={c.addr || ''}
                    disabled={!canEdit}
                    placeholder={t('settings.phCourtAddrEmpty')}
                    onChange={(val) => onCourtChange(c.id, 'addr', val)}
                  />
                </div>
                <div>
                  {c.mapUrl ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <a
                        href={c.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 13,
                          color: '#0d8b8a',
                          fontWeight: 600,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {t('settings.openMap')}
                        <Icon name="arrow-up-right" size={13} />
                      </a>
                    </div>
                  ) : (
                    <InlineTextCell
                      value=""
                      disabled={!canEdit}
                      placeholder={t('settings.phPasteLink')}
                      onChange={(val) => onCourtChange(c.id, 'mapUrl', val)}
                    />
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <InlineTextCell
                    value={c.price}
                    type="number"
                    align="right"
                    disabled={!canEdit}
                    formatDisplay={(v) => t('settings.dongPerHour', { price: fmtK(v || 0) })}
                    onChange={(val) => onCourtChange(c.id, 'price', val)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <ToggleSwitch
                    checked={c.active !== false}
                    disabled={!canEdit}
                    onChange={(checked) => onCourtChange(c.id, 'active', checked)}
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onDeleteCourt && onDeleteCourt(c.id, c.name)}
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
                      {t('common.delete')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      {/* 2. Loại cầu & Định mức cầu */}
      <SettingsCard
        title={t('settings.typesQuotaTitle')}
        subtitle={t('settings.typesQuotaSub')}
        icon="package-open"
        fullWidth
        action={
          canEdit && (
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              onClick={() => onOpenDialog('newShuttleType')}
            >
              {t('settings.addType')}
            </Button>
          )
        }
        bodyPadding="0 20px 20px"
      >
        {shuttleTypes.length === 0 ? (
          <EmptyState
            icon="package-open"
            title={t('settings.noType')}
            hint={t('settings.noTypeHint')}
          />
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 110px 140px 90px 70px',
                background: '#f7f9fc',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '.07em',
                color: '#8b98ab',
              }}
            >
              <div>{t('settings.colShuttleType')}</div>
              <div style={{ textAlign: 'right' }}>{t('settings.colPerTubeCaps')}</div>
              <div style={{ textAlign: 'right' }}>{t('settings.colRefPriceCaps')}</div>
              <div style={{ textAlign: 'center' }}>{t('settings.colUseCaps')}</div>
              <div style={{ textAlign: 'right' }}></div>
            </div>

            {shuttleTypes.map((x) => (
              <div
                key={x.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 110px 140px 90px 70px',
                  alignItems: 'center',
                  padding: '12px 12px',
                  borderBottom: '1px solid #f6f8fb',
                  fontSize: 13.5,
                }}
              >
                <div>
                  <InlineTextCell
                    value={x.name}
                    disabled={!canEdit}
                    placeholder={t('settings.phTypeName')}
                    onChange={(val) => onShuttleTypeChange(x.id, 'name', val)}
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <InlineTextCell
                    value={x.perTube}
                    type="number"
                    align="right"
                    disabled={!canEdit}
                    formatDisplay={(v) => t('settings.shuttleTube', { n: v || 12 })}
                    onChange={(val) => onShuttleTypeChange(x.id, 'perTube', val)}
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <InlineTextCell
                    value={x.pricePerTube}
                    type="number"
                    align="right"
                    disabled={!canEdit}
                    formatDisplay={(v) => (v ? `${fmtK(v)}${t('units.dong')}` : t('common.unknown'))}
                    onChange={(val) => onShuttleTypeChange(x.id, 'pricePerTube', val)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <ToggleSwitch
                    checked={x.active !== false}
                    disabled={!canEdit}
                    onChange={(checked) => onShuttleTypeChange(x.id, 'active', checked)}
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onDeleteShuttleType && onDeleteShuttleType(x.id, x.name)}
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
                      {t('common.delete')}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div style={{ fontSize: 12, color: '#8b98ab', lineHeight: 1.5, marginTop: 10, padding: '0 4px' }}>
              {t('settings.refPriceNote')}
            </div>
          </div>
        )}

        {/* Khối định mức cầu mỗi buổi */}
        {groups.length > 0 && (
          <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid #eef1f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#2a3a54' }}>
                {t('settings.quotaTitle')}
              </div>
              <div style={{ fontSize: 12, color: '#8b98ab' }}>
                {t('settings.quotaNote')}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 12,
              }}
            >
              {groups.map((g) => {
                const mine = closedSessions.filter((s) => s.groupId === g.id)
                const avg = mine.length
                  ? Math.round(mine.reduce((acc, s) => acc + (s.shuttleUsed || 0), 0) / mine.length)
                  : null

                return (
                  <div
                    key={g.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '12px 16px',
                      borderRadius: 10,
                      background: '#f8fafc',
                      border: '1px solid #e4e9f1',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: '#10203c' }}>
                        {g.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#8b98ab', marginTop: 2 }}>
                        {avg === null ? t('settings.quotaNone') : t('settings.quotaActual', { avg })}
                      </div>
                    </div>
                    <Stepper
                      value={g.quota ?? 24}
                      min={0}
                      max={60}
                      width={130}
                      suffix={t('units.shuttle')}
                      disabled={!canEdit}
                      onChange={(val) => onGroupQuotaChange(g.id, val)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </SettingsCard>
    </div>
  )
}
