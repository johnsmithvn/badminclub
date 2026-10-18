import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, IconButton, Skeleton } from '#ds'
import { Empty, PageHeader, TabTrack } from '#ui'
import { useApp } from '#contexts/AppContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { libErr } from '#contexts/libraryActions.js'
import { useMobile } from '#hooks/useMobile.js'
import { can } from '#lib/roles.js'
import { myMember } from '#lib/money.js'
import { clock, filterPosts, groupByShelf, isNewPost, pinnedOf, postLength, shelvesOf } from '#lib/library.js'
import { pathOf } from '#routes'
import { t } from '#i18n'
import { Chip, Corner, SaveButton, Thumb } from '#components/library/LibraryBits.jsx'
import PostComposer from '#components/library/PostComposer.jsx'

/** Thư viện bài tập: bài ghim + các kệ. Nạp riêng (không nằm trong `db`) — xem libraryActions.js. */
export default function Library() {
  const { db, a } = useApp()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const isMobile = useMobile(768)
  const me = myMember(db)?.id || null
  const canPin = can(db.viewAs || 'owner', 'settings')
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('all')
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    let alive = true
    a.libLoad()
      .then((r) => { if (alive) setData({ ...r, now: Date.now() }) })
      .catch((e) => { if (alive) { setErr(libErr(e)); setData({ posts: [], marks: {}, now: Date.now() }) } })
    return () => { alive = false }
  }, [a, db.clubId])

  const open = (id) => navigate(pathOf('libraryPost', id))
  const toggleSave = async (id) => {
    const on = !data.marks[id]?.saved
    if (await a.libSave(id, on)) setData((d) => ({ ...d, marks: { ...d.marks, [id]: { ...d.marks[id], saved: on } } }))
  }

  const posts = data?.posts || []
  const marks = data?.marks || {}
  const shelves = shelvesOf(posts)
  const savedN = posts.filter((p) => marks[p.id]?.saved).length
  const pinned = filter === 'all' ? pinnedOf(posts) : null
  // Mobile: kệ là hàng cuộn ngang, đang lọc thì lưới 2 cột. Desktop: luôn lưới.
  const row = isMobile && filter === 'all'
  const groups = filter === 'all'
    ? groupByShelf(posts)
    : [{ name: filter === 'saved' ? t('library.savedShelf') : filter, items: filterPosts(posts, filter, marks) }]

  const card = (p) => (
    <PostCard key={p.id} post={p} saved={!!marks[p.id]?.saved} viewed={!!marks[p.id]?.viewedAt}
      isNew={isNewPost(p, marks[p.id], me, data.now)} row={row}
      onOpen={() => open(p.id)} onSave={() => toggleSave(p.id)} />
  )

  return (
    <>
      <PageHeader
        isMobile={isMobile}
        actions={(
          <>
            <IconButton icon={isDark ? 'sun' : 'moon'} size="sm" variant="ghost" label={isDark ? t('common.themeLight') : t('common.themeDark')} onClick={toggleTheme} />
            {me && (
              <Button icon="plus" aria-label={t('library.post')} title={t('library.post')} onClick={() => setComposing(true)}
                style={isMobile ? { padding: 0, aspectRatio: '1' } : undefined}>
                {isMobile ? null : t('library.post')}
              </Button>
            )}
          </>
        )}
      />
      {err && <Alert tone="danger">{err}</Alert>}
      {!data && <Skeleton height={220} />}

      {data && posts.length === 0 && (
        <div style={S.box}>
          <Empty icon="book-open" title={t('library.emptyTitle')} hint={t('library.emptyHint')} />
        </div>
      )}

      {data && posts.length > 0 && (
        <>
          <TabTrack>
            <div style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
              <Chip on={filter === 'all'} onClick={() => setFilter('all')}>{t('library.filterAll')}</Chip>
              <Chip on={filter === 'saved'} onClick={() => setFilter('saved')}>{t('library.filterSaved', { n: savedN })}</Chip>
              {shelves.map((s) => <Chip key={s} on={filter === s} onClick={() => setFilter(s)}>{s}</Chip>)}
            </div>
          </TabTrack>

          {pinned && <PinnedCard post={pinned} isMobile={isMobile} onOpen={() => open(pinned.id)} />}

          {groups.map((g) => (
            <section key={g.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                <span style={S.shelfName}>{g.name}</span>
                <span style={S.mono}>{t('library.shelfCount', { n: g.items.length })}</span>
              </div>
              {g.items.length === 0 && <div style={S.dashed}>{t('library.savedEmpty')}</div>}
              {g.items.length > 0 && (row
                ? <TabTrack><div style={{ display: 'flex', gap: 10 }}>{g.items.map(card)}</div></TabTrack>
                : <div style={{ ...S.grid, gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                  {g.items.map(card)}
                </div>)}
            </section>
          ))}
        </>
      )}

      {composing && (
        <PostComposer
          shelves={shelves}
          canPin={canPin}
          onClose={() => setComposing(false)}
          onDone={(id) => { setComposing(false); open(id) }}
        />
      )}
    </>
  )
}

/** "2 video · 04:05" — độ dài chỉ hiện khi mọi video có giờ kết thúc (lib: postLength). */
const metaOf = (post) => {
  const len = postLength(post)
  return [t('library.videoCount', { n: post.videos.length }), len != null && clock(len)].filter(Boolean).join(' · ')
}

function PostCard({ post, saved, viewed, isNew, row, onOpen, onSave }) {
  const len = postLength(post)
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}
      style={{ ...(row ? { flex: '0 0 176px', width: 176 } : {}), minWidth: 0, display: 'grid', gap: 7, alignContent: 'start', cursor: 'pointer' }}
    >
      <Thumb url={post.videos[0]?.url}>
        {isNew && <span style={S.newTag}>{t('library.new')}</span>}
        <SaveButton saved={saved} label={saved ? t('library.unsaveAria') : t('library.saveAria')} onClick={onSave} />
        <Corner pos={{ bottom: 7, right: 7 }}>{len != null ? clock(len) : t('library.videoCount', { n: post.videos.length })}</Corner>
        {viewed && <Corner sans pos={{ bottom: 7, left: 7 }}>{t('library.viewed')}</Corner>}
      </Thumb>
      <div style={S.cardTitle} title={post.title}>{post.title}</div>
      <div style={S.mono}>{t('library.views', { n: post.viewCount })}</div>
    </div>
  )
}

