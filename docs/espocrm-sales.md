# EspoCRM Sales — Quotes, Invoices, Sales Orders, Products

The Sales module covers the post-opportunity commercial documents. Part of the **Sales Pack** extension. Quotes link directly to Opportunities and Accounts with line items.

> ⚠ **Not in this repo.** The entire Sales Pack (Quotes, Invoices, Sales Orders, Products, Purchase Orders, Inventory) is a paid EspoCRM extension. `application/Espo/Modules/` in this codebase contains only `Crm/` — no `Quote.json`, `Invoice.json`, `Product.json` entity definitions exist. See **Implementation Notes** at the bottom before planning any React work against this module.

**Source**: `espocrm/knowledge_graph.json`

## Quotes

### Navigation
Sales > Quotes

### Quote Numbering
Auto-incremented: **Q-NNNNN** (e.g. Q-00011, Q-00005)

### Statuses
| Status | Notes |
|--------|-------|
| Draft | Default on creation. Quote being prepared. |
| Sent | Not fully visible in source — assumed next status |
| Accepted | Not fully visible in source |
| Rejected | Not fully visible in source |
| Cancelled | Not fully visible in source |

### Detail Page — Overview Tab

| Field | Type | Notes |
|-------|------|-------|
| Quote Number | Auto | Q-NNNNN format |
| Status | Dropdown | Draft default |
| Opportunity | Relate | Linked opportunity |
| Account | Relate | Linked account |
| Amount | Currency | Total quote value |
| Date Quoted | Date | |

### Detail Page — Right Panel

| Field | Notes |
|-------|-------|
| Assigned User | |
| Teams | |
| Amount (converted) | In base currency |
| Date Quoted | |
| Invoice Number | Links to Invoice when raised |
| Date Ordered | When order placed |
| Created | Datetime + user |

### Items Section (Line Items)

| Column | Type |
|--------|------|
| Name | Product name |
| Qty | Quantity |
| List Price | Standard price |
| Unit Price | Negotiated price |
| Amount Express | Line total |

### Detail Page — Details Tab
Additional fields (not fully visible in source).

### Workflow Integration
Quotes can be auto-created via Workflow when an Opportunity reaches **Proposal/Price Quote** stage. The auto-created Quote is linked to the Opportunity. See [espocrm-workflows.md](espocrm-workflows.md).

### Example Record
```
Quote Number: Q-00011
Status:       Draft
Opportunity:  Sales
Account:      enable
Amount:       £10,000.00 (GBP)
Items:        Bar Towel — Qty: 100, List: £100, Unit: £100, Amount: £10,000
```

---

## Invoices

### Navigation
Sales > Invoices

Linked to Quotes (Invoice Number field on Quote). Minimal detail visible in source.

---

## Sales Orders

### Navigation
Sales > Sales Orders

Post-quote order management. Minimal detail visible in source.

---

## Products

### Navigation
Sales > Products

Product catalogue referenced in Opportunity line items and Quotes. Minimal detail visible in source.

---

## Purchase Orders (Sales Pack)

Part of the Sales Pack extension along with Quotes, Invoices, Sales Orders. Purchase order management toward suppliers. Not shown in source video.

---

## Inventory Management (Sales Pack)

Stock/inventory tracking. Part of Sales Pack. Not shown in source video.

## See Also
- [espocrm-opportunities.md](espocrm-opportunities.md) — Opportunities that Quotes are linked to
- [espocrm-workflows.md](espocrm-workflows.md) — Auto-create Quote automation
- [espocrm-administration.md](espocrm-administration.md) — Sales Pack extension install
- [espocrm-data-entities.md](espocrm-data-entities.md) — Quote entity full field list

## Implementation Notes

**2026-04-16 — code cross-reference (PHP source vs. video wiki):**

### Sales Pack is entirely absent from this repo
Verified by search — these are the facts:
- `application/Espo/Modules/` contains only `Crm/`. No `Sales`, `Quote`, `Invoice`, `Product` module directory.
- No `entityDefs/Quote.json`, `Invoice.json`, `SalesOrder.json`, `Product.json`, `PurchaseOrder.json` anywhere under `application/` or `custom/`.
- `custom/Espo/Modules/` has empty stub folders only (`Controllers/`, `Resources/`).
- Quote auto-numbering (Q-NNNNN), line items, Opportunity↔Quote relationship, Invoice raising — none of this exists in the current codebase.

So **every behavior described in this wiki page is aspirational** relative to the running code. The wiki is correct about what Sales Pack looks like when installed; it's just that it isn't installed.

### Three paths forward for the React rewrite

**(a) Install the Sales Pack extension.** It's a paid EspoCRM Inc. product. After install, the extension drops entity defs into `application/Espo/Modules/Sales/Resources/metadata/entityDefs/` and the `/api/v1/Quote`, `/api/v1/Invoice`, `/api/v1/Product` endpoints go live. The React metadata-driven engine would then pick them up automatically with no code changes. Cheapest option if budget allows.

**(b) Build custom Quote/Invoice/Product entities via EspoCRM's Entity Manager.** Creates metadata in `custom/Espo/Custom/Resources/metadata/entityDefs/`. We own the schema, we own the behavior. Works through the same `/api/v1/` API. This is what we'd do if we want Sales tightly coupled to our telecom/billing model — e.g., Quote has a `sipTrunkCount`, `monthlyRecurringCharge`, `installFee` instead of the generic Sales Pack shape.

**(c) Skip Sales in EspoCRM entirely and hand it to Odoo.** Matches the CRM/ERP boundary decision already made (Accounts/Contacts sync Espo → Odoo). Opportunity "Closed Won" becomes the handoff trigger that pushes a sales order into Odoo. The React UI would show Odoo quotes/invoices via an iframe or a thin read proxy. Zero Sales Pack cost, no custom entity work in Espo.

### Recommendation
Given the decision earlier in this repo to keep Odoo as the ERP system of record (accounting + inventory + sales/purchases), **option (c)** is the natural fit. The React rewrite should:
- NOT plan a Quotes/Invoices UI inside the Espo frontend.
- Have the Opportunity detail page show "View in Odoo" links for any created Sales Order / Invoice (deep-link into Odoo via `odoo_partner_id` + odoo sales order id stored back on Opportunity).
- Keep this wiki page as a reference for what "full EspoCRM" looks like, in case option (a) or (b) is revisited later.

### Data fields observed in wiki that would NOT need porting under option (c)
Quote.status, Quote.quoteNumber, Quote line items, Invoice.number, Sales Order, Product catalogue — all handled by Odoo's `sale.order`, `account.move`, `product.product`.

### If option (b) is chosen later, the missing schema to design
- `Quote`: number (auto-gen Q-NNNNN), status (Draft/Sent/Accepted/Rejected/Cancelled), opportunityId, accountId, amount, dateQuoted, assignedUserId, items (JSON or child entity)
- `Invoice`: number, status (Draft/Sent/Paid/Overdue/Cancelled), quoteId, accountId, amount, dateIssued, dateDue
- `Product`: name, sku, listPrice, cost, description, active
- `QuoteItem` (child of Quote): productId, qty, listPrice, unitPrice, lineAmount, description
- Relationships: Quote → Opportunity (belongsTo), Quote → Account (belongsTo), Quote hasMany QuoteItem, Invoice → Quote (belongsTo), QuoteItem → Product (belongsTo).

None of this is needed to ship the core CRM React app — defer until Sales direction is decided.
