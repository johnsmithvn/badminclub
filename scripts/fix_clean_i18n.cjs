const fs = require('fs');

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [target, replacement] of replacements) {
    if (typeof target === 'string') {
      if (!content.includes(target)) {
        console.warn(`[WARN] Target not found in ${filePath}: ${target.slice(0, 50)}...`);
      }
      content = content.replace(target, replacement);
    } else if (target instanceof RegExp) {
      if (!target.test(content)) {
        console.warn(`[WARN] Regex target not found in ${filePath}: ${target}...`);
      }
      content = content.replace(target, replacement);
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${filePath}`);
}

// 1. CareerEloTab.jsx
replaceInFile('src/components/leaderboard/CareerEloTab.jsx', [
  [
    `{filterMode === 'official'
                  ? \`Xếp hạng chính thức · \${officialList.length} người\`
                  : \`Tất cả thành viên · \${allList.length} người\`}`,
    `{filterMode === 'official'
                  ? t('season.officialActiveCount', { n: officialList.length })
                  : t('season.allActiveCount', { n: allList.length })}`
  ],
  [
    `{provisionalList.length} người đang thẩm định`,
    `{t('season.provisionalActiveCount', { n: provisionalList.length })}`
  ],
  [
    `              <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                sort: Elo ↓
              </span>`,
    `              <span style={{ font: "400 12px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                {t('season.sortEloDesc')}
              </span>`
  ],
  [
    `              <span>#</span>
              <span>Thành viên</span>
              <span style={{ textAlign: 'right' }}>Elo</span>
              <span style={{ textAlign: 'right' }}>Trận</span>
              <span style={{ textAlign: 'center' }}>Độ tin cậy</span>
              <span style={{ textAlign: 'right' }}>Thắng</span>
              <span style={{ textAlign: 'right' }}>30 ngày</span>`,
    `              <span>#</span>
              <span>{t('season.colMember')}</span>
              <span style={{ textAlign: 'right' }}>Elo</span>
              <span style={{ textAlign: 'right' }}>{t('season.colMatches')}</span>
              <span style={{ textAlign: 'center' }}>{t('season.colConfidence')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.colWins')}</span>
              <span style={{ textAlign: 'right' }}>{t('season.col30Days')}</span>`
  ],
  [
    `background: player.gender === 'Nữ' || player.gender === 'F' ? '#7A3D8F' : '#1D50A0',`,
    `background: player.gender === 'Nữ' || player.gender === 'F' ? '#7A3D8F' : '#1D50A0', // i18n-ok: gender check`
  ],
  [
    `                <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#F1A79D' }}>
                  ⚠ Đang thẩm định · chưa vào podium
                </span>
                <div style={{ flex: '1 1 0%' }} />
                <span style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  Elo vẫn chạy, chỉ chưa xếp hạng chính thức
                </span>`,
    `                <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#F1A79D' }}>
                  {t('season.provisionalSectionTitle')}
                </span>
                <div style={{ flex: '1 1 0%' }} />
                <span style={{ font: "400 12px/1.4 'IBM Plex Sans', sans-serif", color: '#8494AA' }}>
                  {t('season.provisionalSectionSub')}
                </span>`
  ],
  [
    `background: player.gender === 'Nữ' || player.gender === 'F' ? '#7A3D8F' : '#B0562A',`,
    `background: player.gender === 'Nữ' || player.gender === 'F' ? '#7A3D8F' : '#B0562A', // i18n-ok: gender check`
  ],
  [
    `còn {player.provisionalRemaining} trận`,
    `{t('season.provisionalBadgeCount', { n: player.provisionalRemaining })}`
  ],
  [
    `<span style={{ color: '#8494AA' }}>&lt; 5 trận · gắn nhãn thẩm định</span>`,
    `<span style={{ color: '#8494AA' }}>{t('season.confLowNote')}</span>`
  ],
  [
    `<span style={{ color: '#8494AA' }}>5–29 trận · vào bảng chính thức</span>`,
    `<span style={{ color: '#8494AA' }}>{t('season.confMedNote')}</span>`
  ],
  [
    `<span style={{ color: '#8494AA' }}>30–99 trận · Elo dùng nguyên 100%</span>`,
    `<span style={{ color: '#8494AA' }}>{t('season.confHighNote')}</span>`
  ],
  [
    `<span style={{ color: '#8494AA' }}>≥ 100 trận · số liệu ổn định</span>`,
    `<span style={{ color: '#8494AA' }}>{t('season.confVHighNote')}</span>`
  ],
  [
    `Elo hiển thị của người LOW có dấu <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#E9EFF7' }}>?</span> — con số có thật nhưng biên sai số còn rộng.`,
    `{t('season.confQuestionNote')}`
  ],
  [
    `Trung vị {medianElo} · nhóm 1500–1700 chiếm {middleRangePct}% CLB, đủ dày để ghép sân cân trình mỗi buổi.`,
    `{t('season.medianNote', { median: medianElo, pct: middleRangePct })}`
  ],
  [
    `Hai bảng khác nhau chỗ nào`,
    `{t('season.twoTablesDiffTitle')}`
  ],
  [
    `<span>Đo trình độ. Không bao giờ bị xóa. Quyết định ai vào sân với ai.</span>`,
    `<span>{t('season.eloPurpose')}</span>`
  ],
  [
    `<span style={{ font: "600 11px/1.3 'IBM Plex Mono', monospace", color: '#F0D26A' }}>Điểm mùa</span>`,
    `<span style={{ font: "600 11px/1.3 'IBM Plex Mono', monospace", color: '#F0D26A' }}>{t('season.colPoints')}</span>`
  ],
  [
    `<span>Đo mức tham gia trong quý. Reset 01/10. Quyết định ai nhận thưởng.</span>`,
    `<span>{t('season.seasonPointsPurpose')}</span>`
  ]
]);

