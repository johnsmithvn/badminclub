-- fake_betting_seed.sql — ĐỔ DỮ LIỆU GIẢ vào MỘT CLB MỚI TẠO để xem thử cả hệ điểm mùa + cược kèo:
--   · BXH: Top Mùa Giải, tab Sòng bạc        · Hồ sơ thành viên → Điểm mùa (lọc Trận / Kèo / Dự đoán)
--   · Trận đấu → Kèo (có tab "Đã cược")      · Home → thẻ Mục tiêu (Mùa / Elo)
--   · Chuông thông báo kết quả phiếu của bạn
--
-- KHÔNG phải migration: cố ý đặt ngoài supabase/migrations/ để không bị áp nhầm vào DB nào khác.
--
-- CÁCH DÙNG
--   1. Trong app: tạo một CLB MỚI (bạn là chủ CLB). Lấy mã mời 8 ký tự của nó.
--   2. Sửa dòng đánh dấu ↓ bên dưới → dán TOÀN BỘ file vào Supabase SQL Editor → Run.
--   3. Mở app, chuyển sang CLB đó. (Tuỳ chọn: BXH → "Đồng bộ lại Elo" để Elo tính theo trận giả.)
--   4. Xem xong: Cài đặt → Chung → Xoá CLB (hoặc trang CLB) — xoá sạch mọi thứ script này tạo ra.
--
-- Script TỪ CHỐI chạy nếu CLB đã có thành viên khác / buổi tập / kèo: đổ dữ liệu giả vào CLB thật
-- là làm bẩn điểm mùa của người thật.
--
-- TẠO RA
--   · 1 mùa "Mùa thử" từ 30 ngày trước tới 60 ngày sau (để mọi mốc giờ giả nằm trong mùa)
--   · 14 thành viên giả (chưa gắn tài khoản) + bạn
--   · 6 buổi tập đã chốt, mỗi buổi 8 trận đôi thường — bạn có đánh vài trận
--   · 10 kèo đã đánh (BO3: 2-0 hoặc 2-1, mỗi set là một trận thật) + 1 kèo đang chờ + 1 kèo đã huỷ
--   · Phiếu cược: tối đa 8 người đứng ngoài mỗi kèo, 5..50 SP; bạn cược cả 12 kèo
--   · Chuông 'prediction_settled' cho các phiếu của bạn

DO $seed$
DECLARE
  -- ↓↓↓ SỬA DÒNG NÀY ↓↓↓
  v_club_code text := 'XXXXXXXX';  -- mã mời 8 ký tự của CLB VỪA TẠO
  -- ↑↑↑
  v_names   text[] := ARRAY['An','Bảo','Chi','Dũng','Giang','Hải','Khánh','Linh','Minh','Ngân','Phúc','Quỳnh','Sơn','Trang'];
  v_genders text[] := ARRAY['nam','nam','nu','nam','nu','nam','nam','nu','nam','nu','nam','nu','nam','nu'];
  v_club    uuid;
  v_me      uuid;
  v_levels  text[];
  v_m       uuid[] := '{}';  -- thành viên giả
  v_all     uuid[];          -- thành viên giả + bạn (cho trận thường)
  v_n       int;
  v_na      int;
  v_sess    uuid[] := '{}';
  v_sid     uuid;
  v_date    date;
  v_mid     uuid;
  v_chal    uuid;
  v_code    text;
  v_kind    text;            -- 'played' | 'accepted' | 'cancelled'
  v_winner  text;
  v_setwin  text;
  v_lose    int;
  v_players uuid[];
  v_at      timestamptz;
  v_settled timestamptz;
  v_bettor  uuid;
  v_team    text;
  v_stake   int;
  v_status  text;
  s int;
  i int;
  k int;
  j int;
  v_set int;
