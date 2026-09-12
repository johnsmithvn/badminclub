
const SANS = "'IBM Plex Sans', sans-serif";
const MONO = "'IBM Plex Mono', monospace";

const T = {
  legend: { name:'Huyền thoại', note:'rực lửa · vòng quay', pts:120,
    ring:'conic-gradient(from 210deg,#FF2D55,#FF6A00,#FFD166,#FFF3C4,#FF6A00,#FF2D55)',
    core:'radial-gradient(130% 130% at 50% 6%,#5A1706,#1C0702 74%)',
    glow:'0 0 0 1px rgba(255,178,102,.60),0 12px 32px rgba(255,88,20,.40)',
    ink:'#FFB25E', g1:'#FFF0C2', g2:'#FF7A29', g3:'#FF2D55',
    chipBg:'rgba(255,106,0,.14)', chipBd:'#8A3A0E',
    cardBg:'linear-gradient(165deg,#1D0A04,#14060B)', cardBd:'#8A3A0E', spin:true },
  epic: { name:'Sử thi', note:'tím · quầng nhẹ', pts:60,
    ring:'conic-gradient(from 200deg,#4C1D95,#8B5CF6,#E879F9,#8B5CF6,#4C1D95)',
    core:'radial-gradient(130% 130% at 50% 6%,#2E1065,#130524 74%)',
    glow:'0 0 0 1px rgba(196,150,255,.50),0 10px 26px rgba(139,92,246,.32)',
    ink:'#C4A5FF', g1:'#F5E6FF', g2:'#A97BFF', g3:'#6D28D9',
    chipBg:'rgba(139,92,246,.14)', chipBd:'#5B2BA8',
    cardBg:'linear-gradient(165deg,#180B2E,#100820)', cardBd:'#4C2B82' },
  elite: { name:'Tinh anh', note:'lam · viền sáng', pts:30,
    ring:'conic-gradient(from 200deg,#1D4ED8,#3B82F6,#22D3EE,#3B82F6,#1D4ED8)',
    core:'radial-gradient(130% 130% at 50% 6%,#0C2A5A,#05101F 74%)',
    glow:'0 0 0 1px rgba(120,180,255,.48),0 10px 24px rgba(59,130,246,.28)',
    ink:'#8FC2FF', g1:'#E4F3FF', g2:'#59A8FF', g3:'#1D4ED8',
    chipBg:'rgba(59,130,246,.14)', chipBd:'#24508F',
    cardBg:'linear-gradient(165deg,#0C1A33,#091220)', cardBd:'#274C85' },
  rare: { name:'Hiếm', note:'teal · màu thương hiệu', pts:15,
    ring:'conic-gradient(from 200deg,#00584F,#00B2A9,#5FDBD3,#00B2A9,#00584F)',
    core:'radial-gradient(130% 130% at 50% 6%,#04322D,#04161A 74%)',
    glow:'0 0 0 1px rgba(95,219,211,.45),0 10px 22px rgba(0,178,169,.26)',
    ink:'#5FDBD3', g1:'#D9FFFB', g2:'#35C9BF', g3:'#00786F',
    chipBg:'rgba(0,178,169,.14)', chipBd:'#00786F',
    cardBg:'linear-gradient(165deg,#0A2225,#071618)', cardBd:'#1E5D5A' },
  fun: { name:'Tự phong', note:'vàng · tự chọn, 0 điểm', pts:0,
    ring:'conic-gradient(from 200deg,#7A5620,#F0B75C,#FFE3A3,#F0B75C,#7A5620)',
    core:'radial-gradient(130% 130% at 50% 6%,#3B2609,#180E02 74%)',
    glow:'0 0 0 1px rgba(240,183,92,.45),0 10px 22px rgba(240,183,92,.22)',
    ink:'#F0B75C', g1:'#FFF2D2', g2:'#F0B75C', g3:'#A8741F',
    chipBg:'rgba(240,183,92,.14)', chipBd:'#7A5620',
    cardBg:'linear-gradient(165deg,#1C1507,#130D03)', cardBd:'#6A4B1B' },
  hidden: { name:'Ẩn', note:'??? cho tới khi mở', pts:0,
    ring:'repeating-conic-gradient(from 0deg,#2E3E5C 0deg 14deg,#141D2E 14deg 28deg)',
    core:'radial-gradient(130% 130% at 50% 6%,#16203A,#0A1120 74%)',
    glow:'0 0 0 1px rgba(46,62,92,.9)',
    ink:'#8494AA', g1:'#5B6B81', g2:'#3A4C71', g3:'#22304A',
    chipBg:'#141D2E', chipBd:'#2E3E5C',
    cardBg:'#101A2B', cardBd:'#22304A', dashed:true }
};

const GLYPH = {
  flame: 'polygon(50% 0%,78% 32%,64% 43%,88% 70%,50% 100%,12% 70%,36% 43%,22% 32%)',
  chev:  'polygon(50% 0%,100% 46%,74% 46%,74% 100%,26% 100%,26% 46%,0% 46%)',
  shield:'polygon(50% 0%,100% 16%,100% 62%,50% 100%,0% 62%,0% 16%)',
  crown: 'polygon(0% 100%,0% 28%,25% 56%,50% 0%,75% 56%,100% 28%,100% 100%)',
  bolt:  'polygon(58% 0%,20% 54%,46% 54%,36% 100%,84% 40%,54% 40%)',
  star:  'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
  ring:  'polygon(50% 0%,100% 50%,50% 100%,0% 50%)'
};

const RAD = { 168:42, 84:22, 64:17, 58:15, 52:14, 46:12, 44:12, 34:9, 26:8, 24:7 };

function ringOf(t, size) {
  const r = RAD[size] || Math.round(size * 0.26);
  return `position:absolute;inset:0;border-radius:${r}px;background:${t.ring};box-shadow:${t.glow}`
    + (t.spin && size >= 44 ? ';animation:emberSpin 9s linear infinite' : '');
}
function coreOf(t, size) {
  const pad = size >= 84 ? 4 : size >= 44 ? 3 : 2;
  const r = Math.max(4, (RAD[size] || Math.round(size * 0.26)) - pad);
  return `position:absolute;inset:${pad}px;border-radius:${r}px;background:${t.core}`;
}
function glyphOf(t, g, size) {
  const h = Math.round(size * 0.42), w = Math.round(h * 0.86);
  if (t.dashed) return 'width:0;height:0';
  return `width:${w}px;height:${h}px;background:linear-gradient(180deg,${t.g1},${t.g2} 55%,${t.g3});clip-path:${GLYPH[g] || GLYPH.shield}`;
}
function med(tierKey, glyph, size) {
  const t = T[tierKey];
  return { ring: ringOf(t, size), core: coreOf(t, size), glyph: glyphOf(t, glyph, size) };
}
function tierChip(tierKey, fs) {
  const t = T[tierKey];
  return `display:inline-flex;align-items:center;font:600 ${fs || 11}px/1.3 ${SANS};letter-spacing:0.05em;text-transform:uppercase;`
    + `padding:4px 9px;border-radius:999px;background:${t.chipBg};border:1px ${t.dashed ? 'dashed' : 'solid'} ${t.chipBd};color:${t.ink}`;
}

