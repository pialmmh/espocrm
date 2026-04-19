/**
 * WebRTC Call State Service — framework-agnostic.
 *
 * RxJS-based reactive state for call status. Consumers (UI wrappers,
 * adapters, CTI orchestrator) subscribe to observables; writers mutate
 * via setter methods.
 */

import { BehaviorSubject, Observable, Subject } from 'rxjs';

export type CallDirection = 'incoming' | 'outgoing';

export type CallStatus =
  | 'idle'
  | 'registering'
  | 'registered'
  | 'dialing'
  | 'ringing'
  | 'incomingcall'
  | 'answering'
  | 'connected'
  | 'on_hold'
  | 'transferring'
  | 'ending'
  | 'ended'
  | 'failed';

export type RegisterStatus = 'idle' | 'registering' | 'registered' | 'failed' | 'unregistered';

export type HoldStatus = 'active' | 'holding' | 'held' | 'resuming';

export type TransferStatus = 'idle' | 'transferring' | 'transferred' | 'failed';

export interface CallParticipant {
  displayName: string;
  number: string;
  uri?: string;
}

export interface ActiveCall {
  id: string;
  direction: CallDirection;
  status: CallStatus;
  caller: CallParticipant;
  callee: CallParticipant;
  startTime?: Date;
  connectedTime?: Date;
  endTime?: Date;
  duration: number;
  isMuted: boolean;
  isOnHold: boolean;
  isLocalHold: boolean;
  isRemoteHold: boolean;
  dtmfBuffer: string;
  sipCallId?: string;
}

export interface CallHistoryEntry {
  id: string;
  direction: CallDirection;
  participant: CallParticipant;
  startTime: Date;
  endTime?: Date;
  duration: number;
  status: 'completed' | 'missed' | 'failed' | 'rejected';
}

export interface WebRTCConnectionState {
  websocketConnected: boolean;
  sipRegistered: boolean;
  registrationError?: string;
}

export interface CallStateServiceOptions {
  /** localStorage key for call history persistence. Pass null to disable. */
  historyStorageKey?: string | null;
  /** Max history entries to keep */
  historyLimit?: number;
}

export class CallStateService {
  private connectionState$ = new BehaviorSubject<WebRTCConnectionState>({
    websocketConnected: false,
    sipRegistered: false
  });
  private registerStatus$ = new BehaviorSubject<RegisterStatus>('idle');
  private activeCall$ = new BehaviorSubject<ActiveCall | null>(null);
  private incomingCall$ = new BehaviorSubject<ActiveCall | null>(null);
  private callHistory$ = new BehaviorSubject<CallHistoryEntry[]>([]);
  private holdStatus$ = new BehaviorSubject<HoldStatus>('active');
  private transferStatus$ = new BehaviorSubject<TransferStatus>('idle');
  private transferTarget$ = new BehaviorSubject<string | null>(null);
  private isMuted$ = new BehaviorSubject<boolean>(false);
  private wrapUpTrigger$ = new Subject<any>();
  private wrapUpCompleted$ = new Subject<void>();
  private callEvents$ = new Subject<{ type: string; data?: any }>();

  private callTimerInterval: any = null;
  private readonly historyKey: string | null;
  private readonly historyLimit: number;

  constructor(options: CallStateServiceOptions = {}) {
    this.historyKey = options.historyStorageKey === undefined
      ? 'webrtc_call_history'
      : options.historyStorageKey;
    this.historyLimit = options.historyLimit ?? 100;
    console.log('[CallState] Service initialized');
    this.loadCallHistory();
  }

  // ==================== PUBLIC OBSERVABLES ====================

  getConnectionState(): Observable<WebRTCConnectionState> { return this.connectionState$.asObservable(); }
  getRegisterStatus(): Observable<RegisterStatus>         { return this.registerStatus$.asObservable(); }
  getActiveCall(): Observable<ActiveCall | null>          { return this.activeCall$.asObservable(); }
  getIncomingCall(): Observable<ActiveCall | null>        { return this.incomingCall$.asObservable(); }
  getCallHistory(): Observable<CallHistoryEntry[]>        { return this.callHistory$.asObservable(); }
  getHoldStatus(): Observable<HoldStatus>                 { return this.holdStatus$.asObservable(); }
  getTransferStatus(): Observable<TransferStatus>         { return this.transferStatus$.asObservable(); }
  getMuteStatus(): Observable<boolean>                    { return this.isMuted$.asObservable(); }
  getCallEvents(): Observable<{ type: string; data?: any }> { return this.callEvents$.asObservable(); }
  getWrapUpTrigger(): Observable<any>                     { return this.wrapUpTrigger$.asObservable(); }
  getWrapUpCompleted(): Observable<void>                  { return this.wrapUpCompleted$.asObservable(); }

