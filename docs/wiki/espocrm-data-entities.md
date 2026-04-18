# EspoCRM Data Entities

All entity types, fields, and relationships extracted from the EspoCRM tutorial. Use this as the foundation for DB schema design.

**Source**: `espocrm/knowledge_graph.json`

## Entity Relationship Overview

```
Enquiry (Lead)
  ├── converts to → Account
  ├── converts to → Contact
  ├── converts to → Opportunity
  └── linked to ← Target Lists (Marketing)

Account
  ├── has many → Contacts
  ├── has many → Opportunities
  ├── has many → Quotes
  └── has many → Tasks

Contact
  ├── belongs to → Account (multi)
  └── has many → Opportunities (via join)

Opportunity
  ├── belongs to → Account
  ├── has many → Contacts (via join)
  ├── has many → Quotes
  ├── has many → Documents
  ├── has many → Line Items
  └── has many → Tasks

Quote
  ├── belongs to → Opportunity
  ├── belongs to → Account
  └── has many → Line Items

Task
  ├── assigned to → User
  └── related to → Account (or other entity)

Report
  └── queries → any Entity Type

Workflow
  └── fires on → any Entity Type
```

---

## Enquiry (internal name: Lead)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | uuid | auto | |
| status | enum | — | New, Assigned, In Process, Recycled, Dead. Default: New |
| source | enum | — | Web Site, and others |
| name | text | yes | Full name |
| account_name | text | — | Company name (free text, not a relate) |
| email | email | — | |
| phone | phone | — | |
| title | text | — | Job title |
| address | address | — | Single address block |
| assigned_user_id | relate | — | → User |
| teams | relate_multi | — | → Teams |
| map | map | — | Based on address |
| created_at | datetime | auto | |
| created_by_id | relate | auto | → User |
| modified_at | datetime | auto | |
| modified_by_id | relate | auto | → User |

**Relationships**:
- Enquiry → has many → Target Lists (via junction table)
- Enquiry → converted → Account (one-to-one, post-conversion)
- Enquiry → converted → Contact (one-to-one, post-conversion)
- Enquiry → converted → Opportunity (one-to-one, post-conversion)

---

## Contact

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | uuid | auto | |
| name | text | yes | First + last name |
| email | email | — | |
| phone | phone | — | |
| address | address | — | |
| description | text | — | |
| assigned_user_id | relate | — | → User |
| teams | relate_multi | — | → Teams |
| map | map | — | |
| created_at | datetime | auto | |
| created_by_id | relate | auto | → User |

**Relationships**:
- Contact ↔ Account (many-to-many via junction)
- Contact ↔ Opportunity (many-to-many via junction)

---

## Account

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | uuid | auto | |
| name | text | yes | |
| email | email | — | |
| phone | phone | — | |
| type | enum | — | Prospect, Customer, Investor, Partner, Reseller, Consultant. Default: Prospect |
| sector | text | — | Industry/sector |
| billing_address | address | — | Street, City, County, Postal Code, Country |
| shipping_address | address | — | |
| description | text | — | |
| map | map | — | Based on billing address |
| assigned_user_id | relate | — | → User |
| teams | relate_multi | — | → Teams |
| created_at | datetime | auto | |
| created_by_id | relate | auto | → User |

**Relationships**:
- Account → has many → Contacts
- Account → has many → Opportunities
- Account → has many → Quotes
- Account → has many → Tasks

---

## Opportunity

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | uuid | auto | |
| name | text | yes | |
| stage | enum | yes | Prospecting, Qualification, Perception Analysis, Proposal/Price Quote, Negotiation/Review, Closed Won, Closed Lost |
| amount | currency | — | |
| currency | text | — | GBP default |
| lead_source | enum | — | Web Site, and others |
| description | text | — | |
| account_id | relate | — | → Account |
| assigned_user_id | relate | — | → User |
| teams | relate_multi | — | → Teams |
| created_at | datetime | auto | |
| created_by_id | relate | auto | → User |
| modified_at | datetime | auto | |
| modified_by_id | relate | auto | → User |

**Relationships**:
- Opportunity ↔ Contacts (many-to-many via junction)
- Opportunity → has many → Quotes
- Opportunity → has many → Documents
- Opportunity → has many → Line Items (OpportunityItem)
- Opportunity → has many → Tasks

---

## Quote

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | uuid | auto | |
| quote_number | text | auto | Q-NNNNN format, auto-incremented |
| status | enum | — | Draft, Sent, Accepted, Rejected, Cancelled. Default: Draft |
| opportunity_id | relate | — | → Opportunity |
| account_id | relate | — | → Account |
| amount | currency | — | Total |
| amount_converted | currency | auto | In base currency |
| date_quoted | date | — | |
| invoice_number | text | — | Reference to Invoice |
| date_ordered | date | — | When order placed |
| assigned_user_id | relate | — | → User |
| teams | relate_multi | — | → Teams |
| created_at | datetime | auto | |
| created_by_id | relate | auto | → User |

**Line Item (QuoteItem)**:

| Field | Type | Notes |
|-------|------|-------|
| name | text | Product/service name |
| qty | decimal | Quantity |
| list_price | currency | Standard price |
| unit_price | currency | Negotiated price |
| amount | currency | Qty × unit_price |
| quote_id | relate | → Quote (parent) |

---

## Task

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | uuid | auto | |
| name | text | yes | Task subject |
| status | enum | — | Not Started, In Progress, Completed. Default: Not Started |
| priority | enum | — | Normal, High, Urgent. Default: Normal |
| date_due | datetime | — | |
| assigned_user_id | relate | — | → User |
| parent_type | text | — | Entity type of related record (Account, Opportunity, etc.) |
| parent_id | uuid | — | ID of related record |
| description | text | — | |
| created_at | datetime | auto | |

---

## Report

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | auto |
| name | text | Report name |
| type | enum | Grid |
| category | text | Optional grouping |
| entity_type | text | Entity queried (Task, Opportunity, Lead, etc.) |
| columns | json | Column definitions |
| grouping | json | Group by field config |
| chart_type | enum | pie, bar, line |
| assigned_user_id | relate | → User |
| teams | relate_multi | → Teams |
| created_at | datetime | auto |
| created_by_id | relate | → User |

---

## Workflow

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | auto |
| name | text | Workflow rule name |
| entity_type | text | Entity this fires on |
| trigger | enum | record_created, record_updated, field_changed |
| conditions | json | Condition group with field/operator/value rules |
| actions | json | Action definitions (type + parameters) |
| created_at | datetime | auto |
| created_by_id | relate | → User |

**WorkflowLog**:

| Field | Type | Notes |
|-------|------|-------|
| workflow_id | relate | → Workflow |
| target_id | uuid | ID of record that triggered it |
| target_type | text | Entity type of trigger record |
| created_by_id | relate | → User who triggered |
| created_at | datetime | Execution timestamp |

---

## User

| Field | Notes |
|-------|-------|
| name | Full name (e.g. James Bleese, Sally Thomas, Joseph Bush) |
| email | User email |
| role | Drives dashboard tab visibility |
| teams | Team memberships |

## See Also
- [espocrm-modules.md](espocrm-modules.md) — Module overview and navigation
- [espocrm-enquiries.md](espocrm-enquiries.md) — Enquiry conversion flow
- [espocrm-opportunities.md](espocrm-opportunities.md) — Opportunity pipeline and stage rules
- [espocrm-sales.md](espocrm-sales.md) — Quote and line item details
- [espocrm-workflows.md](espocrm-workflows.md) — Workflow and WorkflowLog entities