const BADGES = [
  { group:0, name:'Bất bại V', cond:'Thắng 5 trận liên tiếp', tier:'elite', glyph:'chev', at:'mở 11/09' },
  { group:0, name:'Bất bại X', cond:'Thắng 10 trận liên tiếp', tier:'legend', glyph:'flame', prog:'6 / 10 trận', pct:60 },
  { group:0, name:'Kẻ ngắt chuỗi', cond:'Hạ người đang có chuỗi ≥ 5 trận', tier:'epic', glyph:'bolt', at:'mở 06/09' },
  { group:0, name:'Sát thần đôi', cond:'Đánh bại cặp có tỉ lệ thắng cao nhất CLB', tier:'legend', glyph:'star', prog:'0 / 1 lần', pct:4 },
  { group:0, name:'Trùm giải', cond:'Vô địch giải nội bộ CLB', tier:'legend', glyph:'crown', prog:'giải mở mùa sau', pct:0 },

  { group:1, name:'Chuyên cần 50', cond:'Đi đủ 50 buổi sinh hoạt', tier:'rare', glyph:'shield', at:'mở 04/07' },
  { group:1, name:'Chuyên cần 100', cond:'Đi đủ 100 buổi sinh hoạt', tier:'epic', glyph:'shield', prog:'62 / 100 buổi', pct:62 },
  { group:1, name:'Công thần 1 năm', cond:'Gắn bó tròn 1 năm', tier:'rare', glyph:'ring', at:'mở 12/03' },
  { group:1, name:'Công thần 2 năm', cond:'Gắn bó tròn 2 năm', tier:'epic', glyph:'ring', prog:'14 / 24 tháng', pct:58 },
  { group:1, name:'Đại sứ 5', cond:'Rủ được 5 người mới đến giao lưu', tier:'rare', glyph:'star', at:'mở 22/08' },
  { group:1, name:'Đại sứ 10', cond:'Rủ được 10 người mới đến giao lưu', tier:'epic', glyph:'star', prog:'6 / 10 người', pct:60 },
  { group:1, name:'Sổ sạch', cond:'Đóng quỹ đủ 12 tháng liên tục, không nợ 1 ngày', tier:'elite', glyph:'shield', prog:'9 / 12 tháng', pct:75 },

  { group:2, name:'Chuyên gia vồ hụt', cond:'Tự phong · đổi lúc nào cũng được', tier:'fun', glyph:'chev', at:'đang dùng' },
  { group:2, name:'Thánh lau sàn', cond:'Tự phong · đổi lúc nào cũng được', tier:'fun', glyph:'shield', at:'có sẵn' },
  { group:2, name:'Hề chúa sân cầu', cond:'Tự phong · đang gắn ở kệ', tier:'fun', glyph:'crown', at:'đang dùng' },
  { group:2, name:'Chích chòe (cãi cầu)', cond:'Tự phong · đổi lúc nào cũng được', tier:'fun', glyph:'bolt', at:'có sẵn' },
  { group:2, name:'Đại gia đổi vợt', cond:'Tự phong · đổi lúc nào cũng được', tier:'fun', glyph:'star', at:'có sẵn' },

  { group:3, name:'???', cond:'Một hành động đặc biệt trên sân sẽ mở', tier:'hidden', glyph:'shield', locked:true },
  { group:3, name:'???', cond:'Gợi ý: liên quan tới tỷ số ngược dòng', tier:'hidden', glyph:'shield', locked:true },
  { group:3, name:'???', cond:'Gợi ý: chỉ mở vào buổi đột xuất', tier:'hidden', glyph:'shield', locked:true },
  { group:3, name:'???', cond:'Chưa ai trong CLB chạm tới', tier:'hidden', glyph:'shield', locked:true },
  { group:3, name:'???', cond:'Gợi ý: cần đúng một người đồng hành', tier:'hidden', glyph:'shield', locked:true }
];

const GROUPS = [
  { title:'Chiến thần sân cầu', note:'mở bằng kết quả thi đấu', tone:'elite' },
  { title:'Linh hồn CLB', note:'mở bằng gắn bó và đóng góp', tone:'rare' },
  { title:'Tấu hài tự phong', note:'10 huy hiệu, không điều kiện — đây là 5 cái đầu', tone:'fun' },
  { title:'Danh hiệu ẩn', note:'chỉ sáng lên khi làm được, không có gợi ý đầy đủ', tone:'hidden' }
];

const STREAK = ['T','T','T','T','T','T','','','',''];

const BOUNTIES = [
  { name:'Minh', meta:'đơn · chuỗi mở từ 04/09', streak:6, xp:'+100 XP', sp:'+15 Điểm mùa', tries:'2 người', hot:true, tier:'legend', glyph:'flame' },
  { name:'Hà', meta:'đơn · chuỗi mở từ 06/09', streak:5, xp:'+100 XP', sp:'+15 Điểm mùa', tries:'0 người', hot:true, tier:'legend', glyph:'flame' },
  { name:'Cặp Tuấn – Vũ', meta:'đôi · tỉ lệ thắng 72% mùa này', streak:4, xp:'+80 XP', sp:'+12 Điểm mùa', tries:'1 cặp', tier:'epic', glyph:'bolt' },
  { name:'Cặp Nam – Sơn', meta:'đôi · vừa chạm mốc tối qua', streak:4, xp:'+80 XP', sp:'+12 Điểm mùa', tries:'0 cặp', tier:'epic', glyph:'bolt' }
];

const RULES = [
  'Chuỗi chạm 4 trận là tự động bị treo thưởng, không cần ai bấm gì.',
  'Bounty tắt ngay khi chuỗi bị ngắt, hoặc khi mùa kết thúc.',
  'Người bị treo không mất gì cả — thắng tiếp thì chuỗi dài thêm, thưởng treo cao hơn.',
  'Chỉ trận có ghi tỷ số mới ngắt được chuỗi. Kèo và trận chia sân tính như nhau.',
  'Elo tính theo chênh lệch trình độ như mọi trận khác. Bounty chỉ trả XP và Điểm mùa.'
];

const BOUNTY_BADGES = [
  { name:'Kẻ Săn Tiền Thưởng', cond:'Ngắt chuỗi của một bounty đang mở', tier:'legend', glyph:'bolt' },
  { name:'Sát Thần', cond:'Ngắt 3 bounty khác nhau trong cùng một mùa', tier:'legend', glyph:'flame' }
];

const COLLECTORS = [
  { name:'Minh', signature:'Hề chúa sân cầu', count:21, score:'1.480', dist:[42,28,18,12], shelf:[['legend','flame'],['epic','bolt'],['fun','crown']] },
  { name:'Tuấn', signature:'Đại gia đổi vợt', count:18, score:'1.290', dist:[26,32,26,16], shelf:[['legend','star'],['elite','chev'],['fun','star']] },
  { name:'Hà', signature:'Thánh lau sàn', count:16, score:'1.120', dist:[18,30,32,20], shelf:[['epic','ring'],['elite','shield'],['fun','shield']] },
  { name:'Vũ', signature:'Chích chòe (cãi cầu)', count:14, score:'980', dist:[12,26,36,26], shelf:[['epic','bolt'],['rare','star'],['fun','bolt']] },
  { name:'Sơn', signature:'chưa chọn', count:12, score:'840', dist:[0,24,40,36], shelf:[['elite','chev'],['rare','shield'],['hidden','shield']] },
  { name:'Tấu', signature:'Chuyên gia vồ hụt', count:11, score:'760', dist:[0,18,38,44], shelf:[['rare','ring'],['fun','chev'],['hidden','shield']] }
];

const RAREST = [
  { name:'Trùm giải', tier:'legend', glyph:'crown', own:'chưa ai mở' },
  { name:'Sát thần đôi', tier:'legend', glyph:'star', own:'1 / 24' },
  { name:'Bất bại X', tier:'legend', glyph:'flame', own:'2 / 24' },
  { name:'Sổ sạch', tier:'elite', glyph:'shield', own:'4 / 24' }
];

