# GoComet · British Auction RFQ

A complete local assignment implementation with a responsive frontend, Node.js HTTP API, and persistent SQLite database. No npm dependencies or external database setup required.

## Run

Install **Node.js 24 or later**, then run from this folder:

```sh
npm start
```

Open http://localhost:3000. Run `npm test` to verify auction rules, or `npm run dev` for automatic backend reloads. SQLite's experimental warning on some Node versions is expected. Data is stored in `data/auctions.sqlite`; sample auctions are created on the first start. Set `PORT` or `DB_PATH` environment variables to override defaults.

## Features

- Searchable auction list with status filters, lowest quotes, live countdowns and five-second refresh.
- RFQ creation with start, close, forced close, service date, and British auction configuration.
- Quotes with carrier, three charge components, transit days and validity.
- Supplier ranking by the latest quote's total. All bid revisions remain in history.
- Bid, rank-change, and L1-change extension triggers, capped at the forced close.
- Persistent activity log recording bids and extension reasons.
- Server validation and atomic bid/extension/log writes in one transaction.

## Rule decisions

Each supplier can revise its quote only downwards; a quote need not beat L1 to participate. Supplier names are case insensitive identifiers in this simplified assignment. Rankings use total freight + origin + destination charges in USD. Ties favor earlier submissions. A first bid establishes the leaderboard and does not count as a rank change; a new supplier can trigger rank changes if existing suppliers move. Extensions add Y minutes to the current close time, once per qualifying bid. The trigger window includes its start boundary; the close boundary rejects bids. An auction that reaches its forced-close cap reports Force Closed when that deadline passes; an auction that ends earlier reports Closed. Scheduled is included as an additional pre-start status.

This is a local demonstration without authentication or multi-tenant authorization. The server binds to localhost. Production would require authenticated buyer/supplier identities, role permissions, request limits, and a managed transactional database. Dates are stored as UTC milliseconds and shown in the browser's local timezone. Demo records use relative timestamps only when the database is initially created.

Architecture, schema and API: [docs/architecture.md](docs/architecture.md).
