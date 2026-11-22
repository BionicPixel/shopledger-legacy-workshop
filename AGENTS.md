# ShopLedger instructions for Codex

## Stack today

- ShopLedger 0.8.4: Node.js, CommonJS JavaScript, Express and body-parser.
- package.json declares express ^4.17.1 and body-parser ^1.19.0; package-lock.json resolves Express 4.22.3 and body-parser 1.20.9.
- Browser UI uses plain HTML, CSS and JavaScript with XMLHttpRequest. No frontend build step.
- Persistence is synchronous JSON file I/O through lib/store.js, not a database server.
- config.js selects process.env.PORT or port 3000. No Node engine version is declared.

## Module map

| Path | Responsibility |
| --- | --- |
| server.js | Express setup, static public/ files, /api router mounting, HTML invoice endpoint |
| public/index.html, public/css/style.css, public/js/app.js | POS, order history, customer Khata, inventory and GST audit UI |
| routes/products.js | Product filtering and active coupons |
| routes/orders.js | Order creation, retrieval, filtering and cancellation |
| routes/customers.js | Customer balances and settlement requests |
| routes/reports.js | Dashboard, GST reconciliation, pricing preview and keyed data export |
| lib/store.js | Read/write data/db.json, fill missing structure, append capped audit log |
| lib/inventory.js | Sellable stock, stock checks, deductions, release and summary |
| lib/orders.js | Order records, lookup, filtering and cancellation orchestration |
| lib/pricing.js | Discount allocation, line taxes and totals; used by checkout and invoices |
| lib/coupons.js | Coupon normalization, validation, minimums and caps |
| lib/tax.js | Explicit/HSN tax rates and CGST/SGST split |
| lib/ledger.js | Customer credit limits, order charges, reversals and settlements |
| lib/dates.js | DD/MM/YYYY dates, input normalization and fiscal-year labels |
| lib/invoice.js | Invoice figures via pricing.js and printable HTML |
| lib/reports.js | Dashboard totals and invoice/order reconciliation |
| config.js | Port, shop details, admin key, tax slabs, inventory defaults and coupon definitions |
| data/db.json | Products, orders, customers, settlements, audit entries and ID counters |
| test/invoice.test.js | Node assert regression checks for invoice figures, rendering and reconciliation |
| docs/architecture.png | Current architecture and order-placement flow |

## Commands

- npm ci: install dependencies from the committed lockfile (writes node_modules; requires installation authorization when applicable).
- npm start: runs node server.js and starts the HTTP server.
- npm test: runs node --test across the test suite.
- node test/invoice.test.js: run the existing invoice regression checks directly.
- git diff --check: check patch whitespace.
- No build or lint script is configured.

## Working rules

1. Write characterization tests before changing behavior. Capture the current behavior with isolated fixtures, then add a regression expectation for the requested correction.
2. Change only the application module the ticket is about. Keep its tests focused; do not refactor unrelated modules. Explain and obtain agreement if another application module must change.
3. Never edit data/db.json. Tests must not read, write, reset or otherwise touch it; use independent fixtures and in-memory objects or a stubbed store.
4. Add no dependencies.

## Existing exceptions and known behavior

- Invoice tests use node:test with independent in-memory fixtures and do not access data/db.json. test/invoice.regression.test.js covers the ticket regression and mixed HSN calculations.
- The invoice engine already shares checkout pricing (Ticket 1).
- Inventory still rejects quantities equal to sellable stock. Its release function looks up productId instead of order item id and changes reserved stock instead of restoring physical stock. Ticket 2 is not fixed in this checkout.
- Comments describing a reset endpoint and PDF endpoint do not represent implemented routes.