const SEASON_ROWS = [
  { rank:1, name:'Minh', sessions:'11', wl:'34 / 12', pts:'412', bounty:'chuỗi 6', shelf:[['legend','flame'],['epic','bolt'],['fun','crown']] },
  { rank:2, name:'Tuấn', sessions:'12', wl:'30 / 16', pts:'386', shelf:[['legend','star'],['elite','chev'],['fun','star']] },
  { rank:3, name:'Hà', sessions:'10', wl:'27 / 14', pts:'340', bounty:'chuỗi 5', shelf:[['epic','ring'],['elite','shield'],['fun','shield']] },
  { rank:4, name:'Vũ', sessions:'11', wl:'24 / 19', pts:'318', shelf:[['epic','bolt'],['rare','star'],['fun','bolt']] },
  { rank:5, name:'Sơn', sessions:'9', wl:'19 / 18', pts:'274', shelf:[['elite','chev'],['rare','shield']] }
];

const ELO_ROWS = [
  { rank:1, name:'Minh', cls:'TB+', matches:'46', trend:'+34', elo:'1.612', top:['legend','flame'], topName:'Bất bại X' },
  { rank:2, name:'Tuấn', cls:'TB+', matches:'46', trend:'+12', elo:'1.548', top:['legend','star'], topName:'Sát thần đôi' },
  { rank:3, name:'Hà', cls:'TB', matches:'41', trend:'+21', elo:'1.486', top:['epic','ring'], topName:'Công thần 2 năm' },
  { rank:4, name:'Vũ', cls:'TB', matches:'43', trend:'−8', elo:'1.441', top:['epic','bolt'], topName:'Kẻ ngắt chuỗi' },
  { rank:5, name:'Sơn', cls:'TB−', matches:'37', trend:'+4', elo:'1.388', top:['elite','chev'], topName:'Bất bại V' }
];

const SCORING = [
  { tier:'legend', label:'Huyền thoại' },
  { tier:'epic', label:'Sử thi' },
  { tier:'elite', label:'Tinh anh' },
  { tier:'rare', label:'Hiếm' },
  { tier:'fun', label:'Tấu hài tự phong' }
];

class Component extends DCLogic {
  renderVals() {
    const p = this.props;
    const showHidden = p.showHidden ?? true;
    const slots = Math.max(1, Math.min(3, p.shelfSlots ?? 3));

    const list = BADGES.filter(b => showHidden || b.tier !== 'hidden');

    const groups = GROUPS.map((g, gi) => {
      const items = list.filter(b => b.group === gi);
      const opened = items.filter(b => b.at).length;
      return {
        title: g.title,
        note: g.note,
        count: g.tone === 'fun' ? items.length + ' / 10' : opened + ' / ' + items.length,
        countChip: tierChip(g.tone, 10.5),
        badges: items.map(b => {
          const t = T[b.tier];
          const m = med(b.tier, b.glyph, 84);
          return {
            ...m,
            name: b.name,
            cond: b.cond,
            tier: t.name,
            locked: !!b.locked,
            owned: !!b.at,
            ownedAt: b.at,
            hasBar: !!b.prog,
            prog: b.prog,
            pct: b.pct,
            tierChip: tierChip(b.tier, 10.5),
            nameStyle: `font:600 14px/1.3 ${SANS};text-align:center;color:${b.locked ? '#8494AA' : '#E9EFF7'}`,
            progStyle: `font:400 11.5px/1.2 ${MONO};color:${t.ink}`,
            barStyle: `width:${b.pct || 0}%;background:linear-gradient(90deg,${t.g3},${t.g2})`,
            cardStyle: 'display:flex;flex-direction:column;align-items:center;gap:11px;padding:16px 14px 15px;border-radius:12px;'
              + `background:${t.cardBg};border:1px ${t.dashed ? 'dashed' : 'solid'} ${t.cardBd}`
              + (b.tier === 'legend' ? ';box-shadow:0 10px 28px rgba(255,88,20,.14)' : '')
          };
        })
      };
    });

    const shelfSrc = [['elite','chev','Bất bại V','Tinh anh'],['epic','bolt','Kẻ ngắt chuỗi','Sử thi'],['fun','crown','Hề chúa sân cầu','Tự phong']];
    const shelf = shelfSrc.slice(0, slots).map(([tier, glyph, name]) => ({
      ...med(tier, glyph, 58),
      name, tier: T[tier].name,
      tierChip: tierChip(tier, 10),
      slotStyle: 'display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:10px;'
        + `background:#0F1828;border:1px solid ${T[tier].chipBd}`
    }));

    const mini = arr => arr.map(([tier, glyph]) => med(tier, glyph, 26));

    return {
      ...animeVals(p),
      showBanner: p.showBountyBanner ?? true,

      tiers: Object.keys(T).map(k => ({
        ...med(k, k === 'legend' ? 'flame' : k === 'epic' ? 'star' : k === 'elite' ? 'chev' : k === 'rare' ? 'shield' : k === 'fun' ? 'crown' : 'shield', 46),
        name: T[k].name,
        note: T[k].note,
        nameStyle: `font:600 13.5px/1.2 ${SANS};color:${T[k].ink}`
      })),

      groups,
      shelf,

      streak: STREAK.map((s, i) => ({
        label: s || (i + 1),
        cellStyle: 'flex:1;height:40px;border-radius:8px;display:grid;place-items:center;'
          + `font:600 14px/1 ${MONO};`
          + (s
            ? 'background:linear-gradient(165deg,#33110A,#1C0702);border:1px solid #8A3A0E;color:#FFB25E'
            : 'background:#0F1828;border:1px dashed #2E3E5C;color:#4E5C72')
      })),

      conditions: [
        { ok:true, text:'Thắng liên tiếp trong cùng một mùa', val:'6 / 10' },
        { ok:true, text:'Trận phải có ghi tỷ số đầy đủ', val:'đủ' },
        { ok:false, text:'Không có trận thua xen giữa', val:'đang giữ' },
        { ok:false, text:'Ít nhất 3 đối thủ khác nhau trong chuỗi', val:'4 người' }
      ].map(c => ({
        text: c.text, val: c.val,
        mark: c.ok ? '✓' : '·',
        markStyle: 'width:22px;height:22px;flex:0 0 auto;border-radius:999px;display:grid;place-items:center;'
          + `font:600 12px/1 ${SANS};`
          + (c.ok ? 'background:rgba(95,217,162,.16);border:1px solid #2F6B45;color:#5FD9A2'
                  : 'background:#141D2E;border:1px solid #2E3E5C;color:#8494AA'),
        valStyle: `flex:0 0 auto;font:600 13px/1 ${MONO};color:${c.ok ? '#5FD9A2' : '#A8B7CB'}`
      })),

      owners: [
        { initial:'M', name:'Minh', note:'chuỗi 11 trận · mùa 2', at:'18/04' },
        { initial:'T', name:'Tuấn', note:'chuỗi 10 trận · mùa 3', at:'02/08' }
      ],

      chasers: [
        { rank:1, name:'Bạn', val:'6', pct:60, ink:'#FFB25E' },
        { rank:2, name:'Hà', val:'5', pct:50, ink:'#FFB25E' },
        { rank:3, name:'Vũ', val:'3', pct:30, ink:'#8FC2FF' },
        { rank:4, name:'Sơn', val:'2', pct:20, ink:'#8FC2FF' }
      ].map(c => ({
        rank: c.rank, name: c.name, val: c.val,
        barStyle: `width:${c.pct}%;background:linear-gradient(90deg,#8A3A0E,${c.ink})`
      })),

      bounties: BOUNTIES.map(b => ({
        ...med(b.tier, b.glyph, 44),
        name: b.name, meta: b.meta, xp: b.xp, sp: b.sp, tries: b.tries,
        streak: b.streak + ' trận',
        rowStyle: 'background:#141D2E;padding:13px 15px;display:grid;grid-template-columns:minmax(0,1.5fr) 92px 150px 116px 108px;gap:12px;align-items:center'
          + (b.hot ? ';box-shadow:inset 3px 0 0 #FF6A00' : ''),
        streakStyle: `text-align:right;font:600 14px/1 ${MONO};color:${b.hot ? '#FFB25E' : '#A8B7CB'}`,
        cta: b.hot ? 'Gạ kèo ngay' : 'Gạ kèo',
        ctaStyle: 'text-align:center;border-radius:7px;padding:10px 12px;'
          + `font:600 12.5px/1 ${SANS};`
          + (b.hot
            ? 'color:#1C0702;background:linear-gradient(135deg,#FFD166,#FF8A3D)'
            : 'color:#E9EFF7;background:#1A2437;border:1px solid #2E3E5C')
      })),

      rules: RULES,

      bountyBadges: BOUNTY_BADGES.map(b => ({
        ...med(b.tier, b.glyph, 52),
        name: b.name, cond: b.cond, tier: T[b.tier].name, tierChip: tierChip(b.tier, 10)
      })),

      collectors: COLLECTORS.map((c, i) => {
        const keys = ['legend','epic','elite','rare'];
        return {
          rank: i + 1,
          initial: c.name.slice(0, 1),
          name: c.name,
          signature: c.signature === 'chưa chọn' ? 'chưa chọn chữ ký' : '“' + c.signature + '”',
          count: c.count,
          score: c.score,
          shelf: mini(c.shelf),
          dist: c.dist.map((v, k) => `width:${v}%;background:${T[keys[k]].g2}`),
          distLabel: c.dist.map((v, k) => T[keys[k]].name.toLowerCase() + ' ' + v + '%').slice(0, 2).join(' · '),
          rowStyle: 'background:#141D2E;padding:12px 15px;display:grid;grid-template-columns:44px minmax(0,1fr) 190px 96px 116px;gap:12px;align-items:center'
            + (i === 0 ? ';box-shadow:inset 3px 0 0 #FF6A00' : ''),
          rankStyle: `font:600 15px/1 ${MONO};color:${i === 0 ? '#FFB25E' : i < 3 ? '#E9EFF7' : '#5B6B81'}`,
          scoreStyle: `text-align:right;font:600 15px/1 ${MONO};color:${i === 0 ? '#FFB25E' : '#E9EFF7'}`
        };
      }),

      rarest: RAREST.map(r => ({
        ...med(r.tier, r.glyph, 34),
        name: r.name, own: r.own,
        ownStyle: `flex:0 0 auto;font:600 12px/1 ${MONO};color:${r.own === 'chưa ai mở' ? '#FFB25E' : '#A8B7CB'}`
      })),

      scoring: SCORING.map(s => ({
        label: s.label,
        pts: T[s.tier].pts === 0 ? '0 đ' : T[s.tier].pts + ' đ',
        dot: `width:9px;height:9px;flex:0 0 auto;border-radius:999px;background:${T[s.tier].g2}`
      })),

      seasonRows: SEASON_ROWS.map((r, i) => ({
        rank: r.rank,
        initial: r.name.slice(0, 1),
        name: r.name,
        sessions: r.sessions,
        wl: r.wl,
        pts: r.pts,
        bounty: !!r.bounty,
        bountyLabel: r.bounty,
        shelf: mini(r.shelf).slice(0, slots),
        rowStyle: 'background:#141D2E;padding:12px 15px;display:grid;grid-template-columns:44px minmax(0,1fr) 104px 96px 108px;gap:12px;align-items:center'
          + (r.bounty ? ';box-shadow:inset 3px 0 0 #FF6A00' : ''),
        rankStyle: `font:600 15px/1 ${MONO};color:${i < 3 ? '#E9EFF7' : '#5B6B81'}`,
        ptsStyle: `text-align:right;font:600 15px/1 ${MONO};color:${i === 0 ? '#5FDBD3' : '#E9EFF7'}`
      })),

      eloRows: ELO_ROWS.map((r, i) => ({
        rank: r.rank,
        initial: r.name.slice(0, 1),
        name: r.name,
        matches: r.matches,
        trend: r.trend,
        elo: r.elo,
        topName: r.topName,
        top: med(r.top[0], r.top[1], 26),
        class: r.cls,
        classChip: `display:inline-flex;align-items:center;font:600 12px/1 ${MONO};padding:5px 9px;border-radius:6px;background:#1A2437;border:1px solid #2E3E5C;color:#A8B7CB`,
        rowStyle: 'background:#141D2E;padding:12px 15px;display:grid;grid-template-columns:44px minmax(0,1fr) 120px 96px 96px 108px;gap:12px;align-items:center',
        rankStyle: `font:600 15px/1 ${MONO};color:${i < 3 ? '#E9EFF7' : '#5B6B81'}`,
        trendStyle: `text-align:right;font:600 13.5px/1 ${MONO};color:${r.trend.indexOf('−') === 0 ? '#FF8578' : '#5FD9A2'}`
      }))
    };
  }
}


