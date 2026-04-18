# EspoCRM Dashboard and Reports

Dashboards provide per-user/role analytics with interactive charts. Reports (Advanced Pack) support Grid reports with grouping, charts, and drill-down modals.

**Source**: `espocrm/knowledge_graph.json`

## Dashboard

### Navigation
Home (left nav icon)

### Tabs

Dashboards are tabbed and **per-user/role configurable** — not everyone sees the same tabs or widgets.

| Tab | Who Sees It | Purpose |
|-----|-------------|---------|
| My Items | All users | Personal calendar + tasks + stream |
| Task Overview | All users | Task summary view |
| Sales Manager | Manager role | Full pipeline analytics |

---

### My Items Tab

| Widget | Type | Description |
|--------|------|-------------|
| Calendar | Week view | Current week's scheduled activities |
| My Activities | Task list | Open tasks assigned to current user. Shows: task name, due date, related account/opportunity |
| Stream | Activity feed | Recent activity across followed records: "James Bleese created opportunity Training", "assigned task Send NDA to Philippa Meadows" |

---

### Sales Manager Tab

| Widget | Type | Description |
|--------|------|-------------|
| Opportunity By Stage | Horizontal bar chart | Pipeline value per user broken down by stage color. Hover tooltip: "Joe / Prospecting / £31,500.00" |
| Leads by status | Pie chart | New (6%), Assigned (8%), In Process (86%). Clickable segments. |
| Revenue by month | Bar chart | Monthly revenue totals (Jan–May) |
| Revenue by month and user | Multi-series line chart | Revenue trend per user (James Bleese, Joseph Bush, Sally Thomas) Feb–Aug 2025 |
| Opportunities by user | Vertical bar chart | Opportunity count per user |
| Opportunities won | Data table | Name, Account, Close Date, Amount. Recent Closed Won deals. |
| Quotes won | Data table | Quote name, Account, Date, Amount |

#### Opportunity By Stage Chart — Stage Colors

| Stage | Color |
|-------|-------|
| Negotiation/Review | Dark blue/navy |
| Closed Won | Green |
| Prospecting | Orange |
| -Empty- | Light gray |
| Qualification | Purple |
| Perception Analysis | Teal/cyan |
| Proposal/Price Quote | Medium blue |
| Closed Lost | Red/coral |

#### Leads by Status Pie — Example Data
- In Process: 43 records (86%)
- Assigned: 4 records (8%)
- New: 3 records (6%)

**Drill-down**: Click a pie segment → modal overlay showing filtered record list (columns: Name, Status, Email, Date)

---

## Reports

### Navigation
Admin > Reports

### Report Structure

| Field | Notes |
|-------|-------|
| Name | Report name |
| Type | Grid (table report with optional chart) |
| Category | Optional grouping label |
| Entity Type | The entity queried: Task, Opportunity, Lead, etc. |
| Assigned User | Owner |
| Teams | Visibility |

### Grid Report Layout
- **Detail view** (read-only): shows report metadata + results table + optional chart
- **Star** button: bookmark/favourite the report
- **Results View** button: go to full results view
- **Refresh** (↺) button on results panel

### Example: "Open Tasks — By Assigned To"

| Field | Value |
|-------|-------|
| Name | Open Tasks - By Assigned To |
| Type | Grid |
| Entity Type | Task |
| Columns | User, Name, Status, Account, Count |
| Grouping | By Assigned User |

Results table shows each user with their open tasks, grouped with a subtotal "Group Total" row per user.

Chart: Pie chart showing share of open tasks by user.

**Drill-down**: Click a pie segment or a row → modal overlay:
- Title: "Open Tasks - By Assigned To: [User Name]"
- Columns: Name, Status, Priority, Date Due
- Example: Follow up on Proposal / Not Started / Normal / 09 Jun 14:30

---

## Dashboard Interactivity

| Action | Result |
|--------|--------|
| Hover chart bar/segment | Tooltip: "User / Stage / £Value" or "Status N / XX%" |
| Click pie segment (Leads by status) | Modal: filtered record list for that status |
| Click pie segment (Report chart) | Modal: filtered task list for that user |
| Scroll dashboard | More widgets below (Revenue by month and user, Opportunities by user, Quotes won) |

## See Also
- [espocrm-modules.md](espocrm-modules.md) — Dashboard tabs explained in context of navigation
- [espocrm-opportunities.md](espocrm-opportunities.md) — Opportunity data powering pipeline charts
- [espocrm-enquiries.md](espocrm-enquiries.md) — Enquiry data powering Leads by status chart
- [espocrm-administration.md](espocrm-administration.md) — Advanced Pack required for Reports