// 2. MemberSeasonLedgerModal.jsx
replaceInFile('src/components/leaderboard/MemberSeasonLedgerModal.jsx', [
  [
    `{season?.name || 'Mùa 3 · 2026'} · {t('season.rankOf', { rank, total: totalMembers })}`,
    `{(season?.name ? \`\${season.name} · \` : '') + t('season.rankOf', { rank, total: totalMembers })}`
  ],
  [
    `Chưa có trận đấu nào trong mùa này.`,
    `{t('season.noMatchesInSeason')}`
  ]
]);

// 3. QuadrantMapModal.jsx
replaceInFile('src/components/leaderboard/QuadrantMapModal.jsx', [
  [
    `seasonName = 'Mùa 3',`,
    `seasonName = '',`
  ],
  [
    `title={\`\${p.name}: Elo \${p.displayRating || p.rating}, Điểm mùa \${p.totalSeasonPoints}\`}`,
    `title={\`\${p.name}: Elo \${p.displayRating || p.rating}, \${t('season.colPoints')} \${p.totalSeasonPoints}\`}`
  ],
  [
    `Elo {medianElo} (trung vị)`,
    `Elo {medianElo} ({t('season.medianLabel')})`
  ]
]);

// 4. SeasonRaceTab.jsx
replaceInFile('src/components/leaderboard/SeasonRaceTab.jsx', [
  [
    `            <span>
              {remainingSessions} {t('season.remainingSessions')} — {t('season.maxPoints')}{' '}
              +{maxPossiblePts || 190} pts
            </span>`,
    `            <span>{t('season.remainingSessionDesc', { n: remainingSessions, pts: maxPossiblePts || 190 })}</span>`
  ],
  [
    `<text x="0" y="128" fill="#8494AA" fontFamily="IBM Plex Mono, monospace" fontSize="10">buổi 5</text>`,
    `<text x="0" y="128" fill="#8494AA" fontFamily="IBM Plex Mono, monospace" fontSize="10">{t('season.sessionN', { n: 5 })}</text>`
  ],
  [
    `<text x="278" y="128" fill="#8494AA" fontFamily="IBM Plex Mono, monospace" fontSize="10">buổi 11</text>`,
    `<text x="278" y="128" fill="#8494AA" fontFamily="IBM Plex Mono, monospace" fontSize="10">{t('season.sessionN', { n: 11 })}</text>`
  ],
  [
    `<span style={{ font: "400 11px 'IBM Plex Mono', monospace", color: '#8494AA' }}>Elo × Điểm mùa</span>`,
    `<span style={{ font: "400 11px 'IBM Plex Mono', monospace", color: '#8494AA' }}>{t('season.quadrantMapSub')}</span>`
  ]
]);

