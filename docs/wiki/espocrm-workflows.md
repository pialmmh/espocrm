# EspoCRM Workflows

Workflow automation via the Advanced Pack extension. Rules fire on entity events (creation, field changes), check conditions, and execute actions. Includes an execution Log.

**Source**: `espocrm/knowledge_graph.json`

## Overview

Workflows are configured per entity type. Structure: **Trigger → Conditions → Actions → Log**.

```
Entity Event (created / updated / field changed)
  └── Conditions check (optional — "All must be met")
      └── Actions execute (Send Email / Create Record / etc.)
          └── Log entry written per execution
```

## Workflow Detail Page Fields

| Field | Notes |
|-------|-------|
| Name | Workflow rule name |
| Entity Type | The entity this workflow fires on |
| Trigger | Record created / Record updated / Field value change |
| Conditions | Optional. "All (All must be met)" or "Any". Field value comparison rules. |
| Actions | One or more actions to execute |
| Log | Execution history: Target record, Created By, Created At |

## Condition Types

| Condition | Example |
|-----------|---------|
| Field value equals | `Last Stage equals value Proposal/Price Quote` |
| Field value not equals | (not shown in source) |
| Field is empty | (not shown in source) |
| All must be met | Wraps multiple conditions with AND logic |

## Action Types

| Action | Parameters |
|--------|-----------|
| Send Email | Timing (Immediately), From (Related field e.g. Assigned User), To (Target record entity), Email Template, Opt-Out Link toggle |
| Create Record | Entity type to create (e.g. Quote), Links (e.g. Opportunity — inherits relationship) |

## Documented Workflow Examples

### 1. Account Welcome Email

| Field | Value |
|-------|-------|
| Name | Account Welcome |
| Trigger | Account record created |
| Conditions | None |
| Action | Send Email — Immediately — From: Related Assigned User — To: Target record Account — Template: Case-to-Email auto-reply |
| Opt-Out Link | Off (checkbox unchecked) |

**Purpose**: When a new Account is created, automatically send a welcome email to the account contact using the assigned user as sender.

---

### 2. Auto Create Quote

| Field | Value |
|-------|-------|
| Name | Auto Create (Quote) |
| Trigger | Opportunity field value change (Stage) |
| Conditions | All: Last Stage equals value `Proposal/Price Quote` |
| Action | Create Record > Quote — Links: Opportunity |
| Log | Shows Sales / James Bleese / Today 15:35 (executed twice for 2 test opportunities) |

**Purpose**: When an Opportunity's stage is set to Proposal/Price Quote, automatically create a linked Quote record. The Quote is linked back to the Opportunity.

## Workflow Log

Each workflow execution writes a log entry:

| Column | Description |
|--------|-------------|
| Target | The trigger record (e.g. the Opportunity named "Sales") |
| Created By | User who triggered it (or "System") |
| Created At | Timestamp of execution |

## Advanced Pack — BPM

Beyond simple workflows, the Advanced Pack includes **Business Process Management (BPM)** for multi-step process flows. Not shown in detail in source video.

## See Also
- [espocrm-opportunities.md](espocrm-opportunities.md) — Stage trigger for Auto Create Quote
- [espocrm-contacts-accounts.md](espocrm-contacts-accounts.md) — Account creation trigger for welcome email
- [espocrm-sales.md](espocrm-sales.md) — Quote entity created by workflow
- [espocrm-administration.md](espocrm-administration.md) — Advanced Pack installation required for Workflows