function PinnedCard({ post, isMobile, onOpen }) {
  return (
    <div style={{
      ...S.box, overflow: 'hidden', display: 'grid',
      gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 420px) minmax(0, 1fr)',
    }}>
      <div role="link" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }} style={{ cursor: 'pointer' }}>
        <Thumb url={post.videos[0]?.url} ratio="16 / 9" radius={0}>
          <span style={S.pinTag}>{t('library.pinned')}</span>
        </Thumb>
      </div>
      <div style={{ padding: isMobile ? 14 : '22px 24px', display: 'grid', gap: 10, alignContent: 'center', minWidth: 0 }}>
        <span style={S.mono}>{metaOf(post)} · {post.shelf}</span>
        <span style={{ font: `700 ${isMobile ? 19 : 24}px/1.2 var(--font-display)`, color: 'var(--text-primary)' }}>{post.title}</span>
        {post.body && <span style={{ ...S.clamp(3), font: '400 13.5px/1.55 var(--font-sans)', color: 'var(--text-secondary)' }}>{post.body}</span>}
        <div><Button variant="accent" icon="play" onClick={onOpen}>{t('library.open')}</Button></div>
      </div>
    </div>
  )
}

const S = {
  box: { borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)' },
  grid: { display: 'grid', gap: 12 },
  shelfName: { font: '600 16px/1.2 var(--font-display)', color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0 },
  clamp: (n) => ({ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: n, overflow: 'hidden' }),
  cardTitle: {
    font: '600 13.5px/1.35 var(--font-sans)', color: 'var(--text-primary)',
    display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere',
  },
  dashed: {
    padding: 18, borderRadius: 12, border: '1px dashed var(--border-default)',
    font: '400 13px/1.5 var(--font-sans)', color: 'var(--text-muted)',
  },
  newTag: {
    position: 'absolute', top: 8, left: 8, padding: '3px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '.08em',
    background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)', font: '700 9.5px/1 var(--font-sans)',
  },
  pinTag: {
    position: 'absolute', top: 10, left: 10, padding: '4px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '.1em',
    background: 'var(--surface-card)', color: 'var(--text-primary)', font: '700 10px/1 var(--font-sans)',
  },
}
