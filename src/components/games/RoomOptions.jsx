import { Alert, Checkbox, Select, Switch } from '#ds'
import { BOARD_POINTS, NO_STAKE, STAKES, buyinsOf, stakeOf } from '#lib/games/registry.js'
import { ROLE_IDS as MASOI_ROLE_IDS, SPECIALS as MASOI_SPECIALS, WOLF, isWolf, lineupOf, minPlayersOf } from '#lib/games/masoi.js'
import { fieldsOf } from '#components/games/roomFields.js'
import { t } from '#i18n'

/**
 * Form tuỳ chọn phòng. `stakeLocked` = đang ở phòng chờ: không đổi được mức cược (server giữ nguyên — 0105).
 * `coins` = ví của tôi (chỉ để báo thiếu xu khi chọn mức cược lúc tạo phòng).
 */
export default function RoomOptions({ gameId, opts, setOpts, coins = 0, stakeLocked = false }) {
  const set = (patch) => {
    const next = { ...opts, ...patch }
    for (const k of Object.keys(patch)) if (patch[k] === undefined) delete next[k]
    setOpts(next)
  }
  const stake = stakeOf(opts)
  const ins = buyinsOf(gameId, stake)
  const points = BOARD_POINTS.includes(gameId)
  const broke = ins.length > 0 && ins[0] > coins
  // Ma sói tự chọn: số Sói thường + các vai đặc biệt đang bật.
  const roles = gameId === 'masoi' ? opts.roles || null : null
  const wolves = roles ? roles.filter((r) => r === WOLF).length : 0
  const specials = roles ? roles.filter((r) => r !== WOLF) : []
  const setRoles = (w, sp) => set({ roles: [...Array(w).fill(WOLF), ...sp].sort((x, y) => x - y) })

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {fieldsOf(gameId, opts, set).map((x) => {
        if (x.type === 'switch') return <Switch key={x.key} label={x.label} description={x.hint} checked={x.value} onChange={x.set} />
        if (x.type === 'select') return <Select key={x.key} label={x.label} hint={x.hint} value={x.value} onChange={x.set} options={x.options} />
        return (
          <div key={x.key} style={S.col}>
            <Select
              label={t('games.masoi.wolfCount')}
              value={String(wolves)}
              onChange={(e) => setRoles(Number(e.target.value), specials)}
              options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: t('games.masoi.wolfCountOpt', { n }) }))}
            />
            <span style={S.label}>{x.label}</span>
            {MASOI_SPECIALS.map((r) => (
              <Checkbox
                key={r}
                label={t('games.masoi.role.' + MASOI_ROLE_IDS[r])}
                description={t('games.masoi.roleDesc.' + MASOI_ROLE_IDS[r])}
                checked={specials.includes(r)}
                onChange={(e) => setRoles(wolves, e.target.checked ? [...specials, r] : specials.filter((y) => y !== r))}
              />
            ))}
            {!roles.some(isWolf)
              ? <Alert tone="danger">{t('games.err.noWolf')}</Alert>
              : <span style={S.caption}>{t('games.masoi.customList', { list: lineupOf(roles) })} · {t('games.masoi.customHint', { n: minPlayersOf(roles) })}</span>}
          </div>
        )
      })}
      {!NO_STAKE.includes(gameId) && !stakeLocked && (
        <>
          <Select
            label={t(points ? 'games.coins.pointValue' : 'games.coins.stake')}
            value={String(stake)}
            onChange={(e) => set({ stake: Number(e.target.value) })}
            options={STAKES.map((n) => ({ value: String(n), label: n ? t('games.coins.stakeOpt', { n }) : t('games.coins.noStake') }))}
          />
          {stake > 0 && (
            <span style={{ ...S.caption, color: broke ? 'var(--status-incident-fg)' : undefined }}>
              {broke ? t('games.coins.broke', { n: coins.toLocaleString('vi-VN'), min: ins[0].toLocaleString('vi-VN') })
                : points ? t('games.coins.hintPoints', { n: stake, min: ins[0].toLocaleString('vi-VN'), max: ins[ins.length - 1].toLocaleString('vi-VN') })
                  : t('games.coins.hintWin', { n: stake })}
            </span>
          )}
        </>
      )}
    </div>
  )
}

const S = {
  col: { display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
}
