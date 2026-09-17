-- 0038_notifications_and_activity.sql
-- Hệ thống Thông báo (Notification) & Hoạt động CLB (Social Activity)

BEGIN;

-- 1. Bảng Activity Events (Dòng thời gian hoạt động toàn CLB)
CREATE TABLE IF NOT EXISTS public.activity_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES public.club_members(id) ON DELETE SET NULL,
  type        text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}',
  ref_type    text,       -- 'match', 'challenge', 'session', 'member'
  ref_id      uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ae_club_time ON public.activity_events(club_id, created_at DESC);

-- 2. Bảng Notifications (Thông báo riêng tư của từng thành viên)
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  type        text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}',
  ref_type    text,
  ref_id      uuid,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_member_unread ON public.notifications(member_id, read_at, created_at DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3a. Quyền với activity_events
DROP POLICY IF EXISTS activity_events_select ON public.activity_events;
CREATE POLICY activity_events_select ON public.activity_events
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

DROP POLICY IF EXISTS activity_events_insert ON public.activity_events;
CREATE POLICY activity_events_insert ON public.activity_events
  FOR INSERT TO authenticated
  WITH CHECK (
    is_club_member(club_id)
    AND (
      actor_id IS NULL
      OR actor_id IN (
        SELECT id FROM public.club_members
        WHERE user_id = auth.uid() AND club_id = activity_events.club_id
      )
    )
  );

-- 3b. Quyền với notifications
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    member_id IN (
      SELECT id FROM public.club_members
      WHERE user_id = auth.uid() AND club_id = notifications.club_id
    )
  );

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    member_id IN (
      SELECT id FROM public.club_members
      WHERE user_id = auth.uid() AND club_id = notifications.club_id
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT id FROM public.club_members
      WHERE user_id = auth.uid() AND club_id = notifications.club_id
    )
  );

DROP POLICY IF EXISTS notifications_delete ON public.notifications;
CREATE POLICY notifications_delete ON public.notifications
  FOR DELETE TO authenticated
  USING (
    member_id IN (
      SELECT id FROM public.club_members
      WHERE user_id = auth.uid() AND club_id = notifications.club_id
    )
  );

DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (is_club_member(club_id));

COMMIT;
