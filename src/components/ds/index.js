// TDMS Design System — trích từ _ds_bundle.js của handoff (chỉ 29 component, bỏ demo ui_kits).
// Không sửa tay trong file này; tokens ở ./tokens/*.css.
import React from 'react'
import { ICONS } from '#components/ds/icons.js'

const __ds_scope = {}
const __ds_ns = { __errors: [] }


// components/core/Icon.jsx — bỏ: bản CDN cũ, thay bằng lucide-react ở cuối file.

// components/data/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Avatar({
  name = '',
  src,
  size = 32,
  status,
  square,
  style,
  ...rest
}) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const dot = {
    online: 'var(--status-delivered)',
    driving: 'var(--teal-500)',
    off: 'var(--gray-400)',
    alert: 'var(--status-incident)'
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      position: 'relative',
      display: 'inline-flex',
      flex: '0 0 auto',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: square ? 'var(--radius-sm)' : '50%',
      overflow: 'hidden',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: src ? 'var(--surface-sunken)' : 'var(--navy-100)',
      color: 'var(--navy-700)',
      font: `600 ${Math.round(size * 0.38)}px/1 var(--font-sans)`,
      letterSpacing: '0.02em'
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials), status && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: -1,
      bottom: -1,
      width: Math.max(8, size * 0.28),
      height: Math.max(8, size * 0.28),
      borderRadius: '50%',
      background: dot[status],
      border: '2px solid var(--surface-card)'
    }
  }));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  neutral: ['var(--gray-100)', 'var(--gray-700)'],
  brand: ['var(--navy-100)', 'var(--navy-700)'],
  accent: ['var(--teal-100)', 'var(--teal-800)'],
  success: ['var(--green-100)', 'var(--green-600)'],
  warning: ['var(--amber-100)', 'var(--amber-600)'],
  danger: ['var(--red-100)', 'var(--red-600)']
};
function Badge({
  children,
  tone = 'neutral',
  variant = 'soft',
  count,
  style,
  ...rest
}) {
  const [bg, fg] = TONES[tone] || TONES.neutral;
  const solid = variant === 'solid';
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: count != null ? 20 : undefined,
      height: 20,
      padding: '0 7px',
      borderRadius: 'var(--radius-chip)',
      background: solid ? fg : bg,
      color: solid ? '#fff' : fg,
      font: '600 var(--text-2xs)/1 var(--font-sans)',
      letterSpacing: '0.01em',
      ...style
    }
  }, rest), count != null ? count : children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  title,
  subtitle,
  icon,
  actions,
  footer,
  padding = 'var(--pad-card)',
  elevation = 'sm',
  accent,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("section", _extends({
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-card)',
      boxShadow: elevation === 'none' ? 'none' : `var(--shadow-${elevation})`,
      borderTop: accent ? `3px solid ${accent}` : undefined,
      overflow: 'hidden',
      ...style
    }
  }, rest), (title || actions) && /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      justifyContent: 'space-between',
      padding: '14px var(--pad-card)',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      minWidth: 0
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 17,
    style: {
      color: 'var(--text-muted)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      font: 'var(--type-h3)',
      color: 'var(--text-primary)'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, subtitle))), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, actions)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding
    }
  }, children), footer && /*#__PURE__*/React.createElement("footer", {
    style: {
      padding: '12px var(--pad-card)',
      borderTop: '1px solid var(--border-subtle)',
      background: 'var(--surface-inset)'
    }
  }, footer));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Card.jsx", error: String((e && e.message) || e) }); }

