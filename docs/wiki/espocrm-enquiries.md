# EspoCRM Enquiries (Leads)

Enquiries are EspoCRM's name for Leads — incoming prospects before qualification. Internally uses the `Lead` entity type. Convert button creates Account + Contact + Opportunity simultaneously.

**Source**: `espocrm/knowledge_graph.json`

## Status Pipeline

```
New → Assigned → In Process → Recycled → Dead
```

Displayed as a **horizontal clickable bar** at the top of the detail page. Color-coded:

| Status | Color | Meaning |
|--------|-------|---------|
| New | Blue | Just created, not yet assigned |
| Assigned | Amber/Orange | Assigned to a user, being worked |
| In Process | Green | Actively being pursued |
| Recycled | Gray | Returned to pool (not dead yet) |
| Dead | Light purple/gray | Closed, not converting |

Click any stage label to move the record to that status directly.

## List View

Columns: Status (colored badge), Name, Account Name, Email, Phone, Source, Assigned User, Created

Actions: + Create Enquiry button, search bar, scope filter (All), column settings

## Detail Page

### Overview Tab

| Field | Type | Notes |
|-------|------|-------|
| Status | Dropdown | New, Assigned, In Process, Recycled, Dead |
| Source | Dropdown | Web Site, and others |
| Name | Text | Required |
| Account Name | Text | Company name |
| Email | Email | |
| Phone | Phone | |
| Title | Text | Job title |
| Address | Address | |

### Other Information Tab
Additional fields not shown in overview (not fully visible in source).

### Right Panel

| Field | Notes |
|-------|-------|
| Assigned User | User responsible for this enquiry |
| Teams | Team visibility |
| Map | Address map |
| Created | Date + creator name |
| Modified | Date + modifier name |
| Followers | Users following this record |

### Bottom Panels

- **Internal Collaboration / Newsfeed** — stream comments and activity log
- **Related Entities**
  - Target Lists — links this enquiry to marketing target lists

### Activities Panel (right side)
- Email, Log Call, New Task, New Event quick-action buttons
- **Activities** — upcoming activities
- **History** — completed activities (e.g. "First Reach Out" call)

### Action Buttons
- **Follow** — add yourself to Followers
- **Convert** — open conversion dialog
- **Edit** — edit record inline

## Lead Conversion

The **Convert** button opens a multi-section form that creates three records simultaneously.

### Sections in Conversion Form

**Account** section:
| Field | Type | Notes |
|-------|------|-------|
| Name | Text | Pre-filled from Account Name |
| Email | Email | |
| Billing Address | Address search | |
| Shipping Address | Address (Street, City, County, Postal Code, Country) | |
| Type | Dropdown | Prospect, Customer, Investor, Partner, Reseller, Consultant |
| Sector | Text | |
| Description | Long text | |

**Contact** section:
Fields pre-filled from the Enquiry (Name, Email, Phone). Links to the created Account.

**Opportunity** section:
| Field | Type | Notes |
|-------|------|-------|
| Name | Text | Required |
| Stage | Dropdown | Prospecting, Qualification, Perception Analysis, Proposal/Price Quote, Negotiation/Review, Closed Won, Closed Lost |
| Amount | Currency | |
| Currency | Dropdown | GBP default |
| Assigned User | Relate | |
| Teams | Multi-relate | |
| Lead Source | Dropdown | Web Site, and others |

### What Conversion Creates
```
Enquiry (James Bleese, enable)
  ├── Account created: enable (Type: Prospect)
  ├── Contact created: James Bleese (jbleese@enable.services)
  └── Opportunity created: [Name entered in form]
```

## See Also
- [espocrm-contacts-accounts.md](espocrm-contacts-accounts.md) — Account and Contact entities created during conversion
- [espocrm-opportunities.md](espocrm-opportunities.md) — Opportunity pipeline created from conversion
- [espocrm-data-entities.md](espocrm-data-entities.md) — Full Enquiry field list
- [espocrm-modules.md](espocrm-modules.md) — Navigation and cross-module features
