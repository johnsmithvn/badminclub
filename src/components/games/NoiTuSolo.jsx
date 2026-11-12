import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, Skeleton } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { G, btn, card, field, mono, over, seg, segWrap } from '#components/games/stage.js'
import { BONUS, botTurn, dictOf, endMine, judge, LEVELS, needOf, parseWords, playMine, start, TIMES } from '#lib/games/noituSolo.js'
import { pathOf } from '#routes'
import { t } from '#i18n'

// Nối từ đấu máy (/tro-choi/may-noitu): bạn và máy nối luân phiên, điểm = số từ bạn nối được (từ lạ nửa điểm), máy bí
// thì bạn thắng + thưởng. Chạy hẳn trong trình duyệt — luật + máy ở lib/games/noituSolo.js, từ điển public/words/vi.txt
// tải lười một lần. Không chặn cứng: gõ sai luật nối thì báo để gõ lại, không mất lượt. Kỷ lục lưu trên máy theo mức.

const KEY = 'noitu-solo:'
const BOT_MS = 700 // máy trả lời nhanh quá nhìn không kịp

let dictLoad = null
/** Từ điển tải một lần cho cả trang; lỗi thì lần sau tải lại. */
function loadDict() {
  dictLoad ??= fetch('/words/vi.txt')
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text() })
    .then((txt) => dictOf(parseWords(txt)))
    .catch((e) => { dictLoad = null; throw e })
  return dictLoad
}

const read = (k, base) => {
  try { return { ...base, ...JSON.parse(localStorage.getItem(KEY + k) || '{}') } } catch { return base }
}
const write = (k, v) => {
  try { localStorage.setItem(KEY + k, JSON.stringify(v)) } catch { /* trình duyệt chặn lưu — bỏ qua */ }
}
const num = (v) => v.toLocaleString('vi-VN')

