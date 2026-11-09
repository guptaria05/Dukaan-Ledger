# Testing strategy

## Automated checks

GitHub Actions runs on pushes and pull requests:

1. Install Node dependencies.
2. Run TypeScript type checking.
3. Run Vitest unit tests for money, quantities, gross profit and outstanding balances.
4. Export the Android JavaScript bundle with Expo to catch Metro and route bundling failures.

## Manual device checks before a pilot

- Create a product and verify it remains after app restart.
- Record a purchase and verify stock and weighted-average cost.
- Record a fully paid walk-in sale.
- Record a partly paid customer sale and verify outstanding balance.
- Collect a partial customer payment and verify the balance decreases.
- Attempt to sell more stock than is available; confirm it is rejected.
- Attempt an unpaid walk-in sale; confirm a customer must be selected.
- Enable airplane mode and verify local operations still work.
- Export/restore a database backup once backup support is added.

## Current limitations

The automated pipeline does not yet run an Android emulator or end-to-end UI tests. CI success is necessary but not a substitute for testing on real Android devices.
