import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Input } from '#ds'
import { Mono } from '#ui'
import {
  CANVAS, RANK_CHOICES, byesOf, canvasChecks, estimateOf, groupBalanceOf, koPreviewOf, layoutOf, moveTeam, nextFreeRanks,
  quickPlan, shownGroups, unplacedTeams,
} from '#lib/tournament/canvas.js'
import { TEMPLATES } from '#lib/tournament/format.js'
import { nextPowerOf2 } from '#lib/tournament/bracket.js'
import { eventTeams, shuffle } from '#lib/tournament/pairing.js'
import cfg from '#config/app.json' with { type: 'json' }
import { t } from '#i18n'
import { RuleField, Seg } from './TourBits.jsx'
import { rankLabel, ruleLabel, stageName, teamName } from './tourUtils.js'

const TEAM_MIME = 'text/x-tour-team'
const BLOCK_MIME = 'text/x-tour-block'
const ZOOM_MIN = 0.4
const ZOOM_MAX = 1.6

// Khay trái (handoff): kiểu khối kéo vào sơ đồ. Thuỵ Sĩ chưa có thuật toán nên không có ở đây (plan §2.1).
const PALETTE = [
  { key: 'rr', type: 'round_robin', config: { numGroups: 2 }, bars: [3, 'teal'] },
  { key: 'round', type: 'round_robin', config: { numGroups: 1 }, bars: [1, 'teal'] },
  { key: 'ko', type: 'knockout', config: { thirdPlace: true }, bars: [3, 'amber'] },
  { key: 'final', type: 'knockout', config: { thirdPlace: false }, bars: [1, 'gold'] },
]
const PAL_KEY = { rr: 'palRr', round: 'palRound', ko: 'palKo', final: 'palFinal' }
const BAR = { teal: 'var(--teal-500)', amber: 'var(--status-delayed-fg)', gold: 'var(--podium-gold)' }
// Hình thu nhỏ cho thẻ mẫu trong hộp "Tạo nhanh" (handoff): mỗi thanh = một khối.
const TPL_BARS = { ko: ['amber'], rr: ['teal'], rr_ko: ['teal', 'amber'], rr_ko_plate: ['teal', 'amber', 'amber'] }

