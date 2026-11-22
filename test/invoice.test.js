const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// Hand-built in-memory fixtures; no database or store imports.
function order(price, hsn, coupon, extra) {
  return {
    id: 42, date: '01/03/2022', customer: 'Test Customer',
    coupon: coupon || '', total: 0,
    items: [Object.assign({ id: 1, name: 'Test item', price, qty: 1, hsn }, extra)]
  };
}

test('18% items without a coupon match checkout', () => {
  const o = order(500, '0902');
  const f = invoice.computeInvoiceFigures(o);
  assert.equal(f.subtotal, 500);
  assert.equal(f.discount, 0);
  assert.equal(f.tax, 90);
  assert.equal(f.total, 590);
  assert.equal(f.cgst, 45);
  assert.equal(f.sgst, 45);
  assert.equal(f.total, pricing.computeTotals(o.items, o.coupon).total);
});

for (const [hsn, expectedTax] of [['1006', 5], ['0405', 12]]) {
  test('HSN ' + hsn + ' determines the invoice GST rate', () => {
    const o = order(100, hsn);
    const f = invoice.computeInvoiceFigures(o);
    assert.equal(f.tax, expectedTax);
    assert.equal(f.rows[0].gstPercent, expectedTax);
    assert.equal(pricing.computeTotals(o.items, '').tax, expectedTax);
  });
}

test('SAVE10 discounts the subtotal before GST', () => {
  const o = order(1020, '1006', 'SAVE10');
  const f = invoice.computeInvoiceFigures(o);
  assert.equal(f.tax, 45.9);
  assert.equal(f.discount, 102);
  assert.equal(f.total, 963.9);
  const checkout = pricing.computeTotals(o.items, o.coupon);
  assert.equal(checkout.tax, 45.9);
  assert.equal(checkout.total, 963.9);
});

test('SAVE10 respects the 150 discount cap', () => {
  const o = order(2240, '1006', 'SAVE10');
  const f = invoice.computeInvoiceFigures(o);
  assert.equal(f.discount, 150);
  assert.equal(f.tax, 104.5);
  assert.equal(f.total, 2194.5);
  assert.equal(pricing.computeTotals(o.items, o.coupon).discount, 150);
});

test('Flat discount reduces taxable value', () => {
  const o = order(400, '0902', 'FLAT50');
  const f = invoice.computeInvoiceFigures(o);
  assert.equal(f.discount, 50);
  assert.equal(f.tax, 63);
  assert.equal(f.total, 413);
  assert.equal(pricing.computeTotals(o.items, o.coupon).tax, 63);
});

test('Coupon minimum order is respected', () => {
  const f = invoice.computeInvoiceFigures(order(100, '0902', 'SAVE10'));
  assert.equal(f.discount, 0);
  assert.equal(f.total, 118);
});

test('Inactive coupon does not discount the invoice', () => {
  const f = invoice.computeInvoiceFigures(order(1000, '0902', 'DIWALI20'));
  assert.equal(f.discount, 0);
  assert.equal(f.total, 1180);
});

test('Coupon text is trimmed and normalized', () => {
  const f = invoice.computeInvoiceFigures(order(1000, '0902', ' save10 '));
  assert.equal(f.discount, 100);
  assert.equal(f.total, 1062);
});

test('Explicit percentage GST rate is used', () => {
  const f = invoice.computeInvoiceFigures(order(100, '0902', '', { gstRate: 5 }));
  assert.equal(f.tax, 5);
  assert.equal(f.rows[0].gstPercent, 5);
});

test('Explicit zero GST is preserved', () => {
  assert.equal(invoice.computeInvoiceFigures(order(100, '1006', '', { gstRate: 0 })).tax, 0);
});

test('Decimal GST rate is interpreted correctly', () => {
  const f = invoice.computeInvoiceFigures(order(100, '1006', '', { gstRate: 0.05 }));
  assert.equal(f.tax, 5);
  assert.equal(f.rows[0].gstPercent, 5);
});

test('Missing items produce zero figures and empty rows', () => {
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
});

test('Rendered SAVE10 invoice matches billing without a warning', () => {
  const o = order(1020, '1006', 'SAVE10');
  o.total = 963.9;
  const original = JSON.stringify(o);
  const html = invoice.render(o);
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
  assert.ok(!html.includes('1083.24'));
  assert.ok(html.includes('963.90'));
  assert.ok(html.includes('45.90'));
  assert.equal(JSON.stringify(o), original);
});

test('Matching invoice omits the warning and escapes customer/item HTML', () => {
  const o = order(500, '0902');
  o.total = 590;
  o.customer = '<script>customer</script>';
  o.items[0].name = '<b>item</b>';
  const html = invoice.render(o);
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
  assert.ok(html.includes('&lt;script&gt;customer&lt;/script&gt;'));
  assert.ok(html.includes('&lt;b&gt;item&lt;/b&gt;'));
});
