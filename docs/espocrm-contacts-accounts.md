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

## Implementation Notes

**2026-04-16 — code cross-reference (PHP source vs. video wiki):**

### Account Type — wiki is WRONG
- Code (`application/Espo/Modules/Crm/Resources/metadata/entityDefs/Account.json:23-27`): `["", "Customer", "Investor", "Partner", "Reseller"]` — **4 options plus empty**. No `Prospect`, no `Consultant`.
- Wiki lists 6 including Prospect and Consultant — those must have been customizations on the demo instance in the tutorial video. Default EspoCRM does NOT have them.
- Wiki also claims "Prospect is the default on conversion" — also wrong. `Lead.convertFields.Account` (`entityDefs/Lead.json:378`) maps only name + billing address; `type` is **not** set on conversion, so converted Accounts get an **empty** type.
- Action: either add Prospect/Consultant back via `custom/` metadata override if the tutorial behavior is desired, or update the wiki table to match code.

### Account.industry is an enum, not free text
- 50+ options in `Account.json:29-87` (Advertising, Aerospace, Agriculture, … Water). Wiki calls it "industry/sector" as if it's text — it's a sorted enum. Lead.industry references it (`Lead.json:73-78 optionsReference=Account.industry`).

### Contact ↔ Account is many-to-many, not 1:N
- `Contact.accounts` linkMultiple (`Contact.json:268`) plus primary `Contact.account` belongsTo (`:264`).
- M:N table `AccountContact` carries columns `role` (varchar 100) + `isInactive` (bool) — see `Contact.json:590-607` / `Account.json:264-271`. This is the "job title at company" pattern from the enquiry-conversion flow.
- The Contact's displayed **`title`** field is NOT stored on Contact — it's a computed column pulling `accountContactPrimary.role` from the primary Account relationship (`Contact.json:87-226`). So "title" is per-Account, not per-Contact. A contact working at multiple accounts has a different title at each.

### Fields wiki missed on Contact
- `salutationName` (Mr./Ms./Mrs./Dr.), `doNotCall`, `opportunityRole` (enum: Decision Maker, Evaluator, Influencer — stored as role column in `contactOpportunity` M:N via RelationshipRole converter at `Contact.json:381-402`), `accountType` (foreign read-through to Account.type), `portalUser` / `hasPortalUser` (customer portal), `originalLead` (back-ref), `campaign`, `targetLists`.
- `lastName` is **required**; `firstName` is not.

### Fields wiki missed on Account
- `website`, `sicCode`, `isLocked` (record locking), `shippingAddress` (wiki mentions it; confirmed all 5 sub-fields exist), `targetLists` (marketing), `originalLead` (back-ref from enquiry).
- `optimisticConcurrencyControl: true` (`Account.json:390`) — update requests must include the current `versionNumber` or the save is rejected. React edit forms must send it back.

### Relationship columns — wiki doesn't mention
- Contact↔Account: `role`, `isInactive`
- Contact↔Opportunity (`contactOpportunity` table): `role` (enum Decision Maker/Evaluator/Influencer)
- Surface these in the React detail pages — they're how "Finance Director at Acme, Decision Maker on Deal X" gets expressed.

### Hooks
- `Hooks/Account/Contacts.php`, `TargetList.php`
- `Hooks/Contact/Accounts.php`, `Opportunities.php`, `TargetList.php`
- These maintain the primary-link invariants (when you add to the M:N, they keep the `account` / `contact` primary column in sync).

### Workflow integration note
- Wiki says "Account creation → Send Email workflow". That capability requires the **Advanced Pack** extension (Workflows), which is not in this repo. Confirm the extension is installed on the deployment before promising this to end-users.
