// src/lib/pushSubscription.js
// Quản lý đăng ký / huỷ đăng ký Web Push Notifications phía Client

/**
 * Chuyển chuỗi VAPID public key base64 URL-safe sang mảng byte Uint8Array cho PushManager
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Kiểm tra xem trình duyệt và môi trường hiện tại có hỗ trợ Web Push đầy đủ không
 */
export function isPushSupported() {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
}

/**
 * Trả về trạng thái quyền thông báo: 'granted' | 'denied' | 'default' | 'unsupported'
 */
export function getPushPermissionState() {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * `navigator.serviceWorker.ready` KHÔNG bao giờ reject — chưa có SW nào active thì nó treo
 * vĩnh viễn (Safari riêng tư, sw.js lỗi đăng ký). `isPushSupported()` vẫn trả true trong các
 * trường hợp đó, nên bất kỳ chỗ nào `await` thẳng nó đều có thể đứng mãi. Đăng xuất là chỗ
 * nguy hiểm nhất: nút bấm không phản hồi, không lỗi, người dùng kẹt lại trong phiên.
 */
async function swReady(timeoutMs = 3000) {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ])
}

/**
 * Lấy push subscription đang có trên Service Worker của trình duyệt
 */
export async function getExistingSubscription() {
  if (!isPushSupported()) return null
  try {
    const reg = await swReady()
    if (!reg) return null
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

/**
 * Đã bật push thật sự chưa?
 *
 * Trình duyệt có subscription là CHƯA ĐỦ. `pushManager.subscribe()` chạy trước, lưu DB chạy
 * sau — upsert hỏng (chưa chạy migration 0049, RLS chặn, mất mạng) thì trình duyệt vẫn giữ
 * subscription, công tắc vẫn hiện BẬT, mà bảng `push_subscriptions` rỗng nên Edge Function
 * không tìm thấy ai để gửi. Người dùng thấy "đã bật" và không bao giờ nhận được gì, cũng
 * không bấm lại được vì bấm là TẮT.
 *
 * Truyền `supabase` + `userId` để kiểm cả dòng dưới DB. Không truyền thì chỉ kiểm trình duyệt
 * (dùng cho chỗ không có phiên đăng nhập).
 */
export async function isPushSubscribed(supabase, userId) {
  const sub = await getExistingSubscription()
  if (!sub) return false
  if (!supabase || !userId) return true

  try {
    const memberIds = await getMyMemberIds(supabase, userId, { activeOnly: true })
    if (!memberIds.length) return false
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', sub.endpoint)
      .in('member_id', memberIds)
      .limit(1)
    if (error) return false
    return (data || []).length > 0
  } catch {
    return false
  }
}

/**
 * Lấy tất cả member_id thuộc về user_id hiện tại trên mọi CLB.
 *
 * `activeOnly` KHÁC nhau theo chiều dùng, đừng gộp làm một:
 *   - GHI (subscribe / ghi bù): chỉ tư cách còn hoạt động. Người đã bị cho nghỉ khỏi một CLB
 *     thì không nên nhận thông báo của CLB đó nữa.
 *   - XOÁ (đăng xuất): lấy HẾT, kể cả tư cách đã ngưng — lọc ở đây là bỏ sót đúng những dòng
 *     rác cần dọn, và thiết bị vẫn còn đăng ký dưới tên người vừa rời đi.
 */
export async function getMyMemberIds(supabase, userId, { activeOnly = false } = {}) {
  if (!supabase || !userId) return []
  try {
    let q = supabase.from('club_members').select('id').eq('user_id', userId)
    if (activeOnly) q = q.eq('active', true)
    const { data, error } = await q
    if (error || !data) return []
    return data.map((m) => m.id)
  } catch {
    return []
  }
}

/**
 * Đăng ký Push Notification: xin quyền, tạo subscription, và lưu vào database cho mọi member_id của user
 */
export async function subscribePush(supabase, userId) {
  if (!isPushSupported()) throw new Error('PUSH_UNSUPPORTED')
  if (!userId) throw new Error('NO_USER')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('PERMISSION_DENIED')
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    console.warn('[push] Thiếu VITE_VAPID_PUBLIC_KEY')
    throw new Error('NO_VAPID_KEY')
  }

  const reg = await swReady()
  if (!reg) throw new Error('SW_NOT_READY')
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  const json = sub.toJSON()
  const endpoint = sub.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    throw new Error('INVALID_SUBSCRIPTION_KEYS')
  }

  const memberIds = await getMyMemberIds(supabase, userId, { activeOnly: true })
  if (memberIds.length > 0) {
    const rows = memberIds.map((mid) => ({
      member_id: mid,
      endpoint,
      p256dh,
      auth,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(rows, { onConflict: 'member_id,endpoint' })

    if (error) {
      console.warn('[push] Lỗi lưu subscription vào database', error)
      throw error
    }
  }

  return sub
}

/**
 * Huỷ đăng ký Push Notification: gỡ trên trình duyệt và xoá khỏi database
 */
export async function unsubscribePush(supabase, userId) {
  if (!isPushSupported()) return false
  try {
    const reg = await swReady()
    if (!reg) return false
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return true

    const endpoint = sub.endpoint
    await sub.unsubscribe()

    if (supabase && userId) {
      const memberIds = await getMyMemberIds(supabase, userId)
      if (memberIds.length > 0) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .in('member_id', memberIds)
          .eq('endpoint', endpoint)
      }
    }
    return true
  } catch (err) {
    console.warn('[push] Lỗi huỷ đăng ký push', err)
    return false
  }
}

/**
 * Bắn một push THỬ cho chính mình, không cần dựng kèo thật.
 *
 * Cách dùng đúng: bấm nút này **trên máy tính**, điện thoại rung. Đó là cách duy nhất thử được
 * trạng thái "app đã bị kill" mà vẫn bấm được nút — bấm trên chính điện thoại thì app đang mở.
 *
 * `tag` phải DUY NHẤT mỗi lần. Android coi hai notification cùng `tag` là một: cái sau thay cái
 * trước và KHÔNG rung/kêu lại (`renotify` mặc định false). Đặt tag cố định là lần thử thứ hai
 * trở đi im ru, rồi lại tưởng push hỏng.
 *
 * Trả về nguyên `{ totalSubs, sentCount, failedCount }` của Edge Function để màn hình nói thẳng
 * cho người dùng biết server đã gửi được mấy cái — khỏi phải đi lục Dashboard.
 */
export async function sendTestPush(supabase, { memberId, clubId, title, body, url = '/' }) {
  if (!supabase) throw new Error('NO_SUPABASE')
  if (!memberId || !clubId) throw new Error('NO_MEMBER')
  const { data, error } = await supabase.functions.invoke('push-send', {
    body: {
      member_ids: [memberId],
      club_id: clubId,
      title,
      body,
      url,
      tag: `test_${Date.now()}`,
    },
  })
  if (error) throw error
  return data || {}
}

/**
 * Ghi bù subscription: khi user tham gia thêm CLB mới, bổ sung subscription row cho member_id mới
 */
export async function syncMissingSubscriptions(supabase, userId) {
  if (!isPushSupported() || !supabase || !userId) return
  try {
    const sub = await getExistingSubscription()
    if (!sub) return
    const json = sub.toJSON()
    const endpoint = sub.endpoint
    const p256dh = json.keys?.p256dh
    const auth = json.keys?.auth
    if (!endpoint || !p256dh || !auth) return

    const memberIds = await getMyMemberIds(supabase, userId, { activeOnly: true })
    if (!memberIds.length) return

    const rows = memberIds.map((mid) => ({
      member_id: mid,
      endpoint,
      p256dh,
      auth,
      updated_at: new Date().toISOString(),
    }))

    await supabase
      .from('push_subscriptions')
      .upsert(rows, { onConflict: 'member_id,endpoint' })
  } catch (err) {
    console.warn('[push] Lỗi ghi bù push subscriptions', err)
  }
}