// 5. BestOfNArrangementView.jsx
replaceInFile('src/components/session/BestOfNArrangementView.jsx', [
  [
    `Chia sân · buổi {session.date ? session.date.slice(5) : ''}`,
    `{t('season.assignSessionTitle', { date: session.date ? session.date.slice(5) : '' })}`
  ],
  [
    `{waitingCount} người chờ · {activeIdxs.length} sân · máy đã dò 80 phương án trong {timeMs}ms`,
    `{t('season.headerAssignMeta', { players: waitingCount, courts: activeIdxs.length, candidates: 80, ms: timeMs })}`
  ],
  [
    `Kéo thả thủ công`,
    `{t('season.manualDragDrop')}`
  ],
  [
    `            <button
              type="button"
              onClick={() => setRerunTrigger((prev) => prev + 1)}
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                padding: '9px 14px',
                borderRadius: 6,
                background: '#1A2437',
                border: '1px solid #2E3E5C',
                color: '#E9EFF7',
                cursor: 'pointer',
              }}
            >
              Dò lại
            </button>`,
    `            <button
              type="button"
              onClick={() => setRerunTrigger((prev) => prev + 1)}
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                padding: '9px 14px',
                borderRadius: 6,
                background: '#1A2437',
                border: '1px solid #2E3E5C',
                color: '#E9EFF7',
                cursor: 'pointer',
              }}
            >
              {t('season.rerunBtn')}
            </button>`
  ],
  [
    `Xếp {currentPlan?.title || 'phương án A'} vào sân`,
    `{t('season.applyPlanBtn', { plan: currentPlan?.title || t('season.planA') })}`
  ],
  [
    `                <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  Phương án A
                </span>`,
    `                <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                  {t('season.planA')}
                </span>`
  ],
  [
    `TỐT NHẤT`,
    `{t('season.bestBadge')}`
  ],
  [
    `/ 100 điểm cân`,
    `{t('season.planBalancePts')}`
  ],
  [
    `{planA?.desc || 'Lệch Elo trung bình 24 · không cặp nào lặp lại · 4 người chờ lâu nhất đều vào sân.'}`,
    `{planA?.desc || t('season.planDescA')}`
  ],
  [
    `                  <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                    Phương án B
                  </span>`,
    `                  <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                    {t('season.planB')}
                  </span>`
  ],
  [
    `{planB?.desc || 'Cân trình hơn A nhưng có cặp đánh lại cặp cũ.'}`,
    `{planB?.desc || t('season.planDescB')}`
  ],
  [
    `                  <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                    Phương án C
                  </span>`,
    `                  <span style={{ font: "600 13px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
                    {t('season.planC')}
                  </span>`
  ],
  [
    `{planC?.desc || 'Toàn cặp mới nhưng độ lệch giữa hai đội có thể lớn hơn.'}`,
    `{planC?.desc || t('season.planDescC')}`
  ],
  [
    `{currentPlan?.title || 'Phương án A'} · {courts.length} sân`,
    `{t('season.courtPlanTitle', { plan: currentPlan?.title || t('season.planA'), n: courts.length })}`
  ],
  [
    `số trong ngoặc là effective strength dùng để ghép`,
    `{t('season.effectiveStrengthSub')}`
  ],
  [
    `Sân {court.courtIdx !== undefined ? court.courtIdx + 1 : cIdx + 1}`,
    `{t('season.courtLabel', { n: court.courtIdx !== undefined ? court.courtIdx + 1 : cIdx + 1 })}`
  ],
  [
    `lệch {diff}`,
    `{t('season.diffBadge', { n: diff })}`
  ],
  [
    `title={hasShrink ? 'Bấm để xem tính toán Effective Strength' : ''}`,
    `title={hasShrink ? t('season.inspectEffectiveStrength') : ''}`
  ],
  [
    `title={hasShrink ? 'Bấm để xem tính toán Effective Strength' : ''}`,
    `title={hasShrink ? t('season.inspectEffectiveStrength') : ''}`
  ],
  [
    `tổng {rA}`,
    `{t('season.teamTotal', { n: rA })}`
  ],
  [
    `tổng {rB}`,
    `{t('season.teamTotal', { n: rB })}`
  ],
  [
    `* {shrinkedPlayer.name ? shrinkedPlayer.name.split(' ').pop() : ''} đã co về seed`,
    `{t('season.shrunkSeed', { name: shrinkedPlayer.name ? shrinkedPlayer.name.split(' ').pop() : '' })}`
  ],
  [
    `{court.h2hSummary || 'chưa từng gặp nhau'}`,
    `{court.h2hSummary || t('season.neverPlayed')}`
  ],
  [
    `                      Vì sao?`,
    `                      {t('season.whyBtn')}`
  ],
  [
    `Chờ lượt sau · {waitingPlayers.length} người`,
    `{t('season.waitingRoster', { n: waitingPlayers.length })}`
  ],
  [
    `sort: chờ lâu nhất trước`,
    `{t('season.sortWaitingFirst')}`
  ],
  [
    `{p.rating} · chờ {turns} lượt`,
    `{p.rating} · {t('season.waitTurns', { n: turns })}`
  ],
  [
    `Điểm 5 tiêu chí · {currentPlan?.title || 'phương án A'}`,
    `{t('season.fiveCriteriaTitle', { plan: currentPlan?.title || t('season.planA') })}`
  ],
  [
    `<span>Cân trình Elo</span>`,
    `<span>{t('season.critBalance')}</span>`
  ],
  [
    `<span>Đổi partner</span>`,
    `<span>{t('season.critPartner')}</span>`
  ],
  [
    `<span>Đổi đối thủ</span>`,
    `<span>{t('season.critOpponent')}</span>`
  ],
  [
    `<span>H2H &amp; tỉ số cũ</span>`,
    `<span>{t('season.critH2H')}</span>`
  ],
  [
    `<span>Đều lượt chờ</span>`,
    `<span>{t('season.critWait')}</span>`
  ],
  [
    `<span>Tổng có trọng số</span>`,
    `<span>{t('season.weightedTotal')}</span>`
  ],
  [
    `Máy đã dò gì · 80 phương án`,
    `{t('season.monteCarloTitle', { n: 80 })}`
  ],
  [
    `thứ tự dò →`,
    `{t('season.searchOrder')}`
  ],
  [
    `Ngưỡng nét đứt là điểm 90. Ba phương án vượt ngưỡng, máy lấy cái cao nhất và giữ hai cái sau làm lựa chọn thay thế.`,
    `{t('season.monteCarloSub')}`
  ],
  [
    `            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
              Đang bị chặn
            </div>`,
    `            <div style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif", color: '#E9EFF7' }}>
              {t('season.blockedTitle')}
            </div>`
  ],
  [
    `<span>Cặp cùng trình độ chênh &gt;100 Elo: giữ hai người ở hai đầu sân.</span>`,
    `<span>{t('season.blockRuleDiff100')}</span>`
  ],
  [
    `<span>Nghỉ 1 lượt: người vừa đánh 3 trận liên tiếp được xếp sau.</span>`,
    `<span>{t('season.blockRuleRestConsecutive')}</span>`
  ],
  [
    `Quản lý điều kiện chặn`,
    `{t('season.manageBlocked')}`
  ]
]);

