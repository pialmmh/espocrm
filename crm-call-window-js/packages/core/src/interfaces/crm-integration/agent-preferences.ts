import type { Observable } from 'rxjs';
import type { AgentProfile } from './agent-identity';

export interface OutboundCallerId {
  id: string;
  number: string;
  label?: string;
  isDefault?: boolean;
  raw?: any;
}

export interface AgentPreferencesProvider {
  getOutboundCallerIds(agent: AgentProfile): Observable<OutboundCallerId[]>;
  getActiveCallerId(agent: AgentProfile): string | null;
  setActiveCallerId(agent: AgentProfile, caller: OutboundCallerId): Promise<void>;
}
