# Vue Integration Guide (scaffold)

`@telcobright/crm-call-vue` currently ships:

- `installCallClient(app, options)` plugin
- `useCallClient()` composable
- `useObservable(source$, initial)` — turns any rxjs Observable into a reactive `Ref`
- Convenience composables: `useActiveCall`, `useIncomingCall`, `useRegisterStatus`, `useCallHistory`, `useMuteStatus`, `useHoldStatus`, `useConnectionState`

It does **not yet ship a `<CallPanel>` SFC**. The logic layer works end-to-end; only the template hasn't been ported from React yet. If you need the panel UI in Vue, port `packages/react/src/CallPanel.tsx` — it's mechanical.

---

## 1. Install

```bash
npm install @telcobright/crm-call-core @telcobright/crm-call-vue rxjs vue
```

---

## 2. Implement providers

Same shapes as the React / Angular guides. Vue doesn't care about the provider class style — plain objects work:

```ts
// src/call/my-providers.ts
import type { CrmProviders } from '@telcobright/crm-call-vue';
import { BehaviorSubject } from 'rxjs';

const agent$ = new BehaviorSubject(null);
fetch('/api/me').then(r => r.json()).then(u => agent$.next(u));

export const myProviders: CrmProviders = {
  agentIdentity:    { getCurrentAgent: () => agent$.asObservable() },
  callCredentials:  { async getConnectConfig(agent) { return fetch(`/api/sip/${agent.id}`).then(r => r.json()); } },
  agentPreferences: { /* … */ } as any,
  crmIntegration:   { /* … */ } as any,
};
```

---

## 3. Install the plugin

```ts
// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import { installCallClient } from '@telcobright/crm-call-vue';
import { myProviders } from './call/my-providers';

const app = createApp(App);
installCallClient(app, { providers: myProviders });
app.mount('#app');
```

---

## 4. Consume state in components

```vue
<script setup lang="ts">
import { useActiveCall, useRegisterStatus, useCallClient } from '@telcobright/crm-call-vue';

const call = useActiveCall();
const status = useRegisterStatus();
const { adapter } = useCallClient();

async function dial(phone: string) {
  if (!adapter.isRegistered()) return;
  await adapter.makeCall(phone);
}
</script>

<template>
  <div>
    <p>Status: {{ status }}</p>
    <p v-if="call">In call with {{ call.caller.number }} — {{ call.status }}</p>
    <button @click="dial('01712345678')">Call</button>
  </div>
</template>
```

---

## 5. Porting `<CallPanel>` (TODO)

`packages/react/src/CallPanel.tsx` is the reference — ~500 lines of React. Mechanical translation to Vue 3 `<script setup>`:

- `useState` → `ref` / `reactive`
- `useEffect` → `onMounted` / `watch` / `watchEffect`
- `useMemo` → `computed`
- `useRef` → plain closure var (refs for DOM el → `ref<HTMLElement | null>(null)`)
- Convenience hooks → same names, return `Ref<T>` instead of `T`
- JSX → Vue template with `v-if`, `v-for`, `@click`, etc.
- Copy `CallPanel.css` verbatim — selectors are already `cc-*` prefixed.

If you port it, please contribute it back.
