import type { ActiveCall } from '../../services/call-state';

export type CrmMatchKind = 'contact' | 'lead' | 'account' | 'case' | 'opportunity' | 'custom';

export interface CrmMatch {
  kind: CrmMatchKind;
  module: string;
  id: string;
  displayName: string;
  primaryPhone?: string;
  meta?: Record<string, any>;
}

export interface CrmMatchBundle {
  primary: CrmMatch | null;
  all: CrmMatch[];
}

export type CrmCallDirection = 'inbound' | 'outbound';
export type CallLogStatus = 'planned' | 'connected' | 'completed' | 'missed';

export interface CrmCallLogCreate {
  direction: CrmCallDirection;
  status: CallLogStatus;
  phoneNumber: string;
  displayName?: string;
  startedAt: Date;
  link?: { module: string; id: string };
}

export interface CrmCallLogUpdate {
  id: string;
  status?: CallLogStatus;
  endedAt?: Date;
  durationSeconds?: number;
  providerCallId?: string;
}

/**
 * Context passed to openCreateRecord so the provider can pre-fill the
 * CRM's native create form with caller info and related-record links.
 */
export interface CreateRecordContext {
  phoneNumber?: string;
  callerName?: string;
  linkedRecords?: Partial<Record<CrmMatchKind, string>>;
  extras?: Record<string, any>;
}

export interface CrmIntegrationProvider {
  lookupCaller(phoneVariants: string[]): Promise<CrmMatchBundle>;
  openRecord(match: CrmMatch): void;
  openRecordById(module: string, id: string): void;
  openCreateRecord(module: string, context: CreateRecordContext): void;
  notifyUnknownCaller(call: ActiveCall): void;
  createCallLog(entry: CrmCallLogCreate): Promise<string | null>;
  updateCallLog(entry: CrmCallLogUpdate): Promise<void>;
}
