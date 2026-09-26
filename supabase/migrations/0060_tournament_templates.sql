-- 0060_tournament_templates.sql — Module Giải đấu: "Lưu làm mẫu CLB" (handoff tab Thể thức / sơ đồ tự do).
--
-- Một thể thức tự dựng (khối + đường nối trên canvas) lưu lại để lần sau dựng lại trong 1 bước.
-- Danh sách của CLB (không theo giải). `graph` = { stages: [{ seq, type, title, config, matchRule, ruleOverrides,
-- canvasX, canvasY }], links: [{ fromSeq, toSeq, ranks }] } — ghi / đọc bằng `canvas.js#graphOf` / `stagesFromGraph`.
-- Không đụng Elo / điểm mùa / tiền → không backtest.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tournament_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (btrim(name) <> ''),
  graph       jsonb NOT NULL CHECK (jsonb_typeof(graph) = 'object' AND jsonb_typeof(graph->'stages') = 'array'),
  created_by  uuid REFERENCES public.club_members(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_tournament_templates_club ON public.tournament_templates (club_id);

ALTER TABLE public.tournament_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tournament_templates_read ON public.tournament_templates;
CREATE POLICY tournament_templates_read ON public.tournament_templates
  FOR SELECT TO authenticated USING (public.is_club_member(club_id));
DROP POLICY IF EXISTS tournament_templates_write ON public.tournament_templates;
CREATE POLICY tournament_templates_write ON public.tournament_templates
  FOR ALL TO authenticated
  USING (public.has_club_perm(club_id, 'sessions')) WITH CHECK (public.has_club_perm(club_id, 'sessions'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_templates TO authenticated;

COMMIT;
