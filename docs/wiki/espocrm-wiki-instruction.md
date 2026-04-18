# EspoCRM Wiki — Agent Instruction

## Where the wiki lives

```
Contact_Center/espocrm/docs/
├── installation.md                   ← setup on Ubuntu/Apache/PHP/MySQL/LXC
├── customization.md                  ← custom/ directory override model
└── wiki/
    ├── index.md                      ← start here
    ├── log.md                        ← ingest history
    ├── espocrm-wiki-instruction.md   ← this file
    ├── espocrm-modules.md            ← full navigation + cross-module features
    ├── espocrm-enquiries.md          ← Leads/Enquiries entity + conversion
    ├── espocrm-contacts-accounts.md  ← Contact + Account entities
    ├── espocrm-opportunities.md      ← pipeline stages + line items
    ├── espocrm-sales.md              ← Quotes, Invoices, Sales Orders, Products
    ├── espocrm-dashboard-reports.md  ← Dashboard widgets + Reports
    ├── espocrm-workflows.md          ← automation rules
    ├── espocrm-administration.md     ← admin panel + extensions
    └── espocrm-data-entities.md      ← all entity fields (use for DB schema)
```

## Single source of truth

**This wiki is the authoritative source.** Consume it directly — do not go hunting in JSON or frames to answer day-to-day questions.

If you find the wiki ambiguous, incomplete, or wrong, the fix is to **update the wiki** (see "How to update this wiki" below), not to work around it.

### Regeneration/correction sources (only when fixing the wiki)

These are the inputs the wiki was compiled from. Use them only if you are *editing* the wiki, not if you are *consuming* it:

- `video-extractor/espocrm/knowledge_graph.json` — structured scaffolding extracted from the tutorial (modules, entities, UI patterns). Every fact here should already be in the wiki; if not, promote it.
- `video-extractor/espocrm/scenes.json` + frames in `video-extractor/espocrm/frames/` — 19 significant scenes (≥5s) deduped from 1020 raw 1fps screenshots. Read frames directly with the Read tool (Claude sees images — no API cost).
- Original tutorial video, if a local copy exists on the PC. Check with `find ~ -iname "*espocrm*" \( -name "*.mp4" -o -name "*.mkv" -o -name "*.webm" \) 2>/dev/null` before giving up.

When you pull a fact from these sources into the wiki, add an `## Implementation Notes` entry on the page (see below) so future readers know when and why it was added.

## Reading order for a coding agent

1. `index.md` — understand full scope
2. `espocrm-modules.md` — navigation structure and cross-module patterns
3. `espocrm-data-entities.md` — build your DB schema from this first
4. `espocrm-enquiries.md` — Enquiry status pipeline and conversion flow
5. `espocrm-opportunities.md` — opportunity stages and Quote relationship
6. `espocrm-sales.md` — Quote entity and line items
7. `espocrm-workflows.md` — understand automation before building triggers
8. `espocrm-dashboard-reports.md` — for any analytics UI
9. `espocrm-administration.md` — only if building admin/settings screens
10. `installation.md` + `customization.md` — only if deploying/extending EspoCRM itself

## Critical facts to know before building

### Naming
- EspoCRM calls **Leads → "Enquiries"** (URL still uses `/Lead/` internally)
- Module sections in nav: CRM / Sales / Activities / Admin (not the same as Salesforce)

### Enquiry Status Pipeline
```
New → Assigned → In Process → Recycled → Dead
```
NOT the same as Salesforce (no "Converted" status — conversion is a separate action).

### Opportunity Stage Pipeline
```
Prospecting → Qualification → Perception Analysis → Proposal/Price Quote → Negotiation/Review → Closed Won
                                                                                               ↘ Closed Lost
```
"Perception Analysis" is EspoCRM-specific (not in Salesforce).

### Account Types
Prospect, Customer, Investor, Partner, Reseller, Consultant

### Quote auto-numbering
Format: **Q-NNNNN** (e.g. Q-00011). Auto-incremented. Status default: Draft.

### Extensions required
- **Advanced Pack**: Reports, Workflows, BPM — without this, no automation or reports
- **Sales Pack**: Quotes, Invoices, Sales Orders, Products, Purchase Orders, Inventory — without this, no sales documents
- **Project Management**: Projects + extended Tasks

### Workflow structure
```
Trigger (entity event) → Conditions (field value checks) → Actions → Log
```
Actions: Send Email | Create Record | (others in full product)

### Dashboard
Three tabs: My Items (personal), Task Overview, Sales Manager (role-specific).
Dashboards are per-user configurable — different users can have different widgets.

## How to update this wiki

### When you find a correction
Add an `## Implementation Notes` section at the bottom of the relevant page:
```markdown
## Implementation Notes
**2026-04-16 — [your name]:** [What was wrong and what the correct value is]
```
Then fix the error in the original section too.

### When you add a new page
1. Create `espocrm-<topic>.md` in `Contact_Center/docs/espocrm-wiki/`
2. Add it to `index.md` under the right category
3. Add a `## See Also` link from the most relevant existing page
4. Add a dated entry to `log.md`

### Page structure (required)
```markdown
# Page Title

One sentence describing what this page covers and why it matters.

**Source**: `espocrm/knowledge_graph.json` or session date

## Section Heading
...

## See Also
- [related-page.md](related-page.md) — description
```

## What this wiki does NOT cover (yet)
- Cases/Complaints detail (only module name visible in nav)
- Marketing campaigns in detail
- Email configuration detail
- Portal external user configuration
- BPM (Business Process Management) flows
- Inventory Management details
- Purchase Orders detail
- Project Management module detail
