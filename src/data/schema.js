// Mô tả schema để render trang Sơ đồ dữ liệu. Đây là DỮ LIỆU, không phải UI.
// Nguồn sự thật là supabase/migrations/0001_init.sql — sửa SQL thì cập nhật ở đây.
// groupKey trỏ vào i18n (schema.group*), tên bảng/cột giữ nguyên tên trong DB nên không dịch.

const f = (name, type, key) => ({ name, type, key: key || '' })

export const SCHEMA_GROUPS = [
  {
    groupKey: 'People',
    color: 'var(--navy-700)',
    tables: [
      { name: 'clubs', fields: [f('id', 'uuid', 'PK'), f('name', 'text'), f('code', 'char(8) uniq'), f('opening_balance', 'bigint'), f('opening_date', 'date'), f('court_pay_mode', 'enum'), f('lock_day', 'int'), f('round_unit', 'bool'), f('allow_code_join', 'bool'), f('allow_invite', 'bool'), f('allow_phone_suggest', 'bool')] },
      { name: 'users', fields: [f('id', 'uuid', 'PK'), f('phone', 'text uniq'), f('name', 'text'), f('nick', 'text'), f('email', 'text'), f('avatar_url', 'text'), f('gender', 'enum'), f('level', 'enum'), f('zalo_user_id', 'text')] },
      { name: 'club_members', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('user_id', 'uuid null', 'FK'), f('role', 'enum'), f('name', 'text'), f('phone', 'text'), f('gender', 'enum'), f('level', 'enum'), f('pending_level', 'enum null'), f('pending_level_from', 'char(7)'), f('joined_at', 'date'), f('active', 'bool')] },
      { name: 'member_groups', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('name', 'text'), f('short', 'text'), f('weekday', 'int 0-6'), f('fee_male', 'bigint'), f('fee_female', 'bigint'), f('start_time', 'time'), f('end_time', 'time'), f('quota', 'int')] },
      { name: 'group_memberships', fields: [f('id', 'uuid', 'PK'), f('month', 'char(7)'), f('group_id', 'uuid', 'FK'), f('member_id', 'uuid', 'FK'), f('state', 'enum fixed/off/pending')] },
      { name: 'roster_locks', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('month', 'char(7)'), f('locked_at', 'timestamptz'), f('locked_by', 'uuid', 'FK')] },
      { name: 'member_changes', fields: [f('id', 'uuid', 'PK'), f('member_id', 'uuid', 'FK'), f('field', 'text'), f('from_value', 'text'), f('to_value', 'text'), f('effective', 'now/next'), f('status', 'enum')] },
    ],
  },
  {
    groupKey: 'Sessions',
    color: 'var(--teal-600)',
    tables: [
      { name: 'courts', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('name', 'text'), f('address', 'text'), f('price_per_hour', 'bigint'), f('active', 'bool')] },
      { name: 'schedules', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('group_id', 'uuid', 'FK'), f('name', 'text'), f('weekdays', 'int[]'), f('start_date', 'date'), f('end_date', 'date null'), f('active', 'bool')] },
      { name: 'schedule_slots', fields: [f('id', 'uuid', 'PK'), f('schedule_id', 'uuid', 'FK'), f('court_id', 'uuid', 'FK'), f('start_time', 'time'), f('end_time', 'time')] },
      { name: 'sessions', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('group_id', 'uuid', 'FK'), f('schedule_id', 'uuid null', 'FK'), f('date', 'date'), f('status', 'enum'), f('shuttle_mode', 'enum'), f('tubes_opened', 'int'), f('loose_units', 'int'), f('shuttle_used', 'int'), f('shuttle_est', 'bool'), f('closed_at', 'timestamptz')] },
      { name: 'session_courts', fields: [f('id', 'uuid', 'PK'), f('session_id', 'uuid', 'FK'), f('court_id', 'uuid', 'FK'), f('court_index', 'int'), f('start_time', 'time'), f('end_time', 'time'), f('is_extra', 'bool'), f('is_sold', 'bool'), f('sold_amount', 'bigint'), f('sold_to', 'text')] },
    ],
  },
  {
    groupKey: 'Attend',
    color: 'var(--status-scheduled)',
    tables: [
      { name: 'attendances', fields: [f('id', 'uuid', 'PK'), f('session_id', 'uuid', 'FK'), f('member_id', 'uuid', 'FK'), f('status', 'enum'), f('marked_at', 'timestamptz'), f('marked_by', 'uuid', 'FK')] },
      { name: 'guests', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('name', 'text'), f('gender', 'enum'), f('level', 'enum'), f('phone', 'text'), f('invited_by', 'uuid', 'FK')] },
      { name: 'session_guests', fields: [f('id', 'uuid', 'PK'), f('session_id', 'uuid', 'FK'), f('guest_id', 'uuid', 'FK'), f('level', 'enum'), f('gender', 'enum'), f('price', 'bigint'), f('invited_by', 'uuid', 'FK'), f('paid', 'bool'), f('paid_at', 'timestamptz')] },
      { name: 'guest_price_rules', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('level', 'enum'), f('gender', 'enum'), f('price', 'bigint'), f('effective_from', 'date')] },
    ],
  },
  {
    groupKey: 'Money',
    color: 'var(--status-delayed)',
    tables: [
      { name: 'transactions', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('date', 'date'), f('direction', 'enum in/out'), f('category', 'text key'), f('label', 'text'), f('amount', 'bigint'), f('ref_type', 'text'), f('ref_id', 'uuid'), f('created_by', 'uuid', 'FK')] },
      { name: 'monthly_dues', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('month', 'char(7)'), f('group_id', 'uuid', 'FK'), f('member_id', 'uuid', 'FK'), f('amount', 'bigint'), f('paid', 'bool'), f('paid_at', 'date'), f('method', 'text')] },
      { name: 'back_credits', fields: [f('id', 'uuid', 'PK'), f('month', 'char(7)'), f('group_id', 'uuid', 'FK'), f('member_id', 'uuid', 'FK'), f('sessions_total', 'int'), f('sessions_absent', 'int'), f('unit_price', 'bigint'), f('amount', 'bigint'), f('paid', 'bool')] },
      { name: 'court_bills', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('month', 'char(7)'), f('paid_on', 'date'), f('venue', 'text'), f('amount', 'bigint'), f('payer', 'text'), f('note', 'text')] },
    ],
  },
  {
    groupKey: 'Stock',
    color: 'var(--status-delivered)',
    tables: [
      { name: 'shuttle_types', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('name', 'text'), f('per_tube', 'int'), f('price_per_tube', 'bigint'), f('active', 'bool')] },
      { name: 'shuttle_purchases', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('date', 'date'), f('type_id', 'uuid', 'FK'), f('tubes', 'int'), f('extra_units', 'int'), f('total_units', 'int'), f('price_per_tube', 'bigint'), f('total_amount', 'bigint'), f('payer_member_id', 'uuid', 'FK')] },
      { name: 'shuttle_movements', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('type_id', 'uuid', 'FK'), f('date', 'date'), f('direction', 'enum'), f('qty', 'int'), f('ref_type', 'text'), f('ref_id', 'uuid'), f('balance_after', 'int')] },
      { name: 'stock_checks', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('date', 'date'), f('month', 'char(7)'), f('counted', 'int'), f('system_left', 'int'), f('diff', 'int'), f('spread_sessions', 'int')] },
    ],
  },
  {
    groupKey: 'Access',
    color: 'var(--navy-500)',
    tables: [
      { name: 'club_join_requests', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('user_id', 'uuid', 'FK'), f('code_used', 'char(8)'), f('note', 'text'), f('status', 'enum'), f('matched_member_id', 'uuid null', 'FK'), f('reviewed_by', 'uuid', 'FK')] },
      { name: 'club_invites', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('member_id', 'uuid', 'FK'), f('phone', 'text'), f('token', 'text uniq'), f('status', 'enum'), f('sent_at', 'timestamptz'), f('accepted_user_id', 'uuid null', 'FK')] },
      { name: 'role_permissions', fields: [f('role', 'enum', 'PK'), f('can_money', 'bool'), f('can_members', 'bool'), f('can_sessions', 'bool'), f('can_assign', 'bool'), f('can_settings', 'bool'), f('can_view_all', 'bool')] },
    ],
  },
  {
    groupKey: 'Assign',
    color: 'var(--teal-500)',
    tables: [
      { name: 'session_lineups', fields: [f('id', 'uuid', 'PK'), f('session_id', 'uuid', 'FK'), f('slot', 'text c0t1s0'), f('court_index', 'int'), f('player_type', 'enum'), f('player_id', 'uuid'), f('updated_at', 'timestamptz')] },
      { name: 'session_court_groups', fields: [f('id', 'uuid', 'PK'), f('session_id', 'uuid', 'FK'), f('court_index', 'int'), f('player_type', 'enum'), f('player_id', 'uuid')] },
      { name: 'matches', fields: [f('id', 'uuid', 'PK'), f('session_id', 'uuid', 'FK'), f('court_index', 'int'), f('minutes', 'int'), f('started_at', 'timestamptz'), f('ended_at', 'timestamptz'), f('created_by', 'uuid', 'FK')] },
      { name: 'match_players', fields: [f('id', 'uuid', 'PK'), f('match_id', 'uuid', 'FK'), f('player_type', 'enum'), f('player_id', 'uuid'), f('team', 'int 0/1')] },
    ],
  },
  {
    groupKey: 'Phase2',
    color: 'var(--gray-500)',
    tables: [
      { name: 'notifications', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('member_id', 'uuid', 'FK'), f('kind', 'text'), f('channel', 'push/zalo'), f('payload', 'jsonb'), f('scheduled_at', 'timestamptz'), f('sent_at', 'timestamptz')] },
      { name: 'zalo_links', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('member_id', 'uuid', 'FK'), f('zalo_user_id', 'text'), f('oa_id', 'text'), f('linked_at', 'timestamptz')] },
      { name: 'device_tokens', fields: [f('id', 'uuid', 'PK'), f('user_id', 'uuid', 'FK'), f('platform', 'ios/android/web'), f('token', 'text'), f('last_seen_at', 'timestamptz')] },
      { name: 'audit_logs', fields: [f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('actor_id', 'uuid', 'FK'), f('action', 'text'), f('entity', 'text'), f('entity_id', 'uuid'), f('before', 'jsonb'), f('after', 'jsonb')] },
    ],
  },
]
