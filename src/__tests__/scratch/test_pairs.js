import { rankPairs } from '#lib/rating.js';
import fs from 'fs';

// Let's inspect test matches from pair_synergy_matchup.test.js
const sampleMatches = [
  { id: 'm1', teamA: ['p1', 'p2'], teamB: ['p3', 'p4'], winnerTeam: 'A', sets: [[21, 15]] },
  { id: 'm2', teamA: ['p1', 'p2'], teamB: ['p3', 'p4'], winnerTeam: 'A', sets: [[21, 18]] },
  { id: 'm3', teamA: ['p1', 'p2'], teamB: ['p5', 'p6'], winnerTeam: 'B', sets: [[18, 21]] },
];

console.log('sampleMatches count:', sampleMatches?.length);
const res = rankPairs(sampleMatches || [], {}, {}, { format: 'all', minGames: 1 });
console.log('rankedPairs count:', res.rankedPairs?.length);
if (res.rankedPairs?.length > 0) {
  console.log('First 3 pairs:');
  res.rankedPairs.slice(0, 3).forEach((p, i) => {
    console.log(`Pair ${i}:`, {
      key: p.key,
      names: p.names,
      gamesCount: p.gamesCount,
      synergyScore: p.synergyScore,
      trend: p.trend,
      confidence: p.confidence,
      pairImpact: p.pairImpact,
      actualWinPct: p.actualWinPct,
      expectedWinPct: p.expectedWinPct
    });
  });
}
