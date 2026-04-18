# EspoCRM Opportunities

Opportunities represent deals in the sales pipeline. Seven stages from Prospecting to Closed Won/Lost. Support line items (products), linked Quotes, and workflow automation.

**Source**: `espocrm/knowledge_graph.json`

## Stage Pipeline

```
Prospecting → Qualification → Perception Analysis → Proposal/Price Quote → Negotiation/Review → Closed Won
                                                                                               ↘ Closed Lost
```

| Stage | Notes |
|-------|-------|
| Prospecting | Initial stage — interest identified |
| Qualification | Evaluating fit |
| Perception Analysis | Understanding needs / perception |
| Proposal/Price Quote | Quote being prepared or sent. **Workflow trigger**: auto-creates a Quote record |
| Negotiation/Review | Terms being negotiated |
| Closed Won | Deal won |
| Closed Lost | Deal lost |

## List View

Columns: Name, Account, Stage, Amount, Close Date, Assigned User

Actions: + Create Opportunity, search, scope filter

## Detail Page

### Main Fields

| Field | Type | Notes |
|-------|------|-------|
| Name | Text | Required |
| Stage | Dropdown | 7 stages (see pipeline above) |
| Amount | Currency | Deal value |
| Currency | Dropdown | GBP default |
| Contacts | Relate (multi) | Linked contact people |
| Lead Source | Dropdown | Web Site, and others |
| Description | Long text | |

### Right Panel

| Field | Notes |
|-------|-------|
| Assigned User | Owner of this opportunity |
| Teams | Team visibility |
| Created | Datetime + user |
| Modified | Datetime + user |
| Followers | Users following this record |

### Tabs

**Internal Collaboration / Newsfeed** — stream comments and stage-change log

**Related Entities** tab shows:
| Panel | Description |
|-------|-------------|
| Quotes | Linked quotes (Q-NNNNN). New quotes auto-created at Proposal/Price Quote stage via workflow |
| Documents | Attached documents |
| Items | Line items (product list for this deal) |

### Items (Line Items)

| Column | Type |
|--------|------|
| Name | Product name |
| Qty | Quantity |
| List Price | Standard price |
| Unit Price | Negotiated price |
| Amount | Qty × Unit Price |

### Activities Panel (right side)
- Activities: email, log call, new task, new event buttons
- **History** — completed activity records
- **Tasks** — open tasks related to this opportunity

## Workflow Integration

When Opportunity reaches **Proposal/Price Quote** stage, a Workflow rule auto-creates a linked Quote record (via "Auto Create Quote" workflow). See [espocrm-workflows.md](espocrm-workflows.md).

## Example Record

```
Name:     Sales
Stage:    Proposal/Price Quote
Amount:   £10,000 (GBP)
Account:  enable
Contacts: James Bleese
Related:  Quote Q-00011 (auto-created), Activity: First Reach Out
```

## See Also
- [espocrm-sales.md](espocrm-sales.md) — Quotes linked to Opportunities
- [espocrm-workflows.md](espocrm-workflows.md) — Auto-create Quote workflow
- [espocrm-enquiries.md](espocrm-enquiries.md) — Opportunities created via Enquiry conversion
- [espocrm-data-entities.md](espocrm-data-entities.md) — Full field list
- [espocrm-dashboard-reports.md](espocrm-dashboard-reports.md) — Opportunity By Stage dashboard chart
