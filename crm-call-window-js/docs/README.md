# crm-call-window-js — Documentation

Knowledge graph for the multi-framework version of the library. Start here; follow links into the topic files.

## Reading order

1. This file — the architecture split
2. [`providers.md`](./providers.md) — the 5 CRM provider interfaces (same contracts as the original Angular-only lib, InjectionTokens stripped)
3. [`call-adapter.md`](./call-adapter.md) — `CallAdapter` interface + Janus adapter + how to write your own
4. Pick one: [`integration-react.md`](./integration-react.md) · [`integration-angular.md`](./integration-angular.md) · [`integration-vue.md`](./integration-vue.md)
5. [`theming.md`](./theming.md) — preset themes and CSS-var overrides

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     Host app (React / Angular / Vue)               │
│                                                                    │
│   <CallPanel />  /  <app-call>  /  <CallPanel.vue>                 │
│       │                                                            │
│       │ (framework-specific render + event bridge)                 │
│       ▼                                                            │
│   Framework wrapper package                                         │
│       │  hooks / injectable / composable                           │
│       ▼                                                            │
│   ┌──────────────────────────────────────────────────┐             │
│   │   @telcobright/crm-call-core                     │             │
│   │                                                  │             │
│   │   createCallClient({ providers, adapterConfig }) │             │
│   │        │                                         │             │
│   │        ├── CallStateService (rxjs BehaviorSubjects)             │
│   │        ├── CtiService      (orchestrates caller lookup / logs) │
│   │        ├── CallAudioService                                    │
│   │        ├── RingtoneService                                     │
│   │        └── CallAdapter    ── Janus (default)                   │
│   │                            ── other adapters (write your own)  │
│   │                                                  │             │
│   │   ▲ delegates CRM ops to …                       │             │
│   │   │                                              │             │
│   │   AgentIdentityProvider                          │             │
│   │   CallCredentialsProvider                        │             │
│   │   AgentPreferencesProvider                       │             │
│   │   PhoneNormalizer                                │             │
│   │   CrmIntegrationProvider                         │             │
│   └──────────────────────────────────────────────────┘             │
└────────────────────────────────────────────────────────────────────┘
```

The core has zero framework dependencies (except rxjs, which is framework-agnostic). It exposes observables and commands. A wrapper's only job is to:

1. Build the core client from host-supplied providers (framework's idiomatic DI: React context, Angular tokens, Vue provide/inject).
2. Turn the rxjs observables into the framework's reactive primitives (React `useState`, Angular NgZone-wrapped subscriptions, Vue `ref`).
3. Render the panel in the framework's own template syntax.

---

## What the library does — and does not

**Does:**
- Register an agent against a signaling gateway (Janus ships; swap via adapter factory).
- Show a floating dialpad / incoming-call card / active-call controls.
- Look up the caller in the CRM and screen-pop their record.
- Persist call logs (planned → connected → completed/missed) to the CRM via the host's provider.
- Play ringtone + ringback, show browser notifications for incoming calls.

**Does not:**
- Ship a fixed entity schema. The panel's "Link Existing / Associate With" dropdowns currently list five hardcoded labels (Lead, Contact, Account, Case, Opportunity). Open TODO — hosts with a different entity model need to either fork or wait for the planned `linkableEntities` input.
- Store call logs itself — that's the CRM's job via `CrmIntegrationProvider`.
- Mint gateway credentials — the host's `CallCredentialsProvider` does, so secrets never enter the library.
- Provide agent presence (ready / busy / wrap-up) — also open TODO.

---

## Seven extension points

| Extension | What you implement | Required? |
|---|---|---|
| `CallAdapter` + config | Gateway-specific adapter (Janus shipped) | Janus works out-of-the-box |
| `AgentIdentityProvider` | Who is the logged-in agent | Yes |
| `CallCredentialsProvider` | Return `{username, password, ...}` or `{token}` for connect | Yes |
| `AgentPreferencesProvider` | Outbound caller-IDs (DID list + current) | Yes |
| `CrmIntegrationProvider` | Lookup / screen-pop / create / call-log persistence | Yes |
| `PhoneNormalizer` | Dial-plan variants (default IdentityNormalizer strips non-digits) | Optional |
| `CallPanelExtension` | Route-change side effects (CRM-specific DOM tricks) | Optional |

Detailed contracts in [`providers.md`](./providers.md).

---

## Call flow — end to end

### Outbound
1. Agent types a number in the panel, clicks Call.
2. UI wrapper calls `adapter.makeCall()`.
3. Adapter emits state via `CallStateService.setActiveCall({status: 'dialing'})`.
4. `CtiService` observes this, calls `PhoneNormalizer.normalize()` → `CrmIntegrationProvider.lookupCaller()` → `createCallLog()` with status `planned`.
5. Gateway rings; on answer, adapter bumps status to `connected`; CTI updates the log to `connected`.
6. On hangup, adapter emits `call_ended`; CTI writes final duration + status (`completed` / `missed`).

### Inbound
1. Gateway signals INVITE → adapter calls `CallStateService.setIncomingCall()`.
2. `RingtoneService` + panel render the incoming card.
3. `CtiService` runs the same lookup; on match, it calls `CrmIntegrationProvider.openRecord()` (screen pop); otherwise `notifyUnknownCaller()`.
4. Agent answers → adapter flips state → active-call UI.
5. Same close-out as outbound.

---

## Differences from the original Angular-only library

| Aspect | Old (`@telcobright/crm-call-window`) | New (`crm-call-window-js`) |
|---|---|---|
| Framework | Angular 15+ only | Core + React / Angular / Vue wrappers |
| DI | Angular `InjectionToken`s everywhere | `createCallClient({ providers })` factory; wrappers map to their DI |
| Services | `@Injectable({providedIn:'root'})` | Plain classes constructed by `createCallClient` |
| Reactive primitive | rxjs (via Angular) | rxjs (framework-agnostic) |
| NgZone | `handleMessage` wrapped in `NgZone.run()` inside the Janus adapter | Removed from adapter — UI wrappers handle their own change detection (Angular wrapper wraps observable subscriptions in `NgZone.run()`) |
| Janus adapter | `new JanusCallAdapter(callState, audio, config, ngZone)` | `new JanusCallAdapter(callState, audio, config)` — no zone |
| Angular host migration | N/A | Swap `@telcobright/crm-call-window` → `@telcobright/crm-call-angular`; imports are near-identical |

The rewrite is **behaviorally equivalent** for Angular hosts; the new package is functionally a superset.

---

Continue to [`providers.md`](./providers.md).
