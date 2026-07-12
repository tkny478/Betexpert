// Vercel serverless function: GET /api/fixture-stats?fixtureId=12345
// Fetches live statistics for one fixture and normalizes them into the
// { shotsOnTarget, dangerousAttacks, corners, possession, goals } shape
// that computePressureScores() expects.
//
// IMPORTANT MAPPING NOTE:
// API-Football's official /fixtures/statistics endpoint does NOT expose a
// "Dangerous Attacks" stat (that field exists on some other providers like
// SportMonks, not API-Football). As a substitute proxy for attacking
// pressure, this uses "Shots insidebox" + "Total Shots", which correlates
// reasonably well with sustained attacking pressure. If your API-Football
// plan/tier ever adds attacks data, swap the proxy calc below for the real field.

export default async function handler(req, res) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API_FOOTBALL_KEY is not set on the server' });
  }

  const { fixtureId } = req.query;
  if (!fixtureId) {
    return res.status(400).json({ error: 'fixtureId query param is required' });
  }

  try {
    const [statsRes, fixtureRes] = await Promise.all([
      fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`, {
        headers: { 'x-apisports-key': apiKey }
      }),
      fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
        headers: { 'x-apisports-key': apiKey }
      })
    ]);

    if (!statsRes.ok || !fixtureRes.ok) {
      return res.status(502).json({ error: 'API-Football request failed' });
    }

    const statsData = await statsRes.json();
    const fixtureData = await fixtureRes.json();
    const fixtureInfo = fixtureData.response?.[0];
    const minute = fixtureInfo?.fixture?.status?.elapsed ?? null;
    const goals = fixtureInfo?.goals || { home: 0, away: 0 };

    function pick(statsArray, typeName) {
      const row = (statsArray || []).find(s => s.type === typeName);
      const val = row?.value;
      if (val === null || val === undefined) return 0;
      if (typeof val === 'string' && val.includes('%')) return parseInt(val, 10) || 0;
      return Number(val) || 0;
    }

    function normalizeTeam(teamStatsBlock, teamGoals) {
      const stats = teamStatsBlock?.statistics || [];
      const shotsOnTarget = pick(stats, 'Shots on Goal');
      const shotsInsideBox = pick(stats, 'Shots insidebox');
      const totalShots = pick(stats, 'Total Shots');
      const corners = pick(stats, 'Corner Kicks');
      const possession = pick(stats, 'Ball Possession');

      // Proxy for "dangerous attacks" — API-Football has no native field for it.
      const dangerousAttacks = shotsInsideBox * 3 + totalShots;

      return { shotsOnTarget, corners, possession, dangerousAttacks, goals: teamGoals || 0 };
    }

    const blocks = statsData.response || [];
    const homeBlock = blocks[0];
    const awayBlock = blocks[1];

    const home = normalizeTeam(homeBlock, goals.home);
    const away = normalizeTeam(awayBlock, goals.away);

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
    return res.status(200).json({ fixtureId: Number(fixtureId), minute, home, away });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
