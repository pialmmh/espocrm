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

## Implementation Notes

**2026-04-16 — code cross-reference (PHP source vs. video wiki):**

### Dashlets available in base CRM module (12)
Located in `application/Espo/Modules/Crm/Resources/metadata/dashlets/`:
- **Record-list dashlets** (view `views/dashlets/abstract/record-list`): `Leads.json`, `Opportunities.json`, `Tasks.json`, `Calls.json`, `Meetings.json`, `Cases.json`, `Activities.json`
- **Chart dashlets** (custom views): `OpportunitiesByStage.json`, `OpportunitiesByLeadSource.json`, `SalesByMonth.json`, `SalesPipeline.json`
- **Calendar**: `Calendar.json`

### Dashlet configuration pattern
Each dashlet JSON declares:
- `view` — client-side component path
- `aclScope` — which entity's ACL controls visibility
- `options.fields` — configurable settings (title, autorefresh interval, displayRecords, date range…)
- `options.defaults` — initial values when added via "Add Dashlet"
- `options.layout` — field placement in the options modal

Example (`dashlets/Leads.json`):
- Auto-refresh options: `[0, 0.5, 1, 2, 5, 10]` minutes
- Default `searchData`: `onlyMy=true, primary="actual"` — the "actual" primary filter maps to non-terminal statuses via `Lead.fields.status.notActualOptions` (Converted/Recycled/Dead excluded).
- Default expandedLayout shows: name+accountName row, status+source row.

### Dashboard storage
- User dashboard layout (which tabs, widget positions) is stored per-user in the Preferences record (not a dedicated `Dashboard` entity). Each user configures their own; admin can push a layout to other users.
- Dashboards are **per-user/role configurable** as the wiki says — confirmed; no role-specific "tab" hardcoding in backend. The wiki's "Sales Manager tab" is a user-defined layout, not a system role.

### Chart data endpoints
The pipeline charts are backed by dedicated report tool classes in `application/Espo/Modules/Crm/Tools/Opportunity/Report/`:
- `ByStage.php` — powers OpportunitiesByStage dashlet
- `ByLeadSource.php` — powers OpportunitiesByLeadSource
- `SalesByMonth.php` — monthly revenue bars
- `SalesPipeline.php` — full pipeline value
- `DateRange.php`, `Util.php` — shared helpers

These are not generic "Reports" — they're narrow, chart-specific aggregators.

### Grid Reports (with drill-down modals) need Advanced Pack
- The wiki's **Reports** section describes generic Grid reports (configurable entity type, grouping, columns, chart, drill-down modal). This feature lives in the **Advanced Pack** extension and is NOT in this open-source repo.
- If you search for `Report.json`, `entityDefs/Report.json`, or a Reports controller, you will not find them here. Confirm `application/Espo/Modules/Advanced/` exists on the target deployment before promising the Reports UI to end-users.

### Gaps for the React rewrite
- Record-list dashlets are mechanical — reuse the metadata-driven list engine with the dashlet's `expandedLayout` as the column definition.
- Chart dashlets each have a custom backend aggregator and a custom frontend view. The React port needs one new component per chart type. Start with `OpportunitiesByStage` since it covers the most requested "pipeline" visual.
- Leads-by-status pie chart shown in the wiki is a chart dashlet, but isn't one of the bundled ones — it was likely a custom dashlet on the tutorial instance. To replicate, either build a custom dashlet or use the generic `Leads` record-list dashlet with `groupBy: status`.
- "Click pie segment → filtered modal" behavior is the drill-down pattern used across all chart dashlets — implement once in the engine, reuse everywhere.
