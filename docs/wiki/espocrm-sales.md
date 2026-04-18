# EspoCRM Sales — Quotes, Invoices, Sales Orders, Products

The Sales module covers the post-opportunity commercial documents. Part of the **Sales Pack** extension. Quotes link directly to Opportunities and Accounts with line items.

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
