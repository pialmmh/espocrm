/**
 * Call Adapter Abstraction Layer
 *
 * CRM-agnostic interface for call/meeting backends. Implementations handle
 * signaling protocol details (Janus/SIP, LiveKit, etc.). State updates flow
 * out through CallStateService, not through the interface return values.
 */

/**
 * Configuration passed to CallAdapter.connect() at runtime.
 * Each adapter uses the fields relevant to its protocol.
 */
export interface CallAdapterConnectConfig {
  username: string;
  password: string;
  domain?: string;
  displayName?: string;
  proxy?: string;
  authUser?: string;
  /** Signaling server URL override (falls back to CallAdapterConfig.server if absent) */
  server?: string;
  /** Adapter-specific extras */
  [key: string]: any;
}

/**
 * Static configuration for an adapter instance.
 */
export interface CallAdapterConfig {
  type: 'janus' | 'livekit' | string;
  server: string;
  iceServers: RTCIceServer[];
  iceTransportPolicy?: RTCIceTransportPolicy;
  timeouts: {
    registration: number;
    call: number;
    reconnect: number;
    keepalive: number;
  };
  audio: {
    ringtoneUrl: string;
    ringbackUrl: string;
    ringtoneVolume: number;
  };
  [key: string]: any;
}

/**
 * Abstract call adapter interface.
 * Framework-agnostic: concrete implementations must not depend on React / Angular / Vue.
 */
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
