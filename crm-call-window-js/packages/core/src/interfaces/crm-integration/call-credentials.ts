import type { CallAdapterConnectConfig } from '../call-adapter';
import type { AgentProfile } from './agent-identity';

export interface CallCredentialsProvider {
  getConnectConfig(agent: AgentProfile): Promise<CallAdapterConnectConfig | null>;
}