/* ═══════════ ANIME VARIANT (2a) ═══════════ */
const ADISP = 'Oswald, sans-serif';
const AUI = "'Be Vietnam Pro', sans-serif";

const AT = {
  legend: { name:'HUYỀN THOẠI', note:'hào quang · vòng xoay', pts:120,
    ring:'conic-gradient(from 200deg,#FF2E7E,#FF7A18,#FFE24B,#FFFFFF,#FF7A18,#FF2E7E)',
    core:'radial-gradient(120% 120% at 50% 8%,#4A0718,#140109 72%)',
    ink:'#FFC46B', g1:'#FFFBEA', g2:'#FFB03A', g3:'#FF2E7E',
    edge:'linear-gradient(135deg,#FF2E7E,#FFE24B 70%)', bd:'#FF2E7E',
    panel:'linear-gradient(160deg,#2B0617,#110208)', chipBg:'rgba(255,46,126,.18)',
    aura:'rgba(255,46,126,.55)', spin:true },
  epic: { name:'SỬ THI', note:'tím · xung năng lượng', pts:60,
    ring:'conic-gradient(from 200deg,#6D14FF,#C04BFF,#FF6BE0,#FFFFFF,#C04BFF,#6D14FF)',
    core:'radial-gradient(120% 120% at 50% 8%,#2C0658,#10021F 72%)',
    ink:'#D9A8FF', g1:'#FBF0FF', g2:'#C878FF', g3:'#6D14FF',
    edge:'linear-gradient(135deg,#6D14FF,#FF6BE0 70%)', bd:'#8B2BFF',
    panel:'linear-gradient(160deg,#1E0740,#0E0220)', chipBg:'rgba(139,43,255,.18)',
    aura:'rgba(192,75,255,.45)' },
  elite: { name:'TINH ANH', note:'lam · lưỡi sáng', pts:30,
    ring:'conic-gradient(from 200deg,#0B63FF,#2EE9FF,#D6FEFF,#FFFFFF,#2EE9FF,#0B63FF)',
    core:'radial-gradient(120% 120% at 50% 8%,#032C5E,#01101F 72%)',
    ink:'#7FE7FF', g1:'#EEFDFF', g2:'#55D8FF', g3:'#0B63FF',
    edge:'linear-gradient(135deg,#0B63FF,#2EE9FF 70%)', bd:'#1B7BE0',
    panel:'linear-gradient(160deg,#07203F,#020C1B)', chipBg:'rgba(46,233,255,.14)',
    aura:'rgba(46,233,255,.42)' },
  rare: { name:'HIẾM', note:'ngọc lục · thương hiệu', pts:15,
    ring:'conic-gradient(from 200deg,#00776B,#2EE9C0,#E3FFF8,#FFFFFF,#2EE9C0,#00776B)',
    core:'radial-gradient(120% 120% at 50% 8%,#02332C,#01130F 72%)',
    ink:'#5FEBD0', g1:'#F0FFFB', g2:'#35D8BC', g3:'#00776B',
    edge:'linear-gradient(135deg,#00776B,#2EE9C0 70%)', bd:'#0E9F8E',
    panel:'linear-gradient(160deg,#042925,#010F0D)', chipBg:'rgba(46,233,192,.14)',
    aura:'rgba(46,233,192,.38)' },
  fun: { name:'TỰ PHONG', note:'vàng · 0 điểm sưu tập', pts:0,
    ring:'conic-gradient(from 200deg,#B77400,#FFE24B,#FFF9D6,#FFFFFF,#FFE24B,#B77400)',
    core:'radial-gradient(120% 120% at 50% 8%,#3A2600,#140D00 72%)',
    ink:'#FFD95E', g1:'#FFFDF0', g2:'#FFD03A', g3:'#B77400',
    edge:'linear-gradient(135deg,#B77400,#FFE24B 70%)', bd:'#C98E12',
    panel:'linear-gradient(160deg,#2A1D02,#120C00)', chipBg:'rgba(255,226,75,.14)',
    aura:'rgba(255,226,75,.36)' },
  hidden: { name:'ẨN', note:'??? tới khi mở', pts:0,
    ring:'repeating-conic-gradient(from 0deg,#3B2560 0deg 12deg,#160B26 12deg 24deg)',
    core:'radial-gradient(120% 120% at 50% 8%,#1B1030,#0A0514 72%)',
    ink:'#9C8ABE', g1:'#6B5C8C', g2:'#4A3B6B', g3:'#2A1B45',
    edge:'linear-gradient(135deg,#3B2560,#6B5C8C 70%)', bd:'#3B2560',
    panel:'linear-gradient(160deg,#150C24,#0A0512)', chipBg:'rgba(107,92,140,.16)',
    aura:'rgba(107,92,140,.28)', dim:true }
};

