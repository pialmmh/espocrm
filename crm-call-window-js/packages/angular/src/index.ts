export * from './tokens';
export * from './call-client.service';
export * from './call-panel.component';

// Re-export core surface so hosts can import everything from the Angular package.
export type {
  AgentProfile,
  AgentIdentityProvider,
  AgentPreferencesProvider,
  CallAdapter,
  CallAdapterConfig,
  CallAdapterConnectConfig,
  CallCredentialsProvider,
  CallPanelExtension,
  CrmIntegrationProvider,
  CrmMatch,
  CrmMatchBundle,
  CrmMatchKind,
  CreateRecordContext,
  CrmCallLogCreate,
  CrmCallLogUpdate,
  CallLogStatus,
  CrmCallDirection,
  OutboundCallerId,
  PhoneNormalizer,
  ActiveCall,
  CallHistoryEntry,
  CallParticipant,
  CallStatus,
  CallDirection,
  RegisterStatus,
  HoldStatus,
  TransferStatus,
  WebRTCConnectionState,
  CallerMatch,
  AllCallerMatches
} from '@telcobright/crm-call-core';
export { IdentityPhoneNormalizer, JANUS_CONFIG } from '@telcobright/crm-call-core';
