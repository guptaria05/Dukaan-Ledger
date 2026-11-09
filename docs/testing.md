# Testing

Before merging changes, run:

    npm install
    npm run typecheck
    npm run build

Manually verify:
- Add a product and confirm it appears in inventory.
- Record a stock purchase and confirm stock and weighted-average cost update.
- Record a sale and confirm stock decreases.
- Confirm a credit sale requires a customer and cannot exceed available stock.
- Collect a customer payment and verify outstanding balances reduce.
- Add an expense and verify the monthly report changes.
- Refresh the browser and confirm records persist in that browser.
- Check navigation at desktop and mobile widths.

The current web milestone does not yet include a dedicated automated component or end-to-end test suite.
