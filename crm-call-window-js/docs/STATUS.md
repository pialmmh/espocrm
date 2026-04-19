# Status

> Honest snapshot of what's done, what's untested, and what's pending.
> Update this file as state changes. Don't let it rot.

**Last updated:** 2026-04-20 (initial port completed)

---

## One-liner

**Source-only port from `../crm-call-window/`. Compiled by no one, tested by no one, integrated by no one. The interfaces match the original; the behavior is presumed equivalent but unverified.**

---

## Done ✅

- Monorepo layout with npm workspaces (`packages/core`, `react`, `angular`, `vue`).
- Root `package.json`, `tsconfig.base.json`, per-package `tsconfig.json` files.
- **Core package (`@telcobright/crm-call-core`)**
  - 5 CRM provider interfaces + `CallPanelExtension` + `CallAdapter` — all framework-free, no `InjectionToken`.
  - `CallStateService` — rxjs reactive bus; localStorage persistence configurable via `CallStateServiceOptions`.
  - `CallAudioService` — `<audio>` management.
  - `RingtoneService` — ringtone + browser notifications. Opts object replaces Angular DI.
  - `CtiService` — orchestrator. Constructor takes providers directly.
  - `JanusCallAdapter` — full port of the ~1000-line original. **`NgZone` removed.** Everything else identical.
  - `janus.config.ts` — default config preserved.
  - `createCallClient({ providers, adapterConfig, adapterFactory })` — composition root.
- **React package (`@telcobright/crm-call-react`)**
  - `<CallClientProvider>` context + `useCallClient()` / `useCallClientOptional()`.
  - `useObservable(src$, initial)` + convenience hooks (`useActiveCall`, `useIncomingCall`, `useRegisterStatus`, `useCallHistory`, `useMuteStatus`, `useHoldStatus`, `useTransferStatus`, `useConnectionState`).
  - `<CallPanel />` — full port of the Angular component. Feature parity for: notification banner, incoming-call modal, transfer dialog, floating toggle, DID selector, active-call controls, CRM Link Existing / Associate With dropdowns, keyboard dialpad, 5 preset themes.
  - `CallPanel.css` — flat CSS, class selectors `cc-*`-prefixed and scoped to `.cc-root`.
- **Angular package (`@telcobright/crm-call-angular`)**
  - 7 `InjectionToken`s — same names as the original library.
  - `CallClientService` — `@Injectable({providedIn:'root'})` builds a `CallClient` from tokens.
  - `CallPanelComponent` — standalone. Observable subscriptions wrapped in `NgZone.run()` so Angular change detection fires.
- **Vue package (`@telcobright/crm-call-vue`)**
  - `installCallClient(app, options)` plugin using `provide`/`inject`.
  - `useCallClient()` + `useObservable()` + convenience composables returning `Ref<T>`.
- **Docs**
  - `README.md`, `docs/README.md`, `providers.md`, `call-adapter.md`, `theming.md`, 3 integration guides, this file, `RESUME-HERE.md`.

---

## Untested — highest-risk items 🟡

None of this has been run. Verify early.

1. **No `npm install` has succeeded.** Workspace declarations look right, peer-dep ranges are permissive, but until it resolves cleanly, assume version conflicts are possible.
2. **No `tsc` run on any package.** Expect type errors around:
   - Observable imports using `import type` — verified with rxjs 7's type surface but untested.
   - `AllCallerMatches` / `CallerMatch` re-exports from core into both wrappers.
   - Strict-mode `any`/`null` corners in `CallPanel.tsx` (large file, many refs).
3. **No runtime smoke test.** Never connected to a Janus server. The port was mechanical but the adapter's 650 lines of protocol code could have a missed `ngZone`-related side effect. Specifically watch:
   - First incoming call after the `NgZone` removal — does `setIncomingCall` → React render work?
   - DID dropdown populates correctly on first connect.
   - Reconnect loop behavior (timers).
4. **CSS port (SCSS → flat CSS) for React.** Selectors renamed to `cc-*` throughout; a typo in class names would break silently.
5. **Angular CallPanelComponent vs the original.** Trimmed structurally (some helper getters replaced with `get` accessors, history/contacts tabs not included in this pass — dialpad tab only). Feature parity with the original is not complete; see "Pending" below.
6. **Vue composables never instantiated in a Vue app.**

---

## Pending / not started ❌

### Build verification
- Run `npm install` at the monorepo root.
- Run `npm -ws run build` — fix TypeScript errors as they surface.
- Decide on a bundler (tsup is likely simpler than tsc for consumers needing CJS output).
- Add `ng-packagr` to the Angular package once the rest works, for proper Angular library output.

### Vue `<CallPanel>` SFC
Not shipped. See `docs/integration-vue.md` for the porting checklist — mechanical translation from `packages/react/src/CallPanel.tsx`.

