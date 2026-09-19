// supabase/functions/push-send/index.ts
// Edge Function gửi Web Push Notification cho thành viên CLB
// Được bảo vệ bởi Supabase Gateway JWT Verification (Deploy KHÔNG dùng cờ --no-verify-jwt)

import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Chuyển đổi VAPID public/private key dạng Base64URL sang định dạng JWK chuẩn cho @negrel/webpush
 */
function vapidKeysFromBase64(publicKeyBase64: string, privateKeyBase64: string) {
  const pubBytes = Uint8Array.from(
    atob(publicKeyBase64.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  )
  const x = btoa(String.fromCharCode(...pubBytes.subarray(1, 33)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const y = btoa(String.fromCharCode(...pubBytes.subarray(33, 65)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const d = privateKeyBase64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return {
    publicKey: { kty: 'EC', crv: 'P-256', x, y },
    privateKey: { kty: 'EC', crv: 'P-256', x, y, d },
  }
}

Deno.serve(async (req) => {
  // Xử lý CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@badminclub.com'

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server environment missing Supabase configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: 'Server environment missing VAPID keys' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Kiểm tra JWT caller để lấy user_id
    const userClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized caller' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const callerUserId = user.id

    // Đọc body request
    const body = await req.json()
    const { member_ids, club_id, title, body: pushBody, url, tag } = body

    if (!club_id || !Array.isArray(member_ids) || member_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid payload: member_ids and club_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Client dùng Service Role để truy vấn dữ liệu bảo mật
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    // 2. Bảo mật Bước 1: Caller có phải là thành viên của club_id không?
    const { data: callerMember, error: callerCheckError } = await supabaseAdmin
      .from('club_members')
      .select('id')
      .eq('user_id', callerUserId)
      .eq('club_id', club_id)
      .limit(1)
      .maybeSingle()

    // Gộp "truy vấn LỖI" và "không tìm thấy" vào cùng một câu trả lời là không phân biệt được
    // service role hỏng với người gửi thật sự ngoài CLB — hai nguyên nhân sửa hai kiểu khác hẳn.
    if (callerCheckError) {
      console.error('[push-send] Truy vấn club_members lỗi (service role?):', callerCheckError)
      return new Response(JSON.stringify({
        error: 'Member lookup failed',
        detail: callerCheckError.message,
        hint: 'SUPABASE_SERVICE_ROLE_KEY co the khong hop le hoac da bi vo hieu hoa',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!callerMember) {
      console.warn('[push-send] Caller khong thuoc club:', { callerUserId, club_id })
      return new Response(JSON.stringify({
        error: 'Forbidden: caller is not a member of this club',
        callerUserId,
        club_id,
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Bảo mật Bước 2: Lọc member_ids strictly thuộc về club_id (chống gửi trộm sang CLB khác)
    const { data: validMembers, error: memberCheckError } = await supabaseAdmin
      .from('club_members')
      .select('id')
      .eq('club_id', club_id)
      .in('id', member_ids)

    if (memberCheckError) {
      console.error('[push-send] Loc member_ids loi:', memberCheckError)
      return new Response(JSON.stringify({ error: 'Member filter failed', detail: memberCheckError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!validMembers || validMembers.length === 0) {
      console.warn('[push-send] Khong co member_id nao thuoc club:', { club_id, member_ids })
      return new Response(JSON.stringify({ success: true, sentCount: 0, note: 'No valid members found in club' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const verifiedMemberIds = validMembers.map((m: { id: string }) => m.id)

    // 4. Lấy danh sách push subscriptions của các member_id hợp lệ
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, member_id, endpoint, p256dh, auth')
      .in('member_id', verifiedMemberIds)

    if (subsError || !subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, sentCount: 0, note: 'No subscriptions found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Khởi tạo ApplicationServer từ VAPID keys
    const jwkKeys = vapidKeysFromBase64(vapidPublicKey, vapidPrivateKey)
    const vapidKeys = await webpush.importVapidKeys(jwkKeys)
    const appServer = await webpush.ApplicationServer.new({
      contactInformation: vapidSubject,
      vapidKeys,
    })

    const payload = JSON.stringify({
      title: title || 'BadminClub',
      body: pushBody || '',
      url: url || '/',
      tag: tag || undefined,
      clubId: club_id,
    })

    let sentCount = 0
    let failedCount = 0
    const deadSubIds: string[] = []

    // 6. Gửi Push đến từng thiết bị
    await Promise.allSettled(
      subscriptions.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          const subscriber = appServer.subscribe({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          })
          // Tham số thứ 2 BẮT BUỘC: `pushMessage` destructure `{ urgency, ttl, topic }` từ nó mà
          // KHÔNG có giá trị mặc định (subscriber.ts). Gọi thiếu là TypeError ở mọi lượt gửi —
          // và vì nằm trong try/catch, nó chỉ hiện ra dưới dạng failedCount, không ai truy ra.
          await subscriber.pushTextMessage(payload, {})
          sentCount++
        } catch (err: any) {
          failedCount++
          // @negrel/webpush ném `PushMessageError`, KHÔNG có `.status` / `.statusCode` —
          // mã HTTP nằm ở `.response.status` (xem subscriber.ts). Đọc sai field thì mọi
          // subscription chết đều lọt, bảng phình mãi và không bao giờ được dọn.
          const status = err?.response?.status
          // 404 (Not Found) / 410 (Gone) = subscription đã hết hạn hoặc bị thu hồi
          if (status === 404 || status === 410) {
            deadSubIds.push(sub.id)
          } else {
            console.warn(`[push-send] Lỗi gửi push tới endpoint ${sub.endpoint}:`, String(err), status ?? '')
          }
        }
      })
    )

    // 7. Tự động dọn dẹp các subscription đã chết khỏi database
    if (deadSubIds.length > 0) {
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .in('id', deadSubIds)
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalSubs: subscriptions.length,
        sentCount,
        failedCount,
        cleanedDeadSubs: deadSubIds.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: any) {
    console.error('[push-send] Lỗi không xử lý được:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