BEGIN
  SELECT id, levels INTO v_club, v_levels FROM clubs WHERE code = v_club_code;
  IF v_club IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy CLB có mã %', v_club_code;
  END IF;

  IF (SELECT count(*) FROM club_members WHERE club_id = v_club) > 1
     OR EXISTS (SELECT 1 FROM sessions WHERE club_id = v_club)
     OR EXISTS (SELECT 1 FROM challenges WHERE club_id = v_club) THEN
    RAISE EXCEPTION 'CLB % đã có thành viên khác / buổi tập / kèo — script chỉ chạy trên CLB vừa tạo', v_club_code;
  END IF;

  SELECT id INTO v_me FROM club_members
   WHERE club_id = v_club AND role = 'owner' AND user_id IS NOT NULL
   LIMIT 1;
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'CLB % chưa có chủ CLB gắn tài khoản', v_club_code;
  END IF;

  -- 1. Mùa thử bao trùm mọi mốc giờ giả. Không ghi deltaScale / bonusConfig: code tự lấy từ app.json.
  UPDATE clubs SET seasons = jsonb_build_array(jsonb_build_object(
    'id', 'fake-season', 'code', 'THU', 'name', 'Mùa thử', 'fullName', 'Mùa thử — dữ liệu giả',
    'startDate', to_char(current_date - 30, 'YYYY-MM-DD'),
    'endDate',   to_char(current_date + 60, 'YYYY-MM-DD'),
    'cycle', 'quarter', 'totalSessionsExpected', 14, 'inactiveDays', 21,
    'active', true, 'closedAt', NULL
  ))
  WHERE id = v_club;

  -- 2. Thành viên giả
  FOR i IN 1..array_length(v_names, 1) LOOP
    INSERT INTO club_members (club_id, name, gender, level, joined_at, role, active)
    VALUES (v_club, v_names[i], v_genders[i]::gender,
            v_levels[1 + (i % array_length(v_levels, 1))], current_date - 60, 'member', true)
    RETURNING id INTO v_mid;
    v_m := v_m || v_mid;
  END LOOP;
  v_n   := array_length(v_m, 1);
  v_all := v_m || v_me;
  v_na  := v_n + 1;

  -- 3. Buổi tập đã chốt + trận đôi thường (Elo để trống: app tự lấy theo trình độ)
  FOR s IN 0..5 LOOP
    v_date := current_date - 28 + s * 5;
    INSERT INTO sessions (club_id, date, status) VALUES (v_club, v_date, 'closed')
    RETURNING id INTO v_sid;
    v_sess := v_sess || v_sid;

    FOR i IN 0..7 LOOP
      -- 4 chỉ số liên tiếp mod n luôn khác nhau
      v_players := ARRAY[
        v_all[((s * 7 + i * 4)     % v_na) + 1], v_all[((s * 7 + i * 4 + 1) % v_na) + 1],
        v_all[((s * 7 + i * 4 + 2) % v_na) + 1], v_all[((s * 7 + i * 4 + 3) % v_na) + 1]
      ];
      v_winner := CASE WHEN (s * 5 + i * 3) % 7 < 4 THEN 'A' ELSE 'B' END;
      v_lose   := 10 + (s * 3 + i * 5) % 10;  -- đội thua 10..19 điểm
      v_at     := ((v_date + time '19:00') AT TIME ZONE 'Asia/Ho_Chi_Minh') + i * interval '20 minutes';

      INSERT INTO matches (session_id, court_index, minutes, ended_at, source_type, rating_enabled,
                           sets, winner_team, score_text)
      VALUES (v_sid, i % 3, 20, v_at, 'session', true,
              CASE WHEN v_winner = 'A' THEN jsonb_build_array(jsonb_build_array(21, v_lose))
                   ELSE jsonb_build_array(jsonb_build_array(v_lose, 21)) END,
              v_winner,
              CASE WHEN v_winner = 'A' THEN '21 – ' || v_lose ELSE v_lose || ' – 21' END)
      RETURNING id INTO v_mid;

      INSERT INTO match_players (match_id, player_type, player_id, team)
      SELECT v_mid, 'member'::player_kind, v_players[p], CASE WHEN p <= 2 THEN 0 ELSE 1 END
        FROM generate_series(1, 4) AS p;
    END LOOP;
  END LOOP;

  -- 4. Kèo + phiếu cược. Bạn KHÔNG đánh kèo nào — chỉ đứng ngoài cược.
  FOR k IN 1..12 LOOP
    v_code   := 'C-' || lpad((100 + k)::text, 4, '0');  -- C-0101..C-0112, kèo thật kế tiếp là C-0113
    v_kind   := CASE WHEN k <= 10 THEN 'played' WHEN k = 11 THEN 'accepted' ELSE 'cancelled' END;
    v_winner := CASE WHEN k % 3 = 0 THEN 'B' ELSE 'A' END;
    v_players := ARRAY[
      v_m[((k * 4)     % v_n) + 1], v_m[((k * 4 + 1) % v_n) + 1],
      v_m[((k * 4 + 2) % v_n) + 1], v_m[((k * 4 + 3) % v_n) + 1]
    ];

    IF v_kind = 'played' THEN
      v_sid  := v_sess[1 + ((k - 1) % 6)];
      SELECT date INTO v_date FROM sessions WHERE id = v_sid;
      v_at   := ((v_date + time '21:40') AT TIME ZONE 'Asia/Ho_Chi_Minh') + ((k - 1) / 6) * interval '1 hour';
    ELSE
      -- Không gắn buổi: kèo đang chờ gắn vào buổi đã chốt sẽ bị máy quét coi là mồ côi.
      v_sid := NULL;
      v_at  := now() - interval '1 day';
    END IF;

    INSERT INTO challenges (code, club_id, session_id, created_by, status, best_of, rating_enabled,
                            expires_at, accepted_players, accepted_at, predictions_locked,
                            created_at, updated_at)
    VALUES (v_code, v_club, v_sid, v_players[1], v_kind, 3, true,
            v_at + interval '7 days', v_players, v_at - interval '2 days', v_kind <> 'accepted',
            v_at - interval '3 days', v_at)
    RETURNING id INTO v_chal;

    INSERT INTO challenge_players (challenge_id, member_id, team)
    SELECT v_chal, v_players[p], CASE WHEN p <= 2 THEN 'A' ELSE 'B' END
      FROM generate_series(1, 4) AS p;

    v_settled := v_at;
    IF v_kind = 'played' THEN
      -- BO3: kèo chẵn 2-0, kèo lẻ 2-1 (set 2 đội thua gỡ). Mỗi set là một trận có challenge_id.
      FOR v_set IN 1..(CASE WHEN k % 2 = 0 THEN 2 ELSE 3 END) LOOP
        v_setwin := CASE WHEN k % 2 = 1 AND v_set = 2
                         THEN CASE v_winner WHEN 'A' THEN 'B' ELSE 'A' END
                         ELSE v_winner END;
        v_lose := 12 + (k * 3 + v_set * 4) % 8;
        INSERT INTO matches (session_id, court_index, minutes, ended_at, source_type, challenge_id,
                             rating_enabled, sets, winner_team, score_text)
        VALUES (v_sid, 0, 20, v_at + v_set * interval '20 minutes', 'challenge', v_chal, true,
                CASE WHEN v_setwin = 'A' THEN jsonb_build_array(jsonb_build_array(21, v_lose))
                     ELSE jsonb_build_array(jsonb_build_array(v_lose, 21)) END,
                v_setwin,
                CASE WHEN v_setwin = 'A' THEN '21 – ' || v_lose ELSE v_lose || ' – 21' END)
        RETURNING id INTO v_mid;

        INSERT INTO match_players (match_id, player_type, player_id, team)
        SELECT v_mid, 'member'::player_kind, v_players[p], CASE WHEN p <= 2 THEN 0 ELSE 1 END
          FROM generate_series(1, 4) AS p;
      END LOOP;
      v_settled := v_at + interval '70 minutes';
    END IF;

    -- Người cược: tối đa 8 người KHÔNG đánh kèo này
    FOR j IN 0..LEAST(7, v_n - 5) LOOP
      v_bettor := v_m[((k * 4 + 4 + j) % v_n) + 1];
      CONTINUE WHEN v_bettor = ANY (v_players);
      v_team   := CASE WHEN (k * 7 + j * 3) % 5 < 3 THEN 'A' ELSE 'B' END;
      v_stake  := 5 + ((k * 13 + j * 7) % 10) * 5;  -- 5..50 SP
      v_status := CASE v_kind
                    WHEN 'played'   THEN CASE WHEN v_team = v_winner THEN 'won' ELSE 'lost' END
                    WHEN 'accepted' THEN 'pending'
                    ELSE 'refunded'
                  END;
      INSERT INTO challenge_predictions
        (challenge_id, club_id, member_id, team, stake_points, payout_points, status, settled_at, created_at, updated_at)
      VALUES
        (v_chal, v_club, v_bettor, v_team, v_stake,
         CASE v_status WHEN 'won' THEN v_stake * 2 WHEN 'refunded' THEN v_stake ELSE 0 END,
         v_status,
         CASE WHEN v_status = 'pending' THEN NULL ELSE v_settled END,
         v_at - interval '1 day', v_settled)
      ON CONFLICT (challenge_id, member_id) DO NOTHING;
    END LOOP;

    -- Phiếu của bạn + chuông báo kết quả (kèo đang chờ thì chưa có chuông)
    v_team   := CASE WHEN k % 2 = 0 THEN 'B' ELSE 'A' END;
    v_stake  := 10 + (k % 4) * 10;  -- 10..40 SP
    v_status := CASE v_kind
                  WHEN 'played'   THEN CASE WHEN v_team = v_winner THEN 'won' ELSE 'lost' END
                  WHEN 'accepted' THEN 'pending'
                  ELSE 'refunded'
                END;
    INSERT INTO challenge_predictions
      (challenge_id, club_id, member_id, team, stake_points, payout_points, status, settled_at, created_at, updated_at)
    VALUES
      (v_chal, v_club, v_me, v_team, v_stake,
       CASE v_status WHEN 'won' THEN v_stake * 2 WHEN 'refunded' THEN v_stake ELSE 0 END,
       v_status,
       CASE WHEN v_status = 'pending' THEN NULL ELSE v_settled END,
       v_at - interval '1 day', v_settled);

    IF v_status <> 'pending' THEN
      INSERT INTO notifications (club_id, member_id, type, payload, ref_type, ref_id, created_at)
      VALUES (v_club, v_me, 'prediction_settled',
              jsonb_build_object('code', v_code, 'result', v_status, 'stake', v_stake),
              'challenge', v_chal, v_settled);
    END IF;
  END LOOP;

  RAISE NOTICE 'Xong: CLB % có % thành viên giả, 6 buổi / 48 trận thường, 12 kèo (10 đã đánh), phiếu cược và chuông của bạn',
    v_club_code, v_n;
END
$seed$;