// 6. CourtAssignmentTab.jsx
replaceInFile('src/components/session/CourtAssignmentTab.jsx', [
  [
    `Best-of-N thông minh (80 phương án)`,
    `{t('season.bestOfNMode')}`
  ],
  [
    `Ghi điểm từng sân`,
    `{t('season.scorePerCourtMode')}`
  ]
]);

// 7. EffectiveStrengthModal.jsx
replaceInFile('src/components/session/EffectiveStrengthModal.jsx', [
  [
    `name: 'Nguyễn Khánh Vy',`,
    `name: 'Player',`
  ],
  [
    `const name = player.name || 'VĐV'`,
    `const name = player.name || ''`
  ],
  [
    `<span>&lt; 5 trận</span>`,
    `<span>&lt; 5 {t('season.matchesCount')}</span>`
  ]
]);

// 8. SeasonSettingsModal.jsx
replaceInFile('src/components/session/SeasonSettingsModal.jsx', [
  [
    `name: 'Thu Rực Lửa',`,
    `name: '',`
  ],
  [
    `const [seasonName, setSeasonName] = useState(season.name || 'Thu Rực Lửa')`,
    `const [seasonName, setSeasonName] = useState(season.name || '')`
  ],
  [
    `{editing ? 'Hủy sửa' : t('season.editSeason') || 'Sửa mùa'}`,
    `{editing ? t('season.cancelEdit') : t('season.editSeason')}`
  ],
  [
    `placeholder="Tên mùa..."`,
    `placeholder={t('season.seasonNamePlaceholder')}`
  ],
  [
    `Lưu thay đổi`,
    `{t('common.saveChanges')}`
  ]
]);