const AG = {
  flame:  'polygon(50% 0%,72% 26%,62% 40%,84% 34%,74% 62%,92% 76%,50% 100%,8% 76%,26% 62%,16% 34%,38% 40%,28% 26%)',
  shuriken:'polygon(50% 0%,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0% 50%,39% 39%)',
  wing:   'polygon(0% 100%,10% 52%,36% 62%,42% 26%,68% 40%,76% 6%,100% 22%,64% 96%)',
  crystal:'polygon(50% 0%,100% 34%,74% 100%,26% 100%,0% 34%)',
  thunder:'polygon(58% 0%,14% 56%,44% 56%,32% 100%,86% 40%,52% 40%)',
  horn:   'polygon(0% 100%,4% 18%,26% 54%,50% 0%,74% 54%,96% 18%,100% 100%,76% 74%,50% 88%,24% 74%)',
  moon:   'polygon(50% 0%,86% 16%,100% 50%,86% 84%,50% 100%,72% 78%,78% 50%,72% 22%)',
  fang:   'polygon(14% 0%,86% 0%,74% 40%,58% 100%,50% 56%,42% 100%,26% 40%)',
  eye:    'polygon(0% 50%,26% 16%,50% 6%,74% 16%,100% 50%,74% 84%,50% 94%,26% 84%)',
  blossom:'polygon(50% 2%,68% 20%,92% 20%,88% 46%,98% 72%,72% 78%,50% 98%,28% 78%,2% 72%,12% 46%,8% 20%,32% 20%)',
  skull:  'polygon(20% 0%,80% 0%,100% 24%,100% 56%,78% 68%,80% 100%,62% 84%,50% 100%,38% 84%,20% 100%,22% 68%,0% 56%,0% 24%)'
};
const AGMAP = { flame:'flame', chev:'wing', shield:'crystal', crown:'horn', bolt:'thunder', star:'shuriken', ring:'moon' };
const HEX = 'polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)';
const NOTCH = 'polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)';
const NOTCH_S = 'polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)';

function amed(tierKey, glyph, size) {
  const t = AT[tierKey];
  const g = AG[AGMAP[glyph] || glyph] || AG.crystal;
  const pad = size >= 80 ? 3 : size >= 40 ? 2 : 1.5;
  const gh = Math.round(size * 0.40), gw = Math.round(gh * 0.9);
  return {
    box: `position:relative;width:${size}px;height:${size}px;flex:0 0 auto`,
    aura: size >= 40
      ? `position:absolute;inset:-26%;background:radial-gradient(50% 50% at 50% 50%,${t.aura},transparent 72%);animation:aPulse ${t.spin ? 2.8 : 4.2}s ease-in-out infinite;pointer-events:none`
      : 'width:0;height:0',
    frame: `position:absolute;inset:0;clip-path:${HEX};background:${t.ring}`
      + (t.spin && size >= 40 ? ';animation:aSpin 7s linear infinite' : ''),
    core: `position:absolute;inset:${pad}px;clip-path:${HEX};background:${t.core}`,
    glyph: t.dim ? 'width:0;height:0'
      : `width:${gw}px;height:${gh}px;background:linear-gradient(180deg,${t.g1},${t.g2} 52%,${t.g3});clip-path:${g}`
      + (size >= 80 ? ';filter:drop-shadow(0 0 8px ' + t.aura + ')' : ''),
    qmark: t.dim
      ? `position:absolute;inset:0;display:grid;place-items:center;font:700 ${Math.round(size * 0.34)}px/1 ${ADISP};color:#6B5C8C`
      : 'width:0;height:0;overflow:hidden;font-size:0'
  };
}
function atag(tierKey, fs) {
  const t = AT[tierKey];
  return `display:inline-flex;align-items:center;font:600 ${fs || 10}px/1 ${ADISP};letter-spacing:.14em;`
    + `padding:5px 9px;clip-path:${NOTCH_S};background:${t.chipBg};color:${t.ink};border-top:1px solid ${t.bd}`;
}

