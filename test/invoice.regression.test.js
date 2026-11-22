const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

test('Invoice uses HSN GST after SAVE10 and matches the billed total', () => {
  const order = {
    id: 1002, customer: 'Test customer', coupon: 'SAVE10', total: 963.9,
    items: [{ id: 1, name: 'Test rice', hsn: '1006', price: 1020, qty: 1 }]
  };
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.total, 963.9);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.discount, 102);
  assert.equal(figures.cgst, 22.95);
  assert.equal(figures.sgst, 22.95);
});

test('Mixed HSN invoice allocates discount before line tax and does not mutate input', () => {
  const order = { coupon: 'SAVE10', items: [
    { id: 1, name: 'Test rice', hsn: '1006', price: 500, qty: 1 },
    { id: 2, name: 'Test ghee', hsn: '0405', price: 500, qty: 1 }
  ] };
  const before = JSON.stringify(order);
  const f = invoice.computeInvoiceFigures(order);
  assert.equal(f.discount, 100);
  assert.equal(f.tax, 76.5);
  assert.equal(f.total, 976.5);
  assert.deepEqual(f.rows.map(r => [r.gstPercent, r.lineTax]), [[5, 22.5], [12, 54]]);
  assert.equal(JSON.stringify(order), before);
});

test('Reconciliation warning remains for genuinely inconsistent stored totals', () => {
  const order = { id: 42, total: 1, items: [
    { id: 1, name: 'Test tea', hsn: '0902', price: 500, qty: 1 }
  ] };
  assert.ok(invoice.render(order).includes('Accountant Reconciliation Notice:'));
});
