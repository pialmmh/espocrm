/**
 * <app-call> — Angular standalone component that renders the floating
 * call panel. Delegates all state/logic to the core CallClient exposed by
 * CallClientService. Hosts must provide the five CRM provider tokens
 * (plus optional CALL_PANEL_EXTENSION / CALL_ADAPTER_CONFIG).
 */

import { Component, HostBinding, HostListener, Inject, Input, NgZone, OnDestroy, OnInit, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import type {
  ActiveCall as CoreActiveCall,
  AgentProfile,
  CallPanelExtension,
  CreateRecordContext,
  OutboundCallerId,
  RegisterStatus
} from '@telcobright/crm-call-core';
import type { AllCallerMatches, CallerMatch } from '@telcobright/crm-call-core';
import { CallClientService } from './call-client.service';
import { CALL_PANEL_EXTENSION } from './tokens';

export type CallPanelTheme = 'green' | 'blue' | 'gray' | 'red' | 'dark';

interface DialpadKey { number: string; letters: string; }

@Component({
  selector: 'app-call',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './call-panel.component.html',
  styleUrls: ['./call-panel.component.scss']
})
export class CallPanelComponent implements OnInit, OnDestroy {
  @Input() theme: CallPanelTheme = 'green';
  @HostBinding('class') get themeClass(): string { return `cc-theme-${this.theme}`; }

  @Input() showToggleOnPaths: string[] = [];
  @Input() keepOpenAfterCallOnPaths: string[] = [];
  /** Optional current URL. When omitted the component tracks window.location only at init. */
  @Input() currentUrl: string | null = null;

  // Reactive state surfaced to the template
  isCallPanelOpen = false;
  phoneNumber = '';
  hasActiveCall = false;
  hasIncomingCall = false;
  isMuted = false;
  isOnHold = false;
  callDuration = '00:00';
  isRegistered = false;
  registerStatus: RegisterStatus = 'idle';
  isConnecting = false;
  shouldShowToggle = true;
  shouldKeepOpenAfterCall = false;

  incomingCallData: CoreActiveCall | null = null;
  activeCallData = { name: '', number: '', avatar: '' };

  callerMatch: CallerMatch | null = null;
  allMatches: AllCallerMatches | null = null;
  currentCallerNumber = '';
  currentCallerName = '';
  lookupCompleted = false;

  linkExistingOpen = false;
  associateWithOpen = false;

  showTransferDialog = false;
  transferTarget = '';

  didList: OutboundCallerId[] = [];
  selectedDid = '';
  didDropdownOpen = false;
  didLoading = false;
  didSettingLoading = false;
  showDidToast = false;

  showNotificationBanner = false;

  dialpadKeys: DialpadKey[] = [
    { number: '1', letters: '' },  { number: '2', letters: 'ABC' }, { number: '3', letters: 'DEF' },
    { number: '4', letters: 'GHI' }, { number: '5', letters: 'JKL' }, { number: '6', letters: 'MNO' },
    { number: '7', letters: 'PQRS' }, { number: '8', letters: 'TUV' }, { number: '9', letters: 'WXYZ' },
    { number: '*', letters: '' }, { number: '0', letters: '+' }, { number: '#', letters: '' }
  ];

  private subscriptions: Subscription[] = [];
  private currentAgent: AgentProfile | null = null;
  private credentialsLoaded = false;

  constructor(
    private client: CallClientService,
    private zone: NgZone,
    @Optional() @Inject(CALL_PANEL_EXTENSION) private panelExtension: CallPanelExtension | null
  ) {}

  ngOnInit(): void {
    this.subscribeToCallState();
    this.client.cti.requestNotificationPermission();
    this.checkNotificationPermission();
    this.fetchSipCredentialsAndConnect();
    this.applyUrl(this.currentUrl ?? (typeof window !== 'undefined' ? window.location.href : ''));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.panelExtension?.onDestroy?.();
  }

  private applyUrl(url: string): void {
    const lower = url.toLowerCase();
    this.shouldShowToggle = this.showToggleOnPaths.length === 0 ||
      this.showToggleOnPaths.some(p => lower.includes(p.toLowerCase()));
    this.shouldKeepOpenAfterCall = this.keepOpenAfterCallOnPaths.length > 0 &&
      this.keepOpenAfterCallOnPaths.some(p => lower.includes(p.toLowerCase()));
    this.panelExtension?.onRouteChange?.(url);
  }

  /** Lets the host push URL changes (from its router) into the panel. */
  onUrlChange(url: string): void { this.applyUrl(url); }

  private subscribeToCallState(): void {
    const cs = this.client.callState;

    this.subscriptions.push(cs.getRegisterStatus().subscribe(status => this.zone.run(() => {
      this.registerStatus = status;
      this.isRegistered = status === 'registered';
      this.isConnecting = status === 'registering';
    })));

    this.subscriptions.push(cs.getActiveCall().subscribe(call => this.zone.run(() => {
      const wasActive = this.hasActiveCall;
      this.hasActiveCall = call !== null;
      if (call) {
        const rawNumber = call.direction === 'outgoing' ? call.callee.number : call.caller.number;
        const rawName = call.direction === 'outgoing' ? call.callee.displayName : call.caller.displayName;
        const lookupName = this.lookupCompleted ? (this.currentCallerName || rawName || rawNumber) : (rawName || rawNumber);
        this.activeCallData = {
          name: lookupName,
          number: rawNumber,
          avatar: this.avatarUrl(lookupName, this.lookupCompleted && this.callerMatch !== null)
        };
        this.callDuration = cs.formatDuration(call.duration);
        this.isMuted = call.isMuted;
        this.isOnHold = call.isOnHold;
        this.isCallPanelOpen = true;

        if (call.direction === 'outgoing' && call.callee?.number && !this.lookupCompleted) {
          this.currentCallerNumber = call.callee.number;
          void this.performExtendedLookup(call.callee.number);
        }
      } else if (wasActive) {
        this.lookupCompleted = false;
        if (!this.shouldKeepOpenAfterCall) this.isCallPanelOpen = false;
      }
    })));

    this.subscriptions.push(cs.getIncomingCall().subscribe(call => this.zone.run(() => {
      this.hasIncomingCall = call !== null;
      this.incomingCallData = call;
      if (call) {
        this.isCallPanelOpen = true;
        this.currentCallerNumber = call.caller.number;
        this.currentCallerName = call.caller.displayName || '';
        void this.performExtendedLookup(call.caller.number);
      } else if (!this.hasActiveCall) {
        this.callerMatch = null;
        this.resetAllMatches();
      }
    })));

    this.subscriptions.push(cs.getMuteStatus().subscribe(muted => this.zone.run(() => { this.isMuted = muted; })));
    this.subscriptions.push(cs.getHoldStatus().subscribe(status => this.zone.run(() => {
      this.isOnHold = status === 'held' || status === 'holding';
    })));
  }

  private fetchSipCredentialsAndConnect(): void {
    const sub = this.client.client.providers.agentIdentity.getCurrentAgent().subscribe(async (agent) => {
      if (!agent) return;
      if (this.credentialsLoaded) return;

      this.currentAgent = agent;
      const connectConfig = await this.client.client.providers.callCredentials.getConnectConfig(agent);
      if (!connectConfig) return;

      this.credentialsLoaded = true;
      this.fetchDidList();

      try {
        await this.client.adapter.connect(connectConfig);
      } catch (e) {
        console.error('[Call] Adapter connection failed:', e);
      }
    });
    this.subscriptions.push(sub);
  }

  fetchDidList(): void {
    if (!this.currentAgent) return;
    this.didLoading = true;
    const agent = this.currentAgent;
    const sub = this.client.client.providers.agentPreferences.getOutboundCallerIds(agent).subscribe({
      next: (list) => this.zone.run(() => {
        this.didList = list;
        this.didLoading = false;
        if (this.didList.length > 0 && !this.selectedDid) {
          const saved = this.client.client.providers.agentPreferences.getActiveCallerId(agent);
          const match = saved ? this.didList.find(d => d.number === saved) : null;
          const toSelect = match || this.didList[0];
          if (toSelect) this.selectDid(toSelect);
        }
      }),
      error: (err) => this.zone.run(() => {
        console.error('[Call] Error fetching outbound caller IDs:', err);
        this.didLoading = false;
      })
    });
    this.subscriptions.push(sub);
  }

  selectDid(did: OutboundCallerId): void {
    if (!did?.number || !this.currentAgent) return;
    this.selectedDid = did.number;
    this.didDropdownOpen = false;
    this.didSettingLoading = true;
    this.client.client.providers.agentPreferences.setActiveCallerId(this.currentAgent, did)
      .catch(err => console.error('[Call] setActiveCallerId error:', err))
      .finally(() => this.zone.run(() => { this.didSettingLoading = false; }));
  }

  toggleCallPanel(): void { this.isCallPanelOpen = !this.isCallPanelOpen; }
  toggleDidDropdown(): void { this.didDropdownOpen = !this.didDropdownOpen; }

  dialKey(key: DialpadKey): void {
    if (this.hasActiveCall) this.client.adapter.sendDTMF(key.number);
    else this.phoneNumber += key.number;
  }
  backspace(): void { this.phoneNumber = this.phoneNumber.slice(0, -1); }

  async makeCall(): Promise<void> {
    if (!this.phoneNumber) return;
    if (!this.selectedDid) {
      this.showDidToast = true;
      setTimeout(() => this.showDidToast = false, 3000);
      return;
    }
    if (!this.isRegistered) { alert('Not connected to phone system.'); return; }
    const numberToDial = this.phoneNumber;
    this.phoneNumber = '';
    try { await this.client.adapter.makeCall(numberToDial); }
    catch (e) { alert('Failed to make call: ' + (e as Error).message); }
  }
  endCall(): void { this.client.adapter.hangup(); }
  toggleMute(): void { this.client.adapter.toggleMute(); }
  toggleHold(): void { this.client.adapter.toggleHold(); }
  answerCall(): void { this.client.adapter.answerCall().catch(e => alert('Failed to answer: ' + e.message)); }
  declineCall(): void { this.client.adapter.declineCall(); }

  transferCall(): void { this.showTransferDialog = true; }
  confirmTransfer(): void {
    if (!this.transferTarget) return;
    this.client.adapter.transfer(this.transferTarget);
    this.showTransferDialog = false;
    this.transferTarget = '';
  }
  cancelTransfer(): void { this.showTransferDialog = false; this.transferTarget = ''; }

  getIncomingCallerName(): string {
    if (this.callerMatch?.record?.fullName) return this.callerMatch.record.fullName;
    if (this.incomingCallData?.caller?.displayName) return this.incomingCallData.caller.displayName;
    return 'Unknown Caller';
  }
  getCallerTypeLabel(): string {
    if (this.callerMatch) return this.callerMatch.type === 'Contacts' ? 'Contact' : 'Lead';
    return 'Unknown';
  }
  isCallerKnown(): boolean { return this.callerMatch !== null; }

  async performExtendedLookup(phoneNumber: string): Promise<void> {
    const variants = this.client.cti.normalizePhone(phoneNumber);
    const matches = await this.client.cti.findAllMatches(variants);
    this.zone.run(() => {
      this.allMatches = matches;
      let foundName = '';
      if (matches.contact) { this.callerMatch = matches.contact; foundName = matches.contact.record.fullName; }
      else if (matches.lead) { this.callerMatch = matches.lead; foundName = matches.lead.record.fullName; }
      else if (matches.account) { this.callerMatch = matches.account; foundName = matches.account.record.fullName; }
      this.currentCallerName = foundName || 'Unknown';
      this.lookupCompleted = true;
      if (this.activeCallData) {
        this.activeCallData.name = this.currentCallerName;
        this.activeCallData.avatar = this.avatarUrl(this.currentCallerName, !!foundName);
      }
    });
  }

  private resetAllMatches(): void {
    this.allMatches = null;
    this.currentCallerNumber = '';
    this.currentCallerName = '';
    this.lookupCompleted = false;
    this.linkExistingOpen = false;
    this.associateWithOpen = false;
  }

  get existingLeadId(): string | null        { return this.allMatches?.lead?.record.id || null; }
  get existingContactId(): string | null     { return this.allMatches?.contact?.record.id || null; }
  get existingAccountId(): string | null     { return this.allMatches?.account?.record.id || null; }
  get existingCaseId(): string | null        { return this.allMatches?.case?.id || null; }
  get existingOpportunityId(): string | null { return this.allMatches?.opportunity?.id || null; }

  hasExistingLinks(): boolean {
    return !!(this.existingLeadId || this.existingContactId || this.existingAccountId ||
              this.existingCaseId || this.existingOpportunityId);
  }
  hasUnlinkedModules(): boolean {
    return !this.existingLeadId || !this.existingContactId || !this.existingAccountId ||
           !this.existingCaseId || !this.existingOpportunityId;
  }

  toggleLinkExisting(): void { this.linkExistingOpen = !this.linkExistingOpen; if (this.linkExistingOpen) this.associateWithOpen = false; }
  toggleAssociateWith(): void { this.associateWithOpen = !this.associateWithOpen; if (this.associateWithOpen) this.linkExistingOpen = false; }

  navigateToRecord(module: string, recordId: string): void {
    this.linkExistingOpen = false;
    this.client.client.providers.crmIntegration.openRecordById(module, recordId);
  }

  navigateToCreateRecord(module: string): void {
    this.associateWithOpen = false;
    const context: CreateRecordContext = {
      phoneNumber: this.currentCallerNumber || undefined,
      callerName: this.currentCallerName || undefined,
      linkedRecords: {
        contact: this.existingContactId || undefined,
        account: this.existingAccountId || undefined,
        lead: this.existingLeadId || undefined
      }
    };
    this.client.client.providers.crmIntegration.openCreateRecord(module, context);
  }

  checkNotificationPermission(): void {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.showNotificationBanner = Notification.permission === 'default';
    }
  }

  async requestNotificationPermission(): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      this.showNotificationBanner = permission === 'default';
    } catch (e) {
      console.error('[Call] Error requesting notification permission:', e);
    }
  }
  dismissNotificationBanner(): void { this.showNotificationBanner = false; }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.didDropdownOpen && !target.closest('.cc-did-dropdown-wrap')) {
      this.didDropdownOpen = false;
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardInput(event: KeyboardEvent): void {
    if (!this.isCallPanelOpen) return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' && target.id !== 'cc-phone-input') return;
    const key = event.key;
    if (/^[0-9*#+]$/.test(key)) {
      if (this.hasActiveCall) this.client.adapter.sendDTMF(key);
      else this.phoneNumber += key;
      event.preventDefault();
    } else if (key === 'Backspace' && !this.hasActiveCall) {
      this.backspace();
      event.preventDefault();
    } else if (key === 'Enter' && this.phoneNumber && !this.hasActiveCall && this.selectedDid) {
      void this.makeCall();
      event.preventDefault();
    }
  }

  private avatarUrl(name: string, known: boolean): string {
    const seed = (name || '?').slice(0, 2);
    const bg = known ? '00A651' : '6c757d';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(seed)}&background=${bg}&color=fff`;
  }
}
