// Mô tả schema để render trang Sơ đồ dữ liệu. Đây là DỮ LIỆU, không phải UI.
// Nguồn sự thật là supabase/migrations/ — sửa SQL thì cập nhật ở đây.
// groupKey trỏ vào i18n (schema.group*), tên bảng/cột giữ nguyên tên trong DB nên không dịch.

const f = (name, type, key) => ({ name, type, key: key || '' })

export const SCHEMA_GROUPS = [
  {
    groupKey: 'People',
    color: 'var(--navy-700)',
    tables: [
      {
        name: 'clubs',
        fields: [
          f('id', 'uuid', 'PK'), f('name', 'text'), f('code', 'char(8) uniq'),
          f('opening_balance', 'bigint'), f('opening_date', 'date'), f('opening_by', 'text'),
          f('lock_day', 'int'), f('round_unit', 'bool'), f('allow_code_join', 'bool'),
          f('allow_invite', 'bool'), f('allow_phone_suggest', 'bool'), f('multi_group', 'bool'),
          f('has_member_extra_discount', 'bool'), f('member_extra_discount', 'bigint'),
          f('levels', 'text[]'), f('bank_holder', 'text'), f('bank_no', 'text'), f('bank_name', 'text'),
        ],
      },
      {
        name: 'profiles',
        fields: [
          f('id', 'uuid', 'PK'), f('username', 'citext uniq'), f('email', 'citext uniq'),
          f('phone', 'text uniq null'), f('name', 'text'), f('nick', 'text null'),
          f('avatar_url', 'text null'), f('gender', 'enum'), f('level', 'text'),
          f('zalo_user_id', 'text null'),
        ],
      },
      {
        name: 'club_members',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('user_id', 'uuid null', 'FK'),
          f('role', 'enum owner/treasurer/member'), f('name', 'text'), f('full_name', 'text null'),
          f('phone', 'text null'), f('email', 'citext null'), f('gender', 'enum'), f('level', 'text'),
          f('pending_level', 'text null'), f('pending_level_from', 'char(7) null'),
          f('joined_at', 'date'), f('linked_at', 'timestamptz null'), f('active', 'bool'), f('note', 'text null'),
        ],
      },
      {
        name: 'member_groups',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('name', 'text'), f('short', 'text'),
          f('weekday', 'int 0-6'), f('fee_male', 'bigint'), f('fee_female', 'bigint'),
          f('unit_male', 'bigint'), f('unit_female', 'bigint'),
          f('start_time', 'time'), f('end_time', 'time'), f('active', 'bool'),
        ],
      },
      {
        name: 'group_memberships',
        fields: [
          f('id', 'uuid', 'PK'), f('month', 'char(7)'), f('group_id', 'uuid', 'FK'),
          f('member_id', 'uuid', 'FK'), f('state', 'enum fixed/off/pending'),
        ],
      },
      {
        name: 'roster_locks',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('month', 'char(7)'),
          f('locked_at', 'timestamptz'), f('locked_by', 'uuid', 'FK'),
        ],
      },
      {
        name: 'member_changes',
        fields: [
          f('id', 'uuid', 'PK'), f('member_id', 'uuid', 'FK'), f('field', 'text'),
          f('from_value', 'text'), f('to_value', 'text'), f('effective', 'now/next'), f('status', 'enum pending/approved/rejected'),
        ],
      },
    ],
  },
  {
    groupKey: 'Sessions',
    color: 'var(--teal-600)',
    tables: [
      {
        name: 'courts',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('name', 'text'),
          f('address', 'text null'), f('map_url', 'text null'), f('price_per_hour', 'bigint'), f('active', 'bool'),
        ],
      },
      {
        name: 'schedules',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('group_id', 'uuid', 'FK'),
          f('name', 'text'), f('weekdays', 'int[]'), f('start_date', 'date'),
          f('end_date', 'date null'), f('active', 'bool'),
        ],
      },
      {
        name: 'schedule_slots',
        fields: [
          f('id', 'uuid', 'PK'), f('schedule_id', 'uuid', 'FK'), f('court_id', 'uuid', 'FK'),
          f('start_time', 'time'), f('end_time', 'time'), f('court_label', 'text null'),
        ],
      },
      {
        name: 'sessions',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('group_id', 'uuid null', 'FK'),
          f('schedule_id', 'uuid null', 'FK'), f('date', 'date'), f('status', 'enum'),
          f('closed_at', 'timestamptz null'),
        ],
      },
      {
        name: 'session_courts',
        fields: [
          f('id', 'uuid', 'PK'), f('session_id', 'uuid', 'FK'), f('court_id', 'uuid', 'FK'),
          f('court_index', 'int'), f('start_time', 'time'), f('end_time', 'time'),
          f('default_minutes', 'int null'), f('is_extra', 'bool'), f('is_sold', 'bool'),
          f('sold_amount', 'bigint'), f('sold_to', 'text'), f('court_label', 'text null'),
        ],
      },
    ],
  },
  {
    groupKey: 'Attend',
    color: 'var(--status-scheduled)',
    tables: [
      {
        name: 'attendances',
        fields: [
          f('id', 'uuid', 'PK'), f('session_id', 'uuid', 'FK'), f('member_id', 'uuid', 'FK'),
          f('status', 'enum present/absent/extra'), f('marked_at', 'timestamptz'), f('marked_by', 'uuid', 'FK'),
        ],
      },
      {
        name: 'guests',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('name', 'text'),
          f('gender', 'enum'), f('level', 'text'), f('phone', 'text null'), f('invited_by', 'uuid null', 'FK'),
        ],
      },
      {
        name: 'session_guests',
        fields: [
          f('id', 'uuid', 'PK'), f('session_id', 'uuid', 'FK'), f('guest_id', 'uuid', 'FK'),
          f('member_id', 'uuid null', 'FK'), f('level', 'text'), f('gender', 'enum'),
          f('price', 'bigint'), f('invited_by', 'uuid null', 'FK'), f('paid', 'bool'), f('paid_at', 'timestamptz null'),
        ],
      },
      {
        name: 'guest_price_rules',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('level', 'text'),
          f('gender', 'enum'), f('price', 'bigint'), f('effective_from', 'date'),
        ],
      },
    ],
  },
  {
    groupKey: 'Money',
    color: 'var(--status-delayed)',
    tables: [
      {
        name: 'transactions',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('date', 'date'),
          f('direction', 'enum in/out'), f('category', 'text key'), f('label', 'text'),
          f('amount', 'bigint'), f('payer_name', 'text null'), f('ref_type', 'text null'),
          f('ref_id', 'uuid null'), f('created_by', 'uuid null', 'FK'), f('deleted_at', 'timestamptz null'),
        ],
      },
      {
        name: 'monthly_dues',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('month', 'char(7)'),
          f('group_id', 'uuid', 'FK'), f('member_id', 'uuid', 'FK'),
          f('amount', 'bigint'), f('paid_amount', 'bigint'), f('paid', 'bool'),
          f('paid_at', 'date null'), f('method', 'text null'),
        ],
      },
      {
        name: 'member_adjustments',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('month', 'char(7)'),
          f('group_id', 'uuid null', 'FK'), f('member_id', 'uuid', 'FK'),
          f('kind', 'enum absent/extra/manual'), f('amount', 'bigint'),
          f('settle_mode', 'enum cash/offset_next_dues'), f('paid', 'bool'), f('paid_at', 'date null'),
        ],
      },
      {
        name: 'court_bills',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('month', 'char(7)'),
          f('paid_on', 'date'), f('venue', 'text'), f('amount', 'bigint'),
          f('payer_member_id', 'uuid null', 'FK'), f('payer', 'text null'), f('note', 'text null'),
        ],
      },
    ],
  },
  {
    groupKey: 'Access',
    color: 'var(--navy-500)',
    tables: [
      {
        name: 'club_join_requests',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('user_id', 'uuid', 'FK'),
          f('code_used', 'char(8)'), f('note', 'text null'), f('status', 'enum pending/approved/rejected'),
          f('matched_member_id', 'uuid null', 'FK'), f('reviewed_by', 'uuid null', 'FK'),
        ],
      },
      {
        name: 'club_invites',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('member_id', 'uuid', 'FK'),
          f('phone', 'text'), f('token', 'text uniq'), f('status', 'enum'),
          f('sent_at', 'timestamptz'), f('accepted_user_id', 'uuid null', 'FK'),
        ],
      },
      {
        name: 'role_permissions',
        fields: [
          f('role', 'enum owner/treasurer/member', 'PK'), f('can_money', 'bool'),
          f('can_members', 'bool'), f('can_sessions', 'bool'), f('can_assign', 'bool'),
          f('can_settings', 'bool'), f('can_view_all', 'bool'),
        ],
      },
    ],
  },
  {
    groupKey: 'Assign',
    color: 'var(--teal-500)',
    tables: [
      {
        name: 'session_lineups',
        fields: [
          f('id', 'uuid', 'PK'), f('session_id', 'uuid', 'FK'), f('slot', 'text c0t1s0'),
          f('court_index', 'int'), f('player_type', 'enum member/guest'), f('player_id', 'uuid'),
          f('updated_at', 'timestamptz'),
        ],
      },
      {
        name: 'session_court_groups',
        fields: [
          f('id', 'uuid', 'PK'), f('session_id', 'uuid', 'FK'), f('court_index', 'int'),
          f('player_type', 'enum member/guest'), f('player_id', 'uuid'),
        ],
      },
      {
        name: 'matches',
        fields: [
          f('id', 'uuid', 'PK'), f('session_id', 'uuid', 'FK'), f('court_index', 'int'),
          f('minutes', 'int'), f('started_at', 'timestamptz'), f('ended_at', 'timestamptz'),
          f('created_by', 'uuid null', 'FK'),
          f('source_type', 'enum session/challenge'), f('challenge_id', 'uuid null', 'FK'),
          f('rating_enabled', 'bool'), f('score_a', 'int null'), f('score_b', 'int null'),
          f('team_a_won', 'bool null'), f('elo_delta_a', 'int null'), f('elo_delta_b', 'int null'),
          f('score_text', 'text null'), f('sets', 'jsonb null'),
        ],
      },
      {
        name: 'match_players',
        fields: [
          f('id', 'uuid', 'PK'), f('match_id', 'uuid', 'FK'),
          f('player_type', 'enum member/guest'), f('player_id', 'uuid'), f('team', 'int 0/1'),
        ],
      },
    ],
  },
  {
    groupKey: 'Competition',
    color: '#00786F',
    tables: [
      {
        name: 'challenges',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('session_id', 'uuid null', 'FK'),
          f('code', 'char(8) uniq'), f('created_by', 'uuid', 'FK'),
          f('status', 'enum pending/accepted/declined/cancelled/oncourt/played'),
          f('court_id', 'uuid null', 'FK'), f('scheduled_at', 'timestamptz null'),
          f('best_of', 'int'), f('rating_enabled', 'bool'), f('expires_at', 'timestamptz'),
          f('match_id', 'uuid null', 'FK'),
        ],
      },
      {
        name: 'challenge_players',
        fields: [
          f('id', 'uuid', 'PK'), f('challenge_id', 'uuid', 'FK'),
          f('member_id', 'uuid', 'FK'), f('team', 'enum team_a/team_b'),
        ],
      },
      {
        name: 'player_ratings',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('member_id', 'uuid', 'FK'),
          f('rating', 'int'), f('games_count', 'int'), f('wins_count', 'int'), f('losses_count', 'int'),
          f('confidence', 'enum low/medium/high/very_high/maxed'), f('updated_at', 'timestamptz'),
        ],
      },
      {
        name: 'match_edits',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('match_id', 'uuid', 'FK'),
          f('edited_by', 'uuid', 'FK'), f('edited_at', 'timestamptz'), f('field_changed', 'text'),
          f('old_value', 'text'), f('new_value', 'text'), f('reason', 'text'),
          f('rating_recalc_from_match_id', 'uuid null'),
        ],
      },
      {
        name: 'club_calibration',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('gap_bucket', 'text'),
          f('sample_size', 'int'), f('female_wins', 'int'), f('adjustment_value', 'int'),
          f('updated_at', 'timestamptz'),
        ],
      },
    ],
  },
  {
    groupKey: 'Phase2',
    color: 'var(--gray-500)',
    tables: [
      {
        name: 'notifications',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('member_id', 'uuid', 'FK'),
          f('kind', 'text'), f('channel', 'push/zalo'), f('payload', 'jsonb'),
          f('scheduled_at', 'timestamptz'), f('sent_at', 'timestamptz'),
        ],
      },
      {
        name: 'zalo_links',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('member_id', 'uuid', 'FK'),
          f('zalo_user_id', 'text'), f('oa_id', 'text'), f('linked_at', 'timestamptz'),
        ],
      },
      {
        name: 'device_tokens',
        fields: [
          f('id', 'uuid', 'PK'), f('user_id', 'uuid', 'FK'), f('platform', 'ios/android/web'),
          f('token', 'text'), f('last_seen_at', 'timestamptz'),
        ],
      },
      {
        name: 'audit_logs',
        fields: [
          f('id', 'uuid', 'PK'), f('club_id', 'uuid', 'FK'), f('actor_id', 'uuid', 'FK'),
          f('action', 'text'), f('entity', 'text'), f('entity_id', 'uuid'),
          f('before', 'jsonb'), f('after', 'jsonb'),
        ],
      },
    ],
  },
]
