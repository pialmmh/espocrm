# Ingest Log

## 2026-04-16: Implementation Notes — Sales module

**Scope:** `espocrm-sales.md`

**Finding:** Sales Pack extension is **entirely absent** from this codebase. No `Quote/Invoice/SalesOrder/Product/PurchaseOrder` entity defs anywhere under `application/` or `custom/`. `application/Espo/Modules/` contains only `Crm/`. `custom/Espo/Modules/` has empty stub folders.

**Banner added** to top of the page flagging the gap.

**Appended under `## Implementation Notes`:** three paths forward for the React rewrite —
- (a) install paid Sales Pack
- (b) build custom Quote/Invoice/Product entities via Entity Manager
- (c) delegate Sales to Odoo via the CRM/ERP boundary already decided in this project

Recommended option (c), consistent with earlier Odoo-as-ERP decision. Sketched the minimum schema for option (b) in case direction changes later.

---

## 2026-04-16: Implementation Notes — Contacts/Accounts, Opportunities, Dashboard/Reports

**Scope:** `espocrm-contacts-accounts.md`, `espocrm-opportunities.md`, `espocrm-dashboard-reports.md`

**Sources used:**
- `application/Espo/Modules/Crm/Resources/metadata/entityDefs/Account.json`, `Contact.json`, `Opportunity.json`
- `application/Espo/Modules/Crm/Hooks/Opportunity/{Probability,LastStage,Contacts,AmountWeightedConverted}.php`
- `application/Espo/Modules/Crm/Hooks/Account/{Contacts,TargetList}.php`
- `application/Espo/Modules/Crm/Hooks/Contact/{Accounts,Opportunities,TargetList}.php`
- `application/Espo/Modules/Crm/Resources/metadata/dashlets/*.json`
- `application/Espo/Modules/Crm/Tools/Opportunity/Report/*.php`

**Major corrections to main sections:**
- **Account Type**: wiki's 6 options (including Prospect, Consultant) are a tutorial customization — code has only 4 (`Customer, Investor, Partner, Reseller`). Flagged in Implementation Notes, kept wiki table with a caveat.
- **Account "Prospect is default on convert"**: wrong — Lead.convertFields does not set type, so converted Accounts have empty type.
- **Account industry**: is a 50+ value enum, not free text.
- **Contact.title**: not stored — computed from primary Account relationship's `role` column.
- **Opportunity stages**: wiki's 7-stage pipeline (with Perception Analysis, Proposal/Price Quote, Negotiation/Review) is a customization. Base has 6 stages. Main pipeline section **replaced** with the correct 6-stage version + probabilityMap and style classes.
- **Opportunity required fields**: `amount` and `closeDate` are required — wiki didn't flag.
- **Opportunity line items panel**: Sales Pack extension, not base.
- **Dashboard "Reports" section**: generic Grid reports need Advanced Pack; only narrow per-chart aggregators exist in base code.

**Appended under `## Implementation Notes`:**
- Contact↔Account M:N column semantics (`role`, `isInactive`) and Contact↔Opportunity M:N role (Decision Maker/Evaluator/Influencer)
- Missing fields surfaced on all three entities (salutationName, doNotCall, opportunityRole, isLocked, sicCode, optimisticConcurrencyControl, originalLead back-refs, etc.)
- Opportunity `probability` auto-set by hook; `lastStage` tracking; `amountWeightedConverted` computation
- Full dashlet inventory (12 dashlets in core CRM module) and configuration pattern
- Report tool classes under `Tools/Opportunity/Report/` powering each chart dashlet
- Optimistic concurrency on Account — React edit forms must round-trip `versionNumber`
- React-rewrite gaps flagged (line items feature gating, chart dashlet porting strategy, drill-down modal pattern)

---

## 2026-04-16: Implementation Notes — Enquiries page cross-referenced with PHP source

**Scope:** `espocrm-enquiries.md`

**Sources used:**
- `application/Espo/Modules/Crm/Resources/metadata/entityDefs/Lead.json`
- `application/Espo/Modules/Crm/Resources/metadata/recordDefs/Lead.json`
- `application/Espo/Modules/Crm/Controllers/Lead.php`
- `application/Espo/Modules/Crm/Tools/Lead/ConvertService.php`
- `application/Espo/Modules/Crm/Hooks/Lead/ConvertedAt.php`

**Corrections applied to main sections:**
- Status pipeline now shows 6 statuses including `Converted` (wiki was missing it — `Converted` is set automatically by ConvertService, not by user action).
- Status color table replaced with metadata `style` classes (`primary`/`success`/`info`) alongside the video-observed colors.

**Appended under `## Implementation Notes`:**
- REST endpoints for Convert and GetConvertAttributes
- ConvertService step-by-step (processAccount → Contact → Opportunity → setStatus → processLinks → processStream)
- Contact-Account role column gets Lead.title (not in wiki)
- Meetings/Calls/Emails reparenting behaviour after convert
- Duplicate check mechanism (ConflictSilent with JSON body) and skip flag
- Full Source enum values (wiki was abridged)
- Hook list (ConvertedAt BeforeSave, TargetList BeforeSave, AfterCreate record hook)
- Fields present in code but not wiki: industry, opportunityAmount, doNotCall, website, salutationName, campaign, targetLists, originalEmail
- Back-references (`originalLead` inverse on Account/Contact/Opportunity)
- Open gaps flagged for the React rewrite (non-transactional convert, generic status-bar component)

