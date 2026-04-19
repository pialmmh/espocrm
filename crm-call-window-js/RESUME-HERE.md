# Resume Here

> Orientation doc for whoever (human or agent) picks this up with no prior context.
> Read this first, then `README.md`, then `docs/STATUS.md`.

---

## What this repo is

A framework-agnostic rewrite of `@telcobright/crm-call-window` (the Angular-only call window library). Core logic sits in `packages/core/` as pure TypeScript + rxjs; thin wrappers in `packages/{react,angular,vue}/` expose it to each framework.

**This is a port, not a from-scratch implementation.** The sibling directory `../crm-call-window/` contains the authoritative, production-tested Angular-only original — used right now by the BTCL SuiteCRM deployment. **When a ported file behaves wrong, diff it against the sibling** before assuming a deeper bug. Most of the core logic is identical; the changes are:

- Angular decorators (`@Injectable`, `InjectionToken`) stripped.
- `NgZone` removed from `JanusCallAdapter`.
- DI replaced with `createCallClient({ providers, adapter })` factory.
- UI layers split into per-framework wrappers.

If the sibling is deleted or moved, this note is stale — update it.

---

## Why it was written (original intent)

The parent project `espocrm/` (EspoCRM-based CRM, part of the BTCL Contact Center) is migrating toward a multi-frontend setup:

- **Angular shell** of the legacy Espo-derived UI (where the old library was born).
- **React frontend** in `orchestrix-v2/ui/` (the newer contact-center admin and meeting surfaces).

The user wanted a single call-window library that both frontends could share. The cloned `crm-call-window/` was Angular-only, so this directory was created as a sibling (`crm-call-window-js`) and the port was done.

**Next step the user intended: "perform call integration."** That step was not started. Before resuming integration work, check with the user which target (legacy Angular Espo shell or React orchestrix-v2) and which call gateway (Janus, already running; or LiveKit, also running — see `../../../orchestrix-v2/docs/integration/livekit-meeting-integration-progress.md`).

---

## Current status — one-liner

**Source-only, compiled by no one.** The port is written, the interfaces match the original, and the docs describe the public surface. Zero `tsc` runs, zero tests, zero integrations wired to this new package. See `docs/STATUS.md` for the full list of what is done vs untested vs pending.

---

## Repository map

| Path | What |
|---|---|
| `README.md` | Public-facing intro + quick-start per framework. |
| `RESUME-HERE.md` | (This file.) |
| `docs/STATUS.md` | Honest status — done, untested, pending, known gaps. |
| `docs/README.md` | Architecture overview + reading order. |
| `docs/providers.md` | 5 CRM provider interfaces reference. |
| `docs/call-adapter.md` | `CallAdapter` contract + Janus adapter deep dive. |
| `docs/integration-react.md` | React host integration — full worked example. |
| `docs/integration-angular.md` | Angular integration + migration from the old lib. |
| `docs/integration-vue.md` | Vue scaffold (panel UI TBD). |
| `docs/theming.md` | Preset themes + CSS variables. |
| `packages/core/` | Framework-free. Interfaces, services, Janus adapter, factory. |
| `packages/react/` | React context + hooks + `<CallPanel />` + CSS. |
| `packages/angular/` | DI tokens, `CallClientService`, standalone `<app-call>`. |
| `packages/vue/` | Vue plugin + composables. Panel SFC not shipped. |

## File-level map — which file does what

### `packages/core/src/`