function animeVals(p) {
  const slots = Math.max(1, Math.min(3, p.shelfSlots ?? 3));
  const showHidden = p.showHidden ?? true;
  const list = BADGES.filter(b => showHidden || b.tier !== 'hidden');
  const mini = arr => arr.map(([tier, glyph]) => amed(tier, glyph, 26));

  return {
    aTiers: Object.keys(AT).map(k => ({
      ...amed(k, k === 'legend' ? 'flame' : k === 'epic' ? 'star' : k === 'elite' ? 'chev' : k === 'rare' ? 'ring' : k === 'fun' ? 'crown' : 'shield', 44),
      name: AT[k].name, note: AT[k].note,
      nameStyle: `font:600 13px/1 ${ADISP};letter-spacing:.12em;color:${AT[k].ink}`
    })),

    aShelf: [['elite','chev','Bất bại V'],['epic','bolt','Kẻ ngắt chuỗi'],['fun','crown','Hề chúa sân cầu']]
      .slice(0, slots).map(([tier, glyph, name], i) => ({
        ...amed(tier, glyph, 54),
        name, tier: AT[tier].name, slot: 'Ô ' + (i + 1),
        tagStyle: atag(tier, 9.5),
        frameStyle: `position:relative;padding:1px;clip-path:${NOTCH};background:${AT[tier].edge}`,
        innerStyle: `clip-path:${NOTCH};background:${AT[tier].panel};padding:12px 14px;display:flex;align-items:center;gap:13px`
      })),

    aGroups: GROUPS.map((g, gi) => {
      const items = list.filter(b => b.group === gi);
      const opened = items.filter(b => b.at).length;
      return {
        title: g.title.toUpperCase(),
        note: g.note,
        count: g.tone === 'fun' ? items.length + ' / 10' : opened + ' / ' + items.length,
        tagStyle: atag(g.tone === 'hidden' ? 'hidden' : g.tone, 10),
        badges: items.map(b => {
          const t = AT[b.tier];
          return {
            ...amed(b.tier, b.glyph, 76),
            name: b.name, cond: b.cond, tier: t.name,
            owned: !!b.at, ownedAt: b.at,
            hasBar: !!b.prog, prog: b.prog,
            tagStyle: atag(b.tier, 9),
            frameStyle: `position:relative;padding:1px;clip-path:${NOTCH};background:${t.edge}`
              + (b.locked ? ';opacity:.72' : ''),
            innerStyle: `position:relative;clip-path:${NOTCH};background:${t.panel};padding:16px 13px 14px;`
              + 'display:flex;flex-direction:column;align-items:center;gap:9px;height:100%',
            nameStyle: `font:700 13.5px/1.25 ${AUI};text-align:center;color:${b.locked ? '#9C8ABE' : '#FFFFFF'}`,
            condStyle: `font:400 11px/1.4 ${AUI};text-align:center;color:#9C8ABE`,
            progStyle: `font:600 11px/1 ${MONO};color:${t.ink}`,
            barTrack: `width:100%;height:5px;clip-path:${NOTCH_S};background:rgba(255,255,255,.08)`,
            barStyle: `height:100%;width:${b.pct || 0}%;background:${t.edge}`
          };
        })
      };
    }),

    aBounties: BOUNTIES.map(b => {
      const t = AT[b.tier];
      return {
        ...amed(b.tier, b.glyph, 62),
        name: b.name, meta: b.meta, xp: b.xp, sp: b.sp, tries: b.tries,
        tier: t.name,
        streak: b.streak, streakTxt: b.streak + ' trận thắng liền',
        tagStyle: atag(b.tier, 9.5),
        frameStyle: `position:relative;padding:1px;clip-path:${NOTCH};background:${t.edge}`,
        innerStyle: `position:relative;overflow:hidden;clip-path:${NOTCH};background:${t.panel};padding:16px 18px 15px;display:grid;gap:12px`,
        rays: `position:absolute;top:-60%;right:-30%;width:420px;height:420px;background:repeating-conic-gradient(from 0deg,${t.aura} 0deg 5deg,transparent 5deg 14deg);animation:aSpinBack 26s linear infinite;opacity:.5;pointer-events:none`,
        barTrack: `flex:1;height:8px;clip-path:${NOTCH_S};background:rgba(255,255,255,.08)`,
        barStyle: `height:100%;width:${b.streak * 10}%;background:${t.edge}`,
        pct: b.streak + ' / 10',
        cta: b.hot ? 'GẠ KÈO NGAY' : 'GẠ KÈO',
        ctaStyle: `text-align:center;padding:11px 16px;clip-path:${NOTCH_S};font:600 12.5px/1 ${ADISP};letter-spacing:.12em;`
          + (b.hot ? `color:#140109;background:${t.edge}` : `color:${t.ink};background:rgba(255,255,255,.06);border-top:1px solid ${t.bd}`)
      };
    }),

    aRules: RULES,

    aConditions: [
      { ok:true, text:'Thắng liên tiếp trong cùng một mùa', val:'6 / 10' },
      { ok:true, text:'Trận phải có ghi tỷ số đầy đủ', val:'đủ' },
      { ok:false, text:'Không có trận thua xen giữa', val:'đang giữ' },
      { ok:false, text:'Ít nhất 3 đối thủ khác nhau trong chuỗi', val:'4 người' }
    ].map(c => ({
      text: c.text, val: c.val, mark: c.ok ? '✓' : '·',
      markStyle: `width:24px;height:24px;flex:0 0 auto;clip-path:${HEX};display:grid;place-items:center;font:700 12px/1 ${ADISP};`
        + (c.ok ? 'background:linear-gradient(135deg,#00776B,#2EE9C0);color:#01130F' : 'background:#241640;color:#9C8ABE'),
      valStyle: `flex:0 0 auto;font:600 12.5px/1 ${MONO};color:${c.ok ? '#5FEBD0' : '#C9B8E6'}`
    })),

    aOwners: [
      { initial:'M', name:'Minh', note:'chuỗi 11 trận · mùa 2', at:'18/04' },
      { initial:'T', name:'Tuấn', note:'chuỗi 10 trận · mùa 3', at:'02/08' }
    ],

    aChasers: [
      { rank:1, name:'Bạn', val:'6', pct:60, me:true },
      { rank:2, name:'Hà', val:'5', pct:50 },
      { rank:3, name:'Vũ', val:'3', pct:30 },
      { rank:4, name:'Sơn', val:'2', pct:20 }
    ].map(c => ({
      rank: c.rank, name: c.name, val: c.val,
      nameStyle: `flex:1;min-width:0;font:${c.me ? 700 : 500} 12.5px/1 ${AUI};color:${c.me ? '#FFE24B' : '#C9B8E6'}`,
      barTrack: `flex:2;height:7px;clip-path:${NOTCH_S};background:rgba(255,255,255,.08)`,
      barStyle: `height:100%;width:${c.pct}%;background:${c.me ? 'linear-gradient(90deg,#FF2E7E,#FFE24B)' : 'linear-gradient(90deg,#6D14FF,#C04BFF)'}`
    })),

    aStreak: STREAK.map((s, i) => ({
      label: s ? 'W' : (i + 1),
      cellStyle: `flex:1;height:44px;clip-path:${NOTCH_S};display:grid;place-items:center;font:700 15px/1 ${ADISP};`
        + (s ? 'background:linear-gradient(165deg,#FF2E7E,#7A0A2E);color:#FFFBEA'
             : 'background:rgba(255,255,255,.05);color:#6B5C8C')
    })),

    aCollectors: COLLECTORS.map((c, i) => {
      const keys = ['legend','epic','elite','rare'];
      const top = i === 0;
      return {
        rank: i + 1, initial: c.name.slice(0, 1), name: c.name,
        signature: c.signature === 'chưa chọn' ? 'chưa chọn chữ ký' : '“' + c.signature + '”',
        count: c.count + ' huy hiệu', score: c.score,
        shelf: mini(c.shelf),
        dist: c.dist.map((v, k) => `width:${v}%;background:${AT[keys[k]].g2}`),
        rowStyle: `position:relative;overflow:hidden;display:grid;grid-template-columns:56px minmax(0,1fr) 176px 104px 128px;gap:14px;align-items:center;padding:13px 16px;clip-path:${NOTCH_S};`
          + (top ? 'background:linear-gradient(100deg,#2B0617,#160B26 60%);border-top:1px solid #FF2E7E'
                 : 'background:rgba(255,255,255,.035)'),
        plateStyle: `width:40px;height:40px;clip-path:${HEX};display:grid;place-items:center;font:700 17px/1 ${ADISP};`
          + (top ? 'background:linear-gradient(135deg,#FF2E7E,#FFE24B);color:#140109'
                 : i < 3 ? 'background:linear-gradient(135deg,#6D14FF,#C04BFF);color:#FBF0FF'
                         : 'background:#241640;color:#9C8ABE'),
        avatarStyle: `width:34px;height:34px;flex:0 0 auto;clip-path:${HEX};display:grid;place-items:center;font:700 14px/1 ${ADISP};background:#241640;color:#C9B8E6`,
        scoreStyle: `text-align:right;font:700 19px/1 ${ADISP};color:${top ? '#FFE24B' : '#FFFFFF'}`,
        sweep: top ? 'position:absolute;top:0;left:0;width:70px;height:100%;background:linear-gradient(90deg,transparent,rgba(255,226,75,.22),transparent);animation:aSweep 5s ease-in-out infinite;pointer-events:none' : 'width:0;height:0'
      };
    }),

    aSeason: SEASON_ROWS.map((r, i) => ({
      rank: r.rank, initial: r.name.slice(0, 1), name: r.name,
      sessions: r.sessions, wl: r.wl, pts: r.pts,
      bounty: !!r.bounty, bountyLabel: r.bounty,
      shelf: mini(r.shelf).slice(0, Math.max(1, Math.min(3, p.shelfSlots ?? 3))),
      rowStyle: `display:grid;grid-template-columns:48px minmax(0,1fr) 112px 104px 116px;gap:13px;align-items:center;padding:12px 16px;clip-path:${NOTCH_S};`
        + (r.bounty ? 'background:linear-gradient(100deg,#2B0617,#160B26 55%);border-top:1px solid #FF2E7E' : 'background:rgba(255,255,255,.035)'),
      plateStyle: `width:34px;height:34px;clip-path:${HEX};display:grid;place-items:center;font:700 15px/1 ${ADISP};`
        + (i < 3 ? 'background:linear-gradient(135deg,#6D14FF,#C04BFF);color:#FBF0FF' : 'background:#241640;color:#9C8ABE'),
      ptsStyle: `text-align:right;font:700 18px/1 ${ADISP};color:${i === 0 ? '#5FEBD0' : '#FFFFFF'}`
    })),

    aElo: ELO_ROWS.map((r, i) => ({
      rank: r.rank, initial: r.name.slice(0, 1), name: r.name,
      matches: r.matches, trend: r.trend, elo: r.elo, topName: r.topName,
      top: amed(r.top[0], r.top[1], 30),
      cls: r.cls,
      clsStyle: `display:inline-flex;align-items:center;font:600 11.5px/1 ${MONO};padding:5px 9px;clip-path:${NOTCH_S};background:rgba(255,255,255,.06);color:#C9B8E6`,
      rowStyle: `display:grid;grid-template-columns:48px minmax(0,1fr) 148px 84px 92px 104px;gap:13px;align-items:center;padding:12px 16px;clip-path:${NOTCH_S};background:rgba(255,255,255,.035)`,
      plateStyle: `width:34px;height:34px;clip-path:${HEX};display:grid;place-items:center;font:700 15px/1 ${ADISP};`
        + (i < 3 ? 'background:linear-gradient(135deg,#0B63FF,#2EE9FF);color:#01101F' : 'background:#241640;color:#9C8ABE'),
      trendStyle: `text-align:right;font:600 13px/1 ${MONO};color:${r.trend.indexOf('−') === 0 ? '#FF7A8F' : '#5FEBD0'}`,
      eloStyle: `text-align:right;font:700 18px/1 ${ADISP};color:#FFFFFF`
    })),

    aRarest: RAREST.map(r => ({
      ...amed(r.tier, r.glyph, 34),
      name: r.name, own: r.own,
      ownStyle: `flex:0 0 auto;font:600 11.5px/1 ${MONO};color:${r.own === 'chưa ai mở' ? '#FFE24B' : '#9C8ABE'}`
    })),

    aScoring: SCORING.map(s => ({
      label: AT[s.tier].name, pts: AT[s.tier].pts + ' đ',
      dot: `width:10px;height:10px;flex:0 0 auto;clip-path:${HEX};background:${AT[s.tier].edge}`
    })),

    aBountyBadges: BOUNTY_BADGES.map(b => {
      const t = AT[b.tier];
      return {
        ...amed(b.tier, b.glyph, 52),
        name: b.name, cond: b.cond, tier: t.name, tagStyle: atag(b.tier, 9.5),
        frameStyle: `position:relative;padding:1px;clip-path:${NOTCH};background:${t.edge}`,
        innerStyle: `clip-path:${NOTCH};background:${t.panel};padding:14px 16px;display:flex;align-items:center;gap:14px`
      };
    }),

    mCollectors: COLLECTORS.map((c, i) => {
      const top = i === 0;
      return {
        rank: i + 1, name: c.name, count: c.count + ' huy hiệu', score: c.score,
        shelf: mini(c.shelf),
        rowStyle: `position:relative;overflow:hidden;display:flex;align-items:center;gap:11px;padding:11px 12px;clip-path:${NOTCH_S};`
          + (top ? 'background:linear-gradient(100deg,#2B0617,#160B26 60%);border-top:1px solid #FF2E7E' : 'background:rgba(255,255,255,.035)'),
        plateStyle: `width:32px;height:32px;flex:0 0 auto;clip-path:${HEX};display:grid;place-items:center;font:700 14px/1 ${ADISP};`
          + (top ? 'background:linear-gradient(135deg,#FF2E7E,#FFE24B);color:#140109'
                 : i < 3 ? 'background:linear-gradient(135deg,#6D14FF,#C04BFF);color:#FBF0FF'
                         : 'background:#241640;color:#9C8ABE'),
        scoreStyle: `flex:0 0 auto;text-align:right;font:700 17px/1 ${ADISP};color:${top ? '#FFE24B' : '#FFFFFF'}`,
        sweep: top ? 'position:absolute;top:0;left:0;width:60px;height:100%;background:linear-gradient(90deg,transparent,rgba(255,226,75,.22),transparent);animation:aSweep 5s ease-in-out infinite;pointer-events:none' : 'width:0;height:0'
      };
    }),

    mSeason: SEASON_ROWS.map((r, i) => ({
      rank: r.rank, name: r.name, wl: r.wl, pts: r.pts,
      bounty: !!r.bounty, bountyLabel: r.bounty,
      shelf: mini(r.shelf).slice(0, Math.max(1, Math.min(3, p.shelfSlots ?? 3))),
      rowStyle: `display:flex;align-items:center;gap:11px;padding:11px 12px;clip-path:${NOTCH_S};`
        + (r.bounty ? 'background:linear-gradient(100deg,#2B0617,#160B26 55%);border-top:1px solid #FF2E7E' : 'background:rgba(255,255,255,.035)'),
      plateStyle: `width:30px;height:30px;flex:0 0 auto;clip-path:${HEX};display:grid;place-items:center;font:700 13px/1 ${ADISP};`
        + (i < 3 ? 'background:linear-gradient(135deg,#6D14FF,#C04BFF);color:#FBF0FF' : 'background:#241640;color:#9C8ABE'),
      ptsStyle: `flex:0 0 auto;text-align:right;font:700 17px/1 ${ADISP};color:${i === 0 ? '#5FEBD0' : '#FFFFFF'}`
    })),

    mElo: ELO_ROWS.map((r, i) => ({
      rank: r.rank, name: r.name, elo: r.elo, trend: r.trend, topName: r.topName,
      top: amed(r.top[0], r.top[1], 26),
      rowStyle: `display:flex;align-items:center;gap:11px;padding:11px 12px;clip-path:${NOTCH_S};background:rgba(255,255,255,.035)`,
      plateStyle: `width:30px;height:30px;flex:0 0 auto;clip-path:${HEX};display:grid;place-items:center;font:700 13px/1 ${ADISP};`
        + (i < 3 ? 'background:linear-gradient(135deg,#0B63FF,#2EE9FF);color:#01101F' : 'background:#241640;color:#9C8ABE'),
      trendStyle: `flex:0 0 auto;font:600 12px/1 ${MONO};color:${r.trend.indexOf('−') === 0 ? '#FF7A8F' : '#5FEBD0'}`,
      eloStyle: `flex:0 0 auto;text-align:right;font:700 17px/1 ${ADISP};color:#FFFFFF`
    })),

    aMGroups: GROUPS.map((g, gi) => {
      const items = list.filter(b => b.group === gi);
      const opened = items.filter(b => b.at).length;
      return {
        title: g.title.toUpperCase(),
        count: g.tone === 'fun' ? items.length + ' / 10' : opened + ' / ' + items.length,
        tagStyle: atag(g.tone === 'hidden' ? 'hidden' : g.tone, 9),
        badges: items.map(b => {
          const t = AT[b.tier];
          return {
            ...amed(b.tier, b.glyph, 52),
            name: b.name, owned: !!b.at, hasBar: !!b.prog, prog: b.prog,
            frameStyle: `padding:1px;clip-path:${NOTCH_S};background:${t.edge}` + (b.locked ? ';opacity:.72' : ''),
            innerStyle: `clip-path:${NOTCH_S};background:${t.panel};padding:11px 8px 10px;display:flex;flex-direction:column;align-items:center;gap:7px;height:100%`,
            nameStyle: `font:700 10.5px/1.25 ${AUI};text-align:center;color:${b.locked ? '#9C8ABE' : '#FFFFFF'}`,
            progStyle: `font:600 9.5px/1 ${MONO};color:${t.ink}`,
            barTrack: 'width:100%;height:4px;background:rgba(255,255,255,.08)',
            barStyle: `height:100%;width:${b.pct || 0}%;background:${t.edge}`
          };
        })
      };
    }),

    aMBounties: BOUNTIES.map(b => {
      const t = AT[b.tier];
      return {
        ...amed(b.tier, b.glyph, 44),
        name: b.name, meta: b.meta, xp: b.xp, sp: b.sp, tier: t.name,
        tagStyle: atag(b.tier, 8.5),
        frameStyle: `padding:1px;clip-path:${NOTCH_S};background:${t.edge}`,
        innerStyle: `position:relative;overflow:hidden;clip-path:${NOTCH_S};background:${t.panel};padding:12px 13px;display:grid;gap:10px`,
        barTrack: 'flex:1;height:6px;background:rgba(255,255,255,.08)',
        barStyle: `height:100%;width:${b.streak * 10}%;background:${t.edge}`,
        pct: b.streak + ' / 10',
        ctaStyle: `text-align:center;padding:10px;clip-path:${NOTCH_S};font:600 11.5px/1 ${ADISP};letter-spacing:.12em;`
          + (b.hot ? `color:#140109;background:${t.edge}` : `color:${t.ink};background:rgba(255,255,255,.06);border-top:1px solid ${t.bd}`)
      };
    }),

    aMCollectors: COLLECTORS.slice(0, 5).map((c, i) => {
      const top = i === 0;
      return {
        rank: i + 1, initial: c.name.slice(0, 1), name: c.name,
        count: c.count + ' huy hiệu', score: c.score,
        shelf: mini(c.shelf).slice(0, 3),
        rowStyle: `display:flex;align-items:center;gap:11px;padding:11px 12px;clip-path:${NOTCH_S};`
          + (top ? 'background:linear-gradient(100deg,#2B0617,#160B26 65%);border-top:1px solid #FF2E7E' : 'background:rgba(255,255,255,.035)'),
        plateStyle: `width:30px;height:30px;flex:0 0 auto;clip-path:${HEX};display:grid;place-items:center;font:700 13px/1 ${ADISP};`
          + (top ? 'background:linear-gradient(135deg,#FF2E7E,#FFE24B);color:#140109'
                 : i < 3 ? 'background:linear-gradient(135deg,#6D14FF,#C04BFF);color:#FBF0FF' : 'background:#241640;color:#9C8ABE'),
        scoreStyle: `flex:0 0 auto;text-align:right;font:700 17px/1 ${ADISP};color:${top ? '#FFE24B' : '#FFFFFF'}`
      };
    }),

    aMSeason: SEASON_ROWS.slice(0, 5).map((r, i) => ({
      rank: r.rank, name: r.name, wl: r.wl, pts: r.pts,
      bounty: !!r.bounty, bountyLabel: r.bounty,
      shelf: mini(r.shelf).slice(0, 3),
      rowStyle: `display:flex;align-items:center;gap:11px;padding:11px 12px;clip-path:${NOTCH_S};`
        + (r.bounty ? 'background:linear-gradient(100deg,#2B0617,#160B26 65%);border-top:1px solid #FF2E7E' : 'background:rgba(255,255,255,.035)'),
      plateStyle: `width:30px;height:30px;flex:0 0 auto;clip-path:${HEX};display:grid;place-items:center;font:700 13px/1 ${ADISP};`
        + (i < 3 ? 'background:linear-gradient(135deg,#6D14FF,#C04BFF);color:#FBF0FF' : 'background:#241640;color:#9C8ABE'),
      ptsStyle: `flex:0 0 auto;text-align:right;font:700 17px/1 ${ADISP};color:${i === 0 ? '#5FEBD0' : '#FFFFFF'}`
    })),

    aTabs: [
      { g:'blossom', label:'Trang chủ' },
      { g:'shuriken', label:'Buổi tập' },
      { g:'flame', label:'Danh hiệu', on:true },
      { g:'thunder', label:'Xếp hạng' },
      { g:'eye', label:'Thêm' }
    ].map(r => ({
      label: r.label,
      wrapStyle: 'flex:1;display:grid;justify-items:center;gap:5px;padding:9px 0 4px',
      iconStyle: `width:28px;height:28px;clip-path:${HEX};display:grid;place-items:center;`
        + (r.on ? 'background:linear-gradient(135deg,#FF2E7E,#FFE24B)' : 'background:rgba(255,255,255,.07)'),
      glyphStyle: `width:12px;height:14px;background:${r.on ? '#140109' : '#9C8ABE'};clip-path:${AG[r.g]}`,
      labelStyle: `font:600 8.5px/1 ${ADISP};letter-spacing:.08em;color:${r.on ? '#FFE24B' : '#7E6FA0'}`
    })),

    aRail: [
      { g:'blossom', label:'Trang chủ' },
      { g:'shuriken', label:'Buổi tập' },
      { g:'crystal', label:'Công nợ' },
      { g:'flame', label:'Danh hiệu', on:true },
      { g:'thunder', label:'Xếp hạng' },
      { g:'eye', label:'Thêm' }
    ].map(r => ({
      label: r.label,
      iconStyle: `width:30px;height:30px;clip-path:${HEX};display:grid;place-items:center;`
        + (r.on ? 'background:linear-gradient(135deg,#FF2E7E,#FFE24B)' : 'background:rgba(255,255,255,.07)'),
      glyphStyle: `width:13px;height:15px;background:${r.on ? '#140109' : '#9C8ABE'};clip-path:${AG[r.g]}`,
      labelStyle: `font:600 8.5px/1 ${ADISP};letter-spacing:.1em;text-align:center;color:${r.on ? '#FFE24B' : '#7E6FA0'}`
    }))
  };
}
