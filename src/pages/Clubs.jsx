// "CLB của tôi": chọn CLB để vào · tạo CLB mới · nhập mã tham gia.
// Phê duyệt yêu cầu KHÔNG ở đây — nằm trong Cài đặt của CLB → tab Tài khoản & quyền.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Avatar, Button, Dialog, Icon, IconButton, Input, StatusPill } from '#ds'
import { DeleteClubDialog, Empty, Mono, Overline } from '#ui'
import { useAuth } from '#contexts/AuthContext.jsx'
import { useApp } from '#contexts/AppContext.jsx'
import { ddmy } from '#utils/dates.js'
import { roleName } from '#lib/roles.js'
import { PUBLIC_PATHS } from '#routes'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

export default function Clubs() {
  const { profile, clubs, requests, setActiveClub, signOut, createClub, joinByCode } = useAuth()
  const { toast } = useApp()
  const navigate = useNavigate()
  const [dlg, setDlg] = useState(null) // 'create' | 'join' | null
  const [del, setDel] = useState(null) // CLB đang chờ xác nhận xoá

  const pending = (requests || []).filter((r) => r.status === 'pending')
  const rejected = (requests || []).filter((r) => r.status === 'rejected')
  const meName = (profile && (profile.nick || profile.name)) || ''

  const enter = (id) => {
    setActiveClub(id)
    navigate('/', { replace: true })
  }

  return (
    <div style={S.page}>
      {/* ---- thanh trên: hồ sơ + đăng xuất ---- */}
      <div style={S.topbar}>
        <div style={S.brandRow}>
          <div style={S.logo}><Icon name="volleyball" size={18} /></div>
          <span style={S.appName}>{t('auth.appName')}</span>
        </div>
        <div style={{ flex: 1 }} />
        {profile && (
          <div style={S.me}>
            <Avatar name={meName} size={28} />
            <div style={{ minWidth: 0 }}>
              <div style={S.meName}>{meName}</div>
              <Mono color="var(--text-muted)">{profile.username}</Mono>
            </div>
          </div>
        )}
        {/* Hồ sơ TÀI KHOẢN nằm ngoài CLB (`/tai-khoan`). Trước đây nút này phải nhảy đại vào
            CLB đầu tiên mới mở được trang hồ sơ — sửa một tài khoản không được đòi phải chọn
            CLB, và cái sửa được ở trong CLB là bản ghi thành viên, không phải tài khoản. */}
        <Button variant="secondary" size="sm" icon="user-round" onClick={() => navigate(PUBLIC_PATHS.account)}>
          {t('auth.profileBtn')}
        </Button>
        <Button variant="ghost" size="sm" icon="circle-x" onClick={signOut}>{t('auth.logout')}</Button>
      </div>

      <div style={S.wrap}>
        {/* ---- tiêu đề + hành động ---- */}
        <div style={S.head}>
          <div style={{ minWidth: 0 }}>
            <h1 style={S.title}>{t('clubs.title')}</h1>
            <span style={S.sub}>{t('clubs.sub')}</span>
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <Button variant="secondary" icon="link" onClick={() => setDlg('join')}>{t('clubs.join')}</Button>
            <Button variant="primary" icon="plus" onClick={() => setDlg('create')}>{t('clubs.create')}</Button>
          </div>
        </div>

        {/* ---- danh sách CLB ---- */}
        {clubs.length === 0 ? (
          <div style={S.card}>
            <Empty icon="building-2" title={t('clubs.empty')} hint={t('clubs.emptyHint')} />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {clubs.map((c) => (
              /* Thẻ là <div>, phần bấm-để-vào là <button> con: nút Xoá không lồng được vào
                 trong một <button> khác, mà bỏ <button> đi thì mất luôn điều hướng bàn phím. */
              <div key={c.id} style={S.row}>
                <button type="button" onClick={() => enter(c.id)} style={S.rowMain}>
                  <div style={S.rowIcon}><Icon name="building-2" size={20} /></div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={S.rowName}>{c.name}</div>
                    <Mono color="var(--text-muted)">
                      {t('clubs.meta', { code: c.code, n: c.member_count })}
                    </Mono>
                  </div>
                </button>
                <span style={S.rolePill}>{roleName(c.role)}</span>
                {/* Chỉ chủ CLB. Vai lấy từ RPC my_clubs, và RPC xoá gác lại lần nữa dưới DB. */}
                {c.role === 'owner' && (
                  <IconButton icon="trash-2" size="sm" variant="ghost"
                    label={t('clubs.delBtn')} onClick={() => setDel(c)} />
                )}
                <Icon name="chevron-right" size={18} style={{ color: 'var(--text-muted)' }} />
              </div>
            ))}
          </div>
        )}

        {/* ---- yêu cầu đang chờ ---- */}
        {(pending.length > 0 || rejected.length > 0) && (
          <div style={{ display: 'grid', gap: 9 }}>
            <Overline>{t('clubs.pendingTitle')}</Overline>
            {pending.map((r) => (
              <div key={r.id} style={{ ...S.row, cursor: 'default' }}>
                <div style={S.rowIcon}><Icon name="clock-alert" size={20} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.rowName}>{r.club_name}</div>
                  <Mono color="var(--text-muted)">
                    {t('clubs.pendingMeta', { date: ddmy(String(r.created_at).slice(0, 10)) })}
                  </Mono>
                </div>
                <StatusPill status="scheduled" label={t('rosterState.pending')} size="sm" />
              </div>
            ))}
            {rejected.map((r) => (
              <div key={r.id} style={{ ...S.row, cursor: 'default', opacity: 0.7 }}>
                <div style={S.rowIcon}><Icon name="circle-x" size={20} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.rowName}>{r.club_name}</div>
                  <Mono color="var(--text-muted)">{t('clubs.pendingRejected')}</Mono>
                </div>
              </div>
            ))}
            <div style={S.note}>{t('clubs.approveHere')}</div>
          </div>
        )}
      </div>

      {del && (
        <DeleteClubDialog
          club={del}
          onClose={() => setDel(null)}
          onDone={() => { toast(t('toast.clubDeleted', { name: del.name })); setDel(null) }}
        />
      )}
      {dlg === 'create' && <CreateDialog onClose={() => setDlg(null)} onDone={enter} create={createClub} toast={toast} />}
      {dlg === 'join' && <JoinDialog onClose={() => setDlg(null)} join={joinByCode} toast={toast} />}
    </div>
  )
}

