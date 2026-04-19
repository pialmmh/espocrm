import type { Observable } from 'rxjs';

export interface AgentProfile {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  email?: string;
  /** CRM-specific bag (pbxUuid, extensionUuid, etc.) */
  extras?: Record<string, any>;
}

export interface AgentIdentityProvider {
  getCurrentAgent(): Observable<AgentProfile | null>;
}