---

## 2026-04-16: EspoCRM Advanced wiki added

**Source ingested:**
- `espocrm/knowledge_graph.json` — EspoCRM Advanced tutorial (17:00, 19 significant scenes of 37 total, from 1020 captured frames)

**Pages created:** 8
- espocrm-modules.md, espocrm-enquiries.md, espocrm-contacts-accounts.md, espocrm-opportunities.md, espocrm-sales.md, espocrm-dashboard-reports.md, espocrm-workflows.md, espocrm-administration.md, espocrm-data-entities.md

**Key observations:**
- EspoCRM calls Leads "Enquiries" — URL uses /Lead/ internally but UI displays "Enquiries"
- Enquiry status pipeline: New → Assigned → In Process → Recycled → Dead (different from Salesforce)
- Opportunity stages: Prospecting → Qualification → Perception Analysis → Proposal/Price Quote → Negotiation/Review → Closed Won / Closed Lost
- Account types: Prospect, Customer, Investor, Partner, Reseller, Consultant
- Sales Pack extends core with Quotes (Q-NNNNN auto-numbering), Invoices, Sales Orders, Products, Purchase Orders, Inventory Management
- Advanced Pack adds Reports (Grid with drill-down), Workflows (condition→action), BPM
- Workflow example 1: Account created → Send Email welcome
- Workflow example 2: Opportunity reaches Proposal/Price Quote → Auto-create linked Quote
- Dashboards are per-user/role configurable — Sales Manager tab has 7 chart/table widgets
- Dashboard drill-down: click pie segment → modal with filtered record list
- Admin customisation: Entity Manager, Layout Manager, Label Manager — EspoCRM is highly customisable without code
- One very long scene (scene_07, 456s, 2:25–10:00) covered Lead conversion form + Contact/Account/Opportunity detail pages + Quote entity

**Discarded scenes:**
- Frames 0001-0039: Intro / presenter talking head over dashboard
- Frames 0144-0199: Loading states and transitions
- Various short scenes (< 5s): UI animation frames between navigation clicks
- Final frames 1016-1020: Outro

**Index updated:** Added EspoCRM section with 9 pages to index.md

---

## 2026-04-13: Salesforce Sales Cloud wiki added

**Source ingested:**
- `salesforce-crm/knowledge_graph.json` — Salesforce Sales Cloud tutorial (~40 min, 81 significant scenes of 353 total)

**Pages created:** 7
- salesforce-modules.md, salesforce-leads.md, salesforce-opportunities.md, salesforce-cases.md, salesforce-activities.md, salesforce-campaigns.md, salesforce-reports.md, salesforce-data-entities.md

**Key observations:**
- Full CRM module coverage: Leads, Accounts, Contacts, Opportunities, Cases, Tasks, Calendar, Reports, Dashboards, Campaigns
- Lead Conversion flow: one action creates Account + Contact + Opportunity simultaneously
- Opportunity pipeline: Qualification (20%) → Proposal/Price Quote (65%) → Negotiation/Review (75%) → Closed Won (100%) or Closed Lost
- Case detail: tri-panel layout (Case Details + Contact, Feed/Details center, Knowledge right)
- Kanban views available on Leads (by Status) and Opportunities (by Stage)
- Campaign ROI tracking via Primary Campaign Source field on Opportunities
- Dashboard "Sales Pipeline": 6 widgets, header KPI £210,800

**Discarded scenes:**
- Ads: Domestika (scenes 125-127), Hostinger (scene 214), Firebase (scene 259), Grammarly (scenes 304, 307, 312), Namecheap (scene 347)
- Presenter intro/outro

**Index updated:** Added Salesforce section to index.md

---

## 2026-04-13: Initial wiki compilation

**Sources ingested:**
1. `crm-mightycall/knowledge_graph.json` — Predictive Dialer tutorial (8:00, 15 CRM scenes)
2. `preview-dialer/knowledge_graph.json` — Preview Dialer tutorial (6:18, 21 CRM scenes)
3. `progressive-dialer/knowledge_graph.json` — Progressive Dialer tutorial (6:52, 19 CRM scenes)

**Pages created:** 12
- index.md, campaign-management.md, dialing-modes.md, general-settings.md, dialer-settings.md, dispositions.md, dnc-compliance.md, local-presence.md, record-lists.md, agent-management.md, campaign-statuses.md, data-entities.md, ui-patterns.md, log.md

**Key decisions:**
- Merged overlapping content (campaign wizard steps identical across all 3 videos)
- Separated mode-specific dialer settings into comparison tables
- DNC compliance consolidated from all 3 sources (identical feature shown in each)
- Agent workspace documented from Preview + Progressive videos (not shown in Predictive video)
- Discarded non-CRM scenes: ads (GMass, Namecheap), intro slides, outro/contact info

**Discarded scenes:**
- crm-mightycall scenes 15-74: GMass email marketing ad
- preview-dialer scenes 21-26: outro, contact info, Namecheap ad
- progressive-dialer scenes 19-23: outro, contact info, MightyCall logo, black screen
