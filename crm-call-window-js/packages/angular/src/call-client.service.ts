/**
 * CallClientService — Angular DI wrapper around core createCallClient().
 *
 * Reads the six InjectionTokens, builds the framework-free CallClient, and
 * exposes the wired services (callState, cti, adapter, etc.) to Angular DI.
 */

import { Inject, Injectable, OnDestroy, Optional } from '@angular/core';
import {
  CallClient,
  CallStateService,
  CallAudioService,
  CtiService,
  RingtoneService,
  JANUS_CONFIG,
  createCallClient,
  type CallAdapter,
  type CallAdapterConfig,
  type AgentIdentityProvider,
  type AgentPreferencesProvider,
  type CallCredentialsProvider,
  type CallPanelExtension,
  type CrmIntegrationProvider,
  type PhoneNormalizer
} from '@telcobright/crm-call-core';
import {
  AGENT_IDENTITY_PROVIDER,
  AGENT_PREFERENCES_PROVIDER,
  CALL_ADAPTER_CONFIG,
  CALL_CREDENTIALS_PROVIDER,
  CALL_PANEL_EXTENSION,
  CRM_INTEGRATION_PROVIDER,
  PHONE_NORMALIZER
} from './tokens';

@Injectable({ providedIn: 'root' })
export class CallClientService implements OnDestroy {
  readonly client: CallClient;

  constructor(
    @Inject(AGENT_IDENTITY_PROVIDER) agentIdentity: AgentIdentityProvider,
    @Inject(CALL_CREDENTIALS_PROVIDER) callCredentials: CallCredentialsProvider,
    @Inject(AGENT_PREFERENCES_PROVIDER) agentPreferences: AgentPreferencesProvider,
    @Inject(CRM_INTEGRATION_PROVIDER) crmIntegration: CrmIntegrationProvider,
    @Optional() @Inject(PHONE_NORMALIZER) phoneNormalizer: PhoneNormalizer | null,
    @Optional() @Inject(CALL_PANEL_EXTENSION) panelExtension: CallPanelExtension | null,
    @Optional() @Inject(CALL_ADAPTER_CONFIG) adapterConfig: CallAdapterConfig | null
  ) {
    this.client = createCallClient({
      providers: {
        agentIdentity,
        callCredentials,
        agentPreferences,
        crmIntegration,
        phoneNormalizer: phoneNormalizer || undefined,
        panelExtension: panelExtension || undefined
      },
      adapterConfig: adapterConfig || JANUS_CONFIG
    });
  }

  get callState(): CallStateService { return this.client.callState; }
  get audio(): CallAudioService      { return this.client.audio; }
  get ringtone(): RingtoneService | null { return this.client.ringtone; }
  get cti(): CtiService              { return this.client.cti; }
  get adapter(): CallAdapter         { return this.client.adapter; }

  ngOnDestroy(): void {
    this.client.destroy();
  }
}
