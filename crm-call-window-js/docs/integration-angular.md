# Angular Integration Guide

Step-by-step to wire `@telcobright/crm-call-angular` into an Angular 15+ app. If you're migrating from the old `@telcobright/crm-call-window`, see the "Migrating" section at the bottom — the API is nearly identical.

---

## 1. Install

```bash
npm install @telcobright/crm-call-core @telcobright/crm-call-angular rxjs
```

Peer deps: `@angular/core`, `@angular/common`, `@angular/forms` (any version from 15 onward).

---

## 2. Implement the five provider interfaces

Same shapes as in [`providers.md`](./providers.md). Typical pattern:

```ts
// src/app/call/providers/my-agent-identity.provider.ts
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthService } from '../auth';   // your own
import type { AgentIdentityProvider, AgentProfile } from '@telcobright/crm-call-angular';

@Injectable({ providedIn: 'root' })
export class MyAgentIdentityProvider implements AgentIdentityProvider {
  constructor(private auth: AuthService) {}
  getCurrentAgent(): Observable<AgentProfile | null> {
    return this.auth.currentUser$.pipe(map(u => u && {
      id: u.id, tenantId: u.tenantId,
      username: u.username, displayName: u.fullName,
      extras: { pbxUuid: u.pbxUuid, extensionUuid: u.extensionUuid }
    }));
  }
}
```

Repeat for `MyCallCredentialsProvider`, `MyAgentPreferencesProvider`, `MyCrmIntegrationProvider`, `MyPhoneNormalizer`.

---

## 3. Register the providers

Collect all five into one providers array so AppModule stays tidy:

```ts
// src/app/call/providers/index.ts
import { Provider } from '@angular/core';
import {
  AGENT_IDENTITY_PROVIDER, CALL_CREDENTIALS_PROVIDER,
  AGENT_PREFERENCES_PROVIDER, CRM_INTEGRATION_PROVIDER, PHONE_NORMALIZER
} from '@telcobright/crm-call-angular';
import { MyAgentIdentityProvider } from './my-agent-identity.provider';
import { MyCallCredentialsProvider } from './my-call-credentials.provider';
import { MyAgentPreferencesProvider } from './my-agent-preferences.provider';
import { MyCrmIntegrationProvider } from './my-crm-integration.provider';
import { MyPhoneNormalizer } from './my-phone-normalizer';

export const CRM_INTEGRATION_PROVIDERS: Provider[] = [
  { provide: AGENT_IDENTITY_PROVIDER,    useExisting: MyAgentIdentityProvider },
  { provide: CALL_CREDENTIALS_PROVIDER,  useExisting: MyCallCredentialsProvider },
  { provide: AGENT_PREFERENCES_PROVIDER, useExisting: MyAgentPreferencesProvider },
  { provide: CRM_INTEGRATION_PROVIDER,   useExisting: MyCrmIntegrationProvider },
  { provide: PHONE_NORMALIZER,           useExisting: MyPhoneNormalizer }
];
```

Use `useExisting` (not `useClass`) so the library injects the same instance your other components consume.

---

## 4. Wire into AppModule

```ts
// src/app/app.module.ts
import { CallPanelComponent } from '@telcobright/crm-call-angular';
import { CRM_INTEGRATION_PROVIDERS } from './call/providers';

@NgModule({
  imports: [
    // ...
    CallPanelComponent    // standalone — import, don't declare
  ],
  providers: [...CRM_INTEGRATION_PROVIDERS]
})
export class AppModule {}
```

`CallClientService` is `providedIn: 'root'` — no registration needed.

---

## 5. Place the panel

```html
<!-- src/app/app.component.html -->
<app-call *ngIf="isLoggedIn"
          theme="green"
          [showToggleOnPaths]="['/calls', '/home']"
          [keepOpenAfterCallOnPaths]="['/calls']">
</app-call>
```

### Feeding URLs from Angular Router

By default, the component reads `window.location.href` at init only. To respond to `NavigationEnd` events, wire it up yourself:

```ts
// app.component.ts
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

constructor(private router: Router) {
  this.router.events.pipe(filter(e => e instanceof NavigationEnd))
    .subscribe((e: any) => this.callPanel.onUrlChange(e.urlAfterRedirects || e.url));
}

@ViewChild(CallPanelComponent) callPanel!: CallPanelComponent;
```

Or, simpler: pass `[currentUrl]="currentUrl"` and set it from a subscription.

---

## 6. Click-to-call from anywhere

```ts
import { Component } from '@angular/core';
import { CallClientService } from '@telcobright/crm-call-angular';

@Component({
  selector: 'phone-link',
  template: `<a href="tel:{{ phone }}" (click)="call($event)">{{ phone }}</a>`
})
export class PhoneLinkComponent {
  @Input() phone!: string;
  constructor(private client: CallClientService) {}
  async call(e: Event) {
    e.preventDefault();
    if (!this.client.adapter.isRegistered()) return alert('Phone not connected');
    await this.client.adapter.makeCall(this.phone);
  }
}
```

---

## 7. Smoke test

1. Log in as an agent with valid SIP credentials.
2. Dev console → expect `[JanusAdapter] Connected and registered successfully`.
3. Dial from the panel → hear ringback, connect.
4. Have someone call the agent → incoming modal + ringtone + browser notification.
5. Call logs appear in CRM after hangup.

---

## Migrating from `@telcobright/crm-call-window`

The Angular wrapper is a near drop-in replacement. Changes:

| Old | New |
|---|---|
| `import ... from '@telcobright/crm-call-window'` | `import ... from '@telcobright/crm-call-angular'` |
| Tokens: `AGENT_IDENTITY_PROVIDER`, etc. | Same names, different package. |
| `CALL_ADAPTER_PROVIDERS` factory in AppModule | **Gone.** `CallClientService` handles adapter construction internally. Remove the spread. |
| `@Inject(CALL_ADAPTER)` in your components | Replace with `inject(CallClientService)` and use `.adapter`. |
| Router subscription inside the panel | Now externalised — pass `currentUrl` or call `onUrlChange(url)` from your router event handler. |

The 5 provider interfaces and `<app-call>` inputs (`theme`, `showToggleOnPaths`, `keepOpenAfterCallOnPaths`) are unchanged.
