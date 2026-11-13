# GoComet Assignment Submission

## Four requested deliverables

1. **Frontend code:** `public/index.html`, `public/style.css`, `public/app.js`.
2. **Backend code:** `src/server.js` (HTTP API, persistence), `src/auction.js` (validation, rankings and extension rules).
3. **Database schema:** `database/schema.sql`. Field descriptions and relationships are also documented in `docs/architecture.md`.
4. **High-level design and architecture diagram:** `docs/architecture.md` and `docs/architecture.svg`. Open the SVG directly in any browser to view the diagram.

## Run the submission

Requires Node.js 24 or later. No dependency installation is needed.

```sh
npm start
```

Open http://localhost:3000. If port 3000 is occupied, use PowerShell:

```powershell
$env:PORT='3001'
npm start
```

Then open http://127.0.0.1:3001.

The backend serves the frontend and automatically initializes the database with sample RFQs. There is no separate frontend server or database setup step. Runtime data is created in `data/` and is deliberately excluded from this submission so the reviewer receives fresh sample auctions.

## Verification

```sh
npm test
```

Includes 14 automated tests covering auction rules and the HTTP creation/bidding flow. The API integration test starts an isolated in-memory server on port 3199. See `README.md` for behavior decisions and implementation limits.

## Suggested demonstration

Create an RFQ that starts before now, closes in five minutes, and has a forced-close time fifteen minutes from now. Enable British auctions with a ten-minute trigger window, five-minute extension, and the any-bid trigger. Submit quotes for two suppliers; observe the ranked totals, updated deadline and activity log. Further extensions stop at the forced-close cap.
