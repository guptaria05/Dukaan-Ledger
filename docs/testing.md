# Testing

Before merging changes, run:

    npm install
    npm run typecheck
    npm run build

Manually verify:
- Dashboard revenue Today, MTD and YTD use the expected date boundaries.
- Year chart shows month totals; Month chart shows daily totals; Day chart shows hourly totals for the selected date.
- Add a product with a custom category, cost price, default selling price and opening stock.
- Record stock purchase with a vendor and confirm stock and weighted-average cost update.
- Confirm stock movement history and monthly added-unit count update.
- Download weekly stock review and overall inventory CSV files.
- Record a sale with a different selling price and confirm the product default price is unchanged and sale-time cost is retained.
- Confirm credit sales require a customer and cannot exceed available stock.
- Check customer-wise items bought, quantities, total sales, paid amount and outstanding dues.
- Add a customer and confirm the date is saved; check last-month customer view.
- Check vendor purchase totals and seasonal product links.
- Collect a customer payment and verify outstanding balances reduce.
- Add an expense and verify the monthly net-profit estimate changes.
- Refresh the browser and confirm records persist in that browser.
- Check navigation and tables at desktop and mobile widths.

The current milestone does not yet include a dedicated automated component or end-to-end test suite.