  // ==================== STATE GETTERS (Sync) ====================

  get isRegistered(): boolean                { return this.registerStatus$.value === 'registered'; }
  get hasActiveCall(): boolean               { return this.activeCall$.value !== null; }
  get hasIncomingCall(): boolean             { return this.incomingCall$.value !== null; }
  get currentCall(): ActiveCall | null       { return this.activeCall$.value; }
  get currentIncomingCall(): ActiveCall | null { return this.incomingCall$.value; }
  get isMuted(): boolean                     { return this.isMuted$.value; }
  get isOnHold(): boolean                    { return this.holdStatus$.value === 'held' || this.holdStatus$.value === 'holding'; }

  // ==================== CONNECTION STATE ====================

  updateConnectionState(state: Partial<WebRTCConnectionState>): void {
    const current = this.connectionState$.value;
    const updated = { ...current, ...state };
    this.connectionState$.next(updated);
    console.log('[CallState] Connection state:', updated);
  }

  setRegisterStatus(status: RegisterStatus, error?: string): void {
    this.registerStatus$.next(status);
    if (status === 'registered') {
      this.updateConnectionState({ sipRegistered: true, registrationError: undefined });
    } else if (status === 'failed') {
      this.updateConnectionState({ sipRegistered: false, registrationError: error });
    } else if (status === 'unregistered') {
      this.updateConnectionState({ sipRegistered: false });
    }
    console.log('[CallState] Register status:', status, error || '');
  }

  // ==================== INCOMING CALL ====================

  setIncomingCall(call: ActiveCall): void {
    console.log('[CallState] Incoming call:', call.caller.number);
    this.incomingCall$.next(call);
    this.callEvents$.next({ type: 'incoming_call', data: call });
  }

  clearIncomingCall(): void {
    console.log('[CallState] Clearing incoming call');
    this.incomingCall$.next(null);
  }

  // ==================== ACTIVE CALL ====================

  setActiveCall(call: ActiveCall): void {
    console.log('[CallState] Active call set:', call.direction, call.status);
    this.activeCall$.next(call);
    this.clearIncomingCall();
    if (call.status === 'connected') {
      this.startCallTimer();
    }
  }

  updateActiveCall(updates: Partial<ActiveCall>): void {
    const current = this.activeCall$.value;
    if (current) {
      const updated = { ...current, ...updates };
      this.activeCall$.next(updated);
      console.log('[CallState] Active call updated:', updates);
      if (updates.status === 'connected' && !current.connectedTime) {
        this.startCallTimer();
      }
    }
  }

  clearActiveCall(reason?: string): void {
    console.log('[CallState] Clearing active call:', reason || 'normal');
    this.stopCallTimer();
    const call = this.activeCall$.value;
    if (call) {
      this.addToHistory(call, reason);
    }
    this.activeCall$.next(null);
    this.resetCallState();
    this.callEvents$.next({ type: 'call_ended', data: { reason, call } });
  }

  // ==================== MUTE ====================

  setMuted(muted: boolean): void {
    this.isMuted$.next(muted);
    if (this.activeCall$.value) {
      this.updateActiveCall({ isMuted: muted });
    }
    console.log('[CallState] Muted:', muted);
  }

  toggleMute(): boolean {
    const newState = !this.isMuted$.value;
    this.setMuted(newState);
    return newState;
  }

  // ==================== HOLD ====================

  setHoldStatus(status: HoldStatus): void {
    this.holdStatus$.next(status);
    if (this.activeCall$.value) {
      const isOnHold = status === 'held' || status === 'holding';
      this.updateActiveCall({
        isOnHold,
        isLocalHold: status === 'holding' || status === 'held'
      });
    }
    console.log('[CallState] Hold status:', status);
  }