### Angular CallPanelComponent parity gaps
The original Angular `CallPanelComponent` (940 lines in `../crm-call-window/src/lib/components/call-panel/call-panel.component.ts`) had:
- **History tab and Contacts tab** in the panel (not just the dialpad tab). The new Angular wrapper only wires the dialpad tab. The React wrapper matches this trimmed scope.
- Slide-in animations via `@angular/animations`. Dropped in this port — add back with the `animations` package if hosts want them.
- `createContactFromCall()` / `createLeadFromCall()` quick-action buttons. Present in the original template but unused-ish — not in the new wrappers.

If a host needs full parity, the work is additive, not destructive. React can grow the same features; Angular can re-add the trimmed pieces from the sibling.

### Open from the original library's `docs/TODO.md`
These all still apply to the new rewrite. Carry over when they get picked up:
- **`AgentPresenceProvider`** (6th provider) — agent status (ready/busy/wrap_up/offline).
- **Decouple CTI linking UI from the 5 hardcoded entities** (Lead/Contact/Account/Case/Opportunity). Accept `linkableEntities` input; `*ngFor` / `map` the dropdowns.
- **`ContactDirectoryProvider`** for the Contacts tab.
- **LiveKit adapter** as a second reference `CallAdapter` — proves the abstraction is real, unlocks video for CRMs that want it.
- **Tests.** None exist in either the old or new library.
- **Dark-theme refinement** — current `dark` preset only swaps the accent; panel chrome still light.

### Not part of this rewrite, but adjacent
- The **LiveKit meeting integration** is a separate track — see `../../../orchestrix-v2/docs/integration/livekit-meeting-integration-progress.md`. That's for video meetings inside the CRM, not voice calls. Don't merge the two — they have different providers, different adapters, different UI affordances. If someone eventually writes a `LiveKitCallAdapter` here, it will share protocol knowledge with the meeting code but live as a peer of `JanusCallAdapter`.

---

## Behavioral differences from the original — intentional

| Area | Original | New |
|---|---|---|
| DI container | Angular `InjectionToken`s everywhere | `createCallClient({ providers })` factory; wrappers bridge to their DI. |
| `NgZone` wrapping in Janus adapter | Adapter calls `ngZone.run()` around incoming-message handlers | Adapter is zone-unaware; Angular wrapper calls `ngZone.run()` in subscription callbacks instead. React/Vue subscribe natively. |
| `@Injectable({providedIn: 'root'})` on `CallStateService` / `CtiService` / `RingtoneService` | Yes — Angular singletons | No — constructed by `createCallClient`. Wrappers hand them to their DI. |
| History persistence | Hardcoded `'webrtc_call_history'` localStorage key | Configurable via `CallStateServiceOptions.historyStorageKey`, or `null` to disable. |
| Ringtone + notifications | Always on (Angular DI) | Configurable: `createCallClient({ ringtoneOptions: null })` disables; options object overrides defaults. |
| Router integration in panel | Hardcoded `Router.events` subscription in the Angular component | Panel accepts `currentUrl` prop (React) / `onUrlChange(url)` method (Angular). Host feeds its router. |

All other behavior (call-state machine, CTI orchestration semantics, Janus protocol handling, 5 preset themes, CSS pixel geometry) is copied verbatim.

---

## Quick-reference: where to look when X breaks

| Symptom | First file to read |
|---|---|
| "Not registered to SIP server" | `packages/core/src/adapters/janus/janus-call-adapter.ts` — `registerSip()` + `handlePluginEvent(registered/registration_failed)`. |
| Audio autoplay blocked / no ringtone | `packages/core/src/services/ringtone.ts` — `setupAudioUnlock()`. |
| CRM lookup returns nothing | `packages/core/src/services/cti.ts` — `handleInboundCall()` / `handleOutboundCall()`. Host's `lookupCaller()` impl is the likely culprit. |
| Screen pop doesn't fire | `CrmIntegrationProvider.openRecord()` impl in the host. The library just calls it. |
| Panel doesn't re-render on state change (React) | `packages/react/src/hooks.ts` — `useObservable` subscribe/unsubscribe path. |
| Panel doesn't re-render on state change (Angular) | Missing `NgZone.run()` wrap on the observable subscription in the component. |
| Theme colors wrong | `packages/react/src/CallPanel.css` or `packages/angular/src/call-panel.component.scss` — CSS var overrides per `cc-theme-*` class. |
| Build fails: cannot resolve `@telcobright/crm-call-core` | TypeScript `paths` alias in wrapper `tsconfig.json` points at `../core/src/index.ts`. Works in dev (workspace symlink); after publish, resolution goes through `node_modules`. |
