/**
 * createCallClient() — framework-agnostic composition root.
 *
 * Replaces Angular's DI tree. The host assembles providers + an adapter config
 * and gets back a CallClient handle that wires CallStateService, CallAudioService,
 * RingtoneService, CtiService, and the adapter itself. UI layers (React/Angular/Vue
 * wrappers) consume the handle.
 */

import type { CallAdapter, CallAdapterConfig } from '../interfaces/call-adapter';
import { CallStateService, CallStateServiceOptions } from '../services/call-state';
import { CallAudioService } from '../services/call-audio';
import { RingtoneService, RingtoneServiceOptions } from '../services/ringtone';
import { CtiService } from '../services/cti';
import type { AgentIdentityProvider } from '../interfaces/crm-integration/agent-identity';
import type { AgentPreferencesProvider } from '../interfaces/crm-integration/agent-preferences';
import type { CallCredentialsProvider } from '../interfaces/crm-integration/call-credentials';
import type { CrmIntegrationProvider } from '../interfaces/crm-integration/crm-integration';
import { PhoneNormalizer, IdentityPhoneNormalizer } from '../interfaces/crm-integration/phone-normalizer';
import type { CallPanelExtension } from '../interfaces/call-panel-extension';
import { JanusCallAdapter } from '../adapters/janus/janus-call-adapter';
import { JANUS_CONFIG } from '../adapters/janus/janus.config';

/** Host-supplied CRM integration providers. */
export interface CrmProviders {
  agentIdentity: AgentIdentityProvider;
  callCredentials: CallCredentialsProvider;
  agentPreferences: AgentPreferencesProvider;
  crmIntegration: CrmIntegrationProvider;
  /** Defaults to IdentityPhoneNormalizer if not supplied. */
  phoneNormalizer?: PhoneNormalizer;
  /** Optional UI-side extension for route-change side effects. */
  panelExtension?: CallPanelExtension;
}

/**
 * Factory that builds an adapter. Framework wrappers pass a built-in
 * factory (janus) or the host supplies their own to use a different gateway.
 */
export type CallAdapterFactory = (
  callState: CallStateService,
  audio: CallAudioService,
  config: CallAdapterConfig
) => CallAdapter;

/** Built-in Janus factory. Register more here or pass a custom factory via options. */
export const janusAdapterFactory: CallAdapterFactory = (callState, audio, config) =>
  new JanusCallAdapter(callState, audio, config);

export interface CreateCallClientOptions {
  providers: CrmProviders;
  /** Adapter static config. Defaults to JANUS_CONFIG. */
  adapterConfig?: CallAdapterConfig;
  /** Adapter factory. Defaults to janusAdapterFactory. */
  adapterFactory?: CallAdapterFactory;
  /** CallStateService options (history persistence, limits). */
  stateOptions?: CallStateServiceOptions;
  /** RingtoneService options. Pass null to skip the default ringtone/notifications entirely. */
  ringtoneOptions?: RingtoneServiceOptions | null;
}

/**
 * A fully-wired call client. Frameworks expose this to their UI layers.
 */
export interface CallClient {
  callState: CallStateService;
  audio: CallAudioService;
  ringtone: RingtoneService | null;
  cti: CtiService;
  adapter: CallAdapter;
  providers: Required<Omit<CrmProviders, 'panelExtension'>> & Pick<CrmProviders, 'panelExtension'>;
  adapterConfig: CallAdapterConfig;
  destroy(): void;
}

export function createCallClient(options: CreateCallClientOptions): CallClient {
  const adapterConfig = options.adapterConfig ?? JANUS_CONFIG;
  const adapterFactory = options.adapterFactory ?? janusAdapterFactory;
  const phoneNormalizer = options.providers.phoneNormalizer ?? new IdentityPhoneNormalizer();

  const callState = new CallStateService(options.stateOptions);
  const audio = new CallAudioService(adapterConfig);
  const adapter = adapterFactory(callState, audio, adapterConfig);
  const cti = new CtiService(callState, options.providers.crmIntegration, phoneNormalizer);

  const ringtone = options.ringtoneOptions === null
    ? null
    : new RingtoneService(callState, {
        ringtoneUrl: adapterConfig.audio.ringtoneUrl,
        volume: adapterConfig.audio.ringtoneVolume,
        ...(options.ringtoneOptions || {})
      });

  return {
    callState,
    audio,
    ringtone,
    cti,
    adapter,
    adapterConfig,
    providers: {
      agentIdentity: options.providers.agentIdentity,
      callCredentials: options.providers.callCredentials,
      agentPreferences: options.providers.agentPreferences,
      crmIntegration: options.providers.crmIntegration,
      phoneNormalizer,
      panelExtension: options.providers.panelExtension
    },
    destroy() {
      cti.destroy();
      ringtone?.destroy();
      adapter.disconnect();
    }
  };
}