  toggleHold(): HoldStatus {
    const current = this.holdStatus$.value;
    if (current === 'active') {
      this.setHoldStatus('holding');
      return 'holding';
    } else if (current === 'held') {
      this.setHoldStatus('resuming');
      return 'resuming';
    }
    return current;
  }

  // ==================== TRANSFER ====================

  setTransferStatus(status: TransferStatus, target?: string): void {
    this.transferStatus$.next(status);
    this.transferTarget$.next(target || null);
    console.log('[CallState] Transfer status:', status, target || '');
  }

  resetTransferState(): void {
    this.transferStatus$.next('idle');
    this.transferTarget$.next(null);
  }

  // ==================== CALL TIMER ====================

  private startCallTimer(): void {
    if (this.callTimerInterval) return;
    const call = this.activeCall$.value;
    if (call && !call.connectedTime) {
      this.updateActiveCall({ connectedTime: new Date() });
    }
    this.callTimerInterval = setInterval(() => {
      const currentCall = this.activeCall$.value;
      if (currentCall && currentCall.connectedTime) {
        const duration = Math.floor((Date.now() - currentCall.connectedTime.getTime()) / 1000);
        if (currentCall.duration !== duration) {
          currentCall.duration = duration;
          this.activeCall$.next({ ...currentCall });
        }
      }
    }, 1000);
    console.log('[CallState] Call timer started');
  }

  private stopCallTimer(): void {
    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
      this.callTimerInterval = null;
      console.log('[CallState] Call timer stopped');
    }
  }

  // ==================== CALL HISTORY ====================

  private addToHistory(call: ActiveCall, reason?: string): void {
    let status: CallHistoryEntry['status'] = 'completed';
    if (call.direction === 'incoming') {
      if (call.status === 'incomingcall' || call.status === 'ringing') {
        status = reason === 'rejected' ? 'rejected' : 'missed';
      } else if (call.duration === 0) {
        status = 'missed';
      }
    } else {
      if (call.status === 'failed' || call.duration === 0) {
        status = 'failed';
      }
    }
    const entry: CallHistoryEntry = {
      id: call.id,
      direction: call.direction,
      participant: call.direction === 'outgoing' ? call.callee : call.caller,
      startTime: call.startTime || new Date(),
      endTime: new Date(),
      duration: call.duration,
      status
    };
    const history = [entry, ...this.callHistory$.value].slice(0, this.historyLimit);
    this.callHistory$.next(history);
    this.saveCallHistory();
    console.log('[CallState] Added to history:', entry.participant.number, entry.status);
  }

  private loadCallHistory(): void {
    if (!this.historyKey || typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(this.historyKey);
      if (saved) {
        const history = JSON.parse(saved);
        history.forEach((entry: any) => {
          entry.startTime = new Date(entry.startTime);
          if (entry.endTime) entry.endTime = new Date(entry.endTime);
        });
        this.callHistory$.next(history);
        console.log('[CallState] Loaded call history:', history.length, 'entries');
      }
    } catch (e) {
      console.error('[CallState] Failed to load call history:', e);
    }
  }

  private saveCallHistory(): void {
    if (!this.historyKey || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.historyKey, JSON.stringify(this.callHistory$.value));
    } catch (e) {
      console.error('[CallState] Failed to save call history:', e);
    }
  }

  clearCallHistory(): void {
    this.callHistory$.next([]);
    if (this.historyKey && typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.historyKey);
    }
    console.log('[CallState] Call history cleared');
  }

  // ==================== RESET ====================

  private resetCallState(): void {
    this.holdStatus$.next('active');
    this.transferStatus$.next('idle');
    this.transferTarget$.next(null);
    this.isMuted$.next(false);
  }

  reset(): void {
    console.log('[CallState] Full reset');
    this.stopCallTimer();
    this.activeCall$.next(null);
    this.incomingCall$.next(null);
    this.resetCallState();
    this.connectionState$.next({ websocketConnected: false, sipRegistered: false });
    this.registerStatus$.next('idle');
  }

  // ==================== UTILITY ====================

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== WRAP-UP MODAL ====================

  triggerWrapUp(callData: any): void {
    console.log('[CallState] Triggering wrap-up:', callData);
    this.wrapUpTrigger$.next(callData);
  }

  triggerWrapUpComplete(): void {
    console.log('[CallState] Wrap-up completed');
    this.wrapUpCompleted$.next();
  }
}