// components/data/DataTable.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function DataTable({
  columns = [],
  rows = [],
  onRowClick,
  selectedId,
  rowKey = 'id',
  dense,
  emptyLabel = 'No records',
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(null);
  const h = dense ? 40 : 'var(--row-h)';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width: '100%',
      overflowX: 'auto',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      tableLayout: 'auto'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 1,
      textAlign: c.align || 'left',
      padding: '0 14px',
      height: 38,
      background: 'var(--surface-inset)',
      borderBottom: '1px solid var(--border-subtle)',
      font: 'var(--type-overline)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap',
      width: c.width
    }
  }, c.header)))), /*#__PURE__*/React.createElement("tbody", null, rows.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: columns.length,
    style: {
      padding: 28,
      textAlign: 'center',
      font: 'var(--type-body)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "inbox",
    size: 20,
    style: {
      display: 'block',
      margin: '0 auto 8px'
    }
  }), emptyLabel)), rows.map((row, i) => {
    const id = row[rowKey] ?? i;
    const isSel = selectedId != null && selectedId === id;
    return /*#__PURE__*/React.createElement("tr", {
      key: id,
      onMouseEnter: () => setHover(id),
      onMouseLeave: () => setHover(null),
      onClick: onRowClick ? () => onRowClick(row) : undefined,
      style: {
        height: h,
        cursor: onRowClick ? 'pointer' : 'default',
        background: isSel ? 'var(--surface-brand-soft)' : hover === id ? 'var(--surface-inset)' : 'transparent',
        transition: 'background-color var(--dur-fast) var(--ease-standard)',
        boxShadow: isSel ? 'inset 2px 0 0 var(--navy-600)' : 'none'
      }
    }, columns.map(c => /*#__PURE__*/React.createElement("td", {
      key: c.key,
      style: {
        padding: '0 14px',
        textAlign: c.align || 'left',
        borderBottom: '1px solid var(--border-subtle)',
        font: c.mono ? 'var(--type-mono)' : 'var(--type-body)',
        letterSpacing: c.mono ? 'var(--tracking-wide)' : 0,
        color: c.muted ? 'var(--text-secondary)' : 'var(--text-primary)',
        whiteSpace: c.wrap ? 'normal' : 'nowrap'
      }
    }, c.render ? c.render(row) : row[c.key])));
  }))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/data/EmptyState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  compact,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 10,
      padding: compact ? '28px 20px' : '52px 24px',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: compact ? 40 : 52,
      height: compact ? 40 : 52,
      borderRadius: 'var(--radius-lg)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surface-brand-soft)',
      color: 'var(--navy-600)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: compact ? 20 : 26
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      font: 'var(--type-h3)',
      color: 'var(--text-primary)'
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body)',
      color: 'var(--text-muted)',
      maxWidth: 380
    }
  }, description), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, action));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/data/ProgressBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ProgressBar({
  value = 0,
  max = 100,
  label,
  valueLabel,
  tone = 'accent',
  height = 8,
  style,
  ...rest
}) {
  const pct = Math.max(0, Math.min(100, value / max * 100));
  const colors = {
    accent: 'var(--teal-500)',
    brand: 'var(--navy-600)',
    warning: 'var(--status-delayed)',
    danger: 'var(--status-incident)',
    success: 'var(--status-delivered)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, rest), (label || valueLabel) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 10,
      font: 'var(--type-caption)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-primary)',
      fontWeight: 600,
      fontFamily: 'var(--font-mono)'
    }
  }, valueLabel)), /*#__PURE__*/React.createElement("div", {
    role: "progressbar",
    "aria-valuenow": value,
    "aria-valuemax": max,
    style: {
      height,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--surface-sunken)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${pct}%`,
      height: '100%',
      borderRadius: 'var(--radius-pill)',
      background: colors[tone],
      transition: 'width var(--dur-slow) var(--ease-standard)'
    }
  })));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function StatCard({
  label,
  value,
  unit,
  delta,
  deltaDirection = 'up',
  icon,
  tone = 'neutral',
  caption,
  style,
  ...rest
}) {
  const tones = {
    neutral: 'var(--navy-700)',
    accent: 'var(--teal-600)',
    positive: 'var(--status-delivered)',
    warning: 'var(--status-delayed)',
    critical: 'var(--status-incident)'
  };
  const good = deltaDirection === 'up';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: 'var(--pad-card)',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-xs)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-overline)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 17,
    style: {
      color: tones[tone]
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-metric)',
      color: tones[tone],
      letterSpacing: 'var(--tracking-display)'
    }
  }, value), unit && /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 var(--text-sm)/1 var(--font-sans)',
      color: 'var(--text-muted)'
    }
  }, unit)), (delta || caption) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, delta && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      color: good ? 'var(--status-delivered)' : 'var(--status-incident)',
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: good ? 'trending-up' : 'trending-down',
    size: 14
  }), delta), caption));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/data/StatusPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STATUS = {
  scheduled: {
    label: 'Scheduled',
    icon: 'calendar-clock'
  },
  assigned: {
    label: 'Assigned',
    icon: 'user-round-check'
  },
  loading: {
    label: 'Loading',
    icon: 'package-open'
  },
  transit: {
    label: 'In transit',
    icon: 'truck'
  },
  arrived: {
    label: 'At stop',
    icon: 'map-pin'
  },
  delivered: {
    label: 'Delivered',
    icon: 'circle-check'
  },
  delayed: {
    label: 'Delayed',
    icon: 'clock-alert'
  },
  incident: {
    label: 'Incident',
    icon: 'triangle-alert'
  },
  cancelled: {
    label: 'Cancelled',
    icon: 'circle-x'
  },
  idle: {
    label: 'Idle',
    icon: 'circle-pause'
  }
};
const TOKEN = {
  scheduled: 'scheduled',
  assigned: 'scheduled',
  loading: 'transit',
  transit: 'transit',
  arrived: 'transit',
  delivered: 'delivered',
  delayed: 'delayed',
  incident: 'incident',
  cancelled: 'idle',
  idle: 'idle'
};
function StatusPill({
  status = 'transit',
  label,
  size = 'md',
  dot,
  style,
  ...rest
}) {
  const meta = STATUS[status] || STATUS.idle;
  const t = TOKEN[status] || 'idle';
  const sm = size === 'sm';
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: sm ? 5 : 6,
      height: sm ? 22 : 26,
      padding: sm ? '0 8px' : '0 10px',
      borderRadius: 'var(--radius-chip)',
      background: `var(--status-${t}-bg)`,
      color: `var(--status-${t}-fg)`,
      font: `600 ${sm ? 'var(--text-2xs)' : 'var(--text-xs)'}/1 var(--font-sans)`,
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), dot ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: `var(--status-${t})`
    }
  }) : /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: meta.icon,
    size: sm ? 12 : 14
  }), label || meta.label);
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/data/StatusTimeline.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function StatusTimeline({
  steps = [],
  style,
  ...rest
}) {
  const color = s => s.state === 'done' ? 'var(--status-delivered)' : s.state === 'current' ? 'var(--teal-500)' : s.state === 'issue' ? 'var(--status-incident)' : 'var(--gray-300)';
  return /*#__PURE__*/React.createElement("ol", _extends({
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'grid',
      gap: 0,
      ...style
    }
  }, rest), steps.map((s, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      display: 'grid',
      gridTemplateColumns: '24px 1fr',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 24,
      height: 24,
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: s.state === 'todo' ? 'var(--surface-sunken)' : color(s),
      color: s.state === 'todo' ? 'var(--text-muted)' : '#fff',
      flex: '0 0 auto',
      boxShadow: s.state === 'current' ? '0 0 0 4px var(--surface-accent-soft)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: s.icon || (s.state === 'done' ? 'check' : s.state === 'issue' ? 'triangle-alert' : 'circle'),
    size: 13
  })), i < steps.length - 1 && /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      width: 2,
      minHeight: 22,
      background: s.state === 'done' ? 'var(--status-delivered)' : 'var(--border-subtle)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: i < steps.length - 1 ? 18 : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'baseline',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 var(--text-sm)/1.3 var(--font-sans)',
      color: s.state === 'todo' ? 'var(--text-muted)' : 'var(--text-primary)'
    }
  }, s.title), s.time && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-mono)',
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap'
    }
  }, s.time)), s.detail && /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      marginTop: 3
    }
  }, s.detail)))));
}
Object.assign(__ds_scope, { StatusTimeline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatusTimeline.jsx", error: String((e && e.message) || e) }); }

// components/data/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Tag({
  children,
  icon,
  onRemove,
  selected,
  onClick,
  style,
  ...rest
}) {
  const clickable = !!onClick;
  return /*#__PURE__*/React.createElement("span", _extends({
    onClick: onClick,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 26,
      padding: '0 10px',
      borderRadius: 'var(--radius-chip)',
      border: `1px solid ${selected ? 'var(--navy-500)' : 'var(--border-subtle)'}`,
      background: selected ? 'var(--surface-brand-soft)' : 'var(--surface-card)',
      color: selected ? 'var(--navy-700)' : 'var(--text-secondary)',
      font: '500 var(--text-xs)/1 var(--font-sans)',
      cursor: clickable ? 'pointer' : 'default',
      transition: 'var(--transition-control)',
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 13
  }), children, onRemove && /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onRemove();
    },
    "aria-label": "Remove",
    style: {
      display: 'inline-flex',
      border: 0,
      background: 'transparent',
      padding: 0,
      marginRight: -2,
      color: 'inherit',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 13
  })));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Alert.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  info: {
    bg: 'var(--status-scheduled-bg)',
    fg: 'var(--status-scheduled-fg)',
    bar: 'var(--status-scheduled)',
    icon: 'info'
  },
  success: {
    bg: 'var(--status-delivered-bg)',
    fg: 'var(--status-delivered-fg)',
    bar: 'var(--status-delivered)',
    icon: 'circle-check'
  },
  warning: {
    bg: 'var(--status-delayed-bg)',
    fg: 'var(--status-delayed-fg)',
    bar: 'var(--status-delayed)',
    icon: 'clock-alert'
  },
  danger: {
    bg: 'var(--status-incident-bg)',
    fg: 'var(--status-incident-fg)',
    bar: 'var(--status-incident)',
    icon: 'triangle-alert'
  }
};
function Alert({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.info;
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "status",
    style: {
      display: 'flex',
      gap: 11,
      padding: '12px 14px',
      background: t.bg,
      borderRadius: 'var(--radius-card)',
      borderLeft: 'none',
      boxShadow: `inset 0 -2px 0 ${t.bar}`,
      color: t.fg,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: t.icon,
    size: 18,
    style: {
      marginTop: 1,
      color: t.bar
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'grid',
      gap: 3
    }
  }, title && /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '600 var(--text-sm)/1.35 var(--font-sans)'
    }
  }, title), children && /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-body)',
      color: 'inherit',
      opacity: .92
    }
  }, children), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, action)), onDismiss && /*#__PURE__*/React.createElement("button", {
    onClick: onDismiss,
    "aria-label": "Dismiss",
    style: {
      border: 0,
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      padding: 0,
      height: 18
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 16
  })));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Alert.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Dialog({
  open = true,
  title,
  description,
  children,
  footer,
  width = 480,
  onClose,
  sheet,
  style,
  ...rest
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 60,
      display: 'flex',
      alignItems: sheet ? 'flex-end' : 'center',
      justifyContent: 'center',
      background: 'var(--surface-scrim)',
      backdropFilter: 'blur(2px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", _extends({
    role: "dialog",
    "aria-modal": "true",
    onClick: e => e.stopPropagation(),
    style: {
      width: sheet ? '100%' : 'min(92vw, ' + width + 'px)',
      maxHeight: '86vh',
      minWidth: 0,
      boxSizing: 'border-box',
      overflow: 'auto',
      background: 'var(--surface-overlay)',
      borderRadius: sheet ? 'var(--radius-sheet) var(--radius-sheet) 0 0' : 'var(--radius-lg)',
      boxShadow: sheet ? 'var(--shadow-sheet)' : 'var(--shadow-overlay)',
      animation: `${sheet ? 'tdms-sheet-in' : 'tdms-dialog-in'} var(--dur-sheet) var(--ease-out)`,
      ...style
    }
  }, rest), sheet && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 2,
      background: 'var(--border-default)',
      margin: '10px auto 0'
    }
  }), /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      padding: '18px 20px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--type-h2)',
      color: 'var(--text-primary)'
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body)',
      color: 'var(--text-muted)',
      marginTop: 5
    }
  }, description)), onClose && !sheet && /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      border: 0,
      background: 'transparent',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      padding: 2
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px'
    }
  }, children), footer && /*#__PURE__*/React.createElement("footer", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8,
      padding: '14px 20px',
      borderTop: '1px solid var(--border-subtle)',
      background: 'var(--surface-inset)'
    }
  }, footer), /*#__PURE__*/React.createElement("style", null, '@keyframes tdms-dialog-in{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:none}}@keyframes tdms-sheet-in{from{transform:translateY(100%)}to{transform:none}}')));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Skeleton({
  width = '100%',
  height = 12,
  radius = 'var(--radius-xs)',
  lines = 1,
  style,
  ...rest
}) {
  const bar = (w, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: 'block',
      width: w,
      height,
      borderRadius: radius,
      background: 'linear-gradient(90deg,var(--surface-sunken) 0%,var(--border-subtle) 50%,var(--surface-sunken) 100%)',
      backgroundSize: '200% 100%',
      animation: 'tdms-shimmer 1.3s var(--ease-standard) infinite'
    }
  });
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'grid',
      gap: 8,
      ...style
    }
  }, rest), Array.from({
    length: lines
  }, (_, i) => bar(i === lines - 1 && lines > 1 ? '62%' : width, i)), /*#__PURE__*/React.createElement("style", null, '@keyframes tdms-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}'));
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  info: {
    icon: 'info',
    color: 'var(--teal-400)'
  },
  success: {
    icon: 'circle-check',
    color: 'var(--green-500)'
  },
  warning: {
    icon: 'clock-alert',
    color: 'var(--amber-500)'
  },
  danger: {
    icon: 'triangle-alert',
    color: 'var(--red-500)'
  }
};
function Toast({
  tone = 'success',
  title,
  description,
  action,
  onDismiss,
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.success;
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "status",
    style: {
      display: 'flex',
      gap: 11,
      alignItems: 'flex-start',
      minWidth: 300,
      maxWidth: 420,
      padding: '13px 14px',
      background: 'var(--navy-900)',
      color: '#fff',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-overlay)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: t.icon,
    size: 18,
    style: {
      color: t.color,
      marginTop: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'grid',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      font: '600 var(--text-sm)/1.35 var(--font-sans)'
    }
  }, title), description && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'rgba(255,255,255,.72)'
    }
  }, description)), action, onDismiss && /*#__PURE__*/React.createElement("button", {
    onClick: onDismiss,
    "aria-label": "Dismiss",
    style: {
      border: 0,
      background: 'transparent',
      color: 'rgba(255,255,255,.6)',
      cursor: 'pointer',
      padding: 0,
      height: 18
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 16
  })));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Tooltip({
  label,
  placement = 'top',
  children,
  style,
  ...rest
}) {
  const [show, setShow] = React.useState(false);
  const pos = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: 'translate(-50%,-6px)'
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: 'translate(-50%,6px)'
    },
    left: {
      right: '100%',
      top: '50%',
      transform: 'translate(-6px,-50%)'
    },
    right: {
      left: '100%',
      top: '50%',
      transform: 'translate(6px,-50%)'
    }
  }[placement];
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      position: 'relative',
      display: 'inline-flex',
      ...style
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false),
    onFocus: () => setShow(true),
    onBlur: () => setShow(false)
  }, rest), children, show && /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: 'absolute',
      zIndex: 40,
      ...pos,
      whiteSpace: 'nowrap',
      background: 'var(--navy-900)',
      color: '#fff',
      padding: '5px 9px',
      borderRadius: 'var(--radius-sm)',
      font: 'var(--type-caption)',
      boxShadow: 'var(--shadow-md)',
      pointerEvents: 'none',
      animation: 'tdms-tip-in var(--dur-fast) var(--ease-out)'
    }
  }, label, /*#__PURE__*/React.createElement("style", null, '@keyframes tdms-tip-in{from{opacity:0}to{opacity:1}}')));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    height: 32,
    padX: 12,
    font: 'var(--text-xs)',
    gap: 6,
    icon: 15
  },
  md: {
    height: 'var(--target-web)',
    padX: 'var(--pad-control-x)',
    font: 'var(--text-sm)',
    gap: 8,
    icon: 17
  },
  lg: {
    height: 44,
    padX: 20,
    font: 'var(--text-md)',
    gap: 9,
    icon: 19
  },
  touch: {
    height: 'var(--target-touch-primary)',
    padX: 24,
    font: 'var(--text-md)',
    gap: 10,
    icon: 21
  }
};
const VARIANTS = {
  primary: {
    background: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
    border: '1px solid transparent',
    hover: 'var(--action-primary-bg-hover)',
    active: 'var(--action-primary-bg-active)'
  },
  accent: {
    background: 'var(--action-accent-bg)',
    color: 'var(--action-accent-fg)',
    border: '1px solid transparent',
    hover: 'var(--action-accent-bg-hover)',
    active: 'var(--action-accent-bg-active)'
  },
  secondary: {
    background: 'var(--action-secondary-bg)',
    color: 'var(--action-secondary-fg)',
    border: '1px solid var(--border-default)',
    hover: 'var(--action-secondary-bg-hover)',
    active: 'var(--surface-sunken)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
    hover: 'var(--action-ghost-bg-hover)',
    active: 'var(--surface-sunken)'
  },
  danger: {
    background: 'var(--action-danger-bg)',
    color: '#fff',
    border: '1px solid transparent',
    hover: 'var(--action-danger-bg-hover)',
    active: 'var(--action-danger-bg)'
  }
};
function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconAfter,
  block,
  loading,
  disabled,
  style,
  ...rest
}) {
  const s = SIZES[size] || SIZES.md;
  const v = VARIANTS[variant] || VARIANTS.primary;
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const off = disabled || loading;
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: off,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      display: block ? 'flex' : 'inline-flex',
      width: block ? '100%' : undefined,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.gap,
      height: s.height,
      padding: `0 ${typeof s.padX === 'number' ? s.padX + 'px' : s.padX}`,
      font: `var(--weight-semibold) ${s.font}/1 var(--font-sans)`,
      letterSpacing: '0.01em',
      borderRadius: 'var(--radius-control)',
      border: v.border,
      cursor: off ? 'not-allowed' : 'pointer',
      background: off ? 'var(--action-disabled-bg)' : press ? v.active : hover ? v.hover : v.background,
      color: off ? 'var(--action-disabled-fg)' : v.color,
      transform: press && !off ? 'scale(var(--press-scale))' : 'none',
      transition: 'var(--transition-control), transform var(--dur-instant) var(--ease-standard)',
      boxShadow: variant === 'secondary' && !off ? 'var(--shadow-xs)' : 'none',
      ...style
    }
  }, rest), loading ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "loader-circle",
    size: s.icon,
    style: {
      animation: 'tdms-spin .9s linear infinite'
    }
  }) : icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: s.icon
  }) : null, children, iconAfter ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconAfter,
    size: s.icon
  }) : null, /*#__PURE__*/React.createElement("style", null, '@keyframes tdms-spin{to{transform:rotate(360deg)}}'));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Checkbox({
  label,
  description,
  checked,
  indeterminate,
  disabled,
  size = 'md',
  onChange,
  style,
  ...rest
}) {
  const box = size === 'touch' ? 24 : 18;
  const on = checked || indeterminate;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: description ? 'flex-start' : 'center',
      minHeight: size === 'touch' ? 'var(--target-touch)' : undefined,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .55 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: box,
      height: box,
      flex: '0 0 auto',
      marginTop: description ? 1 : 0,
      borderRadius: 'var(--radius-xs)',
      border: `1.5px solid ${on ? 'var(--action-primary-bg)' : 'var(--field-border)'}`,
      background: on ? 'var(--action-primary-bg)' : 'var(--field-bg)',
      color: '#fff',
      transition: 'var(--transition-control)'
    }
  }, indeterminate ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "minus",
    size: box - 6
  }) : checked ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: box - 5
  }) : null), /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    checked: !!checked,
    disabled: disabled,
    onChange: onChange,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }, rest)), (label || description) && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: `400 ${size === 'touch' ? 'var(--text-md)' : 'var(--text-sm)'}/1.35 var(--font-sans)`,
      color: 'var(--text-primary)'
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, description)));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const S = {
  sm: 28,
  md: 'var(--target-web)',
  lg: 44,
  touch: 'var(--target-touch)'
};
const G = {
  sm: 15,
  md: 17,
  lg: 19,
  touch: 22
};
function IconButton({
  icon = 'ellipsis',
  size = 'md',
  variant = 'ghost',
  label,
  active,
  disabled,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const bg = disabled ? 'transparent' : active ? 'var(--surface-brand-soft)' : hover ? variant === 'ghost' ? 'var(--action-ghost-bg-hover)' : 'var(--action-secondary-bg-hover)' : variant === 'ghost' ? 'transparent' : 'var(--action-secondary-bg)';
  return /*#__PURE__*/React.createElement("button", _extends({
    "aria-label": label,
    disabled: disabled,
    title: label,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: S[size],
      height: S[size],
      borderRadius: 'var(--radius-control)',
      border: variant === 'outline' ? '1px solid var(--border-default)' : '1px solid transparent',
      background: bg,
      color: disabled ? 'var(--text-disabled)' : active ? 'var(--navy-600)' : 'var(--text-secondary)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'var(--transition-control)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: G[size]
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  label,
  hint,
  error,
  icon,
  suffix,
  size = 'md',
  mono,
  id,
  style,
  containerStyle,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const uid = React.useId();
  const fid = id || uid;
  const h = size === 'touch' ? 'var(--target-touch)' : size === 'sm' ? 32 : 'var(--target-web)';
  const borderColor = error ? 'var(--red-600)' : focus ? 'var(--border-focus-color)' : 'var(--field-border)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...containerStyle
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: fid,
    style: {
      font: 'var(--type-label)',
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: h,
      padding: '0 12px',
      background: rest.disabled ? 'var(--field-bg-disabled)' : 'var(--field-bg)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-control)',
      boxShadow: focus ? error ? 'var(--ring-danger)' : 'var(--ring-focus)' : 'none',
      transition: 'var(--transition-control)'
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16,
    style: {
      color: 'var(--text-muted)'
    }
  }), /*#__PURE__*/React.createElement("input", _extends({
    id: fid,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 0,
      outline: 0,
      background: 'transparent',
      font: mono ? 'var(--type-mono)' : `400 ${size === 'touch' ? 'var(--text-md)' : 'var(--text-sm)'}/1.4 var(--font-sans)`,
      letterSpacing: mono ? 'var(--tracking-wide)' : 0,
      color: 'var(--text-primary)',
      ...style
    }
  }, rest)), suffix && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap'
    }
  }, suffix)), (error || hint) && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: error ? 'var(--text-danger)' : 'var(--text-muted)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Radio({
  label,
  description,
  checked,
  disabled,
  size = 'md',
  onChange,
  name,
  value,
  style,
  ...rest
}) {
  const box = size === 'touch' ? 24 : 18;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: description ? 'flex-start' : 'center',
      minHeight: size === 'touch' ? 'var(--target-touch)' : undefined,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .55 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: box,
      height: box,
      flex: '0 0 auto',
      marginTop: description ? 1 : 0,
      borderRadius: '50%',
      border: `1.5px solid ${checked ? 'var(--action-primary-bg)' : 'var(--field-border)'}`,
      background: 'var(--field-bg)',
      transition: 'var(--transition-control)'
    }
  }, checked && /*#__PURE__*/React.createElement("span", {
    style: {
      width: box - 8,
      height: box - 8,
      borderRadius: '50%',
      background: 'var(--action-primary-bg)'
    }
  })), /*#__PURE__*/React.createElement("input", _extends({
    type: "radio",
    name: name,
    value: value,
    checked: !!checked,
    disabled: disabled,
    onChange: onChange,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }, rest)), (label || description) && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: `400 ${size === 'touch' ? 'var(--text-md)' : 'var(--text-sm)'}/1.35 var(--font-sans)`,
      color: 'var(--text-primary)'
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, description)));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SearchField({
  value = '',
  onChange,
  onClear,
  placeholder = 'Search shipments, drivers, plates…',
  width = 320,
  size = 'md',
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const h = size === 'touch' ? 'var(--target-touch)' : 'var(--target-web)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width,
      height: h,
      padding: '0 10px 0 12px',
      background: 'var(--field-bg)',
      border: `1px solid ${focus ? 'var(--border-focus-color)' : 'var(--field-border)'}`,
      borderRadius: 'var(--radius-control)',
      boxShadow: focus ? 'var(--ring-focus)' : 'none',
      transition: 'var(--transition-control)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 16,
    style: {
      color: 'var(--text-muted)'
    }
  }), /*#__PURE__*/React.createElement("input", _extends({
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 0,
      outline: 0,
      background: 'transparent',
      font: '400 var(--text-sm)/1.4 var(--font-sans)',
      color: 'var(--text-primary)'
    }
  }, rest)), value ? /*#__PURE__*/React.createElement("button", {
    onClick: onClear,
    "aria-label": "Clear search",
    style: {
      display: 'inline-flex',
      border: 0,
      background: 'transparent',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      padding: 2
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 15
  })) : /*#__PURE__*/React.createElement("kbd", {
    style: {
      font: 'var(--type-mono)',
      fontSize: 11,
      color: 'var(--text-muted)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xs)',
      padding: '1px 5px'
    }
  }, "/"));
}
Object.assign(__ds_scope, { SearchField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchField.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  label,
  hint,
  error,
  options = [],
  size = 'md',
  style,
  containerStyle,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const uid = React.useId();
  const h = size === 'touch' ? 'var(--target-touch)' : size === 'sm' ? 32 : 'var(--target-web)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...containerStyle
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: uid,
    style: {
      font: 'var(--type-label)',
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: uid,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      appearance: 'none',
      width: '100%',
      height: h,
      padding: '0 34px 0 12px',
      background: rest.disabled ? 'var(--field-bg-disabled)' : 'var(--field-bg)',
      border: `1px solid ${error ? 'var(--red-600)' : focus ? 'var(--border-focus-color)' : 'var(--field-border)'}`,
      borderRadius: 'var(--radius-control)',
      outline: 0,
      boxShadow: focus ? 'var(--ring-focus)' : 'none',
      font: `400 ${size === 'touch' ? 'var(--text-md)' : 'var(--text-sm)'}/1 var(--font-sans)`,
      color: 'var(--text-primary)',
      cursor: 'pointer',
      transition: 'var(--transition-control)',
      ...style
    }
  }, rest), options.map(o => typeof o === 'string' ? /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o) : /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 16,
    style: {
      position: 'absolute',
      right: 11,
      pointerEvents: 'none',
      color: 'var(--text-muted)'
    }
  })), (error || hint) && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: error ? 'var(--text-danger)' : 'var(--text-muted)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Switch({
  label,
  description,
  checked,
  disabled,
  onChange,
  size = 'md',
  style,
  ...rest
}) {
  const w = size === 'touch' ? 52 : 40,
    h = size === 'touch' ? 30 : 22,
    k = h - 6;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      justifyContent: label ? 'space-between' : undefined,
      minHeight: size === 'touch' ? 'var(--target-touch)' : undefined,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .55 : 1,
      ...style
    }
  }, (label || description) && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 var(--text-sm)/1.35 var(--font-sans)',
      color: 'var(--text-primary)'
    }
  }, label), description && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, description)), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      flex: '0 0 auto',
      width: w,
      height: h,
      borderRadius: 'var(--radius-pill)',
      background: checked ? 'var(--action-accent-bg)' : 'var(--gray-300)',
      transition: 'background-color var(--dur-base) var(--ease-standard)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: checked ? w - k - 3 : 3,
      width: k,
      height: k,
      borderRadius: '50%',
      background: '#fff',
      boxShadow: 'var(--shadow-sm)',
      transition: 'left var(--dur-base) var(--ease-standard)'
    }
  })), /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    role: "switch",
    checked: !!checked,
    disabled: disabled,
    onChange: onChange,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }, rest)));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Textarea({
  label,
  hint,
  error,
  rows = 4,
  maxLength,
  value,
  style,
  containerStyle,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const uid = React.useId();
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...containerStyle
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: uid,
    style: {
      font: 'var(--type-label)',
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("textarea", _extends({
    id: uid,
    rows: rows,
    maxLength: maxLength,
    value: value,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      resize: 'vertical',
      padding: '10px 12px',
      background: 'var(--field-bg)',
      border: `1px solid ${error ? 'var(--red-600)' : focus ? 'var(--border-focus-color)' : 'var(--field-border)'}`,
      borderRadius: 'var(--radius-control)',
      outline: 0,
      boxShadow: focus ? 'var(--ring-focus)' : 'none',
      font: '400 var(--text-sm)/var(--leading-normal) var(--font-sans)',
      color: 'var(--text-primary)',
      transition: 'var(--transition-control)',
      ...style
    }
  }, rest)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: error ? 'var(--text-danger)' : 'var(--text-muted)'
    }
  }, error || hint), maxLength && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, String(value || '').length, "/", maxLength)));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Breadcrumb.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Breadcrumb({
  items = [],
  onNavigate,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    "aria-label": "Breadcrumb",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      ...style
    }
  }, rest), items.map((it, i) => {
    const last = i === items.length - 1;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, /*#__PURE__*/React.createElement("button", {
      disabled: last,
      onClick: () => onNavigate && onNavigate(it, i),
      style: {
        border: 0,
        background: 'transparent',
        padding: 0,
        cursor: last ? 'default' : 'pointer',
        font: `${last ? 600 : 400} var(--text-xs)/1.2 var(--font-sans)`,
        color: last ? 'var(--text-primary)' : 'var(--text-muted)'
      }
    }, it.label), !last && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "chevron-right",
      size: 13,
      style: {
        color: 'var(--text-disabled)'
      }
    }));
  }));
}
Object.assign(__ds_scope, { Breadcrumb });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Breadcrumb.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Pagination.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Pagination({
  page = 1,
  pageCount = 1,
  pageSize,
  total,
  onChange,
  style,
  ...rest
}) {
  const btn = (dir, icon, disabled) => /*#__PURE__*/React.createElement("button", {
    disabled: disabled,
    onClick: () => onChange && onChange(page + dir),
    "aria-label": dir < 0 ? 'Previous page' : 'Next page',
    style: {
      width: 30,
      height: 30,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-control)',
      background: 'var(--surface-card)',
      color: disabled ? 'var(--text-disabled)' : 'var(--text-secondary)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'var(--transition-control)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 15
  }));
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-caption)',
      color: 'var(--text-muted)'
    }
  }, total != null && pageSize != null ? /*#__PURE__*/React.createElement(React.Fragment, null, "Showing ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-secondary)'
    }
  }, (page - 1) * pageSize + 1, "\u2013", Math.min(page * pageSize, total)), " of ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-secondary)'
    }
  }, total)) : /*#__PURE__*/React.createElement(React.Fragment, null, "Page ", page, " of ", pageCount)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, btn(-1, 'chevron-left', page <= 1), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-mono)',
      color: 'var(--text-secondary)',
      padding: '0 4px'
    }
  }, page, " / ", pageCount), btn(1, 'chevron-right', page >= pageCount)));
}
Object.assign(__ds_scope, { Pagination });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Pagination.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SidebarNav.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SidebarNav({
  items = [],
  value,
  onChange,
  collapsed,
  header,
  footer,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
      flex: '0 0 auto',
      background: 'var(--surface-nav)',
      color: 'var(--text-on-nav)',
      borderRight: '1px solid var(--border-nav)',
      transition: 'width var(--dur-base) var(--ease-standard)',
      ...style
    }
  }, rest), header && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: collapsed ? '16px 0' : '16px 18px',
      borderBottom: '1px solid var(--border-nav)',
      display: 'flex',
      justifyContent: collapsed ? 'center' : 'flex-start'
    }
  }, header), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '10px 8px',
      display: 'grid',
      gap: 2,
      alignContent: 'start'
    }
  }, items.map(it => it.section ? /*#__PURE__*/React.createElement("div", {
    key: it.section,
    style: {
      font: 'var(--type-overline)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,.42)',
      padding: collapsed ? '14px 0 4px' : '14px 10px 4px',
      textAlign: collapsed ? 'center' : 'left'
    }
  }, collapsed ? '·' : it.section) : /*#__PURE__*/React.createElement(NavItem, {
    key: it.value,
    item: it,
    active: it.value === value,
    collapsed: collapsed,
    onClick: () => onChange && onChange(it.value)
  }))), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: collapsed ? '10px 8px' : '12px 14px',
      borderTop: '1px solid var(--border-nav)'
    }
  }, footer));
}
function NavItem({
  item,
  active,
  collapsed,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    title: collapsed ? item.label : undefined,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      width: '100%',
      height: 40,
      padding: collapsed ? 0 : '0 11px',
      justifyContent: collapsed ? 'center' : 'flex-start',
      border: 0,
      borderRadius: 'var(--radius-control)',
      cursor: 'pointer',
      background: active ? 'var(--surface-nav-active)' : hover ? 'rgba(255,255,255,.07)' : 'transparent',
      color: active ? 'var(--text-on-nav-active)' : 'var(--text-on-nav)',
      font: `${active ? 600 : 500} var(--text-sm)/1 var(--font-sans)`,
      boxShadow: active ? 'inset 3px 0 0 var(--teal-500)' : 'none',
      transition: 'var(--transition-control)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: item.icon || 'circle',
    size: 18
  }), !collapsed && /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      textAlign: 'left'
    }
  }, item.label), !collapsed && item.count != null && /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 var(--text-2xs)/1 var(--font-sans)',
      background: item.alert ? 'var(--red-600)' : 'rgba(255,255,255,.14)',
      color: '#fff',
      borderRadius: 'var(--radius-chip)',
      padding: '3px 6px'
    }
  }, item.count));
}
Object.assign(__ds_scope, { SidebarNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SidebarNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Tabs({
  items = [],
  value,
  onChange,
  variant = 'underline',
  style,
  ...rest
}) {
  const seg = variant === 'segmented';
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: seg ? 2 : 4,
      padding: seg ? 3 : 0,
      background: seg ? 'var(--surface-sunken)' : 'transparent',
      borderRadius: seg ? 'var(--radius-control)' : 0,
      borderBottom: seg ? 'none' : '1px solid var(--border-subtle)',
      ...style
    }
  }, rest), items.map(t => {
    const active = t.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: t.value,
      role: "tab",
      "aria-selected": active,
      onClick: () => onChange && onChange(t.value),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        border: 0,
        cursor: 'pointer',
        height: seg ? 30 : 38,
        padding: seg ? '0 12px' : '0 10px',
        background: seg ? active ? 'var(--surface-card)' : 'transparent' : 'transparent',
        borderRadius: seg ? 'var(--radius-xs)' : 0,
        boxShadow: seg && active ? 'var(--shadow-xs)' : !seg && active ? 'inset 0 -2px 0 var(--teal-500)' : 'none',
        font: `${active ? 600 : 500} var(--text-sm)/1 var(--font-sans)`,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: 'var(--transition-control)'
      }
    }, t.icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: t.icon,
      size: 15
    }), t.label, t.count != null && /*#__PURE__*/React.createElement("span", {
      style: {
        font: '600 var(--text-2xs)/1 var(--font-sans)',
        color: active ? 'var(--navy-700)' : 'var(--text-muted)',
        background: active ? 'var(--navy-100)' : 'var(--surface-sunken)',
        borderRadius: 'var(--radius-chip)',
        padding: '3px 6px'
      }
    }, t.count));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

if (__ds_ns.__errors.length) console.error('[TDMS] lỗi nạp component:', __ds_ns.__errors)

// Thay Icon của DS (nạp SVG từ CDN jsDelivr qua CSS mask) bằng lucide-react bundled.
// Mọi component trong bundle gọi __ds_scope.Icon lúc RENDER nên ghi đè ở đây là đủ.
__ds_scope.Icon = function Icon({ name = 'package', size = 18, strokeColor, style, title, ...rest }) {
  const C = ICONS[name]
  if (!C) {
    if (import.meta.env.DEV) console.warn('[TDMS] thiếu icon "' + name + '" trong src/ds/icons.js')
    return React.createElement('span', { style: { display: 'inline-block', width: size, height: size, ...style } })
  }
  return React.createElement(C, {
    size,
    color: strokeColor || 'currentColor',
    'aria-label': title,
    'aria-hidden': title ? undefined : true,
    style: { display: 'inline-block', flex: '0 0 auto', ...style },
    ...rest,
  })
}

export const {
  Icon, Avatar, Badge, Card, DataTable, EmptyState, ProgressBar, StatCard, StatusPill,
  StatusTimeline, Tag, Alert, Dialog, Skeleton, Toast, Tooltip, Button, Checkbox,
  IconButton, Input, Radio, SearchField, Select, Switch, Textarea, Breadcrumb,
  Pagination, SidebarNav, Tabs,
} = __ds_scope
