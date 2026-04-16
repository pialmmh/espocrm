# EspoCRM Opportunities

Opportunities represent deals in the sales pipeline. Six stages in base EspoCRM from Prospecting to Closed Won/Lost. Line items and Quotes come from the Sales Pack extension; workflow automation from the Advanced Pack.

**Source**: `espocrm/knowledge_graph.json` (video) + `application/Espo/Modules/Crm/Resources/metadata/entityDefs/Opportunity.json` (code)

## Stage Pipeline

Base EspoCRM has **6 stages** (code is authoritative). The tutorial video shows different stage names ("Perception Analysis", "Proposal/Price Quote", "Negotiation/Review") — those are **customizations** on that demo instance, not base product.

```
Prospecting (10%) → Qualification (20%) → Proposal (50%) → Negotiation (80%) → Closed Won (100%)
                                                                             ↘ Closed Lost (0%)
```

| Stage | Probability | Style class | Notes |
|-------|-------------|-------------|-------|
| Prospecting | 10 | default | Default on create |
| Qualification | 20 | default | Evaluating fit |
| Proposal | 50 | `primary` | Proposal/quote prepared or sent |
| Negotiation | 80 | `warning` | Terms being negotiated |
| Closed Won | 100 | `success` | Deal won |
| Closed Lost | 0 | `info` | Deal lost |

Probability values come from `entityDefs.Opportunity.fields.stage.probabilityMap` and are auto-populated by `Hooks/Opportunity/Probability.php` when creating a new record with no probability set.

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

## Implementation Notes

**2026-04-16 — code cross-reference (PHP source vs. video wiki):**

### Stage enum — only 6 stages in base, not 7
- `entityDefs/Opportunity.json:163-192`: `["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]`.
- Wiki's 7-stage list (with Perception Analysis + Proposal/Price Quote + Negotiation/Review) is a **customized demo**, not stock product. Stage section above has been corrected.
- `audited: true` — all stage transitions are in the audit stream.

### Required fields wiki didn't flag
- `amount` — required, currency, `decimal: false` (no sub-unit / no cents stored — min unit is 1 currency unit).
- `closeDate` — required, date, audited.
- `name` — required.
- React create form must enforce all three before enabling Save.

### Derived / computed fields
- `probability` (int 0-100) — auto-set from `stage.probabilityMap` by `Hooks/Opportunity/Probability.php:50` on new records when no value supplied.
- `lastStage` — tracked by `Hooks/Opportunity/LastStage.php`. Records the last "active" stage (any stage with probability other than 0 or 100). Used to recover the pre-closure stage when an opportunity moves Closed Won → Closed Lost. Lets Closed Lost reports attribute the loss back to the stage where it stalled.
- `amountWeightedConverted` (read-only, non-stored) — computed at query time as `amount * probability * currencyRate / 100`. This is the value shown in "Sales Pipeline" charts — NOT raw `amount`.
- `amountConverted` — `amount` converted to the system default currency via stored rates.

### Stage style (code vs video colors)
- Code `style` only sets 4 of the 6 (`entityDefs/Opportunity.json:177-182`): `Proposal=primary, Negotiation=warning, Closed Won=success, Closed Lost=info`. `Prospecting` and `Qualification` render with default style.
- The wiki's elaborate color table for "Opportunity By Stage" chart (orange/purple/teal/etc.) comes from the chart widget's own palette in `client/modules/crm/src/views/dashlets/opportunities-by-stage.js`, not from these style classes. The two are independent.

### Contact relationship is M:N with a role
- `contacts` linkMultiple with column `role` via `contactOpportunity` table (`Opportunity.json:149-159, 313-326`) — role is the same enum as `Contact.opportunityRole` (Decision Maker, Evaluator, Influencer).
- Separate `contact` belongsTo — this is the **primary** contact on the deal. The conversion flow from Lead sets both (see `Tools/Lead/ConvertService.php:370-382`).

### Line items are NOT in base Opportunity
- Base `entityDefs/Opportunity.json` has no `items` field. The "Items" panel shown in the wiki is from the **Sales Pack** extension. If the extension isn't installed, the panel doesn't exist — the React rewrite should gate this feature behind a metadata presence check (`entityDefs.Opportunity.fields.items` exists?).

### Auto-create Quote on stage change
- Wiki describes "Auto Create Quote" workflow firing on stage = Proposal/Price Quote. This requires the **Advanced Pack** (Workflows) extension and is a user-configured rule, not hardcoded logic. Not present in this repo's code.

### Hooks registered on Opportunity
`Hooks/Opportunity/`: `AmountWeightedConverted`, `Contacts` (primary link maintenance), `LastStage`, `Probability`. All BeforeSave.

### Back-reference
- `originalLead` linkOne → Lead.createdOpportunity (`Opportunity.json:224-228, 367-371`). How a deal traces back to its source enquiry.
