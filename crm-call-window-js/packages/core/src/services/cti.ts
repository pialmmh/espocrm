/**
 * CTI orchestrator — framework-agnostic.
 *
 * Subscribes to call lifecycle events and delegates CRM-specific operations
 * (caller lookup, screen pop, call-log persistence) to the CrmIntegrationProvider.
 */

import type { Subscription } from 'rxjs';
import { ActiveCall, CallStateService } from './call-state';
import type {
  CrmIntegrationProvider,
  CrmMatch,
  CrmMatchBundle
} from '../interfaces/crm-integration/crm-integration';
import type { PhoneNormalizer } from '../interfaces/crm-integration/phone-normalizer';

// Back-compat shapes consumed by UI layers
export interface CallerMatch {
  type: 'Contacts' | 'Leads' | 'Accounts';
  module: string;
  record: {
    id: string;
    firstName?: string;
    lastName?: string;
    fullName: string;
    phoneWork?: string;
    phoneMobile?: string;
    phoneOffice?: string;
    accountName?: string;
  };
}

export interface AllCallerMatches {
  lead: CallerMatch | null;
  contact: CallerMatch | null;
  account: CallerMatch | null;
  case: { id: string; name: string } | null;
  opportunity: { id: string; name: string } | null;
}

export class CtiService {
  private subscriptions: Subscription[] = [];
  private currentCallRecordId: string | null = null;
  private currentMatch: CrmMatch | null = null;
  private hasUpdatedToConnected = false;
  private isProcessingCall = false;
  private lastProcessedCallId: string | null = null;

  constructor(
    private callState: CallStateService,
    private crm: CrmIntegrationProvider,
    private phoneNormalizer: PhoneNormalizer
  ) {
    console.log('[CTI] Service initialized');
    this.subscribeToCallEvents();
  }

  private subscribeToCallEvents(): void {
    this.subscriptions.push(
      this.callState.getIncomingCall().subscribe(call => {
        if (call) this.handleInboundCall(call);
      })
    );

    this.subscriptions.push(
      this.callState.getActiveCall().subscribe(call => {
        if (!call) return;
        if (call.direction === 'outgoing' && call.status === 'dialing'
            && !this.currentCallRecordId
            && !this.isProcessingCall
            && this.lastProcessedCallId !== call.id) {
          this.handleOutboundCall(call);
        }
        if (call.status === 'connected' && this.currentCallRecordId && !this.hasUpdatedToConnected) {
          this.hasUpdatedToConnected = true;
          this.crm.updateCallLog({ id: this.currentCallRecordId, status: 'connected' });
        }
      })
    );

    this.subscriptions.push(
      this.callState.getCallEvents().subscribe(event => {
        if (event.type === 'call_ended') this.handleCallEnded(event.data);
      })
    );
  }

  private async handleInboundCall(call: ActiveCall): Promise<void> {
    if (this.currentCallRecordId || this.isProcessingCall || this.lastProcessedCallId === call.id) {
      return;
    }
    this.hasUpdatedToConnected = false;
    this.isProcessingCall = true;
    this.lastProcessedCallId = call.id;

    try {
      const variants = this.phoneNormalizer.normalize(call.caller.number);
      const bundle = await this.crm.lookupCaller(variants);
      this.currentMatch = bundle.primary;

      this.currentCallRecordId = await this.crm.createCallLog({
        direction: 'inbound',
        status: 'planned',
        phoneNumber: call.caller.number,
        displayName: bundle.primary?.displayName || call.caller.displayName,
        startedAt: new Date(),
        link: bundle.primary ? { module: bundle.primary.module, id: bundle.primary.id } : undefined
      });

      this.isProcessingCall = false;

      if (bundle.primary) {
        this.crm.openRecord(bundle.primary);
      } else {
        this.crm.notifyUnknownCaller(call);
      }
    } catch (err) {
      console.error('[CTI] Inbound error:', err);
      this.isProcessingCall = false;
    }
  }

  private async handleOutboundCall(call: ActiveCall): Promise<void> {
    if (this.currentCallRecordId || this.isProcessingCall) return;
    this.hasUpdatedToConnected = false;
    this.isProcessingCall = true;
    this.lastProcessedCallId = call.id;

    try {
      const variants = this.phoneNormalizer.normalize(call.callee.number);
      const bundle = await this.crm.lookupCaller(variants);
      this.currentMatch = bundle.primary;

      this.currentCallRecordId = await this.crm.createCallLog({
        direction: 'outbound',
        status: 'planned',
        phoneNumber: call.callee.number,
        displayName: bundle.primary?.displayName || call.callee.displayName,
        startedAt: new Date(),
        link: bundle.primary ? { module: bundle.primary.module, id: bundle.primary.id } : undefined
      });
      this.isProcessingCall = false;
    } catch (err) {
      console.error('[CTI] Outbound error:', err);
      this.isProcessingCall = false;
    }
  }

  private async handleCallEnded(data: any): Promise<void> {
    if (!this.currentCallRecordId) {
      this.resetCallState();
      return;
    }
    const recordId = this.currentCallRecordId;
    const activeCall = data?.call;
    const duration = activeCall?.duration || 0;
    const providerCallId = activeCall?.sipCallId || undefined;

    this.resetCallState();

    await this.crm.updateCallLog({
      id: recordId,
      status: duration === 0 ? 'missed' : 'completed',
      endedAt: new Date(),
      durationSeconds: duration,
      providerCallId
    });
  }

  private resetCallState(): void {
    this.currentCallRecordId = null;
    this.currentMatch = null;
    this.isProcessingCall = false;
    this.lastProcessedCallId = null;
    this.hasUpdatedToConnected = false;
  }

  // --- Back-compat API used by UI components ---

  normalizePhone(phone: string): string[] {
    return this.phoneNormalizer.normalize(phone);
  }

  async findAllMatches(phoneVariants: string[]): Promise<AllCallerMatches> {
    const bundle = await this.crm.lookupCaller(phoneVariants);
    return this.toLegacy(bundle);
  }

  requestNotificationPermission(): void {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => console.log('[CTI] Notification permission:', p));
    }
  }

  destroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private toLegacy(bundle: CrmMatchBundle): AllCallerMatches {
    const pick = (kind: 'contact' | 'lead' | 'account') =>
      bundle.all.find(m => m.kind === kind) || null;

    const contact = pick('contact');
    const lead = pick('lead');
    const account = pick('account');
    const kase = bundle.all.find(m => m.kind === 'case') || null;
    const opp = bundle.all.find(m => m.kind === 'opportunity') || null;

    return {
      contact: contact ? this.toCallerMatch(contact, 'Contacts', 'contacts') : null,
      lead: lead ? this.toCallerMatch(lead, 'Leads', 'leads') : null,
      account: account ? this.toCallerMatch(account, 'Accounts', 'accounts') : null,
      case: kase ? { id: kase.id, name: kase.displayName } : null,
      opportunity: opp ? { id: opp.id, name: opp.displayName } : null
    };
  }

  private toCallerMatch(m: CrmMatch, type: 'Contacts' | 'Leads' | 'Accounts', module: string): CallerMatch {
    const meta = m.meta || {};
    return {
      type,
      module,
      record: {
        id: m.id,
        firstName: meta.firstName,
        lastName: meta.lastName,
        fullName: m.displayName,
        phoneWork: meta.raw?.phone_work || m.primaryPhone,
        phoneMobile: meta.raw?.phone_mobile,
        phoneOffice: meta.raw?.phone_office,
        accountName: meta.accountName
      }
    };
  }
}
