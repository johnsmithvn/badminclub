import { useState } from 'react'
import { Alert, Button, Dialog, Icon, IconButton, Input, Switch, Textarea } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { blankForm, checkPost, clock, dropVideo, formOf, startFromUrl, thumbOf } from '#lib/library.js'
import { t, tBranch } from '#i18n'
import { Chip } from '#components/library/LibraryBits.jsx'

/**
 * Đăng / sửa một bài. `post` rỗng = bài mới. `shelves` = kệ đang có, gợi ý thêm từ `library.shelfSuggest`.
 * onDone(id) khi lưu xong · onArchived() khi ẩn bài (chỉ ở chế độ sửa).
 */
export default function PostComposer({ post, shelves = [], canPin, onClose, onDone, onArchived }) {
  const { a } = useApp()
  const isMobile = useMobile(768)
  const [f, setF] = useState(() => (post ? formOf(post) : blankForm()))
  const [pin, setPin] = useState(!!post?.pinnedAt)
  const [customShelf, setCustomShelf] = useState(false)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const check = checkPost(f)
  const suggest = tBranch('library.shelfSuggest')
  const shelfOptions = [...new Set([...shelves, ...(Array.isArray(suggest) ? suggest : []), post?.shelf].filter(Boolean))]
  const size = isMobile ? 'touch' : 'md'
  const multi = f.videos.length > 1

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const setVideo = (i, patch) => setF((x) => ({ ...x, videos: x.videos.map((v, k) => (k === i ? { ...v, ...patch } : v)) }))
  const setNote = (i, patch) => setF((x) => ({ ...x, notes: x.notes.map((n, k) => (k === i ? { ...n, ...patch } : n)) }))
  const addVideo = () => setF((x) => ({ ...x, videos: [...x.videos, { url: '', start: '', end: '' }] }))
  const removeVideo = (i) => setF((x) => dropVideo(x, i))
  const addNote = () => setF((x) => ({ ...x, notes: [...x.notes, { v: x.notes[x.notes.length - 1]?.v || 0, t: '', text: '' }] }))
  const removeNote = (i) => setF((x) => ({ ...x, notes: x.notes.filter((_, k) => k !== i) }))
  const pickShelf = (s) => { setCustomShelf(false); setF((x) => ({ ...x, shelf: s })) }

  const submit = async () => {
    setTried(true)
    if (!check.ok) return
    setBusy(true)
    const id = post ? ((await a.libUpdate(post.id, check.post)) && post.id) : await a.libCreate(check.post)
    if (id && canPin && pin !== !!post?.pinnedAt) await a.libPin(id, pin)
    if (id) onDone(id)
    else setBusy(false)
  }
  const archive = async () => {
    setBusy(true)
    if (await a.libArchive(post.id)) onArchived()
    else setBusy(false)
  }

  // Lỗi đầu tiên (đã bấm Đăng) hoặc tóm tắt bài sắp lưu — hiện ở chân sheet cạnh nút.
  const firstErr = check.error || check.errors.title || check.errors.shelf ||
    check.errors.videos.map((e) => e.url || e.range).find(Boolean) || check.errors.notes.find(Boolean)
  const status = check.ok
    ? t('library.form.status', { n: check.post.videos.length, shelf: check.post.shelf })
    : tried && firstErr ? t(firstErr) : ''

  return (
    <Dialog
      open
      sheet={isMobile}
      width={640}
      title={post ? t('library.form.editTitle') : t('library.form.createTitle')}
      description={post ? undefined : t('library.form.sub')}
      onClose={busy ? undefined : onClose}
      footer={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minWidth: 0 }}>
          <span style={{
            flex: 1, minWidth: 0, font: '400 12px/1.4 var(--font-mono)',
            color: check.ok || !tried ? 'var(--text-muted)' : 'var(--status-incident-fg)',
          }}>{status}</span>
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={busy} onClick={submit}>{post ? t('library.form.save') : t('library.form.submit')}</Button>
        </div>
      )}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}>
        <Input size={size} label={t('library.form.title')} placeholder={t('library.form.titlePh')} value={f.title}
          onChange={set('title')} error={tried && check.errors.title ? t(check.errors.title) : undefined} autoFocus={!post} />

        <div style={S.field}>
          <span style={S.label}>{t('library.form.shelf')}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {shelfOptions.map((s) => <Chip key={s} on={!customShelf && f.shelf === s} onClick={() => pickShelf(s)}>{s}</Chip>)}
            <Chip dashed on={customShelf} onClick={() => { setCustomShelf(true); setF((x) => ({ ...x, shelf: '' })) }}>
              {t('library.form.newShelf')}
            </Chip>
          </div>
          {customShelf && (
            <Input size={size} placeholder={t('library.form.newShelfPh')} value={f.shelf} onChange={set('shelf')} autoFocus />
          )}
          {tried && check.errors.shelf && <span style={S.err}>{t(check.errors.shelf)}</span>}
        </div>

        <div style={S.field}>
          <span style={S.label}>{t('library.form.videos')}</span>
          {f.videos.map((v, i) => {
            const e = check.errors.videos[i] || {}
            const thumb = thumbOf(v.url)
            const fromLink = !String(v.start).trim() && startFromUrl(v.url)
            return (
              <div key={i} style={S.videoBox}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
                  <span style={{ font: '600 13px/1 var(--font-sans)', color: 'var(--text-primary)' }}>{t('library.form.video', { n: i + 1 })}</span>
                  <span style={{ flex: 1 }} />
                  {multi && <Button size="sm" variant="ghost" icon="x" onClick={() => removeVideo(i)}>{t('library.form.remove')}</Button>}
                </div>
                <Input size={size} mono placeholder={t('library.form.urlPh')} value={v.url} inputMode="url"
                  onChange={(ev) => setVideo(i, { url: ev.target.value })}
                  error={e.url && (v.url.trim() || tried) ? t(e.url) : undefined} />
                {thumb && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <img src={thumb} alt="" style={{ width: 96, height: 54, flex: '0 0 auto', objectFit: 'cover', borderRadius: 6, background: 'var(--surface-sunken)' }} />
                    <div style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 13px/1.2 var(--font-sans)', color: 'var(--status-delivered-fg)' }}>
                        <Icon name="circle-check" size={14} />{t('library.form.ok')}
                      </span>
                      {fromLink && <span style={{ font: '400 11.5px/1.35 var(--font-mono)', color: 'var(--text-muted)' }}>{t('library.form.fromLink', { t: clock(fromLink) })}</span>}
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  <Input size={size} mono label={t('library.form.start')} placeholder="00:00" inputMode="numeric"
                    value={v.start} onChange={(ev) => setVideo(i, { start: ev.target.value })} />
                  <Input size={size} mono label={t('library.form.end')} placeholder={t('library.form.endPh')} inputMode="numeric"
                    value={v.end} onChange={(ev) => setVideo(i, { end: ev.target.value })} />
                </div>
                {e.range && <span style={S.err}>{t(e.range)}</span>}
              </div>
            )
          })}
          <Button variant="secondary" icon="plus" onClick={addVideo}>{t('library.form.addVideo')}</Button>
        </div>

        <Textarea label={t('library.form.body')} placeholder={t('library.form.bodyPh')} rows={5} value={f.body} onChange={set('body')} />

        <div style={S.field}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={S.label}>{t('library.form.notes')}</span>
            <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('library.form.notesHint')}</span>
          </div>
          {f.notes.map((n, i) => (
            <div key={i} style={{ display: 'grid', gap: 4, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                {/* Nhiều video: bấm để chuyển mốc sang video khác (V1 → V2 → …). */}
                {multi && (
                  <button type="button" onClick={() => setNote(i, { v: ((n.v || 0) + 1) % f.videos.length })} style={S.vTag}
                    title={t('library.form.noteVideo')} aria-label={t('library.form.noteVideo')}>
                    V{Math.min(n.v || 0, f.videos.length - 1) + 1}
                  </button>
                )}
                <Input size={size} mono placeholder="01:42" inputMode="numeric" value={n.t}
                  onChange={(ev) => setNote(i, { t: ev.target.value })} containerStyle={{ width: 84, flex: '0 0 auto' }} />
                <Input size={size} placeholder={t('library.form.notePh')} value={n.text}
                  onChange={(ev) => setNote(i, { text: ev.target.value })} containerStyle={{ flex: 1, minWidth: 0 }} />
                <IconButton icon="x" label={t('library.form.removeNote')} onClick={() => removeNote(i)} />
              </div>
              {tried && check.errors.notes[i] && <span style={S.err}>{t(check.errors.notes[i])}</span>}
            </div>
          ))}
          <div><Button variant="ghost" icon="plus" onClick={addNote}>{t('library.form.addNote')}</Button></div>
        </div>

        {canPin && (
          <Switch size={size} label={t('library.form.pin')} description={t('library.form.pinHint')}
            checked={pin} onChange={(e) => setPin(e.target.checked)} />
        )}

        {tried && check.error && <Alert tone="danger">{t(check.error)}</Alert>}

        {post && !confirmArchive && (
          <div><Button variant="ghost" icon="trash-2" disabled={busy} onClick={() => setConfirmArchive(true)}>{t('library.form.archive')}</Button></div>
        )}
        {post && confirmArchive && (
          <Alert tone="danger" title={t('library.form.archiveTitle')}>
            <div style={{ display: 'grid', gap: 10 }}>
              <span>{t('library.form.archiveHint')}</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button variant="danger" loading={busy} onClick={archive}>{t('library.form.archive')}</Button>
                <Button variant="secondary" disabled={busy} onClick={() => setConfirmArchive(false)}>{t('common.cancel')}</Button>
              </div>
            </div>
          </Alert>
        )}
      </div>
    </Dialog>
  )
}

const S = {
  field: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 },
  label: { font: 'var(--type-label)', color: 'var(--text-secondary)' },
  err: { font: '400 12.5px/1.45 var(--font-sans)', color: 'var(--status-incident-fg)' },
  videoBox: {
    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, padding: 12, borderRadius: 12,
    background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
  },
  vTag: {
    flex: '0 0 auto', width: 44, height: 44, borderRadius: 10, cursor: 'pointer',
    background: 'var(--surface-card)', border: '1px solid var(--border-default)',
    font: '600 12px/1 var(--font-mono)', color: 'var(--action-accent-bg)',
  },
}
