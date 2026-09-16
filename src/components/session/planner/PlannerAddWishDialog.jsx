import { useState } from 'react'
import { t } from '#i18n'
import { Button, Dialog, Select, Avatar } from '#ds'

export default function PlannerAddWishDialog({
  isOpen = false,
  onClose,
  onSaveWish,
  onDeleteWish,
  players = [],
  defaultMemberId = null,
  existingWish = null,
}) {
  const initialMemberId = existingWish?.memberId || defaultMemberId || players[0]?.key || ''
  const [memberId, setMemberId] = useState(initialMemberId)
  const [wishType, setWishType] = useState(existingWish?.type || 'partner') // 'partner' | 'opponent'
  const [targetId, setTargetId] = useState(
    existingWish?.targetId || (players.find((p) => p.key !== initialMemberId)?.key || '')
  )
  const [note, setNote] = useState(existingWish?.note || '')

  const [prevOpen, setPrevOpen] = useState(isOpen)
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen)
    if (isOpen) {
      const mid = existingWish?.memberId || defaultMemberId || players[0]?.key || ''
      setMemberId(mid)
      setWishType(existingWish?.type || 'partner')
      setTargetId(existingWish?.targetId || (players.find((p) => p.key !== mid)?.key || ''))
      setNote(existingWish?.note || '')
    }
  }

  if (!isOpen) return null

  const playerOptions = players.map((p) => ({
    value: p.key,
    label: p.name,
  }))

  const typeOptions = [
    { value: 'partner', label: t('planner.wishTypePartner') },
    { value: 'opponent', label: t('planner.wishTypeOpponent') },
  ]

  const currentMember = players.find((p) => p.key === memberId)

  const handleSave = () => {
    if (!memberId || !targetId || memberId === targetId) return
    const mName = currentMember?.name || memberId
    const tName = players.find((p) => p.key === targetId)?.name || targetId
    const text = wishType === 'partner'
      ? t('planner.wishTextPartner', { mName, tName })
      : t('planner.wishTextOpponent', { mName, tName })

    onSaveWish({
      id: existingWish?.id || `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      memberId,
      targetId,
      type: wishType,
      note: (note || '').trim(),
      text,
      createdAt: existingWish?.createdAt || new Date().toISOString(),
    })
    onClose()
  }

  const handleDelete = () => {
    if (existingWish?.id && onDeleteWish) {
      onDeleteWish(existingWish.id)
      onClose()
    }
  }

  const isLockedMember = Boolean(defaultMemberId)

  return (
    <Dialog
      title={existingWish ? t('planner.editWishTitle') : t('planner.dlgAddWishTitle')}
      onClose={onClose}
      footer={
        <div style={S.footerWrap}>
          {existingWish && onDeleteWish && (
            <Button variant="danger" onClick={handleDelete}>
              {t('planner.deleteWish')}
            </Button>
          )}
          <div style={S.footerRight}>
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
        </div>
      }
    >
      <div style={S.bodyWrap}>
        {/* Người gửi */}
        <div>
          <label style={S.label}>{t('planner.wishMemberLabel')}</label>
          {isLockedMember ? (
            <div style={S.lockedMemberBox}>
              <Avatar
                name={currentMember?.name || ''}
                src={currentMember?.avatarUrl}
                size={24}
              />
              <span style={S.memberNameText}>{currentMember?.name || memberId}</span>
            </div>
          ) : (
            <Select
              value={memberId}
              onChange={(val) => {
                setMemberId(val)
                if (targetId === val) {
                  const other = players.find((p) => p.key !== val)
                  if (other) setTargetId(other.key)
                }
              }}
              options={playerOptions}
              style={{ width: '100%' }}
            />
          )}
        </div>

        {/* Loại nguyện vọng */}
        <div>
          <label style={S.label}>{t('planner.wishTypeLabel')}</label>
          <Select
            value={wishType}
            onChange={(val) => setWishType(val)}
            options={typeOptions}
            style={{ width: '100%' }}
          />
        </div>

        {/* Người muốn ghép / đối đầu */}
        <div>
          <label style={S.label}>{t('planner.wishTargetLabel')}</label>
          <Select
            value={targetId}
            onChange={(val) => setTargetId(val)}
            options={playerOptions.filter((p) => p.value !== memberId)}
            style={{ width: '100%' }}
          />
        </div>

        {/* Ghi chú thêm (tùy chọn) */}
        <div>
          <label style={S.label}>{t('planner.wishNoteLabel')}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('planner.wishNotePh')}
            style={S.noteInput}
          />
        </div>
      </div>
    </Dialog>
  )
}

const S = {
  footerWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  footerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  bodyWrap: {
    display: 'grid',
    gap: 14,
    padding: '4px 0',
  },
  label: {
    display: 'block',
    font: '600 12px/1.3 "IBM Plex Sans", sans-serif',
    color: 'var(--text-secondary)',
    marginBottom: 6,
  },
  lockedMemberBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  memberNameText: {
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  noteInput: {
    width: '100%',
    boxSizing: 'border-box',
    height: 38,
    padding: '0 12px',
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    outline: 'none',
  },
}