| File | Role |
|---|---|
| `index.ts` | Barrel — everything hosts import. |
| `interfaces/call-adapter.ts` | `CallAdapter`, `CallAdapterConfig`, `CallAdapterConnectConfig`. No DI tokens. |
| `interfaces/call-panel-extension.ts` | Optional `CallPanelExtension` hook. |
| `interfaces/crm-integration/agent-identity.ts` | `AgentIdentityProvider`, `AgentProfile`. |
| `interfaces/crm-integration/agent-preferences.ts` | `AgentPreferencesProvider`, `OutboundCallerId`. |
| `interfaces/crm-integration/call-credentials.ts` | `CallCredentialsProvider`. |
| `interfaces/crm-integration/crm-integration.ts` | `CrmIntegrationProvider`, match types, log-create/update types. |
| `interfaces/crm-integration/phone-normalizer.ts` | `PhoneNormalizer` + default `IdentityPhoneNormalizer`. |
| `services/call-state.ts` | rxjs reactive bus. Active call, incoming call, registration, hold/mute, history. |
| `services/call-audio.ts` | `<audio>` element management for ringtone/ringback/remote stream. |
| `services/ringtone.ts` | Ringtone playback + browser notifications on incoming calls. |
| `services/cti.ts` | Orchestrator — subscribes to call events, invokes `CrmIntegrationProvider`. |
| `adapters/janus/janus-call-adapter.ts` | WebSocket + SIP plugin, WebRTC peer connection, reconnect, keepalive. |
| `adapters/janus/janus.config.ts` | Default config (URL, ICE, timeouts, SIP domain). |
| `client/create-call-client.ts` | The composition root. Builds all services + adapter from provider inputs. |

### `packages/react/src/`

| File | Role |
|---|---|
| `context.tsx` | `<CallClientProvider>` + `useCallClient()` + `useCallClientOptional()`. |
| `hooks.ts` | `useObservable` + convenience hooks (`useActiveCall`, `useRegisterStatus`, etc.). |
| `CallPanel.tsx` | The full floating panel component. ~500 lines — ported from the Angular original. |
| `CallPanel.css` | Flat CSS scoped to `.cc-root` with 5 theme presets. |
| `index.ts` | Barrel + re-exported core types. |

### `packages/angular/src/`

| File | Role |
|---|---|
| `tokens.ts` | All 7 `InjectionToken`s (5 providers + `CALL_PANEL_EXTENSION` + `CALL_ADAPTER_CONFIG`). |
| `call-client.service.ts` | `@Injectable({providedIn:'root'})` wrapper around `createCallClient`. |
| `call-panel.component.{ts,html,scss}` | Standalone Angular component. Uses `NgZone.run()` on observable subscriptions. |
| `index.ts` | Barrel. |

### `packages/vue/src/`

| File | Role |
|---|---|
| `index.ts` | Everything — plugin + composables. No `.vue` SFC yet. |

---

## What the user most likely wants next

Based on the prior conversation:

1. **Decide the integration target.** The user's immediate plan was "do call integration." Ask them: React (`orchestrix-v2/ui/`) or Angular (the legacy Espo shell)? LiveKit meeting work is in a separate track and is already documented in `orchestrix-v2/docs/integration/livekit-meeting-integration-progress.md` — this library is the *voice call* side, not meeting. Don't confuse the two.
2. **Verify the port compiles before wiring anything.** `cd crm-call-window-js && npm install && npm -w @telcobright/crm-call-core run build` — expect TypeScript to complain about small things; fix and move on.
3. **Implement the 5 providers against whichever CRM backend the user picks.** For EspoCRM: the backend is Spring Boot at `orchestrix-v2/api/` which proxies to EspoCRM via `EspoProxyController`; all CRM operations go through `/api/crm/**`. See `espocrm/CLAUDE.md` and the meeting-integration doc for the auth flow (Keycloak JWT → APISIX → Spring).
4. **Only then smoke-test against the live Janus gateway.** Defaults in `janus.config.ts` point at `wss://hippbx.btcliptelephony.gov.bd:3050/ws` — credentials come from the host's `CallCredentialsProvider`.

---

## Pointers into the parent project

- `../../CLAUDE.md` — project-level context (BTCL Contact Center, multi-tenancy, infra).
- `../../docs/call-integration.md` — existing wiki page for the Angular-only library's call flow; most of it still applies.
- `../../docs/pbx-integration.md` — FusionPBX/FreeSWITCH side (the thing Janus talks to).
- `../../../orchestrix-v2/` — the React frontend + Spring Boot API likely to host the ported library.
- `../crm-call-window/` — the original Angular-only library. Authoritative reference.
- `../crm-call-window/docs/TODO.md` — open work items that carry over to this rewrite (presence provider, 5-entity decoupling, tests).
