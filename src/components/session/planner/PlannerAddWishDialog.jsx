import { useState } from 'react'
import { t } from '#i18n'
import { Button, Dialog, Select } from '#ds'

export default function PlannerAddWishDialog({
  isOpen = false,
  onClose,
  onSaveWish,
  players = [],
}) {
  const [memberId, setMemberId] = useState(players[0]?.key || '')
  const [wishType, setWishType] = useState('partner') // 'partner' | 'opponent'
  const [targetId, setTargetId] = useState(players[1]?.key || '')

  if (!isOpen) return null

  const playerOptions = players.map((p) => ({
    value: p.key,
    label: p.name,
  }))

  const typeOptions = [
    { value: 'partner', label: t('planner.wishTypePartner') },
    { value: 'opponent', label: t('planner.wishTypeOpponent') },
  ]

  const handleSave = () => {
    if (!memberId || !targetId || memberId === targetId) return
    const mName = players.find((p) => p.key === memberId)?.name || memberId
    const tName = players.find((p) => p.key === targetId)?.name || targetId
    const text = wishType === 'partner'
      ? t('planner.wishTextPartner', { mName, tName })
      : t('planner.wishTextOpponent', { mName, tName })

    onSaveWish({
      id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      memberId,
      targetId,
      type: wishType,
      text,
    })
    onClose()
  }

  return (
    <Dialog
      title={t('planner.dlgAddWishTitle')}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!memberId || !targetId || memberId === targetId}
            onClick={handleSave}
          >
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 14, padding: '4px 0' }}>
        <div>
          <label style={S.label}>{t('planner.wishMemberLabel')}</label>
          <Select
            value={memberId}
            onChange={(val) => setMemberId(val)}
            options={playerOptions}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={S.label}>{t('planner.wishTypeLabel')}</label>
          <Select
            value={wishType}
            onChange={(val) => setWishType(val)}
            options={typeOptions}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={S.label}>{t('planner.wishTargetLabel')}</label>
          <Select
            value={targetId}
            onChange={(val) => setTargetId(val)}
            options={playerOptions.filter((p) => p.value !== memberId)}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </Dialog>
  )
}

const S = {
  label: {
    display: 'block',
    font: '600 12px/1.3 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary)',
    marginBottom: 6,
  },
}
