import { InjectionToken } from '@angular/core';
import type {
  AgentIdentityProvider,
  AgentPreferencesProvider,
  CallAdapterConfig,
  CallCredentialsProvider,
  CallPanelExtension,
  CrmIntegrationProvider,
  PhoneNormalizer
} from '@telcobright/crm-call-core';

export const AGENT_IDENTITY_PROVIDER   = new InjectionToken<AgentIdentityProvider>('AGENT_IDENTITY_PROVIDER');
export const CALL_CREDENTIALS_PROVIDER = new InjectionToken<CallCredentialsProvider>('CALL_CREDENTIALS_PROVIDER');
export const AGENT_PREFERENCES_PROVIDER = new InjectionToken<AgentPreferencesProvider>('AGENT_PREFERENCES_PROVIDER');
export const CRM_INTEGRATION_PROVIDER  = new InjectionToken<CrmIntegrationProvider>('CRM_INTEGRATION_PROVIDER');
export const PHONE_NORMALIZER          = new InjectionToken<PhoneNormalizer>('PHONE_NORMALIZER');
export const CALL_PANEL_EXTENSION      = new InjectionToken<CallPanelExtension>('CALL_PANEL_EXTENSION');
export const CALL_ADAPTER_CONFIG       = new InjectionToken<CallAdapterConfig>('CALL_ADAPTER_CONFIG');
