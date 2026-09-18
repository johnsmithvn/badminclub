-- 0048_challenge_stake_text.sql
-- "Giao kèo" — phần thưởng đời thật hai bên hẹn nhau ngoài sân: thua thì mua nước, trả tiền sân…
--
-- Thuần TRANG TRÍ và ghi nhớ. KHÔNG dính gì tới điểm mùa, Elo, SP hay công nợ: app không thu hộ,
-- không nhắc nợ, không quyết toán. Nó chỉ giúp hai bên khỏi cãi nhau lúc tan sân.
--
-- Đây là chữ NGƯỜI DÙNG TỰ GÕ nên lưu thẳng chuỗi, không lưu key i18n — RULES §3.3 nói lưu key
-- thay cho nhãn hiển thị, mà cái này là DỮ LIỆU chứ không phải nhãn. Các mẫu gợi ý sẵn nằm ở
-- `app.json → challenge.stakeTemplates` và chỉ dùng để đổ chữ vào ô, không lưu xuống dạng mã.

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS stake_text text;

-- Chặn người dán cả bài văn vào. 120 ký tự đủ cho "Thua mua nước cả sân + trả tiền cầu".
ALTER TABLE public.challenges
  DROP CONSTRAINT IF EXISTS challenges_stake_text_len;

ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_stake_text_len
  CHECK (stake_text IS NULL OR char_length(stake_text) <= 120);

COMMENT ON COLUMN public.challenges.stake_text IS
  'Giao kèo đời thật do người chơi tự gõ (vd "Thua mua 2 chai nước"). Trang trí thuần tuý — không dính điểm, không dính tiền, app không thu hộ.';
