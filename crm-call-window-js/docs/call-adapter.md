# Call Adapter

The output side of the library. Defines **how the browser talks to a call/meeting gateway**.

---

## The interface

```ts
export interface CallAdapter {
  readonly adapterName: string;

  connect(config: CallAdapterConnectConfig): Promise<void>;
  disconnect(): void;

  makeCall(phoneNumber: string, displayName?: string): Promise<void>;
  answerCall(): Promise<void>;
  declineCall(): void;
  hangup(): void;

  toggleMute(): boolean;
  toggleHold(): void;
  transfer(targetNumber: string): void;
  sendDTMF(digit: string): void;

  isRegistered(): boolean;
  getCurrentUsername(): string | null;
}
```

State updates (registration status, active call, call events) flow **out** through `CallStateService`, not through return values. The adapter is a command sink; `CallStateService` is the reactive bus.

---

## Config

Two config objects:

- `CallAdapterConfig` — static per-instance settings (default server URL, ICE, timeouts, audio URLs). Passed to `createCallClient({ adapterConfig })`.
- `CallAdapterConnectConfig` — per-session connect parameters (`username`, `password`, optional `server` override). Returned from `CallCredentialsProvider.getConnectConfig()` at runtime.

Runtime `server` wins over static `server` — useful for multi-tenant hosts that mint per-session URLs.

---

## Factory pattern

`createCallClient()` accepts an `adapterFactory` with the signature:

```ts
export type CallAdapterFactory = (
  callState: CallStateService,
  audio: CallAudioService,
  config: CallAdapterConfig
) => CallAdapter;
```

The default is `janusAdapterFactory`. To use a different gateway, pass your own factory and a compatible `adapterConfig`:

```ts
import { createCallClient } from '@telcobright/crm-call-core';

createCallClient({
  providers: myProviders,
  adapterConfig: myLiveKitConfig,
  adapterFactory: (callState, audio, config) => new MyLiveKitAdapter(callState, audio, config)
});
```

---

## The Janus adapter (shipped)

`packages/core/src/adapters/janus/janus-call-adapter.ts` — ~650 lines. Implements `CallAdapter` against the Janus WebSocket Gateway's SIP plugin:

- Opens a WebSocket to Janus (`wss://…/ws`, subprotocol `janus-protocol`).
- Creates a session, attaches `janus.plugin.sip`, sends `register`, waits for the `registered` event.
- `makeCall` → `sip` plugin `call` with the callee URI; answers ringback via `CallAudioService`.
- Incoming INVITE → `sip.incomingcall` event → peer connection built from the offered JSEP → `setIncomingCall()` on the state service.
- Keepalive every `config.timeouts.keepalive` ms.
- Reconnect loop with exponential backoff on WebSocket close.
- ICE trickled both directions; `iceTransportPolicy: 'relay'` by default (force TURN).
- DTMF via `dtmf_info`. Transfer via `sip.transfer` (blind). Hold via re-INVITE with `sendonly`.

State flow: `registering` → `registered` → `dialing` / `incomingcall` → `connected` → `completed` / `missed` — all emitted to `CallStateService`.

### Defaults (`janus.config.ts`)

```ts
{
  type: 'janus',
  server: 'wss://hippbx.btcliptelephony.gov.bd:3050/ws',
  iceServers: [
    { urls: 'turn:iptsp.cosmocom.net:3478', username: '…', credential: '…' },
    { urls: 'stun:iptsp.cosmocom.net:3478' }
  ],
  iceTransportPolicy: 'relay',
  timeouts: { registration: 30000, call: 60000, reconnect: 5000, keepalive: 25000 },
  audio: { ringtoneUrl: '/assets/audio/whatsapp.mp3', ringbackUrl: '/assets/audio/ringback.mp3', ringtoneVolume: 0.7 },
  sip: { domain: 'cosmocom.net', proxy: 'sip:hippbx.btcliptelephony.gov.bd', port: 5060 }
}
```

Three ways to override:

1. Pass a different `adapterConfig` to `createCallClient()`.
2. Return a `server` override in your `CallCredentialsProvider.getConnectConfig()`.
3. (Angular) Provide a different value for the `CALL_ADAPTER_CONFIG` InjectionToken.

---

## Writing a new adapter

Checklist:

1. Create a class implementing `CallAdapter`. Plain TypeScript — do not depend on React / Angular / Vue.
2. Constructor: `(CallStateService, CallAudioService, CallAdapterConfig)`. Store what you need.
3. `connect()` reads `CallAdapterConnectConfig`, opens your protocol connection, emits `CallStateService.setRegisterStatus('registering' → 'registered')`.
4. On incoming signaling: call `CallStateService.setIncomingCall(activeCall)` with a normalized `ActiveCall`.
5. On outbound dial → `setActiveCall(...)`; on accept → `updateActiveCall({status: 'connected'})`; on hangup → `clearActiveCall(reason)`.
6. Use `CallAudioService.playRingback()` / `stopRingback()` during dialing; call `setRemoteStream(stream)` when the remote track arrives.
7. Pass your constructor as `adapterFactory` to `createCallClient()`.

The UI wrappers don't care which adapter is active — they render whatever `CallStateService` emits.

---

## Audio service

`CallAudioService` is a thin utility used by adapters:

- `init(config)` — sets up the `<audio>` element for remote media, preloads ringtone/ringback.
- `setRemoteStream(stream)` / `clearRemoteStream()` — attach/detach `RTCPeerConnection` output.
- `playRingtone()` / `stopRingtone()` — on incoming calls.
- `playRingback()` / `stopRingback()` — while dialing.
- `cleanup()` — tear down on disconnect.

Not user-facing; adapters call it. Hosts don't touch it.

Continue to [`theming.md`](./theming.md) for the UI side.
