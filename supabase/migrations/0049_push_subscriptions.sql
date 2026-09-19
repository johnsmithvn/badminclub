-- 0049_push_subscriptions.sql
-- Bảng lưu Web Push subscriptions của thành viên CLB để gửi thông báo đẩy (Push Notification)
-- sang thiết bị di động (iOS PWA / Android) và Desktop.
--
-- Mỗi dòng = 1 cặp (member_id, endpoint). Một user tham gia nhiều CLB sẽ có nhiều dòng
-- tương ứng với các member_id của họ, dùng chung endpoint của trình duyệt/thiết bị đó.

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_member_endpoint_key UNIQUE(member_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_member_id
  ON public.push_subscriptions(member_id);

-- Trigger tự động cập nhật updated_at khi UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: Chỉ cho phép người dùng thao tác trên subscriptions thuộc các member_id của chính họ
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM public.club_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own"
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    member_id IN (
      SELECT id FROM public.club_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM public.club_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT id FROM public.club_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM public.club_members WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.push_subscriptions IS
  'Web Push subscriptions cho thành viên CLB. Edge Function push-send dùng service role để query theo member_ids.';

COMMIT;
