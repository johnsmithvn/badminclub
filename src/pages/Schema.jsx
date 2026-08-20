// Sơ đồ dữ liệu: tài liệu sống trong app (handoff 02 §8). Dữ liệu ở #data/schema.js.

import { Alert, Card } from '#ds'
import { Mono, Overline } from '#ui'
import { SCHEMA_GROUPS } from '#data/schema.js'
import { t } from '#i18n'

const KEY_COLOR = { PK: 'var(--teal-600)', FK: 'var(--navy-500)' }

export default function Schema() {
  return (
    <>
      <Alert tone="info" title={t('schema.alertTitle')}>{t('schema.alert')}</Alert>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '0 2px' }}>
        <Legend color={KEY_COLOR.PK} label={'PK · ' + t('schema.pk')} />
        <Legend color={KEY_COLOR.FK} label={'FK · ' + t('schema.fk')} />
      </div>

      {SCHEMA_GROUPS.map((g) => (
        <Card
          key={g.groupKey}
          title={t('schema.group' + g.groupKey)}
          subtitle={t('schema.group' + g.groupKey + 'Note')}
          icon="database"
          padding="14px 16px"
          accent={g.color}
        >
          <div style={S.grid}>
            {g.tables.map((tb) => (
              <div key={tb.name} style={S.table}>
                <div style={{ ...S.tableHead, borderColor: g.color }}>
                  <Mono weight={600} size={12} color="var(--text-primary)">{tb.name}</Mono>
                </div>
                <div style={{ display: 'grid' }}>
                  {tb.fields.map((fl) => (
                    <div key={fl.name} style={S.field}>
                      <Mono size={11} color="var(--text-primary)" style={{ flex: 1, minWidth: 0 }}>{fl.name}</Mono>
                      <Mono size={9} color="var(--text-muted)">{fl.type}</Mono>
                      {fl.key && (
                        <Mono size={9} weight={600} color={KEY_COLOR[fl.key]} style={{ width: 18, textAlign: 'right' }}>
                          {fl.key}
                        </Mono>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </>
  )
}

const Legend = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
    <Overline>{label}</Overline>
  </div>
)

const S = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10, alignItems: 'start' },
  table: {
    border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden',
    background: 'var(--surface-card)',
  },
  tableHead: {
    padding: '7px 10px', background: 'var(--surface-inset)',
    borderBottom: '2px solid', borderBottomColor: 'var(--border-subtle)',
  },
  field: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px',
    borderTop: '1px solid var(--border-subtle)',
  },
}