/** Thời lượng kiểu handoff: 143 phút → "2g23". */
const dur = (min) => t('tournament.canvas.dur', { h: Math.floor(min / 60), m: String(min % 60).padStart(2, '0') })
const overline = (x) => <span style={{ font: '700 10.5px/1 var(--font-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{x}</span>

/**
 * Trình dựng sơ đồ (handoff "Giải đấu · sơ đồ tự do") cho MỘT nội dung chưa có lịch — màn rộng.
 *   Thanh trên: số khối · số trận · thời gian ước tính · "vừa lưu" · Tạo nhanh · Công bố & chạy nhánh (tạo lịch).
 *   Trái: khối kéo vào sơ đồ · khay "cặp chưa xếp" (kéo cặp vào / ra khỏi bảng).
 *   Giữa: canvas lưới chấm — kéo nền để di chuyển, cuộn chuột để phóng; khối vòng bảng hiện đội từng bảng, khối
 *         loại hiện nhánh thu nhỏ; kéo tiêu đề khối để dời; kéo chấm tròn bên phải vòng bảng sang một nhánh để nối.
 *   Phải: Toàn giải (tạo nhanh, căn khung, kiểm tra sơ đồ) · bảng sửa khối · bảng sửa đường nối.
 * Luật & số liệu thuần ở `lib/tournament/canvas.js` (có test); đây chỉ vẽ và gọi action.
 */
export default function FlowCanvas({ tour, event, db, a, onBack, onOpenBracket }) {
  const stages = tour.stages.filter((s) => s.eventId === event.id).sort((x, y) => x.seq - y.seq)
  const links = (tour.stageLinks || []).filter((l) => stages.some((s) => s.id === l.toStageId))
  const source = stages.find((s) => s.seq === 1) || null
  const full = eventTeams(tour, event.id).filter((x) => x.full)
  const est = estimateOf(tour, event)
  const checks = canvasChecks(tour, event)
  const blocked = checks.some((c) => c.tone === 'bad') || !stages.length
  const hasSchedule = stages.some((s) => s.status !== 'pending')

  const [selId, setSelId] = useState(null)
  const [selLinkId, setSelLinkId] = useState(null)
  const [drag, setDrag] = useState(null) // dời khối: { id, ox, oy, x, y, moved }
  const [wire, setWire] = useState(null) // kéo dây nối: { x, y }
  const [pan, setPan] = useState(null) // kéo nền: { sx, sy, left, top }
  const [zoom, setZoom] = useState(1)
  const [quick, setQuick] = useState(false)
  const [busy, setBusy] = useState(false)
  const [save, setSave] = useState('idle') // 'idle' | 'saving' | 'saved' — nhãn "vừa lưu" (handoff)
  const viewRef = useRef(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  // Mọi thao tác ghi trên canvas đi qua đây để thanh trên báo "đang lưu… / vừa lưu".
  const act = (p) => {
    setSave('saving')
    Promise.resolve(p).then((ok) => setSave(ok === false ? 'idle' : 'saved'), () => setSave('idle'))
    return p
  }

  // Cuộn chuột = phóng quanh con trỏ (handoff "cuộn để phóng"). Listener thật (passive:false) để chặn cuộn trang.
  useEffect(() => {
    const el = viewRef.current
    if (!el) return undefined
    const onWheel = (e) => {
      e.preventDefault()
      const z0 = zoomRef.current
      const z1 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z0 * (e.deltaY < 0 ? 1.1 : 1 / 1.1)).toFixed(3)))
      if (z1 === z0) return
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left + el.scrollLeft) / z0
      const py = (e.clientY - r.top + el.scrollTop) / z0
      setZoom(z1)
      requestAnimationFrame(() => {
        el.scrollLeft = px * z1 - (e.clientX - r.left)
        el.scrollTop = py * z1 - (e.clientY - r.top)
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Cỡ khối theo nội dung thật (đội trong bảng / nhánh thu nhỏ) — dùng cho xếp chỗ, dây nối, vùng thả.
  const sourceTeams = source ? est.stages[source.id]?.teams ?? full.length : full.length
  const previewOf = (s) => koPreviewOf(s, source, links.find((l) => l.toStageId === s.id), sourceTeams)
  const sizeOf = (s) => {
    if (s.type === 'round_robin') {
      const groups = shownGroups(s, full)
      const cols = groups.length
      const rows = Math.max(3, ...groups.map((g) => g.length)) + 1
      return { w: Math.max(280, 24 + cols * 150 + (cols - 1) * 8), h: 58 + 26 + rows * 30 + 36 }
    }
    const pv = previewOf(s) || []
    const rounds = pv.filter((r) => r.roundKind !== 'third')
    const third = pv.some((r) => r.roundKind === 'third')
    const first = rounds[0]?.matches.length || 1
    return { w: Math.max(280, 24 + Math.max(1, rounds.length) * 150), h: 58 + 20 + first * 64 + (third ? 70 : 0) + 36 }
  }
  const base = layoutOf(stages, sizeOf)
  const pos = (id) => (drag?.id === id ? { x: drag.x, y: drag.y } : base[id])
  const width = Math.max(900, ...stages.map((s) => pos(s.id).x + sizeOf(s).w + CANVAS.pad * 4))
  const height = Math.max(520, ...stages.map((s) => pos(s.id).y + sizeOf(s).h + CANVAS.pad * 4))
  const sel = stages.find((s) => s.id === selId) || null
  const selLink = links.find((l) => l.id === selLinkId) || null
  const choose = (stageId, linkId = null) => { setSelId(stageId); setSelLinkId(linkId) }

  // Toạ độ con trỏ trong canvas (đã tính cuộn + phóng to).
  const pointIn = (e) => {
    const r = viewRef.current.getBoundingClientRect()
    return { x: (e.clientX - r.left + viewRef.current.scrollLeft) / zoom, y: (e.clientY - r.top + viewRef.current.scrollTop) / zoom }
  }
  const blockAt = (p) => stages.find((s) => {
    const q = pos(s.id)
    const z = sizeOf(s)
    return p.x >= q.x && p.x <= q.x + z.w && p.y >= q.y && p.y <= q.y + z.h
  })
  // Đầu dây vào khối nhánh: chấm trái, ngang tiêu đề.
  const wireEnds = (to) => {
    const p1 = pos(source.id)
    const z1 = sizeOf(source)
    const p2 = pos(to.id)
    return { x1: p1.x + z1.w, y1: p1.y + z1.h / 2, x2: p2.x, y2: p2.y + 30 }
  }

  const startMove = (s) => (e) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const p = pointIn(e)
    const q = pos(s.id)
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ id: s.id, ox: p.x - q.x, oy: p.y - q.y, x: q.x, y: q.y, moved: false })
  }
  const startWire = (e) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setWire(pointIn(e))
  }
  // Kéo nền (chỗ không có khối) = di chuyển khung nhìn; bấm nền không kéo = bỏ chọn.
  const startPan = (e) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setPan({ sx: e.clientX, sy: e.clientY, left: viewRef.current.scrollLeft, top: viewRef.current.scrollTop, moved: false })
  }
  const onMove = (e) => {
    if (drag) {
      const p = pointIn(e)
      const x = Math.max(0, Math.round(p.x - drag.ox))
      const y = Math.max(0, Math.round(p.y - drag.oy))
      setDrag({ ...drag, x, y, moved: drag.moved || Math.abs(x - drag.x) + Math.abs(y - drag.y) > 3 })
    } else if (wire) setWire(pointIn(e))
    else if (pan) {
      viewRef.current.scrollLeft = pan.left - (e.clientX - pan.sx)
      viewRef.current.scrollTop = pan.top - (e.clientY - pan.sy)
      if (!pan.moved && Math.abs(e.clientX - pan.sx) + Math.abs(e.clientY - pan.sy) > 3) setPan({ ...pan, moved: true })
    }
  }
  const onUp = (e) => {
    if (drag) {
      if (drag.moved) act(a.tourCanvasSave(drag.id, { canvasX: drag.x, canvasY: drag.y }))
      else choose(selId === drag.id ? null : drag.id)
      setDrag(null)
    }
    if (wire) {
      const target = blockAt(pointIn(e))
      if (target && source && target.id !== source.id && target.type === 'knockout') {
        const cur = links.find((l) => l.toStageId === target.id)
        if (!cur) act(a.tourCanvasLink(source.id, target.id, nextFreeRanks(links, source.id)))
        choose(target.id)
      }
      setWire(null)
    }
    if (pan) {
      if (!pan.moved) choose(null)
      setPan(null)
    }
  }

  // Thả khối từ khay trái: nguồn chưa có → thành khối nguồn; có vòng bảng → nhánh mới tại chỗ thả.
  const canAdd = (item) => (!source ? true : source.type === 'round_robin' && item.type === 'knockout')
  const addBlock = (item, at) => canAdd(item) && act(a.tourCanvasAdd(event.id, item.type, at, item.config))
  const onDropCanvas = (e) => {
    const key = e.dataTransfer.getData(BLOCK_MIME)
    if (!key) return
    e.preventDefault()
    const p = pointIn(e)
    addBlock(PALETTE.find((x) => x.key === key), { x: Math.max(0, Math.round(p.x - 40)), y: Math.max(0, Math.round(p.y - 20)) })
  }
  const saveGroups = (manualGroups) => source && act(a.tourCanvasSave(source.id, { config: { ...source.config, manualGroups } }))
  const dropTeam = (toGroup) => (e) => {
    const id = e.dataTransfer.getData(TEAM_MIME)
    if (!id || !source) return
    e.preventDefault()
    e.stopPropagation()
    saveGroups(moveTeam(source, full, id, toGroup))
  }

  const fit = () => {
    const el = viewRef.current
    if (!el) return
    setZoom(Math.max(ZOOM_MIN, Math.min(1, (el.clientWidth - 24) / width, (el.clientHeight - 24) / height)))
    el.scrollLeft = 0
    el.scrollTop = 0
  }
  const relayout = () => stages.forEach((s) => (s.canvasX != null || s.canvasY != null) && act(a.tourCanvasSave(s.id, { canvasX: null, canvasY: null })))
  const publish = async () => {
    setBusy(true)
    const ok = await a.tourGenerate(event.id, 1)
    setBusy(false)
    if (ok) onOpenBracket(event.id)
  }
  const unplaced = source?.type === 'round_robin' ? unplacedTeams(source, full) : []

  return (
    <div style={{ display: 'grid', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
      {/* Thanh trên */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <Button size="sm" variant="ghost" icon="arrow-left" onClick={onBack}>{t('tournament.canvas.back')}</Button>
        <span style={{ display: 'grid', gap: 3, flex: '1 1 200px', minWidth: 0 }}>
          <span style={{ font: '700 16px/1.2 var(--font-display)', color: 'var(--text-primary)' }}>{t('tournament.canvas.title')}</span>
          <Mono size={11.5} color="var(--text-muted)">
            {t('tournament.canvas.sub', { event: t('tournament.kind.' + event.kind), n: full.length })}
            {save !== 'idle' && ' · ' + t(save === 'saving' ? 'tournament.canvas.saving' : 'tournament.canvas.saved')}
          </Mono>
        </span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '8px 14px', borderRadius: 10, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
          {[[stages.length, 'statBlocks'], [est.matches, 'statMatches']].map(([v, k]) => (
            <span key={k}><Mono size={15} weight={700} color="var(--text-primary)">{v}</Mono> <Mono size={11} color="var(--text-muted)">{t('tournament.canvas.' + k)}</Mono></span>
          ))}
          <span>
            <Mono size={15} weight={700} color="var(--text-primary)">{est.courts ? dur(Math.ceil(est.minutes / est.courts)) : '—'}</Mono>{' '}
            {est.courts > 0 && <Mono size={11} color="var(--text-muted)">{t('tournament.canvas.statCourts', { n: est.courts })}</Mono>}
          </span>
        </span>
        {!hasSchedule && <Button size="sm" variant="secondary" icon="wand-sparkles" onClick={() => setQuick(true)}>{t('tournament.canvas.quick')}</Button>}
        {hasSchedule ? (
          <Button size="sm" iconAfter="arrow-right" onClick={() => onOpenBracket(event.id)}>
            {t('tournament.module.bracket')} →
          </Button>
        ) : (
          <Button size="sm" iconAfter="arrow-right" disabled={blocked || busy} loading={busy} onClick={publish}>
            {t('tournament.canvas.publish')}
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr) 300px', minHeight: 600 }}>
        {/* Trái: khối + cặp chưa xếp */}
        <aside style={{ display: 'grid', alignContent: 'start', gap: 14, padding: 14, borderRight: '1px solid var(--border-subtle)' }}>
          {overline(t('tournament.canvas.palette'))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PALETTE.map((item) => {
              const ok = canAdd(item)
              return (
                <button key={item.key} type="button" draggable={ok} disabled={!ok}
                  title={ok ? undefined : t('tournament.canvas.palSourceTaken')}
                  onDragStart={(e) => e.dataTransfer.setData(BLOCK_MIME, item.key)}
                  onClick={() => addBlock(item, null)}
                  style={{
                    display: 'grid', gap: 8, padding: '10px 10px 9px', borderRadius: 10, textAlign: 'left', color: 'inherit',
                    cursor: ok ? 'grab' : 'not-allowed', opacity: ok ? 1 : 0.4,
                    background: 'var(--surface-raised)', border: '1px solid var(--border-default)',
                  }}>
                  <span style={{ display: 'flex', gap: 3 }}>
                    {Array.from({ length: item.bars[0] }, (_, i) => (
                      <span key={i} style={{ width: item.bars[0] === 1 ? 30 : 12, height: 12, borderRadius: 3, background: BAR[item.bars[1]] }} />
                    ))}
                  </span>
                  <span style={{ font: '600 12.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{t('tournament.canvas.' + PAL_KEY[item.key])}</span>
                </button>
              )
            })}
          </div>

          {source?.type === 'round_robin' && (
            <div onDragOver={(e) => e.preventDefault()} onDrop={dropTeam(-1)}
              style={{ display: 'grid', gap: 6, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {overline(t('tournament.canvas.tray'))}
                {unplaced.length > 0 && <Mono size={11} weight={700} color="var(--status-delayed-fg)">{unplaced.length}</Mono>}
              </span>
              <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t(unplaced.length ? 'tournament.canvas.trayHint' : 'tournament.canvas.trayEmpty')}</span>
              {unplaced.map((x) => <TeamChip key={x.id} team={x} tour={tour} db={db} />)}
            </div>
          )}
        </aside>

        {/* Giữa: canvas */}
        <div style={{ position: 'relative', minWidth: 0 }}>
          <div ref={viewRef} onDragOver={(e) => e.preventDefault()} onDrop={onDropCanvas}
            style={{ position: 'absolute', inset: 0, overflow: 'auto', background: 'var(--surface-inset)',
              backgroundImage: 'radial-gradient(var(--border-default) 1px, transparent 1px)', backgroundSize: `${18 * zoom}px ${18 * zoom}px` }}>
            <div style={{ width: width * zoom, height: height * zoom }}>
              <div onPointerDown={startPan} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { setDrag(null); setWire(null); setPan(null) }}
                style={{ position: 'relative', width, height, transform: `scale(${zoom})`, transformOrigin: '0 0', touchAction: 'none', cursor: pan?.moved ? 'grabbing' : 'default' }}>
                <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {source && links.map((l) => {
                    const to = stages.find((s) => s.id === l.toStageId)
                    if (!to) return null
                    const { x1, y1, x2, y2 } = wireEnds(to)
                    const mx = (x1 + x2) / 2
                    const on = l.id === selLinkId
                    return <path key={l.id} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="var(--teal-500)" strokeWidth={on ? 3.5 : 2} />
                  })}
                  {wire && source && (() => {
                    const p1 = pos(source.id)
                    const z1 = sizeOf(source)
                    return <path d={`M${p1.x + z1.w},${p1.y + z1.h / 2} L${wire.x},${wire.y}`} fill="none" stroke="var(--teal-500)" strokeWidth="2" strokeDasharray="6 4" />
                  })()}
                </svg>

                {/* Nhãn dây nối: hạng · số đội — bấm để sửa riêng đường nối đó */}
                {source && links.map((l) => {
                  const to = stages.find((s) => s.id === l.toStageId)
                  if (!to) return null
                  const { x1, y1, x2, y2 } = wireEnds(to)
                  const on = l.id === selLinkId
                  return (
                    <button key={'lb' + l.id} type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => choose(null, l.id)}
                      style={{
                        position: 'absolute', left: (x1 + x2) / 2 - 62, top: (y1 + y2) / 2 - 13, width: 124,
                        padding: '4px 8px', borderRadius: 99, cursor: 'pointer', font: '600 10.5px/1.2 var(--font-mono)',
                        color: on ? 'var(--action-accent-fg)' : 'var(--text-primary)',
                        background: on ? 'var(--action-accent-bg)' : 'var(--surface-card)', border: '1px solid var(--teal-500)',
                      }}>
                      {t('tournament.canvas.linkTeams', { ranks: rankLabel(l.ranks), n: est.stages[to.id]?.teams ?? 0 })}
                    </button>
                  )
                })}

                {stages.map((s) => (
                  <Block key={s.id} s={s} at={pos(s.id)} size={sizeOf(s)} on={s.id === selId} dragging={drag?.id === s.id}
                    isSource={s.id === source?.id} linked={links.some((l) => l.toStageId === s.id)}
                    est={est.stages[s.id]} stages={stages} full={full} tour={tour} db={db}
                    preview={s.type === 'knockout' ? previewOf(s) : null}
                    onMoveStart={startMove(s)} onWireStart={s.id === source?.id && s.type === 'round_robin' ? startWire : null}
                    onDropTeam={dropTeam} onRun={s.id === source?.id && !blocked && !busy ? publish : null} />
                ))}
              </div>
            </div>
          </div>
          <span style={{ position: 'absolute', left: 12, bottom: 14, font: 'var(--type-caption)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
            {t('tournament.canvas.panHint')}
          </span>
          <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', gap: 6 }}>
            <Button size="sm" variant="secondary" aria-label={t('tournament.canvas.zoomOut')} onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.1).toFixed(2)))}>−</Button>
            <Mono size={11} color="var(--text-muted)" style={{ alignSelf: 'center', minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</Mono>
            <Button size="sm" variant="secondary" aria-label={t('tournament.canvas.zoomIn')} onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.1).toFixed(2)))}>+</Button>
            <Button size="sm" variant="secondary" onClick={fit}>{t('tournament.canvas.fit')}</Button>
          </div>
        </div>

        {/* Phải: toàn giải / khối đang chọn / đường nối đang chọn */}
        <aside style={{ padding: 14, borderLeft: '1px solid var(--border-subtle)', overflowY: 'auto' }}>
          {selLink && source ? (
            <LinkPanel link={selLink} source={source} stages={stages} links={links} teams={est.stages[selLink.toStageId]?.teams ?? 0}
              onRanks={(ranks) => act(a.tourCanvasLink(source.id, selLink.toStageId, ranks))}
              onDelete={() => { act(a.tourCanvasLink(source.id, selLink.toStageId, [])); choose(null) }}
              onClose={() => choose(null)} />
          ) : sel ? (
            <StagePanel key={sel.id} stage={sel} stages={stages} source={source} links={links} full={full} est={est}
              act={act} a={a} onSaveGroups={saveGroups} onPickLink={(id) => choose(null, id)} onClose={() => choose(null)} />
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                {overline(t('tournament.canvas.whole'))}
                <span style={{ font: '700 18px/1.2 var(--font-display)', color: 'var(--text-primary)' }}>{t('tournament.kind.' + event.kind)}</span>
                <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.canvas.wholeHint')}</span>
              </div>
              <PanelButton title={t('tournament.canvas.quickTitle')} sub={t('tournament.canvas.quickSub')} onClick={() => setQuick(true)} />
              <PanelButton title={t('tournament.canvas.fit')} onClick={fit} />
              <PanelButton title={t('tournament.canvas.relayout')} onClick={relayout} />
              <div style={{ display: 'grid', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                {overline(t('tournament.canvas.checks'))}
                {checks.map((c) => (
                  <span key={c.key} style={{ display: 'flex', gap: 8, font: '500 12.5px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>
                    <span style={{ width: 8, height: 8, marginTop: 5, borderRadius: 99, flex: '0 0 auto',
                      background: c.tone === 'ok' ? 'var(--status-delivered-fg)' : c.tone === 'bad' ? 'var(--status-incident-fg)' : 'var(--status-delayed-fg)' }} />
                    {t(c.key, { ...c.vars, end: c.vars?.end?.slice?.(0, 5) })}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {quick && <QuickDialog tour={tour} event={event} n={full.length} a={a} act={act} onClose={() => setQuick(false)} />}
    </div>
  )
}

function PanelButton({ title, sub, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'grid', gap: 3, textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', color: 'inherit',
        background: 'var(--surface-raised)', border: '1px solid var(--border-default)' }}>
      <span style={{ font: '600 13px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{title}</span>
      {sub && <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{sub}</span>}
    </button>
  )
}

/**
 * Hộp "Tạo nhanh sơ đồ" (handoff): chọn mẫu (có sẵn + mẫu CLB) · cách chia đội vào bảng · số cặp mỗi bảng →
 * tóm tắt "n khối · m đường nối · ~x trận" (tính bằng chính hàm dựng) → "Dựng sơ đồ" thay toàn bộ sơ đồ.
 */
function QuickDialog({ tour, event, n, a, act, onClose }) {
  const [tpl, setTpl] = useState('rr_ko')
  const [fill, setFill] = useState('snake')
  const [per, setPer] = useState(4)
  const [busy, setBusy] = useState(false)
  const club = tpl.startsWith('club:') ? (tour.templates || []).find((x) => 'club:' + x.id === tpl) : null
  const grouped = tpl === 'rr_ko' || tpl === 'rr_ko_plate'
  const plan = club ? null : quickPlan(tpl, event, n, per)
  const build = async () => {
    setBusy(true)
    const ok = await act(club ? a.tourSaveTemplate(event.id, tpl) : a.tourQuickBuild(event.id, tpl, { numGroups: plan.numGroups, advance: plan.advance, fill: grouped || tpl === 'rr' ? fill : 'snake' }))
    setBusy(false)
    if (ok) onClose()
  }
  const card = (key, title, sub, bars) => (
    <button key={key} type="button" aria-pressed={tpl === key} onClick={() => setTpl(key)}
      style={{
        display: 'grid', gap: 6, textAlign: 'left', padding: 10, borderRadius: 10, cursor: 'pointer', color: 'inherit',
        background: tpl === key ? 'var(--surface-accent-soft)' : 'var(--surface-raised)',
        border: `1px solid ${tpl === key ? 'var(--teal-500)' : 'var(--border-default)'}`,
      }}>
      <span style={{ display: 'flex', gap: 3 }}>{bars.map((b, i) => <span key={i} style={{ width: 22, height: 10, borderRadius: 3, background: BAR[b] }} />)}</span>
      <span style={{ font: '700 12.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{title}</span>
      <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{sub}</span>
    </button>
  )
  return (
    <Dialog open width={600} title={t('tournament.canvas.quickDialog')} onClose={busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={busy} onClick={build}>{t('tournament.canvas.quickBuild')}</Button>
        </>
      )}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
          {TEMPLATES.map((k) => card(k, t('tournament.format.tpl.' + k), t('tournament.format.tplSub.' + k), TPL_BARS[k] || ['teal']))}
          {(tour.templates || []).map((x) => card('club:' + x.id, x.name, t('tournament.format.clubTemplate', { n: x.graph?.stages?.length || 0 }),
            (x.graph?.stages || []).map((s) => (s.type === 'round_robin' ? 'teal' : 'amber'))))}
        </div>
        {!club && (grouped || tpl === 'rr') && (
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ font: '600 12px/1.3 var(--font-sans)', color: 'var(--text-secondary)' }}>{t('tournament.canvas.fill')}</span>
            <Seg options={['snake', 'draw', 'empty'].map((k) => ({ key: k, label: t('tournament.canvas.fill' + k[0].toUpperCase() + k.slice(1)) }))} value={fill} onChange={setFill} />
          </div>
        )}
        {!club && grouped && (
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ font: '600 12px/1.3 var(--font-sans)', color: 'var(--text-secondary)' }}>{t('tournament.canvas.perGroup')}</span>
            <Seg options={[3, 4, 5, 6].map((k) => ({ key: k, label: String(k) }))} value={per} onChange={setPer} />
          </div>
        )}
        {plan && (
          <Mono size={12} color="var(--text-secondary)">
            {t('tournament.canvas.quickSummary', { b: plan.blocks, l: plan.links, m: plan.matches })}
          </Mono>
        )}
      </div>
    </Dialog>
  )
}

/** Cặp kéo được (khay trái hoặc trong bảng) — có nhãn KHÁCH khi cặp có người ngoài CLB. */
function TeamChip({ team, tour, db, seed }) {
  const guest = team.players?.some((p) => p.playerType === 'guest')
  return (
    <span draggable onDragStart={(e) => e.dataTransfer.setData(TEAM_MIME, team.id)}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 7, cursor: 'grab', minWidth: 0,
        background: 'var(--surface-card)', border: '1px solid var(--border-default)' }}>
      {seed != null && <Mono size={10} weight={700} color="var(--text-muted)">{seed}</Mono>}
      <span style={{ flex: 1, minWidth: 0, font: '600 11.5px/1.2 var(--font-sans)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {teamName(tour, db, team.id)}
      </span>
      {guest && <Mono size={9} weight={700} color="var(--status-transit-fg)">{t('tournament.players.guestTag')}</Mono>}
      <Mono size={10} color="var(--text-muted)">{Math.round(team.sum || 0)}</Mono>
    </span>
  )
}

const sideText = (x) => (x.kind === 'slot' ? x.label : x.kind === 'seed' ? t('tournament.canvas.seed', { n: x.n })
  : x.kind === 'winner' ? t('tournament.canvas.won', { n: x.no }) : x.kind === 'loser' ? t('tournament.canvas.lost', { n: x.no }) : t('tournament.canvas.bye'))

/** Một khối trên canvas: tiêu đề (kéo để dời) · nội dung (bảng có đội / nhánh thu nhỏ) · chân (số trận · luật · giờ). */
function Block({ s, at, size, on, dragging, isSource, linked, est, stages, full, tour, db, preview, onMoveStart, onWireStart, onDropTeam, onRun }) {
  const rr = s.type === 'round_robin'
  const groups = rr ? shownGroups(s, full) : []
  const byId = new Map(full.map((x) => [x.id, x]))
  const teams = est?.teams ?? 0
  const byes = rr ? 0 : byesOf(teams)
  const sub = rr
    ? `${t('tournament.format.groupCount', { n: s.config?.numGroups || 1 })} × ${Math.max(0, ...groups.map((g) => g.length))} · ${t('tournament.bracket.slotsN', { n: teams })}`
    : [isSource ? t('tournament.bracket.slotsN', { n: teams }) : t('tournament.canvas.fromPrev', { n: teams }),
      s.config?.thirdPlace ? t('tournament.canvas.third') : null,
      byes ? t('tournament.canvas.byes', { n: byes }) : null].filter(Boolean).join(' · ')
  return (
    <div onPointerDown={(e) => e.stopPropagation()} style={{
      position: 'absolute', left: at.x, top: at.y, width: size.w, height: size.h, boxSizing: 'border-box', display: 'grid',
      gridTemplateRows: 'auto 1fr auto', borderRadius: 12, background: 'var(--surface-card)', zIndex: dragging ? 3 : 1,
      border: `1px solid ${on ? 'var(--teal-500)' : 'var(--border-default)'}`, boxShadow: on || dragging ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
    }}>
      {/* chấm nối: trái = nhận đội (nhánh), phải = đẩy đội (vòng bảng nguồn — kéo để nối) */}
      {!isSource && (
        <span style={{ position: 'absolute', left: -7, top: 23, width: 12, height: 12, borderRadius: 99, background: 'var(--surface-card)',
          border: `2px solid ${linked ? 'var(--teal-500)' : 'var(--status-delayed-fg)'}` }} />
      )}
      {onWireStart && (
        <span role="button" aria-label={t('tournament.canvas.portHint')} title={t('tournament.canvas.portHint')} onPointerDown={onWireStart}
          style={{ position: 'absolute', right: -8, top: size.h / 2 - 8, width: 16, height: 16, borderRadius: 99, cursor: 'crosshair',
            background: 'var(--surface-card)', border: '2px solid var(--teal-500)', zIndex: 2 }} />
      )}

      <div onPointerDown={onMoveStart} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 8px', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none', borderBottom: '1px solid var(--border-subtle)' }}>
        <Mono size={9.5} weight={700} color={rr ? 'var(--status-transit-fg)' : 'var(--status-delayed-fg)'}
          style={{ padding: '2px 5px', borderRadius: 4, background: rr ? 'var(--surface-accent-soft)' : 'var(--status-delayed-bg)' }}>
          {t(rr ? 'tournament.canvas.tagRr' : 'tournament.canvas.tagKo')}
        </Mono>
        <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <span style={{ font: '700 13px/1.2 var(--font-sans)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stageName(s, stages)}</span>
          <Mono size={10.5} color="var(--text-muted)">{sub}</Mono>
        </span>
      </div>

      <div style={{ padding: '8px 12px', overflow: 'hidden' }}>
        {rr ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${groups.length}, minmax(0,1fr))`, gap: 8 }}>
            {groups.map((ids, gi) => {
              const members = ids.map((id) => byId.get(id)).filter(Boolean)
              const avg = members.length ? Math.round(members.reduce((x, m) => x + (m.sum || 0), 0) / members.length) : null
              return (
                <div key={gi} onDragOver={(e) => e.preventDefault()} onDrop={onDropTeam(gi)}
                  style={{ display: 'grid', alignContent: 'start', gap: 4, padding: 6, borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', font: '700 11.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>
                    {t('tournament.standings.groupTitle', { label: String.fromCharCode(65 + gi) })}
                    {avg != null && <Mono size={10} color="var(--text-muted)">{avg}</Mono>}
                  </span>
                  {members.map((m, k) => <TeamChip key={m.id} team={m} tour={tour} db={db} seed={k + 1} />)}
                  <span style={{ padding: '5px 8px', borderRadius: 7, border: '1px dashed var(--border-default)', font: '500 10.5px/1.2 var(--font-sans)', color: 'var(--text-disabled)', textAlign: 'center' }}>
                    {t('tournament.canvas.dropHere')}
                  </span>
                </div>
              )
            })}
          </div>
        ) : preview ? (
          <div style={{ display: 'flex', gap: 10 }}>
            {preview.filter((r) => r.roundKind !== 'third').map((r, ri) => (
              <div key={ri} style={{ display: 'grid', alignContent: 'space-around', gap: 6, width: 140, flex: '0 0 auto' }}>
                <Mono size={9.5} weight={700} color="var(--text-muted)" style={{ textTransform: 'uppercase' }}>{t('tournament.round.' + r.roundKind)}</Mono>
                {r.matches.map((m) => <MiniMatch key={m.no} m={m} />)}
              </div>
            ))}
            {preview.filter((r) => r.roundKind === 'third').map((r) => (
              <div key="third" style={{ display: 'grid', alignContent: 'end', gap: 6, width: 140, flex: '0 0 auto' }}>
                <Mono size={9.5} weight={700} color="var(--text-muted)" style={{ textTransform: 'uppercase' }}>{t('tournament.round.third')}</Mono>
                {r.matches.map((m) => <MiniMatch key={m.no} m={m} />)}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderTop: '1px solid var(--border-subtle)' }}>
        <Mono size={10.5} color="var(--text-muted)" style={{ flex: 1 }}>
          {t('tournament.canvas.footer', { n: est?.matches ?? 0, rule: s.matchRule ? ruleLabel(s.matchRule) : '—', time: dur(est?.minutes ?? 0) })}
        </Mono>
        {onRun && (
          <button type="button" onClick={onRun}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', font: '700 11px/1 var(--font-sans)', color: 'var(--status-transit-fg)' }}>
            {t('tournament.canvas.runBranch')} →
          </button>
        )}
      </div>
    </div>
  )
}

function MiniMatch({ m }) {
  const row = (x) => (
    <span style={{ font: `${x.kind === 'slot' || x.kind === 'seed' ? 600 : 400} 10.5px/1.25 var(--font-sans)`,
      color: x.kind === 'slot' || x.kind === 'seed' ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {sideText(x)}
    </span>
  )
  return (
    <div style={{ display: 'grid', gap: 2, padding: '4px 7px', borderRadius: 6, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
      {row(m.a)}
      {row(m.b)}
    </div>
  )
}

const panelRow = (label, control) => (
  <div style={{ display: 'grid', gap: 6 }}>
    <span style={{ font: '600 11.5px/1.2 var(--font-sans)', color: 'var(--text-secondary)' }}>{label}</span>
    {control}
  </div>
)
const panelHead = (title, onClose) => (
  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <span style={{ font: '700 15px/1.2 var(--font-display)', color: 'var(--text-primary)' }}>{title}</span>
    <Button size="sm" variant="ghost" icon="x" aria-label={t('tournament.canvas.done')} onClick={onClose} />
  </span>
)

/** Bảng sửa đường nối (handoff): hạng nào của mỗi bảng đi theo đường này · xoá đường nối. */
function LinkPanel({ link, source, stages, links, teams, onRanks, onDelete, onClose }) {
  const to = stages.find((s) => s.id === link.toStageId)
  const taken = new Set(links.filter((l) => l.id !== link.id).flatMap((l) => l.ranks))
  const toggle = (r) => {
    const cur = new Set(link.ranks)
    if (cur.has(r)) cur.delete(r)
    else cur.add(r)
    onRanks([...cur])
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {panelHead(t('tournament.canvas.link'), onClose)}
      <Mono size={11.5} color="var(--text-muted)">{stageName(source, stages)} → {to ? stageName(to, stages) : ''}</Mono>
      <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.canvas.linkHint')}</span>
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {RANK_CHOICES.map((r) => {
          const on = link.ranks.includes(r)
          const off = !on && taken.has(r)
          return (
            <button key={r} type="button" disabled={off} onClick={() => toggle(r)} aria-pressed={on}
              style={{
                minWidth: 40, height: 34, borderRadius: 8, font: '700 12px/1 var(--font-mono)', cursor: off ? 'default' : 'pointer',
                opacity: off ? 0.4 : 1, color: on ? 'var(--status-transit-fg)' : 'var(--text-secondary)',
                background: on ? 'var(--surface-accent-soft)' : 'transparent', border: `1px solid ${on ? 'var(--teal-500)' : 'var(--border-default)'}`,
              }}>
              {t('tournament.flow.rank', { n: r })}
            </button>
          )
        })}
      </span>
      <Mono size={11.5} color="var(--text-secondary)">{t('tournament.canvas.linkTeams', { ranks: rankLabel(link.ranks), n: teams })}</Mono>
      <Button size="sm" variant="ghost" icon="trash-2" onClick={onDelete}>{t('tournament.canvas.linkDelete')}</Button>
    </div>
  )
}

/**
 * Bảng sửa khối đang chọn: tên, số bảng / số cặp mỗi bảng / số lượt, chia bảng (rắn · bốc thăm · đưa hết về khay),
 * độ cân các bảng, luật, đường vào (nhánh), xoá.
 */
function StagePanel({ stage, stages, source, links, full, est, act, a, onSaveGroups, onPickLink, onClose }) {
  const [name, setName] = useState(stage.title || '')
  const isSource = stage.id === source?.id
  const link = links.find((l) => l.toStageId === stage.id)
  const save = (patch) => act(a.tourCanvasSave(stage.id, patch))
  const saveConfig = (patch) => save({ config: { ...stage.config, ...patch } })
  const numGroups = stage.config?.numGroups || 1
  const rr = stage.type === 'round_robin'
  const teams = est.stages[stage.id]?.teams ?? 0
  const draw = () => {
    const ids = shuffle(full.map((x) => x.id))
    onSaveGroups(Array.from({ length: numGroups }, (_, g) => ids.filter((_, i) => i % numGroups === g)))
  }
  const perNow = numGroups > 0 ? Math.ceil(full.length / numGroups) : 0
  const bal = rr && numGroups > 1 && full.length ? groupBalanceOf(stage, full) : null

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {panelHead(stageName(stage, stages), onClose)}
      {panelRow(t('tournament.canvas.name'), (
        <Input value={name} placeholder={t('tournament.canvas.namePh')} onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== (stage.title || '') && save({ title: name.trim() || null })} />
      ))}
      {rr && panelRow(t('tournament.format.groups'), (
        <Seg options={[1, 2, 3, 4].map((k) => ({ key: k, label: String(k) }))} value={numGroups}
          onChange={(k) => saveConfig({ numGroups: Number(k), manualGroups: null })} />
      ))}
      {rr && full.length >= 4 && panelRow(t('tournament.canvas.perGroup'), (
        <Seg options={[3, 4, 5, 6].map((k) => ({ key: k, label: String(k) }))} value={perNow}
          onChange={(k) => saveConfig({ numGroups: Math.max(1, Math.min(4, Math.ceil(full.length / k))), manualGroups: null })} />
      ))}
      {rr && panelRow(t('tournament.format.legs'), (
        <Seg options={[{ key: 1, label: t('tournament.format.oneLeg') }, { key: 2, label: t('tournament.format.twoLegs') }]}
          value={stage.config?.legs || 1} onChange={(k) => saveConfig({ legs: Number(k) })} />
      ))}
      {rr && numGroups > 1 && full.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <Button size="sm" variant="secondary" onClick={() => onSaveGroups(null)}>{t('tournament.canvas.snake')}</Button>
          <Button size="sm" variant="secondary" onClick={draw}>{t('tournament.canvas.draw')}</Button>
          <Button size="sm" variant="ghost" onClick={() => onSaveGroups(Array.from({ length: numGroups }, () => []))}>
            {t('tournament.canvas.clearGroups')} · {t('tournament.canvas.clearGroupsSub')}
          </Button>
        </div>
      )}
      {bal && (
        <div style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', font: '600 12px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>
            {t('tournament.canvas.balance')}
            <Mono size={11} weight={700} color={bal.isBalanced ? 'var(--status-delivered-fg)' : 'var(--status-delayed-fg)'}>{t('tournament.canvas.balanceSpread', { n: bal.spread })}</Mono>
          </span>
          {bal.avgs.map((v, i) => (
            <span key={i} style={{ display: 'flex', justifyContent: 'space-between', font: 'var(--type-caption)', color: 'var(--text-secondary)' }}>
              {t('tournament.standings.groupTitle', { label: String.fromCharCode(65 + i) })}
              <Mono size={11}>{v ?? '—'}</Mono>
            </span>
          ))}
          <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.canvas.balanceHint', { n: cfg.tournament.groupBalanceOk })}</span>
        </div>
      )}
      {!rr && (
        <span style={{ font: 'var(--type-caption)', color: link || isSource ? 'var(--text-secondary)' : 'var(--status-delayed-fg)' }}>
          {isSource ? t('tournament.canvas.koSource', { n: teams, size: teams >= 2 ? nextPowerOf2(teams) : 0 })
            : link ? t('tournament.canvas.koIn', { n: teams, size: teams >= 2 ? nextPowerOf2(teams) : 0 }) : t('tournament.canvas.koUnlinked')}
          {byesOf(teams) > 0 && ' ' + t('tournament.canvas.byes', { n: byesOf(teams) }) + '.'}
        </span>
      )}
      {!rr && link && <Button size="sm" variant="secondary" onClick={() => onPickLink(link.id)}>{t('tournament.canvas.link')} · {rankLabel(link.ranks)}</Button>}
      {!rr && panelRow(t('tournament.format.thirdPlace'), (
        <Seg options={[{ key: 'on', label: t('tournament.format.on') }, { key: 'off', label: t('tournament.format.off') }]}
          value={stage.config?.thirdPlace ? 'on' : 'off'} onChange={(k) => saveConfig({ thirdPlace: k === 'on' })} />
      ))}
      {panelRow(t('tournament.format.qualify'), (
        <RuleField value={stage.matchRule} onChange={(rule) => save({ matchRule: rule })} />
      ))}
      {!rr && panelRow(t('tournament.format.ranking'), (
        <RuleField value={stage.ruleOverrides?.final}
          onChange={(rule) => save({ ruleOverrides: { ...stage.ruleOverrides, final: rule, third: rule } })} />
      ))}
      <div style={{ display: 'grid', gap: 4 }}>
        <Button size="sm" variant="ghost" icon="trash-2" disabled={isSource && stages.length > 1} onClick={() => { act(a.tourCanvasDelete(stage.id)); onClose() }}>
          {t('tournament.canvas.delete')}
        </Button>
        <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
          {t(isSource && stages.length > 1 ? 'tournament.canvas.errDeleteSource' : 'tournament.canvas.deleteHint')}
        </span>
      </div>
    </div>
  )
}
