# EspoCRM Contacts and Accounts

Contacts are individual people; Accounts are companies/organisations. Both link to Opportunities and can be created directly or via Enquiry conversion.

**Source**: `espocrm/knowledge_graph.json`

## Contacts

### Navigation
CRM > Contacts

### Detail Page Fields

| Field | Type | Notes |
|-------|------|-------|
| Name | Text | Required |
| Email | Email | |
| Accounts | Relate (multi) | Links to one or more Accounts |
| Phone | Phone | |
| Address | Address | |
| Description | Long text | |

### Right Panel

| Field | Notes |
|-------|-------|
| Assigned User | |
| Teams | |
| Map | Address map |
| Created | Date + creator |
| Followers | |

### Bottom Panels
- **Stream** — activity log and comments (e.g. "James Bleese linked call First Reach Out with this contact")
- **Opportunities** — related opportunity records (linked via the Opportunity's Contacts field)

### Activities Panel
- Activities (upcoming calls, tasks, events)
- History (completed activities)

### Example Record
```
Name:    James Bleese
Email:   jbleese@enable.services
Account: enable
Created: Today 15:33 · James Bleese
Stream:  Linked call "First Reach Out"
```

---

## Accounts

### Navigation
CRM > Accounts

### Account Types

| Type | Meaning |
|------|---------|
| Prospect | New potential customer (default on conversion) |
| Customer | Active paying customer |
| Investor | Investment relationship |
| Partner | Business partner |
| Reseller | Reseller/channel partner |
| Consultant | Consulting relationship |

### Detail Page Fields

| Field | Type | Notes |
|-------|------|-------|
| Name | Text | Required |
| Email | Email | |
| Phone | Phone | |
| Type | Dropdown | Prospect, Customer, Investor, Partner, Reseller, Consultant |
| Sector | Text | Industry/sector |
| Billing Address | Address | Street, City, County, Postal Code, Country |
| Shipping Address | Address | Separate from billing |
| Description | Long text | |
| Map | Map | Based on billing address |

### Related Entities
- **Contacts** — people at this account
- **Opportunities** — deals with this account
- **Quotes** — quotes raised against this account
- **Tasks** — tasks related to this account

### Workflow Integration
Accounts are a common workflow trigger. Example: when an Account is created, automatically send a welcome email (via Workflow > Send Email action).

## See Also
- [espocrm-enquiries.md](espocrm-enquiries.md) — Enquiry conversion creates both Account and Contact
- [espocrm-opportunities.md](espocrm-opportunities.md) — Opportunities link to both Contact and Account
- [espocrm-workflows.md](espocrm-workflows.md) — Account creation workflow example
- [espocrm-data-entities.md](espocrm-data-entities.md) — Full field lists
