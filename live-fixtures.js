// Vercel serverless function: GET /api/live-fixtures
// Returns all currently live fixtures, trimmed to what the picker UI needs.
// Requires env var API_FOOTBALL_KEY set in your Vercel project settings.

export default async function handler(req, res) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API_FOOTBALL_KEY is not set on the server' });
  }

  try {
    const response = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
      headers: { 'x-apisports-key': apiKey }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `API-Football returned ${response.status}` });
    }

    const data = await response.json();

    // Trim the response down to what the match picker needs.
    const fixtures = (data.response || []).map(f => ({
      id: f.fixture.id,
      home: f.teams.home.name,
      away: f.teams.away.name,
      homeLogo: f.teams.home.logo,
      awayLogo: f.teams.away.logo,
      competition: f.league.name,
      country: f.league.country,
      minute: f.fixture.status.elapsed,
      homeGoals: f.goals.home,
      awayGoals: f.goals.away,
    }));

    // Cache for 15s at the edge to avoid burning quota if multiple users/tabs poll close together
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res.status(200).json({ fixtures });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
