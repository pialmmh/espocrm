/**
 * Vue 3 wrapper for @telcobright/crm-call-core.
 *
 * SCAFFOLD — this package provides:
 *   - `installCallClient(app, options)` Vue plugin that exposes the CallClient via provide/inject.
 *   - `useCallClient()` composable to consume it.
 *   - `useObservable(source$, initial)` — turns any rxjs Observable into a reactive ref.
 *   - Convenience composables: `useActiveCall`, `useIncomingCall`, `useRegisterStatus`, …
 *
 * A full <CallPanel /> Vue SFC is intentionally not yet implemented — port from
 * `@telcobright/crm-call-react`'s CallPanel.tsx when the first Vue host lands.
 * The core logic and providers are identical; only the template is Vue-specific.
 */

import {
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
  type App,
  type InjectionKey,
  type Ref
} from 'vue';
import type { Observable } from 'rxjs';
import {
  createCallClient,
  type ActiveCall,
  type CallClient,
  type CallHistoryEntry,
  type CreateCallClientOptions,
  type HoldStatus,
  type RegisterStatus,
  type WebRTCConnectionState
} from '@telcobright/crm-call-core';

export const CALL_CLIENT_KEY: InjectionKey<CallClient> = Symbol('CallClient');

export interface InstallCallClientOptions extends CreateCallClientOptions {
  /** Destroy the client when the root app unmounts. Default: true. */
  autoDestroy?: boolean;
}

/**
 * Vue plugin. Usage:
 *   import { createApp } from 'vue';
 *   import { installCallClient } from '@telcobright/crm-call-vue';
 *   const app = createApp(App);
 *   installCallClient(app, { providers: {...} });
 */
export function installCallClient(app: App, options: InstallCallClientOptions): CallClient {
  const { autoDestroy = true, ...clientOptions } = options;
  const client = createCallClient(clientOptions);
  app.provide(CALL_CLIENT_KEY, client);

  if (autoDestroy) {
    const origUnmount = app.unmount.bind(app);
    app.unmount = () => { client.destroy(); origUnmount(); };
  }
  return client;
}

export function useCallClient(): CallClient {
  const client = inject(CALL_CLIENT_KEY);
  if (!client) throw new Error('useCallClient requires installCallClient(app, ...) to be called first.');
  return client;
}

/**
 * Subscribe to any rxjs Observable and expose the latest value as a reactive ref.
 * For BehaviorSubjects the initial emit fires synchronously on subscribe, so `initial`
 * is briefly overwritten by the first tick — safe for template usage.
 */
export function useObservable<T>(source$: Observable<T>, initial: T): Ref<T> {
  const value = ref<T>(initial) as Ref<T>;
  let sub: { unsubscribe: () => void } | null = null;
  onMounted(() => { sub = source$.subscribe(v => { value.value = v; }); });
  onBeforeUnmount(() => { sub?.unsubscribe(); });
  return value;
}

export function useActiveCall(): Ref<ActiveCall | null> {
  return useObservable(useCallClient().callState.getActiveCall(), null);
}
export function useIncomingCall(): Ref<ActiveCall | null> {
  return useObservable(useCallClient().callState.getIncomingCall(), null);
}
export function useRegisterStatus(): Ref<RegisterStatus> {
  return useObservable(useCallClient().callState.getRegisterStatus(), 'idle');
}
export function useCallHistory(): Ref<CallHistoryEntry[]> {
  return useObservable(useCallClient().callState.getCallHistory(), []);
}
export function useMuteStatus(): Ref<boolean> {
  return useObservable(useCallClient().callState.getMuteStatus(), false);
}
export function useHoldStatus(): Ref<HoldStatus> {
  return useObservable(useCallClient().callState.getHoldStatus(), 'active');
}
export function useConnectionState(): Ref<WebRTCConnectionState> {
  return useObservable(useCallClient().callState.getConnectionState(), {
    websocketConnected: false,
    sipRegistered: false
  });
}

// Re-export core types for host convenience.
export type {
  CallClient,
  CreateCallClientOptions,
  CrmProviders,
  AgentProfile,
  AgentIdentityProvider,
  AgentPreferencesProvider,
  CallCredentialsProvider,
  CrmIntegrationProvider,
  PhoneNormalizer,
  CallPanelExtension,
  OutboundCallerId,
  ActiveCall,
  CallHistoryEntry,
  RegisterStatus,
  CallAdapter,
  CallAdapterConfig,
  CallAdapterConnectConfig
} from '@telcobright/crm-call-core';
export { IdentityPhoneNormalizer, JANUS_CONFIG } from '@telcobright/crm-call-core';
