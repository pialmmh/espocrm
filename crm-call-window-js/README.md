# crm-call-window-js

Framework-agnostic CRM call window library. Written as a **core package** (pure TypeScript + rxjs) with thin **framework wrappers** for React, Angular, and Vue.

Status: **pre-1.0, experimental.** Extracted from the Angular-only `@telcobright/crm-call-window` (sibling directory `../crm-call-window/`) and rewritten so the same core logic can drive any frontend stack.

> **Picking this up cold?** Read [`RESUME-HERE.md`](./RESUME-HERE.md) first — it captures what state the rewrite is in, where the original lives for diffing, and what the user most likely wants next. Current status + known gaps: [`docs/STATUS.md`](./docs/STATUS.md).

---

## Packages

| Package | What it is |
|---|---|
| [`@telcobright/crm-call-core`](./packages/core) | Framework-free: `CallAdapter` interface, `JanusCallAdapter`, state service, CTI orchestrator, 5 CRM provider interfaces, `createCallClient()` factory. No UI, no React/Angular/Vue dependency. |
| [`@telcobright/crm-call-react`](./packages/react) | React hooks + floating `<CallPanel />` component + `<CallClientProvider>` context. |
| [`@telcobright/crm-call-angular`](./packages/angular) | Angular DI tokens, `CallClientService`, standalone `<app-call>` component. Drop-in replacement for the old `@telcobright/crm-call-window`. |
| [`@telcobright/crm-call-vue`](./packages/vue) | Vue 3 plugin + composables. (Scaffold — `<CallPanel>` SFC not yet shipped.) |

The wrappers are thin — all call-gateway protocol code, CTI orchestration, and call-log persistence logic lives in **core**. Wrappers exist only to bridge the reactive state into the framework's rendering model and to shape the DI boundary the host already expects.

---

## Why split it this way

Most CRMs want the same capabilities — register an agent against a SIP/WebRTC gateway, make and receive calls, screen-pop the caller's record, log calls back into the CRM. Two things vary per deployment:

- **Output side** (the gateway): Janus + FreeSWITCH today; LiveKit / Twilio / custom tomorrow. The `CallAdapter` interface in core abstracts this. Janus ships by default; add more by passing a custom `adapterFactory` to `createCallClient()`.
- **Input side** (the CRM): SuiteCRM, EspoCRM, Salesforce, whatever. Five small provider interfaces (`AgentIdentityProvider`, `CallCredentialsProvider`, `AgentPreferencesProvider`, `PhoneNormalizer`, `CrmIntegrationProvider`) tell the library what the CRM's records look like. The host implements them, passes them to `createCallClient()`.

Frameworks (React, Angular, Vue) sit on top of that handle — they render the panel and bridge the reactive state.

---

## Quick start — React

```bash
npm install @telcobright/crm-call-core @telcobright/crm-call-react rxjs react
```

```tsx
// App.tsx
import { CallClientProvider, CallPanel } from '@telcobright/crm-call-react';
import '@telcobright/crm-call-react/styles.css';
import { myProviders } from './my-providers';   // your 5 CRM provider impls

export function App() {
  return (
    <CallClientProvider providers={myProviders}>
      <YourRoutes />
      <CallPanel theme="blue"
                 showToggleOnPaths={['/calls', '/home']}
                 keepOpenAfterCallOnPaths={['/calls']} />
    </CallClientProvider>
  );
}
```

Full guide: [`docs/integration-react.md`](./docs/integration-react.md).

---

## Quick start — Angular

```bash
npm install @telcobright/crm-call-core @telcobright/crm-call-angular rxjs
```

```typescript
// app.module.ts
import {
  AGENT_IDENTITY_PROVIDER, CALL_CREDENTIALS_PROVIDER, AGENT_PREFERENCES_PROVIDER,
  CRM_INTEGRATION_PROVIDER, PHONE_NORMALIZER, CallPanelComponent
} from '@telcobright/crm-call-angular';

@NgModule({
  imports: [CallPanelComponent],
  providers: [
    { provide: AGENT_IDENTITY_PROVIDER,    useClass: MyAgentIdentity },
    { provide: CALL_CREDENTIALS_PROVIDER,  useClass: MyCallCredentials },
    { provide: AGENT_PREFERENCES_PROVIDER, useClass: MyAgentPreferences },
    { provide: CRM_INTEGRATION_PROVIDER,   useClass: MyCrmIntegration },
    { provide: PHONE_NORMALIZER,           useClass: MyPhoneNormalizer }
  ]
})
export class AppModule {}
```

```html
<app-call theme="green" [showToggleOnPaths]="['/calls']"></app-call>
```

Full guide: [`docs/integration-angular.md`](./docs/integration-angular.md).

---

## Quick start — Vue

```bash
npm install @telcobright/crm-call-core @telcobright/crm-call-vue rxjs vue
```

```typescript
// main.ts
import { createApp } from 'vue';
import { installCallClient } from '@telcobright/crm-call-vue';
import App from './App.vue';
import { myProviders } from './my-providers';

const app = createApp(App);
installCallClient(app, { providers: myProviders });
app.mount('#app');
```

```vue
<!-- somewhere in your app -->
<script setup>
import { useActiveCall, useRegisterStatus, useCallClient } from '@telcobright/crm-call-vue';
const call = useActiveCall();
const status = useRegisterStatus();
const client = useCallClient();
</script>
```

Full guide: [`docs/integration-vue.md`](./docs/integration-vue.md). Note: Vue package currently ships composables only — the `<CallPanel>` SFC is TBD.

---

## Documentation

- [`docs/README.md`](./docs/README.md) — architecture + reading order
- [`docs/providers.md`](./docs/providers.md) — five CRM provider interfaces, deep dive
- [`docs/call-adapter.md`](./docs/call-adapter.md) — gateway abstraction, writing a new adapter
- [`docs/integration-react.md`](./docs/integration-react.md) — React host integration
- [`docs/integration-angular.md`](./docs/integration-angular.md) — Angular host integration
- [`docs/integration-vue.md`](./docs/integration-vue.md) — Vue host integration (scaffold)
- [`docs/theming.md`](./docs/theming.md) — preset themes + CSS variables

---

## Monorepo layout

```
crm-call-window-js/
├── package.json                (npm workspace root)
├── tsconfig.base.json
├── README.md                   (this file)
├── docs/
└── packages/
    ├── core/     @telcobright/crm-call-core
    ├── react/    @telcobright/crm-call-react
    ├── angular/  @telcobright/crm-call-angular
    └── vue/      @telcobright/crm-call-vue
```

## License

AGPL-3.0.
