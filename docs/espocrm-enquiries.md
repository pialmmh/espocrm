# EspoCRM Enquiries (Leads)

Enquiries are EspoCRM's name for Leads — incoming prospects before qualification. Internally uses the `Lead` entity type. Convert button creates Account + Contact + Opportunity simultaneously.

**Source**: `espocrm/knowledge_graph.json`

## Status Pipeline

```
New → Assigned → In Process → Converted   (success)
                            ↘ Recycled    (back to pool)
                            ↘ Dead        (closed, not converting)
```

Six statuses total. `Converted` is set **automatically** by the Convert action — it is not selected manually. `Converted`, `Recycled`, `Dead` are terminal ("not actual") states used by reports.

Displayed as a **horizontal clickable bar** at the top of the detail page. Code styling (`entityDefs/Lead.json` → `fields.status.style`):

| Status | Style class | Wiki video color (observed) |
|--------|-------------|------------------------------|
| New | default | Blue |
| Assigned | default | Amber/Orange |
| In Process | `primary` | Green |
| Converted | `success` | — (set automatically on Convert) |
| Recycled | `info` | Gray |
| Dead | `info` | Light purple/gray |

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

## Implementation Notes

**2026-04-16 — code cross-reference (PHP source vs. video wiki):**

### Status pipeline — wiki was missing "Converted"
- `application/Espo/Modules/Crm/Resources/metadata/entityDefs/Lead.json:29-57` defines 6 statuses: `New, Assigned, In Process, Converted, Recycled, Dead`. Default `New`. Fixed in the section above.
- `notActualOptions: ["Converted", "Recycled", "Dead"]` — terminal states excluded from "active pipeline" reports.
- `audited: true` — status changes land in the audit stream.

### Convert flow — authoritative source
- Endpoint: `POST /Lead/action/convert` body `{ id, records: { Account:{…}, Contact:{…}, Opportunity:{…} }, skipDuplicateCheck }` — `Controllers/Lead.php:52`.
- Prefill endpoint: `POST /Lead/action/getConvertAttributes` — `Controllers/Lead.php:88`.
- Which entities can be created is driven by metadata: `entityDefs.Lead.convertEntityList = ["Account", "Contact", "Opportunity"]` (`entityDefs/Lead.json:370`).
- Field mapping from Lead → target is `entityDefs.Lead.convertFields` (`entityDefs/Lead.json:375`). Same-named fields auto-map; the map only needs rename pairs (e.g. `Account.name ← Lead.accountName`, `Opportunity.leadSource ← Lead.source`).
- ConvertService orchestration: `Tools/Lead/ConvertService.php::convert()` at line 83:
  1. `processAccount` — creates Account (skip-duplicate-check inside, duplicates already handled up front).
  2. `processContact` — creates Contact, attaches to Account, and writes the Lead's `title` into the Contact↔Account relationship **role column** (`ConvertService.php:318-324`). The wiki doesn't mention this; it's why Contacts inherit "job title at company".
  3. `processOpportunity` — creates Opportunity with `accountId` + `contactId`, then explicitly relates the Contact↔Opportunity many-to-many (`:379`).
  4. `$lead->setStatus(STATUS_CONVERTED)` at line 111 — this is how `Converted` gets set; there is no UI button to set it manually.
  5. `processLinks` (:410) — reparents all existing Meetings/Calls/Emails: `parent` → Opportunity if present, else Account. Contacts on Meetings/Calls get related to the new Contact. Documents get related to both Account and Opportunity.
  6. `processStream` (:513) — if current user follows the Lead, auto-follow the three new records.
- `Hooks/Lead/ConvertedAt.php:46` — `BeforeSave` hook stamps `convertedAt` the first time status transitions to `Converted`. `convertedAt` is readonly from the UI.

### Duplicate check during conversion
- `processDuplicateCheck` (`ConvertService.php:561`) calls `findDuplicates` on **all three** target entities; if any hits, throws `ConflictSilent` with body `{"reason":"duplicate","data":[{id,name,_entityType},…]}`. Client can retry with `skipDuplicateCheck: true`.

### Fields present in code but absent from wiki overview
`industry` (enum, mirrors `Account.industry`), `opportunityAmount` (currency, audited), `doNotCall` (bool, audited), `website`, `salutationName` (Mr./Ms./Mrs./Dr.), `description` (long text), `campaign` (link), `targetLists` (linkMultiple — used by marketing), `originalEmail` (source email link). The "Other Information" tab in the wiki probably contains these.

### Source enum — actual values
`entityDefs/Lead.json:58` → `Call, Email, Existing Customer, Partner, Public Relations, Web Site, Campaign, Other`. The wiki lists only "Web Site, and others" — expand when next touched.

### Back-references
A Lead keeps `createdAccount` / `createdContact` / `createdOpportunity` `belongsTo` links (`entityDefs/Lead.json:216-234`). The inverse on Account/Contact/Opportunity is `originalLead`. This is how you trace a deal back to its source enquiry — worth surfacing in the React detail page.

### Hooks registered on Lead
- `BeforeSave`: `ConvertedAt`, `TargetList` (`Hooks/Lead/`).
- `AfterCreate` record hook: `Classes/RecordHooks/Lead/AfterCreate.php` (registered via `recordDefs/Lead.json:3`).

### Gaps / open questions for the React rewrite
- The clickable status bar is a generic `clientDefs`-driven component (not lead-specific). Confirm when documenting the shared status-bar pattern.
- Wiki says Contact section fields are "pre-filled from the Enquiry"; the actual prefill is whatever `getConvertAttributes` returns — which is derived from `convertFields` + same-name auto-mapping. The React conversion dialog should call that endpoint, not re-implement the mapping.
- Conversion creates entities one-at-a-time (no transaction wrapper visible). If Opportunity creation fails, Account/Contact are already persisted. React UX should handle partial failure (resume from the already-created entities via the Lead's `createdAccount/Contact/Opportunity` back-links).
