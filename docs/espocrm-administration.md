# EspoCRM Administration

The Administration panel controls system settings, customisation, messaging, extensions, and user management. Accessed via the user avatar dropdown (top-right) → Administration.

**Source**: `espocrm/knowledge_graph.json`

## Accessing Administration

User avatar (top-right) → dropdown menu:
- James Bleese (current user display)
- **Administration**
- Preferences
- Last Viewed
- About
- Log Out

## Administration Panel Sections

### System

| Setting | Description |
|---------|-------------|
| Settings | System settings of application |
| User Interface | Configure UI appearance |
| Authentication | Authentication settings (SSO, 2FA, etc.) |
| Scheduled Jobs | Jobs executed by cron |
| Currency | Currency settings and exchange rates |
| Notifications | In-app and email notification settings |
| Integrations | Integration with third-party services |
| Extensions | Install or uninstall extensions |
| User Requirements | User account requirements/policies |
| Job Settings | Job processing settings, queue configuration |
| Upgrade | Upgrade EspoCRM version |

### Customisation

| Tool | Description |
|------|-------------|
| Entity Manager | Create and edit custom entities. Manage fields and relationships. |
| Layout Manager | Customise layouts: list, detail, edit, search, mass update views |
| Label Manager | Customize application labels (rename field labels, module names) |
| Template Manager | Customize message templates |
| Report Filters | Custom list view filters based on report results |
| Report Panels | Add report result panels to entity detail views |

### Messaging

| Setting | Description |
|---------|-------------|
| Outbound Emails | SMTP settings for outgoing emails |
| Inbound Emails | Settings for incoming emails |
| Group Email Accounts | Group IMAP email accounts. Email import and Email-to-Case. |
| Personal Email Accounts | Individual user email account settings |
| Email Filters | Rules — matching messages won't be imported |
| Group Email Folders | Email folders shared for teams |
| Email Templates | Templates for outbound emails |
| SMS | SMS configuration |

### Portal
Portal configuration for external user access. Not fully visible in source.

---

## Official Extensions

Extensions are installed via Administration > Extensions. Three official packs shown:

### Advanced Pack
| Feature | Description |
|---------|-------------|
| Reports | Grid and chart reports with drill-down |
| Workflows | Automation rules (condition → action) |
| Business Process Management (BPM) | Complex multi-step process flows |

### Sales Pack
| Feature | Description |
|---------|-------------|
| Products | Product catalogue |
| Quotes | Quote management (Q-NNNNN numbering) |
| Sales Orders | Sales order management |
| Invoices | Invoice generation |
| Purchase Orders | Supplier purchase orders |
| Inventory Management | Stock/inventory tracking |

### Project Management Pack
| Feature | Description |
|---------|-------------|
| Projects | Project tracking |
| Tasks (extended) | Extended task management for projects |

---

## Users Management

Accessible via Administration or via `#User` URL:
- Users list with search and "+ Create User" button
- Scope filter: All / Active / etc.
- Calendar sharing: each user's calendar can be viewed by others with access

## Customisation Capability

EspoCRM is highly customisable without code:
- **Entity Manager**: Add custom entities, add fields to existing entities, manage relationships
- **Layout Manager**: Change which fields appear in list/detail/edit views, and in what order
- **Label Manager**: Rename any field label or module name application-wide
- The video presenter notes dashboards are configurable per-user so "not everyone has to have the same view or access"

## See Also
- [espocrm-workflows.md](espocrm-workflows.md) — Advanced Pack Workflows
- [espocrm-dashboard-reports.md](espocrm-dashboard-reports.md) — Advanced Pack Reports
- [espocrm-sales.md](espocrm-sales.md) — Sales Pack features
- [espocrm-modules.md](espocrm-modules.md) — Full navigation including Admin section