export default function NoiTuSolo() {
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const [got, setGot] = useState(null) // { tries, dict } | { tries, failed }
  const [tries, setTries] = useState(0)
  const [prefs, setPrefs] = useState(() => read('prefs', { level: 'normal', time: 20 }))
  const [best, setBest] = useState(() => read('best', {})) // { [mức]: { score, words } }
  const [g, setG] = useState(null) // ván đang chơi / vừa xong (noituSolo.js)
  const [text, setText] = useState('')
  const [msg, setMsg] = useState(null) // { text, bad }
  const [tick, setTick] = useState(null) // { g, left } — giây còn lại của lượt bạn, gắn với đúng thế `g`

  useEffect(() => {
    let live = true
    loadDict()
      .then((dict) => { if (live) setGot({ tries, dict }) })
      .catch((e) => { console.warn('[games] Không tải được từ điển:', e?.message || e); if (live) setGot({ tries, failed: true }) })
    return () => { live = false }
  }, [tries])
  const dict = got?.dict || null
  const level = prefs.level

  /** Ghi thế mới; hết ván thì so kỷ lục của mức đang chơi (đọc lại localStorage — có thể gọi từ hẹn giờ). */
  const commit = useCallback((next) => {
    if (next.over) {
      const all = read('best', {})
      if (next.score > (all[level]?.score ?? -1)) {
        const nb = { ...all, [level]: { score: next.score, words: next.mine } }
        write('best', nb)
        setBest(nb)
        next = { ...next, over: { ...next.over, record: true } }
      }
    }
    setG(next)
  }, [level])

  // Lượt máy: nghĩ một nhịp rồi đi. Thế đổi (ván mới) thì huỷ.
  useEffect(() => {
    if (!g || g.over || g.turn !== 1 || !dict) return undefined
    const id = setTimeout(() => commit(botTurn(g, dict, level)), BOT_MS)
    return () => clearTimeout(id)
  }, [g, dict, level, commit])

  // Đồng hồ lượt bạn: chạy lại mỗi khi tới lượt bạn (thế mới); hết giờ là hết ván.
  useEffect(() => {
    if (!g || g.over || g.turn !== 0) return undefined
    const end = Date.now() + prefs.time * 1000
    const id = setInterval(() => {
      const sec = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setTick({ g, left: sec })
      if (sec === 0) {
        clearInterval(id)
        commit(endMine(g, 'timeout'))
      }
    }, 250)
    return () => clearInterval(id)
  }, [g, prefs.time, commit])
  const left = tick?.g === g ? tick.left : prefs.time

  const setPref = (k, v) => {
    const next = { ...prefs, [k]: v }
    setPrefs(next)
    write('prefs', next)
  }
  const begin = () => {
    setG(start(dict))
    setText('')
    setMsg(null)
  }
  const send = (e) => {
    e.preventDefault()
    if (!g || g.over || g.turn !== 0) return
    const j = judge(g, dict, text)
    if (j.err) { setMsg({ text: t(j.err), bad: true }); return }
    commit(playMine(g, j))
    setText('')
    setMsg(j.kind === 'dict' ? null : { text: t('games.noitu.solo.' + j.kind) })
  }

  const playing = g && !g.over
  const need = playing ? needOf(g) : ''
  const mine = best[level]
  const last = g?.chain[g.chain.length - 1]

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: 640, width: '100%', justifySelf: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <button type="button" onClick={() => navigate(pathOf('games'))} style={btn('ghost', { sm: true })}>
          <Icon name="arrow-left" size={15} />{!isMobile && t('games.lobbyShort')}
        </button>
        <span style={{ font: `800 ${isMobile ? 17 : 20}px/1.2 var(--font-display)`, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t('games.noitu.solo.title')}
        </span>
      </div>

      {!got && (
        <>
          <Skeleton height={160} />
          <span style={{ ...S.caption, textAlign: 'center' }}>{t('games.noitu.solo.loading')}</span>
        </>
      )}
      {got?.failed && (
        <div style={{ ...card, padding: 16, display: 'grid', gap: 10, justifyItems: 'center', textAlign: 'center' }}>
          <span style={S.caption}>{t('games.noitu.solo.loadFailed')}</span>
          <button type="button" onClick={() => setTries((n) => n + 1)} style={btn('soft', { sm: true })}><Icon name="refresh-cw" size={14} />{t('games.noitu.solo.retry')}</button>
        </div>
      )}

      {dict && (
        <>
          {/* Điểm · số từ · kỷ lục */}
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {[
              [t('games.noitu.solo.score'), g ? num(g.score) : '0', G.tealHi],
              [t('games.noitu.solo.words'), g ? String(g.mine) : '0', G.text],
              [t('games.noitu.solo.best'), mine ? num(mine.score) : t('games.noitu.solo.bestNone'), G.goldHi],
            ].map(([label, value, color]) => (
              <div key={label} style={{ ...card, padding: '10px 12px', display: 'grid', gap: 6 }}>
                <span style={over}>{label}</span>
                <span style={{ font: '800 22px/1 var(--font-mono)', color }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Cài đặt + bắt đầu (chưa chơi hoặc vừa hết ván) */}
          {!playing && (
            <div style={{ ...card, padding: 16, display: 'grid', gap: 14 }}>
              {g?.over && (
                <div style={{ display: 'grid', gap: 4, textAlign: 'center' }} aria-live="polite">
                  <span style={{ font: '800 18px/1.3 var(--font-display)', color: g.over.win ? G.tealHi : G.text }}>
                    {g.over.why === 'botStuck' ? t('games.noitu.solo.overBot', { n: BONUS }) : t('games.noitu.solo.over_' + g.over.why)}
                  </span>
                  <span style={S.caption}>{t('games.noitu.solo.final', { score: num(g.score), words: g.mine })}</span>
                  {g.over.record && <span style={{ font: '700 13px/1.2 var(--font-sans)', color: G.goldHi }}>{t('games.noitu.solo.record')}</span>}
                </div>
              )}
              {!g && <span style={{ ...S.caption, textAlign: 'center' }}>{t('games.noitu.solo.intro', { n: BONUS })}</span>}
              <Row label={t('games.bot.level')} items={LEVELS.map((v) => [v, t('games.bot.levelShort.' + v)])} value={level} set={(v) => setPref('level', v)} />
              <Row label={t('games.noitu.solo.time')} items={TIMES.map((v) => [v, t('games.noitu.solo.secs', { n: v })])} value={prefs.time} set={(v) => setPref('time', v)} />
              <button type="button" onClick={begin} style={btn('primary', { block: true })}>
                <Icon name="play" size={15} />{t(g ? 'games.noitu.solo.again' : 'games.noitu.solo.start')}
              </button>
            </div>
          )}

          {/* Lượt chơi */}
          {playing && (
            <div style={{ ...card, padding: 14, display: 'grid', gap: 10 }} aria-live="polite">
              {g.turn === 1
                ? <span style={{ ...S.caption, textAlign: 'center' }}>{t('games.bot.thinking')}</span>
                : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <span style={{ font: '600 13px/1.3 var(--font-sans)', color: G.sub }}>
                        {last?.fresh ? t('games.noitu.solo.freshNote') + ' ' : ''}{t('games.noitu.solo.need', { syl: need })}
                      </span>
                      <span role="timer" aria-label={t('games.noitu.solo.time')} style={{
                        padding: '4px 10px', borderRadius: 8, font: '700 16px/1 var(--font-mono)',
                        background: left <= 5 ? G.redA(0.16) : G.tealA(0.14), color: left <= 5 ? G.red : G.tealHi,
                      }}>{left}s</span>
                    </div>
                    <form onSubmit={send} style={{ display: 'flex', gap: 8, minWidth: 0 }}>
                      <span style={{ ...field, flexShrink: 0, background: G.inset, color: G.tealHi, fontWeight: 700 }}>{need}</span>
                      <input value={text} onChange={(e) => { setText(e.target.value); setMsg(null) }} autoFocus autoComplete="off" autoCapitalize="none"
                        aria-label={t('games.noitu.inputAria')} placeholder={t('games.noitu.solo.placeholder')} style={{ ...field, flex: 1, fontSize: 16 }} />
                      <button type="submit" disabled={!text.trim()} style={{ ...btn('primary'), opacity: text.trim() ? 1 : 0.5 }} aria-label={t('games.noitu.send')}>
                        <Icon name="send" size={15} />{!isMobile && t('games.noitu.send')}
                      </button>
                    </form>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', minHeight: 30 }}>
                      <span style={{ font: '500 12.5px/1.3 var(--font-sans)', color: msg?.bad ? G.red : G.muted, minWidth: 0 }}>{msg?.text || ''}</span>
                      <button type="button" onClick={() => commit(endMine(g, 'giveup'))} style={btn('danger', { sm: true })}>
                        <Icon name="flag" size={14} />{t('games.noitu.giveup')}
                      </button>
                    </div>
                  </>
                )}
            </div>
          )}

          {/* Chuỗi từ, mới nhất ở trên */}
          {g && (
            <div style={{ ...card, padding: '10px 14px', display: 'grid', gap: 2, maxHeight: 360, overflowY: 'auto' }}>
              {[...g.chain].reverse().map((c, k) => {
                const me = c.seat === 0
                const tag = c.fresh ? t('games.noitu.solo.tagFresh') : c.kind === 'strange' ? t('games.noitu.solo.tagStrange') : c.kind === 'unknown' ? t('games.noitu.solo.tagUnknown') : ''
                return (
                  <div key={g.chain.length - k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid ' + G.line, minWidth: 0 }}>
                    <span style={{ ...mono, width: 44, flexShrink: 0, color: me ? G.tealHi : G.muted }}>{t(me ? 'games.bot.you' : 'games.bot.bot')}</span>
                    <span style={{ font: `${k === 0 ? 700 : 500} 15px/1.3 var(--font-sans)`, color: me ? G.text : G.sub, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.word}</span>
                    {tag && <span style={{ ...mono, flexShrink: 0, color: c.fresh ? G.muted : G.goldHi }}>{tag}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Hàng chọn phân đoạn (mức, giờ). */
function Row({ label, items, value, set }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={over}>{label}</span>
      <div style={{ ...segWrap, display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, background: G.inset }}>
        {items.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => set(v)} style={{ ...seg(value === v), padding: '7px 4px' }}>{l}</button>
        ))}
      </div>
    </div>
  )
}

const S = {
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
}
