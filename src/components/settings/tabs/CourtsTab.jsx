import React from 'react'
import { Button, Icon } from '#ds'
import {
  SettingsCard,
  ToggleSwitch,
  InlineTextCell,
  EmptyState,
} from '#components/settings/SettingsComponents.jsx'
import { courtForm } from '#lib/forms.js'
import { fmtK } from '#lib/money.js'
import { t } from '#i18n'

export default function CourtsTab({
  courts = [],
  onCourtChange,
  onOpenDialog,
  canEdit = true,
}) {
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
          <div className="settings-table-scroll" style={{ overflowX: 'auto', marginTop: 14 }}>
            <div
              className="settings-table-head"
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1.6fr 1.3fr 140px 90px',
                background: 'var(--surface-inset)',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '.07em',
                color: 'var(--text-muted)',
              }}
            >
              <div>{t('settings.colCourtName')}</div>
              <div>{t('settings.colAddressCaps')}</div>
              <div>{t('settings.colMapUrlCaps')}</div>
              <div style={{ textAlign: 'right' }}>{t('settings.colPricePerHour')}</div>
              <div style={{ textAlign: 'center' }}>{t('settings.colActiveCaps')}</div>
            </div>

            {courts.map((c) => (
              <div
                key={c.id}
                className="settings-table-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1.6fr 1.3fr 140px 90px',
                  alignItems: 'center',
                  padding: '12px 12px',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: 13.5,
                }}
              >
                <div data-label={t('settings.colCourtName')}>
                  <InlineTextCell
                    value={c.name}
                    disabled={!canEdit}
                    placeholder={t('settings.phCourt')}
                    onChange={(val) => onCourtChange(c.id, 'name', val)}
                  />
                </div>
                <div data-label={t('settings.colAddressCaps')}>
                  <InlineTextCell
                    value={c.addr || ''}
                    disabled={!canEdit}
                    placeholder={t('settings.phCourtAddrEmpty')}
                    onChange={(val) => onCourtChange(c.id, 'addr', val)}
                  />
                </div>
                <div data-label={t('settings.colMapUrlCaps')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <InlineTextCell
                        value={c.mapUrl || ''}
                        disabled={!canEdit}
                        placeholder={t('settings.phPasteLink')}
                        onChange={(val) => onCourtChange(c.id, 'mapUrl', val)}
                      />
                    </div>
                    {c.mapUrl && (
                      <a
                        href={c.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={t('settings.openMap')}
                        style={{
                          fontSize: 13,
                          color: 'var(--text-accent)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px',
                          flexShrink: 0,
                        }}
                      >
                        <Icon name="arrow-up-right" size={13} />
                      </a>
                    )}
                  </div>
                </div>
                <div data-label={t('settings.colPricePerHour')} style={{ textAlign: 'right' }}>
                  <InlineTextCell
                    value={c.price}
                    type="number"
                    align="right"
                    disabled={!canEdit}
                    suffix={t('units.dong')}
                    formatDisplay={(v) => t('settings.dongPerHour', { price: fmtK(v || 0) })}
                    onChange={(val) => onCourtChange(c.id, 'price', val)}
                  />
                </div>
                <div data-label={t('settings.colActiveCaps')} style={{ display: 'flex', justifyContent: 'center' }}>
                  <ToggleSwitch
                    checked={c.active !== false}
                    disabled={!canEdit}
                    onChange={(checked) => onCourtChange(c.id, 'active', checked)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </div>
  )
}
