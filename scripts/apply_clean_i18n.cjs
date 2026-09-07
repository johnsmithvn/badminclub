const fs = require('fs');

// 1. CareerEloTab.jsx
let f1 = 'src/components/leaderboard/CareerEloTab.jsx';
let c1 = fs.readFileSync(f1, 'utf8');

c1 = c1.replace(/`Xếp hạng chính thức · \${officialList\.length} người`/g, "t('season.officialActiveCount', { n: officialList.length })");
c1 = c1.replace(/`Tất cả thành viên · \${allList\.length} người`/g, "t('season.allActiveCount', { n: allList.length })");
c1 = c1.replace(/\{provisionalList\.length\} người đang thẩm định/g, "{t('season.provisionalActiveCount', { n: provisionalList.length })}");
c1 = c1.replace(/sort: Elo ↓/g, "{t('season.sortEloDesc')}");
c1 = c1.replace(/<span>Thành viên<\/span>/g, "<span>{t('season.colMember')}</span>");
c1 = c1.replace(/<span style=\{\{ textAlign: 'right' \}\}>Trận<\/span>/g, "<span style={{ textAlign: 'right' }}>{t('season.colMatches')}</span>");
c1 = c1.replace(/<span style=\{\{ textAlign: 'center' \}\}>Độ tin cậy<\/span>/g, "<span style={{ textAlign: 'center' }}>{t('season.colConfidence')}</span>");
c1 = c1.replace(/<span style=\{\{ textAlign: 'right' \}\}>Thắng<\/span>/g, "<span style={{ textAlign: 'right' }}>{t('season.colWins')}</span>");
c1 = c1.replace(/<span style=\{\{ textAlign: 'right' \}\}>30 ngày<\/span>/g, "<span style={{ textAlign: 'right' }}>{t('season.col30Days')}</span>");
c1 = c1.replace(/Top 1/g, "{t('season.topBadge')}");
c1 = c1.replace(/bạn/g, "{t('season.youBadge')}");
c1 = c1.replace(/⚠ Đang thẩm định · chưa vào podium/g, "{t('season.provisionalSectionTitle')}");
c1 = c1.replace(/Elo vẫn chạy, chỉ chưa xếp hạng chính thức/g, "{t('season.provisionalSectionSub')}");
c1 = c1.replace(/còn \{player\.provisionalRemaining\} trận/g, "{t('season.provisionalBadgeCount', { n: player.provisionalRemaining })}");
c1 = c1.replace(/&lt; 5 trận · gắn nhãn thẩm định/g, "{t('season.confLowNote')}");
c1 = c1.replace(/5–29 trận · vào bảng chính thức/g, "{t('season.confMedNote')}");
c1 = c1.replace(/30–99 trận · Elo dùng nguyên 100%/g, "{t('season.confHighNote')}");
c1 = c1.replace(/≥ 100 trận · số liệu ổn định/g, "{t('season.confVHighNote')}");
c1 = c1.replace(/Elo hiển thị của người LOW có dấu <span style=\{\{ fontFamily: "'IBM Plex Mono', monospace", color: '#E9EFF7' \}\}>\?<\/span> — con số có thật nhưng biên sai số còn rộng\./g, "{t('season.confQuestionNote')}");
c1 = c1.replace(/Trung vị \{medianElo\} · nhóm 1500–1700 chiếm \{middleRangePct\}% CLB, đủ dày để ghép sân cân trình mỗi buổi\./g, "{t('season.medianNote', { median: medianElo, pct: middleRangePct })}");
c1 = c1.replace(/Hai bảng khác nhau chỗ nào/g, "{t('season.twoTablesDiffTitle')}");
c1 = c1.replace(/<span>Đo trình độ\. Không bao giờ bị xóa\. Quyết định ai vào sân với ai\.<\/span>/g, "<span>{t('season.eloPurpose')}</span>");
c1 = c1.replace(/<span style=\{\{ font: "600 11px\/1\.3 'IBM Plex Mono', monospace", color: '#F0D26A' \}\}>Điểm mùa<\/span>/g, "<span style={{ font: \"600 11px/1.3 'IBM Plex Mono', monospace\", color: '#F0D26A' }}>{t('season.colPoints')}</span>");
c1 = c1.replace(/<span>Đo mức tham gia trong quý\. Reset 01\/10\. Quyết định ai nhận thưởng\.<\/span>/g, "<span>{t('season.seasonPointsPurpose')}</span>");

fs.writeFileSync(f1, c1, 'utf8');
console.log('Updated f1');
