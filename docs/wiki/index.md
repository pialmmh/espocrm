# EspoCRM — Knowledge Wiki

Compiled from a 17-minute EspoCRM Advanced tutorial video and hands-on installation/customisation sessions.

## Sources

| Source | Duration/Size | Scenes/Pages | Focus |
|--------|--------------|--------------|-------|
| [EspoCRM Advanced tutorial](../../video-extractor/espocrm/knowledge_graph.json) | 17:00 | 19 scenes | CRM modules, Quotes, Dashboard, Reports, Workflows, Admin |
| Installation session (2026-04-15) | hands-on | — | Setup on Ubuntu 24.04 / Apache / PHP 8.3 / MySQL / LXC |
| Customisation session (2026-04-15) | hands-on | — | custom/ directory model, backend/frontend override pattern |

## Pages

### Overview
- [espocrm-modules.md](espocrm-modules.md) — All modules, full navigation structure, cross-module features, UI layout patterns

### CRM Modules
- [espocrm-enquiries.md](espocrm-enquiries.md) — Enquiries (Leads): status pipeline New→Assigned→In Process→Recycled→Dead, conversion flow
- [espocrm-contacts-accounts.md](espocrm-contacts-accounts.md) — Contacts and Accounts, Account types (Prospect/Customer/Partner/Reseller/Investor/Consultant)
- [espocrm-opportunities.md](espocrm-opportunities.md) — Deal pipeline, 7 stages, line items, Quote auto-creation

### Sales (Sales Pack Extension)
- [espocrm-sales.md](espocrm-sales.md) — Quotes (Q-NNNNN), Invoices, Sales Orders, Products, Purchase Orders

### Analytics & Automation (Advanced Pack Extension)
- [espocrm-dashboard-reports.md](espocrm-dashboard-reports.md) — Dashboard tabs (My Items, Sales Manager), 7 chart widgets, Grid reports with drill-down
- [espocrm-workflows.md](espocrm-workflows.md) — Workflow automation: condition→action rules with execution log

### Administration & Customisation
- [espocrm-administration.md](espocrm-administration.md) — Admin panel, Entity/Layout/Label Manager, official extensions
- [installation.md](installation.md) — Full installation procedure (Ubuntu 24.04, Apache, PHP 8.3, MySQL, LXC)
- [customization.md](customization.md) — custom/ directory model, backend/frontend override patterns

### Reference
- [espocrm-data-entities.md](espocrm-data-entities.md) — All entity fields and relationships (Enquiry, Contact, Account, Opportunity, Quote, Task, Report, Workflow)
- [log.md](log.md) — Ingest history
