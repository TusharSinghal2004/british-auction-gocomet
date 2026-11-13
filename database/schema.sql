-- GoComet British Auction RFQ: SQLite schema matching src/server.js.
-- The application creates these tables automatically on startup.
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS auctions (
    id INTEGER PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY,
    auction_id INTEGER NOT NULL REFERENCES auctions(id),
    payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY,
    auction_id INTEGER NOT NULL REFERENCES auctions(id),
    created INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL
);

-- auctions.payload JSON keys:
-- name, reference: string
-- start, close, forcedClose, pickup: UTC epoch milliseconds
-- triggerWindow, extension: integer minutes
-- trigger: 'bid' | 'rank' | 'leader'
-- british: boolean
--
-- bids.payload JSON keys:
-- carrier: string (case-insensitive identity in application)
-- freight, origin, destination, total: numeric USD amounts
-- transit: integer days
-- validity, created: UTC epoch milliseconds
--
-- activity.type: 'created' | 'bid' | 'extension'
-- activity.created: UTC epoch milliseconds
--
-- Relationships:
-- auctions 1 -> N bids
-- auctions 1 -> N activity
-- Rankings and status are computed; bid history is retained.
-- Payload validation and extension caps are enforced by src/auction.js.
