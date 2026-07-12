betiq-live/
├── index.html          ← the app (picker, live monitor, backtest lab)
├── package.json
└── api/
    ├── live-fixtures.js  ← GET /api/live-fixtures  (list of currently live matches)
    └── fixture-stats.js  ← GET /api/fixture-stats?fixtureId=X  (stats for one match)
