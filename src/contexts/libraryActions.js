// Hành động của Thư viện bài tập — trải vào `a.*` trong makeActions (appActions.js).
//
// Như giải đấu: dữ liệu KHÔNG nằm trong `db`, KHÔNG qua diff()/save(). Màn hình tự nạp
// (`libLoad` / `libPost`), mỗi lần ghi chờ DB xong mới báo. Luật quyền nằm ở RLS + RPC của 0066.

import { libraryRpc, libraryWrite, loadLibrary, loadLibraryPost, loadLibraryViewers } from '#contexts/storage.js'
import { libPostRow } from '#contexts/dbmap.js'
import { myMember } from '#lib/money.js'
import { t } from '#i18n'

/** Lỗi mang key `library.err.*` (từ RAISE của RPC) → dịch; lỗi khác giữ nguyên để còn biết là gì. */
export const libErr = (e) => {
  const m = String(e?.message || e || '')
  return m.startsWith('library.err.') ? t(m) : m
}

export function makeLibraryActions({ dbRef, toast, uid }) {
  const db = () => dbRef.current
  const me = () => myMember(db())?.id || null

  /** Chạy một lần ghi. Xong → toast `ok()`, trả kết quả (hoặc true). Lỗi → toast, trả null. */
  const run = async (fn, ok) => {
    try {
      const res = await fn()
      if (ok) toast(ok())
      return res ?? true
    } catch (e) {
      toast(libErr(e))
      return null
    }
  }

  return {
    libLoad: () => loadLibrary(db().clubId, me()),
    libPost: (id) => loadLibraryPost(id, me()),
    libViewers: (id) => loadLibraryViewers(id),

    /** Đăng bài, trả id để mở bài vừa đăng. */
    libCreate: (post) => {
      if (!me()) { toast(t('library.err.notMember')); return Promise.resolve(null) }
      const id = uid()
      return run(
        async () => { await libraryWrite('insert', id, { ...libPostRow(post), club_id: db().clubId, author_id: me() }); return id },
        () => t('library.toast.posted', { shelf: post.shelf, n: post.videos.length }),
      )
    },
    libUpdate: (id, post) => run(() => libraryWrite('update', id, libPostRow(post)), () => t('library.toast.updated')),
    libArchive: (id) => run(() => libraryWrite('update', id, { status: 'archived' }), () => t('library.toast.archived')),
    libPin: (id, on) => run(() => libraryRpc('library_pin', { p_post: id, p_on: on }),
      () => (on ? t('library.toast.pinned') : t('library.toast.unpinned'))),
    libSave: (id, on) => run(() => libraryRpc('library_save', { p_post: id, p_on: on }),
      () => (on ? t('library.toast.saved') : t('library.toast.unsaved'))),

    /** Ghi lượt xem khi mở bài — im lặng: hỏng thì chỉ thiếu một lượt đếm, không chặn người đọc. */
    libView: (id) => libraryRpc('library_view', { p_post: id }).catch((e) => {
      console.warn('[library] Không ghi được lượt xem:', e?.message || e)
      return null
    }),
  }
}
