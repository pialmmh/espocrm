# React Integration Guide

Step-by-step to wire `@telcobright/crm-call-react` into a React app.

---

## 1. Install

```bash
npm install @telcobright/crm-call-core @telcobright/crm-call-react rxjs react
```

(`react` is already in your project; listed here for completeness. `rxjs` is a peer dep of both core and the React wrapper.)

---

## 2. Implement the five provider interfaces

Each provider is a plain object or class with the shape defined in [`providers.md`](./providers.md). Keep CRM-specific HTTP / GraphQL calls inside them.

```ts
// src/call/my-providers.ts
import { BehaviorSubject, from, type Observable } from 'rxjs';
import type {
  AgentIdentityProvider, AgentPreferencesProvider, AgentProfile,
  CallCredentialsProvider, CallAdapterConnectConfig,
  CrmIntegrationProvider, CrmMatchBundle, CrmCallLogCreate, CrmCallLogUpdate,
  OutboundCallerId, PhoneNormalizer, CrmProviders
} from '@telcobright/crm-call-core';

class MyAgentIdentity implements AgentIdentityProvider {
  private agent$ = new BehaviorSubject<AgentProfile | null>(null);
  constructor() {
    fetch('/api/me').then(r => r.json()).then(user => this.agent$.next({
      id: user.id, tenantId: user.tenantId,
      username: user.username, displayName: user.displayName
    }));
  }
  getCurrentAgent() { return this.agent$.asObservable(); }
}

class MyCallCredentials implements CallCredentialsProvider {
  async getConnectConfig(agent: AgentProfile): Promise<CallAdapterConnectConfig | null> {
    const res = await fetch(`/api/agents/${agent.id}/sip-credentials`);
    if (!res.ok) return null;
    return await res.json();   // {username, password, domain, proxy, server?}
  }
}

class MyAgentPreferences implements AgentPreferencesProvider {
  getOutboundCallerIds(agent: AgentProfile): Observable<OutboundCallerId[]> {
    return from(fetch(`/api/agents/${agent.id}/dids`).then(r => r.json()));
  }
  getActiveCallerId(agent: AgentProfile): string | null {
    return localStorage.getItem(`did:${agent.id}`);
  }
  async setActiveCallerId(agent: AgentProfile, caller: OutboundCallerId): Promise<void> {
    localStorage.setItem(`did:${agent.id}`, caller.number);
  }
}

class MyPhoneNormalizer implements PhoneNormalizer {
  // Bangladesh: 880 ↔ 0 pairs
  normalize(phone: string): string[] {
    const digits = phone.replace(/\D/g, '');
    const variants = new Set<string>([digits]);
    if (digits.startsWith('880')) variants.add('0' + digits.slice(3));
    if (digits.startsWith('0'))   variants.add('880' + digits.slice(1));
    return Array.from(variants);
  }
}

class MyCrmIntegration implements CrmIntegrationProvider {
  async lookupCaller(phoneVariants: string[]): Promise<CrmMatchBundle> {
    const res = await fetch(`/api/crm/lookup?` + phoneVariants.map(p => `phone=${p}`).join('&'));
    return res.json();
  }
  openRecord(match) { window.location.href = `/${match.module}/${match.id}`; }
  openRecordById(module, id) { window.location.href = `/${module}/${id}`; }
  openCreateRecord(module, context) {
    const qs = new URLSearchParams();
    if (context.phoneNumber) qs.set('phone', context.phoneNumber);
    if (context.callerName)  qs.set('name', context.callerName);
    window.location.href = `/${module}/create?${qs}`;
  }
  notifyUnknownCaller(call) {
    new Notification('Incoming call', { body: `Unknown caller: ${call.caller.number}` });
  }
  async createCallLog(entry: CrmCallLogCreate): Promise<string | null> {
    const res = await fetch('/api/crm/call-logs', { method: 'POST', body: JSON.stringify(entry) });
    const { id } = await res.json();
    return id;
  }
  async updateCallLog(entry: CrmCallLogUpdate): Promise<void> {
    await fetch(`/api/crm/call-logs/${entry.id}`, { method: 'PATCH', body: JSON.stringify(entry) });
  }
}

export const myProviders: CrmProviders = {
  agentIdentity:    new MyAgentIdentity(),
  callCredentials:  new MyCallCredentials(),
  agentPreferences: new MyAgentPreferences(),
  crmIntegration:   new MyCrmIntegration(),
  phoneNormalizer:  new MyPhoneNormalizer()
};
```

---

## 3. Mount the provider + panel

```tsx
// App.tsx
import { CallClientProvider, CallPanel } from '@telcobright/crm-call-react';
import '@telcobright/crm-call-react/styles.css';
import { myProviders } from './call/my-providers';

export default function App() {
  return (
    <CallClientProvider providers={myProviders}>
      <AppShell>
        {/* your routes */}
        <CallPanel theme="blue"
                   showToggleOnPaths={['/calls', '/home']}
                   keepOpenAfterCallOnPaths={['/calls']} />
      </AppShell>
    </CallClientProvider>
  );
}
```

`<CallPanel />` uses `position: fixed` and anchors to the viewport — mount it once at the app root.

### Passing current URL (for path matching)

If you're using React Router, pass `currentUrl` explicitly so the panel reacts to route changes:

```tsx
import { useLocation } from 'react-router-dom';
function Shell() {
  const { pathname } = useLocation();
  return <CallPanel theme="blue" currentUrl={pathname} />;
}
```

Without `currentUrl`, the panel reads `window.location.href` once at mount only.

---

## 4. Click-to-call from anywhere

```tsx
import { useCallClient } from '@telcobright/crm-call-react';

function PhoneLink({ phone }: { phone: string }) {
  const { adapter } = useCallClient();
  return (
    <a href={`tel:${phone}`} onClick={async (e) => {
      e.preventDefault();
      if (!adapter.isRegistered()) return alert('Phone not connected');
      await adapter.makeCall(phone);
    }}>{phone}</a>
  );
}
```

---

## 5. Reading state in your own components

```tsx
import { useActiveCall, useRegisterStatus } from '@telcobright/crm-call-react';

function StatusPill() {
  const call = useActiveCall();
  const status = useRegisterStatus();
  return <span>{call ? call.status : status}</span>;
}
```

All convenience hooks: `useActiveCall`, `useIncomingCall`, `useRegisterStatus`, `useCallHistory`, `useMuteStatus`, `useHoldStatus`, `useTransferStatus`, `useConnectionState`, and the generic `useObservable(source$, initial)`.

---

## 6. Smoke test

1. Log in as an agent with valid SIP credentials.
2. Open dev console — expect `[JanusAdapter] Connected and registered successfully`.
3. Dial a test number from the panel → outgoing call appears, ringback plays, connects.
4. Have someone call the agent → incoming-call modal + ringtone + browser notification.
5. Check call logs appear in your CRM after hangup.
6. Confirm caller screen-pop happens for known callers.

---

## Common gotchas

- **CORS on credentials endpoint** — your `CallCredentialsProvider` runs in the browser; the CRM endpoint must accept the app origin.
- **Audio autoplay** — browsers block audio until user interaction. The library attaches a best-effort unlock on first click; calls arriving before any interaction may have silent first-ring.
- **Mixed content** — WebRTC requires HTTPS on the page for `getUserMedia`. `wss://` works either way but the app must be served over HTTPS.
- **TURN** — the default Janus config forces `iceTransportPolicy: 'relay'`. Bring your own TURN or override; STUN-only fails behind most enterprise NATs.
- **CSS** — don't forget `import '@telcobright/crm-call-react/styles.css';` at the app root. Without it the panel renders unstyled.