/** Vào Trang cá nhân: cần một CLB đang chọn để AppLayout render được. */
/* ---------------- tạo CLB ---------------- */

function CreateDialog({ onClose, onDone, create, toast }) {
  const today = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({
    name: '', opening: '0', openingDate: today, lockDay: String(cfg.club.defaultLockDay),
    bankHolder: '', bankNo: '', bankName: '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = async () => {
    setErr('')
    if (f.name.trim().length < 2) return setErr(t('clubs.fName'))
    setBusy(true)
    try {
      const { club } = await create(f)
      toast(t('clubs.createdToast', { name: club.name, code: club.code }))
      onClose()
      onDone(club.id)
    } catch (ex) {
      setErr(ex.message)
      setBusy(false)
    }
  }

  return (
    <Dialog open title={t('clubs.createTitle')} description={t('clubs.createSub')} width={580} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Input
          label={t('clubs.fName')}
          placeholder="Ví dụ: CLB Cầu Lông Ba Đình"
          value={f.name}
          onChange={set('name')}
          autoFocus
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label={t('clubs.fOpening')}
            mono
            suffix={t('units.dong')}
            value={f.opening}
            onChange={set('opening')}
            hint={t('clubs.fOpeningHint')}
          />
          <Input
            label={t('clubs.fOpeningDate')}
            type="date"
            mono
            value={f.openingDate}
            onChange={set('openingDate')}
            hint="Ngày bắt đầu tính thu chi"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
          <Input
            label={t('clubs.fLockDay')}
            mono
            suffix="hàng tháng"
            value={f.lockDay}
            onChange={set('lockDay')}
            hint="Khoá danh sách tháng sau (mặc định 25)"
          />
          <div style={S.lockTip}>
            <Icon name="calendar-clock" size={16} style={{ color: 'var(--teal-600)', flexShrink: 0, marginTop: 2 }} />
            <span>Sau ngày này, danh sách cố định tháng mới sẽ chốt và tự động sinh quỹ tháng.</span>
          </div>
        </div>

        <div style={{ marginTop: 2, display: 'grid', gap: 4 }}>
          <Overline>{t('clubs.bankSection')}</Overline>
          <div style={S.hint}>{t('clubs.bankHint')}</div>
        </div>

        <Input
          label={t('clubs.fBankHolder')}
          placeholder="Ví dụ: NGUYỄN VĂN A"
          value={f.bankHolder}
          onChange={set('bankHolder')}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label={t('clubs.fBankNo')}
            mono
            placeholder="Số tài khoản"
            value={f.bankNo}
            onChange={set('bankNo')}
          />
          <Input
            label={t('clubs.fBankName')}
            placeholder="Ví dụ: MB Bank, Vietcombank..."
            value={f.bankName}
            onChange={set('bankName')}
          />
        </div>

        {err && <Alert tone="danger">{err}</Alert>}
        <Alert tone="info">{t('clubs.nextStep')}</Alert>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" icon="plus" loading={busy} disabled={busy} onClick={submit}>
            {t('clubs.create')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

/* ---------------- tham gia bằng mã ---------------- */

function JoinDialog({ onClose, join, toast }) {
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setErr('')
    if (code.trim().length !== cfg.club.codeLength) return setErr(t('clubs.errCode'))
    setBusy(true)
    try {
      const req = await join(code, note)
      toast(t('clubs.joinedToast', { name: req.club_name || code.toUpperCase() }))
      onClose()
    } catch (ex) {
      setErr(ex.message)
      setBusy(false)
    }
  }

  return (
    <Dialog open title={t('clubs.joinTitle')} description={t('clubs.joinSub')} width={480} onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Input label={t('clubs.fCode')} mono value={code} autoFocus
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          style={{ letterSpacing: '.18em', fontSize: 18 }} />
        <Input label={t('clubs.fNote')} value={note} onChange={(e) => setNote(e.target.value)}
          hint={t('clubs.fNoteHint')} />
        {err && <Alert tone="danger">{err}</Alert>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" icon="send" loading={busy} disabled={busy} onClick={submit}>
            {t('clubs.join')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

const S = {
  page: { minHeight: '100vh', background: 'var(--surface-page)', font: 'var(--type-body)', color: 'var(--text-primary)' },
  topbar: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 22px', flexWrap: 'wrap',
    background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)',
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: 9 },
  logo: {
    width: 30, height: 30, flex: '0 0 auto', borderRadius: 8, background: 'var(--teal-500)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#04302C',
  },
  appName: { font: '700 15px/1.15 var(--font-display)', letterSpacing: '-0.015em' },
  me: { display: 'flex', alignItems: 'center', gap: 8, paddingRight: 6 },
  meName: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  wrap: { maxWidth: 860, margin: '0 auto', padding: '28px 22px 60px', display: 'grid', gap: 18 },
  head: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' },
  title: { font: 'var(--type-h1)', margin: 0, color: 'var(--text-primary)' },
  sub: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  card: {
    background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 12, boxShadow: 'var(--shadow-xs)',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px',
    background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 12,
    boxShadow: 'var(--shadow-xs)', cursor: 'pointer', font: 'inherit', textAlign: 'left',
  },
  rowMain: {
    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12,
    padding: 0, border: 0, background: 'transparent', cursor: 'pointer',
    font: 'inherit', textAlign: 'left', color: 'inherit',
  },
  rowIcon: {
    width: 40, height: 40, flex: '0 0 auto', borderRadius: 10, background: 'var(--surface-brand-soft)',
    color: 'var(--navy-700)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  rowName: { font: 'var(--type-h3)', color: 'var(--text-primary)' },
  rolePill: {
    font: '600 10px/1 var(--font-sans)', padding: '6px 10px', borderRadius: 99, whiteSpace: 'nowrap',
    background: 'var(--surface-accent-soft)', color: 'var(--teal-700)',
  },
  hint: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  note: { font: 'var(--type-caption)', color: 'var(--text-muted)', paddingTop: 2 },
  lockTip: {
    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
    borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
    font: 'var(--type-caption)', color: 'var(--text-secondary)', lineHeight: 1.45,
    marginTop: 22,
  },
}
