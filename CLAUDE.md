# CLAUDE.md

# Language

- Always reply in Vietnamese unless explicitly requested otherwise.

---

# Primary Workflow

Before implementing any code changes:

1. Read `docs/RULES.md`.
2. Read only the files directly related to the task.
3. Read additional documentation only when required.
4. Create a short implementation plan.
5. If the task affects more than 5 files, architecture, or database schema, wait for user approval before implementation.
6. Implement the smallest correct solution.
7. Prefer modifying existing code over creating new files.
8. Reuse existing components, hooks, utilities, and patterns whenever possible.
9. Do not run `npm run build` automatically. The user builds manually; only run it yourself if they report a build error, then fix and re-run until it passes.
10. Summarize what changed.

---

# Documentation Loading

Load documentation only when relevant.

| Task | Documentation |
|------|---------------|
| Database | docs/DATABASE.md |
| Architecture | docs/ARCHITECTURE.md |
| Features | docs/FEATURES.md |
| Tasks | docs/TASKS.md |

Never load unrelated documentation.

---

# Design System

For tasks involving:

- UI
- Styling
- CSS
- Components
- Layout
- Responsive Design
- Theme
- UX

Read `DESIGN.md` before making changes.

If the task is unrelated to UI, do not load `DESIGN.md`.

When modifying the design system:

- Update `DESIGN.md` if necessary.

---

# Coding Philosophy

Always prefer:

- Simplicity
- Readability
- Small reversible changes
- Existing project patterns

Before writing new code, check in this order:

1. Can existing project code solve this?
2. Can React solve this?
3. Can browser APIs solve this?
4. Can Supabase solve this?
5. Can existing dependencies solve this?
6. Only then create new code.

Avoid:

- Over engineering
- Premature abstraction
- Duplicate logic
- One-time helper functions
- Unnecessary dependencies
- Large rewrites

---

# Scope Control

Never:

- Refactor unrelated code.
- Rename files without reason.
- Move folders unnecessarily.
- Modify unrelated components.

Stay inside the requested scope.

---

# UI Verification

Do NOT use the Browser tool to self-verify UI/frontend changes by default — it burns tokens fast
and the user verifies manually. Instead:

- List exactly what changed (files + behavior), same as any other summary.
- Give the user a short checklist of what to click/check themselves.
- Call out known gotchas up front: features that need login to test (guest mode can't reach them),
  data that must already exist (e.g. a completed task) to see a state, or anything easy to
  misclick.
- Only open the Browser tool when the user explicitly asks you to verify, or when you're
  debugging a bug report and can't diagnose it from code alone.

---

# Testing

For non-trivial business logic (date math, chain/cascade rules, anything with more than one
edge case) — not simple CRUD wiring:

- Unit tests live in `src/__tests__/`. This is a deliberate departure from the older colocated
  `*.test.js` files next to `dateUtils.js`/`mediaUtils.js` — leave those where they are, don't
  migrate them just to unify the pattern (unrelated refactor).
- No test framework (no Jest/Vitest) — plain `node:assert/strict` scripts, same style as
  `src/utils/dateUtils.test.js`: import the function, assert, `console.log('X check: OK')` at
  the end, run via `node <path>`.
- Extract the logic into PURE functions (no Supabase, no React) so it's testable without
  mocking. Code that calls Supabase/hooks stays untested by this suite — manual test on
  Supabase per existing convention (see `npm test` comment in RULES.md).
- Wire every new test file into the `test` script in `package.json`.
- Run `npm test` after finishing any change to logic covered by these tests.
- **If a test fails: stop.** Report the failure to the user before changing either the test or
  the logic — don't silently pick whichever is more convenient to "fix". The user decides which
  one is wrong.

---

# Output

Before finishing every implementation:

- Do not claim the build passes — you didn't run it. Ask the user to build and report back.
- Do not claim the UI works — you didn't check it in a browser (see UI Verification above).
  Say what you verified (lint/build/code review) and what the user still needs to click through.
- Explain what changed.
- Mention important tradeoffs.
- Mention remaining TODOs if any.

If the user reports a build error, run `npm run build` yourself, fix it, and repeat until clean.


## Project Memory

For architecture decisions, historical context, previous bugs, conventions, and implementation rationale:

- Search Engram memory before making assumptions.
- Reuse existing project knowledge when relevant.
- If a significant architectural decision or important bug fix is made, save it to Engram.
- Do not save trivial implementation details.

### Engram usage rules

- **Write memory ONLY through the MCP tool `mem_save`. Never use `engram save` from the CLI/terminal.**
  A CLI save does not get a project key: `engram projects list` stays empty and the default
  `mem_search` (scoped to the project) will not find it. Verified 2026-07-27 — the orphan
  observation had to be re-saved via MCP and soft-deleted.
- This repo's Engram project key is **`web_challenge`**, detected from the git remote
  (`github.com/johnsmithvn/Web_challenge.git`) — not from the folder name `Web_Update`.
- Use the `engram` CLI only for admin commands missing from the `--tools=agent` profile:
  `engram delete`, `engram stats`, `engram projects list`, `engram doctor`.

---

# 🚨 CẤM TUYỆT ĐỐI: XOÁ / RESET DATABASE

> **⛔ LUẬT ƯU TIÊN CAO NHẤT — KHÔNG NGOẠI LỆ.**

**KHÔNG BAO GIỜ được chạy** các lệnh phá huỷ data mà không hỏi người dùng:

- `supabase db reset` — xoá sạch DB
- `DROP DATABASE` / `DROP SCHEMA ... CASCADE`
- `TRUNCATE` / `DELETE FROM ... WHERE true`

**PHẢI** giải thích rõ lệnh sẽ làm gì → cảnh báo mất data → **hỏi xin phép** trước khi chạy.

Cách đúng để cập nhật DB: chạy file migration SQL trực tiếp (`psql -f`), **không** reset.

Chi tiết đầy đủ: xem `docs/RULES.md` mục **#12**.
