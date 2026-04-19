export * from './context';
export * from './hooks';
export * from './CallPanel';

// Re-export core surface for convenience — hosts typically need these types.
export type {
  AgentProfile,
  OutboundCallerId,
  ActiveCall,
  CallHistoryEntry,
  RegisterStatus,
  CallAdapter,
  CallAdapterConfig,
  CallAdapterConnectConfig,
  CrmProviders,
  CreateCallClientOptions,
  CallClient
} from '@telcobright/crm-call-core';
