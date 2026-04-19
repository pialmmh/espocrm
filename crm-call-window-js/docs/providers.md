# CRM Provider Interfaces

Five framework-free interfaces the host CRM implements to teach the library about its data model. All live in `@telcobright/crm-call-core` under `src/interfaces/crm-integration/`.

> **Migrating from `@telcobright/crm-call-window`?** The interfaces are identical. The only change is how you register them — no more `InjectionToken` imports. Use the framework wrapper's registration mechanism (React context, Angular tokens, Vue `provide`).

---

## 1. `AgentIdentityProvider`

```ts
import type { Observable } from 'rxjs';

export interface AgentProfile {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  email?: string;
  extras?: Record<string, any>;   // CRM-specific bag (pbxUuid, extensionUuid, …)
}

export interface AgentIdentityProvider {
  getCurrentAgent(): Observable<AgentProfile | null>;
}
```

Emit `null` while auth is resolving. `extras` is free-form — anything downstream providers may need.

---

## 2. `CallCredentialsProvider`

```ts
export interface CallCredentialsProvider {
  getConnectConfig(agent: AgentProfile): Promise<CallAdapterConnectConfig | null>;
}
```

Returns the adapter's connect config — SIP username/password for Janus, token for LiveKit, etc. Return `null` if the agent has no telephony privileges; the panel stays disconnected.

The returned config can include `server?: string` to override the signaling URL per session (useful for multi-tenant setups).

---

## 3. `AgentPreferencesProvider`

```ts
export interface OutboundCallerId {
  id: string;
  number: string;
  label?: string;
  isDefault?: boolean;
  raw?: any;
}

export interface AgentPreferencesProvider {
  getOutboundCallerIds(agent: AgentProfile): Observable<OutboundCallerId[]>;
  getActiveCallerId(agent: AgentProfile): string | null;
  setActiveCallerId(agent: AgentProfile, caller: OutboundCallerId): Promise<void>;
}
```

Persistence (localStorage, CRM user prefs, PBX backend) is entirely the provider's concern.

---

## 4. `PhoneNormalizer`

```ts
export interface PhoneNormalizer {
  normalize(phone: string): string[];
}
```

Default `IdentityPhoneNormalizer` strips non-digits/plus and returns one variant. Country-specific dial-plans write their own (e.g. Bangladesh `880 ↔ 0`). The returned array is OR-matched against the CRM by `lookupCaller()`.

---

## 5. `CrmIntegrationProvider`

```ts
export type CrmMatchKind = 'contact' | 'lead' | 'account' | 'case' | 'opportunity' | 'custom';

export interface CrmMatch {
  kind: CrmMatchKind;
  module: string;
  id: string;
  displayName: string;
  primaryPhone?: string;
  meta?: Record<string, any>;
}

export interface CrmMatchBundle {
  primary: CrmMatch | null;   // best match for auto screen-pop
  all: CrmMatch[];
}

export interface CreateRecordContext {
  phoneNumber?: string;
  callerName?: string;
  linkedRecords?: Partial<Record<CrmMatchKind, string>>;
  extras?: Record<string, any>;
}

export type CallLogStatus = 'planned' | 'connected' | 'completed' | 'missed';

export interface CrmIntegrationProvider {
  lookupCaller(phoneVariants: string[]): Promise<CrmMatchBundle>;
  openRecord(match: CrmMatch): void;
  openRecordById(module: string, id: string): void;
  openCreateRecord(module: string, context: CreateRecordContext): void;
  notifyUnknownCaller(call: ActiveCall): void;
  createCallLog(entry: CrmCallLogCreate): Promise<string | null>;
  updateCallLog(entry: CrmCallLogUpdate): Promise<void>;
}
```

The biggest interface because it spans lookup, navigation, and persistence. Everything the library does against the CRM flows through here; replace this impl and the entire CRM coupling changes.

### Status vocabulary translation

`CallLogStatus` is the library's normalized vocabulary. Your impl maps it to the CRM's own strings (e.g. a SuiteCRM impl would map `completed → 'Held'`, `missed → 'Not Held'`).

---

## Optional: `CallPanelExtension`

```ts
export interface CallPanelExtension {
  onRouteChange?(url: string): void;
  onDestroy?(): void;
}
```

Host-specific DOM side effects that fire on navigation — e.g. rewriting a particular record-page's layout. The panel wrapper passes its current URL in; if you don't supply an extension, nothing happens.

---

## Wiring

### React

```tsx
import { CallClientProvider } from '@telcobright/crm-call-react';

<CallClientProvider providers={{
  agentIdentity:    new MyAgentIdentity(),
  callCredentials:  new MyCallCredentials(),
  agentPreferences: new MyAgentPreferences(),
  crmIntegration:   new MyCrmIntegration(),
  phoneNormalizer:  new MyPhoneNormalizer(),  // optional
  panelExtension:   new MyPanelExtension()    // optional
}}>
  <App />
</CallClientProvider>
```

### Angular

```ts
providers: [
  { provide: AGENT_IDENTITY_PROVIDER,    useClass: MyAgentIdentity },
  { provide: CALL_CREDENTIALS_PROVIDER,  useClass: MyCallCredentials },
  { provide: AGENT_PREFERENCES_PROVIDER, useClass: MyAgentPreferences },
  { provide: CRM_INTEGRATION_PROVIDER,   useClass: MyCrmIntegration },
  { provide: PHONE_NORMALIZER,           useClass: MyPhoneNormalizer }, // optional
  { provide: CALL_PANEL_EXTENSION,       useClass: MyPanelExtension }   // optional
]
```

### Vue

```ts
installCallClient(app, {
  providers: {
    agentIdentity:    new MyAgentIdentity(),
    callCredentials:  new MyCallCredentials(),
    agentPreferences: new MyAgentPreferences(),
    crmIntegration:   new MyCrmIntegration(),
    phoneNormalizer:  new MyPhoneNormalizer()
  }
});
```

Continue to [`call-adapter.md`](./call-adapter.md) for the gateway side.
