// Trang Giao diện: sáng / tối, hoạt ảnh nền trời và từng hiệu ứng (bật / tắt, "cứ N giây").
// Lưu theo thiết bị (ThemeContext → skyMotion, skyPrefs) — áp dụng ngay, không qua nút Lưu.
// Danh sách hiệu ứng: lib/sky.js → SKY_FX; mặc định: app.json → sky.fx. Chi tiết: docs/HOME_SKY.md.

import { useState } from 'react'
import { Button, Tabs } from '#ds'
import { t } from '#i18n'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { SettingsCard, Stepper, ToggleSwitch } from '#components/settings/SettingsComponents.jsx'
import { SKY_FX, SKY_FX_MAX, normSkyPrefs } from '#lib/sky.js'

const GROUPS = [['chars', 'users'], ['night', 'moon'], ['other', 'sparkles']]

function Row({ label, note, last, children }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 16px', padding: '12px 0', borderBottom: last ? 'none' : '1px solid var(--border-subtle)' }}>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ font: '600 13.5px/1.35 var(--font-sans)', color: 'var(--text-primary)' }}>{label}</div>
        {note && <div style={{ marginTop: 3, font: '400 12.5px/1.45 var(--font-sans)', color: 'var(--text-muted)' }}>{note}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>{children}</div>
    </div>
  )
}

export default function ThemeSettings() {
  const { isDark, setTheme, skyMotion, setSkyMotion, skyPrefs: P, setSkyPrefs } = useTheme()
  const [osReduced] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  })
  // Ô số đang xoá để gõ lại (chuỗi rỗng) chỉ giữ ở đây; gõ ra số mới lưu.
  const [draft, setDraft] = useState({})
  const off = !skyMotion || osReduced
  const setOn = (k, on) => setSkyPrefs((p) => ({ ...p, on: { ...p.on, [k]: on } }))
  const setEvery = (k, v) => {
    setDraft((d) => ({ ...d, [k]: v }))
    if (v !== '') setSkyPrefs((p) => ({ ...p, every: { ...p.every, [k]: v } }))
  }
  const reset = () => {
    setDraft({})
    setSkyPrefs(normSkyPrefs(null))
    setSkyMotion(true)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16, maxWidth: 880 }}>
      <SettingsCard title={t('themePage.modeTitle')} subtitle={t('themePage.modeSub')} icon={isDark ? 'moon' : 'sun'}>
        <Tabs
          variant="segmented"
          value={isDark ? 'dark' : 'light'}
          onChange={setTheme}
          items={[{ value: 'light', label: t('themePage.light') }, { value: 'dark', label: t('themePage.dark') }]}
        />
      </SettingsCard>

      <SettingsCard title={t('themePage.motionTitle')} subtitle={t('themePage.motionSub')} icon="sparkles">
        <Row label={t('themePage.motion')} note={osReduced ? t('themePage.motionOs') : t('themePage.motionNote')}>
          <ToggleSwitch checked={skyMotion && !osReduced} disabled={osReduced} onChange={setSkyMotion} aria-label={t('themePage.motion')} />
        </Row>
        <Row label={t('themePage.ambient')} note={t('themePage.ambientNote')} last>
          <ToggleSwitch checked={P.on.ambient} disabled={off} onChange={(on) => setOn('ambient', on)} aria-label={t('themePage.ambient')} />
        </Row>
      </SettingsCard>

      {GROUPS.map(([g, icon]) => {
        const list = SKY_FX.filter((fx) => fx.group === g)
        return (
          <SettingsCard key={g} title={t('themePage.group.' + g)} subtitle={t('themePage.groupSub.' + g)} icon={icon}>
            {list.map((fx, i) => {
              const label = t('themePage.fx.' + fx.key + '.label')
              const v = draft[fx.key] ?? P.every[fx.key]
              const min = fx.min ? ' · ' + t(Number(v) < fx.min ? 'themePage.minUsed' : 'themePage.min', { n: fx.min }) : ''
              return (
                <Row key={fx.key} label={label} note={t('themePage.fx.' + fx.key + '.note') + min} last={i === list.length - 1}>
                  {fx.min ? (
                    <Stepper value={v} min={1} max={SKY_FX_MAX} step={5} suffix={t('themePage.sec')} width={150}
                      disabled={off || !P.on[fx.key]} onChange={(n) => setEvery(fx.key, n)} />
                  ) : null}
                  <ToggleSwitch checked={P.on[fx.key]} disabled={off} onChange={(on) => setOn(fx.key, on)} aria-label={label} />
                </Row>
              )
            })}
          </SettingsCard>
        )
      })}

      <div>
        <Button variant="secondary" icon="rotate-ccw" onClick={reset}>{t('themePage.reset')}</Button>
      </div>
    </div>
  )
}
