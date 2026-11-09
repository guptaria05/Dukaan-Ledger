# Architecture

## Current milestone

Expo Router + React Native + TypeScript with a local SQLite database. The first milestone is local-first so core workflows work without a network connection.

## Modules

- Inventory: products, SKU, category, unit, purchase/selling price and stock.
- Procurement: purchases increase stock and capture supplier and cost.
- Sales: capture snapshots of item name, unit cost and selling price, then decrement stock.
- Customer ledger: customer-linked sales create outstanding balances; later payments reduce them.
- Reporting: daily sales, gross profit, inventory cost value, low-stock count and monthly gross profit.

## Data integrity

- Currency is stored as integer paise.
- Sales, sale items, stock decrement and initial payment are written in one SQLite transaction.
- Sale items snapshot cost at sale time; later product price changes do not rewrite historical gross profit.
- Posted financial history should be corrected with reversing entries, not silent deletion.
- Database constraints validate quantities and monetary values.

## Future cloud milestones

Add shop, user and membership entities before enabling cloud sync. Enforce tenant-scoped authorization server-side. Use an outbox with idempotency keys, conflict handling, encrypted transport, backups and export/deletion flows. Do not enable multi-device sync until tenant isolation and conflict behavior are tested.
