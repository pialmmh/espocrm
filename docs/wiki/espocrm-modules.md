# EspoCRM — Modules Overview

All modules, navigation structure, and cross-module features for EspoCRM (Advanced edition with Sales Pack + Advanced Pack extensions).

**Source**: `espocrm/knowledge_graph.json`

## Navigation Structure

Left sidebar (icon-based, collapsed by default — click hamburger to expand with labels):

```
Home
Calendar
CRM
├── Enquiries        ← EspoCRM's name for Leads
├── Contacts
├── Accounts
├── Opportunities
└── Complaints
Sales
├── Quotes
├── Invoices
├── Sales Orders
└── Products
Activities
├── Emails
├── Tasks
└── Marketing
Admin
├── Reports
└── Import
```

User avatar (top-right) → Administration panel (system settings, customisation, extensions)

## Modules Summary

| Module | Section | Description |
|--------|---------|-------------|
| Home | — | Tabbed dashboard: My Items, Task Overview, Sales Manager |
| Calendar | — | Week-view calendar, own and other users' |
| Enquiries | CRM | Leads/prospects. Status: New→Assigned→In Process→Recycled→Dead |
| Contacts | CRM | Individual people linked to Accounts |
| Accounts | CRM | Companies/organisations. Types: Prospect→Customer→Partner etc. |
| Opportunities | CRM | Deals in pipeline. 7 stages from Prospecting to Closed Won/Lost |
| Complaints | CRM | Customer complaints tracking |
| Quotes | Sales | Q-NNNNN numbered quotes linked to Opportunities |
| Invoices | Sales | Invoice management |
| Sales Orders | Sales | Sales order management |
| Products | Sales | Product catalogue |
| Emails | Activities | Inbound/outbound email, group email accounts |
| Tasks | Activities | Assigned tasks with priority and due date |
| Marketing | Activities | Campaigns linked to Enquiries via Target Lists |
| Reports | Admin | Grid reports with charts and drill-down |
| Import | Admin | Data import tool |

## Dashboard Tabs

| Tab | Audience | Content |
|-----|----------|---------|
| My Items | All users | Calendar (week) + My Activities task list + Stream feed |
| Task Overview | All users | Task summary view |
| Sales Manager | Manager role | Pipeline charts, lead stats, revenue trends, won deals tables |

## Cross-Module Features

### Stream / Newsfeed
Present on Home dashboard and every entity detail page. Shows created records, stage changes, assigned tasks, linked calls. Users can comment directly in the stream.

### Activities Panel
On Contact, Account, Opportunity, Enquiry detail pages. Quick-action buttons: email, log call, new task, new event. Shows linked calls (e.g. "First Reach Out"), with History sub-panel for completed activities.

### Follow
"Follow" button on detail pages adds current user to record's Followers list. Followed records surface in the Stream.

### Teams
All entities support Teams field for visibility and access control. Dashboards and reports support per-user and team-scoped views.

### Assigned User
All entities have an Assigned User field. Drives "My Items" dashboard content, report groupings, and workflow email routing.

### Currency
GBP used as base currency throughout. Amounts carry currency code and a converted amount field.

## UI Layout Pattern

```
[Hamburger] ← sidebar toggle
│
├── Left sidebar (60px collapsed / 200px expanded)
│   ├── Colored module icons
│   └── Section labels when expanded
│
└── Main content area
    ├── Top bar: Search | Notifications bell | User avatar
    ├── Entity list view OR detail page
    └── Status pipeline bar (on detail pages)
```

Detail page layout:
- **Header**: Breadcrumb (Module › Record Name) + action buttons right
- **Status bar**: Horizontal clickable pipeline (stages highlighted by current status)
- **Body**: Two-column — left: main fields; right: metadata (Assigned User, Teams, Map, Created, Modified, Followers)
- **Bottom**: Tabbed panels — Internal Collaboration/Newsfeed | Related Entities
- **Right side**: Activities panel (email/call/task/event) + History + Tasks

## See Also
- [espocrm-enquiries.md](espocrm-enquiries.md) — Enquiries (Leads), status pipeline, conversion flow
- [espocrm-contacts-accounts.md](espocrm-contacts-accounts.md) — Contacts and Accounts
- [espocrm-opportunities.md](espocrm-opportunities.md) — Opportunity pipeline and Quotes
- [espocrm-sales.md](espocrm-sales.md) — Quotes, Invoices, Sales Orders, Products
- [espocrm-dashboard-reports.md](espocrm-dashboard-reports.md) — Dashboard widgets and Reports
- [espocrm-workflows.md](espocrm-workflows.md) — Workflow automation
- [espocrm-administration.md](espocrm-administration.md) — Admin panel, customisation, extensions
- [espocrm-data-entities.md](espocrm-data-entities.md) — All entity fields and relationships
