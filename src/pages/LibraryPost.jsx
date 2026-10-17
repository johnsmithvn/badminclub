import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Dialog, Icon, Skeleton } from '#ds'
import { Empty, TabTrack } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { libErr } from '#contexts/libraryActions.js'
import { useMobile } from '#hooks/useMobile.js'
import { can } from '#lib/roles.js'
import { myMember } from '#lib/money.js'
import { activeNoteIdx, clock, loopRange } from '#lib/library.js'
import { extractYouTubeId } from '#utils/videoUtils.js'
import { ddmy, isoOf } from '#utils/dates.js'
import { pathOf } from '#routes'
import { t } from '#i18n'
import cfg from '#config/app.js'
import { useYouTube } from '#components/library/useYouTube.js'
import PostComposer from '#components/library/PostComposer.jsx'

/** Đọc một bài: video dính trên đầu khi cuộn, tua chậm, lặp đoạn, bấm mốc để tua tới. */
export default function LibraryPost() {
  const { id } = useParams()
  const { db, a } = useApp()
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const me = myMember(db)?.id || null
  const isOwner = can(db.viewAs || 'owner', 'settings')
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(false)
  const [viewers, setViewers] = useState(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    a.libPost(id)
      .then((r) => {
        if (!alive) return
        setData(r)
        // Mở bài = một lượt xem. RPC tự bỏ qua lần mở thứ hai và bài của chính mình.
        if (r.post) {
          a.libView(id).then((n) => {
            if (alive && n != null) setData((d) => (d?.post ? { ...d, post: { ...d.post, viewCount: n } } : d))
          })
        }
      })
      .catch((e) => { if (alive) { setErr(libErr(e)); setData({ post: null, mark: null }) } })
    return () => { alive = false }
  }, [a, id, version])

  const back = () => navigate(pathOf('library'))
  const post = data?.post
  const saved = !!data?.mark?.saved
  const canEdit = !!post && (isOwner || (me && post.authorId === me))

  const toggleSave = async () => {
    if (await a.libSave(post.id, !saved)) setData((d) => ({ ...d, mark: { ...d.mark, saved: !saved } }))
  }
  const openViewers = async () => {
    setViewers([])
    try { setViewers(await a.libViewers(post.id)) } catch (e) { setErr(libErr(e)) }
  }
  const nameOf = (memberId) => (db.members || []).find((m) => m.id === memberId)?.name || t('common.unknown')

  if (!data) return <Skeleton height={320} />
  if (!post) {
    return (
      <div style={S.box}>
        {err && <Alert tone="danger">{err}</Alert>}
        <Empty icon="book-open" title={t('library.notFoundTitle')} hint={t('library.notFoundHint')} />
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 18 }}>
          <Button variant="secondary" icon="arrow-left" onClick={back}>{t('library.back')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <Button variant="ghost" icon="chevron-left" onClick={back} style={{ minWidth: 0 }}>
          <span style={S.ellipsis}>{post.shelf}</span>
        </Button>
        <span style={{ flex: 1 }} />
        <Button variant="secondary" icon="bookmark" onClick={toggleSave} aria-pressed={saved}
          style={saved ? { color: 'var(--action-accent-bg)', borderColor: 'var(--action-accent-bg)' } : undefined}>
          {saved ? t('library.savedLabel') : t('library.save')}
        </Button>
        {canEdit && <Button variant="ghost" icon="pencil" onClick={() => setEditing(true)}>{t('library.edit')}</Button>}
      </div>
      {err && <Alert tone="danger">{err}</Alert>}

      <Reader key={post.id} post={post} isMobile={isMobile} />

      <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
        <h1 style={{ margin: 0, font: '700 22px/1.25 var(--font-display)', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{post.title}</h1>
        <div style={{ font: '400 12.5px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>
          {t('library.byline', { name: nameOf(post.authorId), date: post.createdAt ? ddmy(isoOf(new Date(post.createdAt))) : '' })}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ ...S.pill, background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)', borderColor: 'transparent' }}>{post.shelf}</span>
          <span style={S.pill}>{t('library.videoCount', { n: post.videos.length })}</span>
          {/* Ai cũng thấy tổng số; chỉ chủ CLB mở được danh sách ai đã xem (RLS library_marks). */}
          {isOwner
            ? <button type="button" onClick={openViewers} style={{ ...S.pill, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="eye" size={13} />{t('library.views', { n: post.viewCount })}
            </button>
            : <span style={S.pill}>{t('library.views', { n: post.viewCount })}</span>}
        </div>
        {post.body && (
          <div style={{ font: '400 15px/1.65 var(--font-sans)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {post.body}
          </div>
        )}
      </div>

      {editing && (
        <PostComposer
          post={post}
          shelves={[post.shelf]}
          canPin={isOwner}
          onClose={() => setEditing(false)}
          onDone={() => { setEditing(false); setVersion((v) => v + 1) }}
          onArchived={back}
        />
      )}

      {viewers && (
        <Dialog open sheet={isMobile} title={t('library.viewersTitle', { n: viewers.length })} onClose={() => setViewers(null)}>
          {viewers.length === 0 && <div style={{ color: 'var(--text-muted)' }}>{t('library.viewersEmpty')}</div>}
          <div style={{ display: 'grid', gap: 2 }}>
            {viewers.map((v) => (
              <div key={v.memberId} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, minWidth: 0 }}>
                <span style={{ ...S.ellipsis, flex: 1, minWidth: 0, color: 'var(--text-primary)' }} title={nameOf(v.memberId)}>{nameOf(v.memberId)}</span>
                <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0 }}>{ddmy(isoOf(new Date(v.viewedAt)))}</span>
              </div>
            ))}
          </div>
        </Dialog>
      )}
    </div>
  )
}

/** Khối video dính trên đầu + danh sách mốc. Tách riêng để hook player chỉ chạy khi đã có bài. */
function Reader({ post, isMobile }) {
  const [vid, setVid] = useState(0)
  const [loop, setLoop] = useState(null)
  const v = post.videos[vid] || post.videos[0]
  // Tách từng giá trị: object trả về có chứa ref, đọc thẳng time lúc render bị React Compiler chặn.
  const { boxRef, time, duration: dur, rate, seek, setRate } = useYouTube(extractYouTubeId(v?.url), v?.start || 0, v?.end ?? null, loop)
  if (!v) return null

  const notes = v.notes || []
  const active = activeNoteIdx(notes, time)
  const pct = (x) => (dur > 0 ? Math.min(100, Math.max(0, (x / dur) * 100)) : 0) + '%'

  const toggleLoop = () => {
    if (loop) { setLoop(null); return }
    const r = loopRange(v, time, dur)
    if (r) { setLoop(r); seek(r.a) }
  }
  const jump = (sec) => { setLoop(null); seek(sec) }
  const pickVideo = (i) => { setLoop(null); setVid(i) }
  const scrub = (e) => {
    if (!(dur > 0)) return
    const box = e.currentTarget.getBoundingClientRect()
    jump(((e.clientX - box.left) / box.width) * dur)
  }

  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 3, background: 'var(--surface-page)', paddingBottom: 8,
        ...(isMobile ? { margin: '0 -14px' } : {}),
      }}>
        <div ref={boxRef} style={{ aspectRatio: '16 / 9', background: 'var(--surface-sunken)', borderRadius: isMobile ? 0 : 10, overflow: 'hidden' }} />
        {dur > 0 && (
          // Thanh phụ: chỉ để thấy đoạn cần xem và vạch mốc. Điều khiển chính (kể cả bàn phím) là của YouTube.
          <div onClick={scrub} aria-hidden="true" style={{ position: 'relative', height: 24, margin: '0 16px', cursor: 'pointer' }}>
            <span style={{ ...S.track, left: 0, right: 0, background: 'var(--surface-sunken)' }} />
            <span style={{ ...S.track, left: pct(v.start || 0), width: `calc(${pct((v.end ?? dur))} - ${pct(v.start || 0)})`, background: 'var(--surface-accent-soft)' }} />
            {loop && <span style={{ position: 'absolute', top: 7, height: 10, borderRadius: 3, left: pct(loop.a), width: `calc(${pct(loop.b)} - ${pct(loop.a)})`, background: 'var(--status-delayed-bg)', border: '1px solid var(--status-delayed-fg)' }} />}
            <span style={{ ...S.track, left: 0, width: pct(time), background: 'var(--action-accent-bg)' }} />
            {notes.map((n) => <span key={n.t} style={{ position: 'absolute', top: 5, width: 2, height: 14, marginLeft: -1, left: pct(n.t), background: 'var(--text-secondary)' }} />)}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '0 12px 0 16px' : '0 4px', flexWrap: 'wrap' }}>
          <span style={{ font: '500 12px/1 var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {clock(time)} / {clock(dur)}
          </span>
          <span style={{ flex: 1 }} />
          <div style={{ display: 'flex', padding: 3, borderRadius: 9, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
            {cfg.library.rates.map((r) => (
              <button key={r} type="button" onClick={() => setRate(r)} aria-pressed={rate === r} style={{
                minHeight: 38, minWidth: 46, padding: '0 8px', borderRadius: 7, border: 0, cursor: 'pointer',
                font: '600 12px/1 var(--font-mono)',
                background: rate === r ? 'var(--action-primary-bg)' : 'transparent',
                color: rate === r ? 'var(--action-primary-fg)' : 'var(--text-secondary)',
              }}>{r}×</button>
            ))}
          </div>
          <Button variant="secondary" icon="repeat" onClick={toggleLoop} aria-pressed={!!loop}
            style={loop ? { color: 'var(--status-delayed-fg)', borderColor: 'var(--status-delayed-fg)', background: 'var(--status-delayed-bg)' } : undefined}>
            {loop ? t('library.loopOn', { a: clock(loop.a), b: clock(loop.b) }) : t('library.loop')}
          </Button>
        </div>
      </div>

      {post.videos.length > 1 && (
        <TabTrack>
          <div style={{ display: 'flex', gap: 8 }}>
            {post.videos.map((x, i) => (
              <button key={i} type="button" onClick={() => pickVideo(i)} aria-pressed={i === vid} style={{
                flex: '0 0 auto', display: 'grid', gap: 4, textAlign: 'left', padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                background: i === vid ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
                border: `1px solid ${i === vid ? 'var(--action-accent-bg)' : 'var(--border-subtle)'}`,
              }}>
                <span style={{ font: '600 12.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>{t('library.videoTab', { n: i + 1 })}</span>
                <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--text-muted)' }}>
                  {x.end != null ? t('library.range', { a: clock(x.start || 0), b: clock(x.end) }) : t('library.from', { a: clock(x.start || 0) })}
                </span>
              </button>
            ))}
          </div>
        </TabTrack>
      )}

      {notes.length > 0 && (
        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ font: '600 16px/1.2 var(--font-display)', color: 'var(--text-primary)' }}>{t('library.marksTitle')}</span>
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('library.marksHint')}</span>
          </div>
          {notes.map((n, i) => (
            <button key={n.t + ':' + i} type="button" onClick={() => jump(n.t)} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', padding: '11px 12px', borderRadius: 10,
              minHeight: 48, cursor: 'pointer', minWidth: 0,
              background: i === active ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
              border: `1px solid ${i === active ? 'var(--action-accent-bg)' : 'var(--border-subtle)'}`,
            }}>
              <span style={{
                flex: '0 0 auto', padding: '5px 7px', borderRadius: 6, font: '600 12.5px/1 var(--font-mono)',
                background: i === active ? 'var(--action-accent-bg)' : 'var(--surface-inset)',
                color: i === active ? 'var(--action-accent-fg)' : 'var(--text-secondary)',
              }}>{clock(n.t)}</span>
              <span style={{ flex: 1, minWidth: 0, font: '400 14px/1.5 var(--font-sans)', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{n.text}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

const S = {
  box: { borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', display: 'grid', gap: 8 },
  ellipsis: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pill: {
    padding: '5px 9px', borderRadius: 999, border: '1px solid var(--border-subtle)', background: 'var(--surface-inset)',
    font: '500 11.5px/1 var(--font-sans)', color: 'var(--text-secondary)',
  },
  track: { position: 'absolute', top: 10, height: 4, borderRadius: 999 },
}
