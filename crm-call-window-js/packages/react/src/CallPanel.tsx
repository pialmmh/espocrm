/**
 * <CallPanel /> — React port of the floating call-panel UI.
 *
 * Preserves feature parity with the Angular version: floating toggle button,
 * incoming-call modal, transfer dialog, dialpad, active-call controls, DID
 * selector, CRM Link/Associate dropdowns, and the 5 preset themes.
 *
 * Routing is bring-your-own: pass `currentUrl` from useLocation() (or similar).
 * If omitted, window.location.href is used and not tracked on navigation.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentProfile, OutboundCallerId, ActiveCall as CoreActiveCall } from '@telcobright/crm-call-core';
import { useCallClient } from './context';
import {
  useActiveCall,
  useHoldStatus,
  useIncomingCall,
  useMuteStatus,
  useObservable,
  useRegisterStatus
} from './hooks';
import './CallPanel.css';

export type CallPanelTheme = 'green' | 'blue' | 'gray' | 'red' | 'dark';

export interface CallPanelProps {
  theme?: CallPanelTheme;
  /**
   * URL substrings on which the floating toggle button is shown.
   * Empty = always shown.
   */
  showToggleOnPaths?: string[];
  /**
   * URL substrings where the panel should stay open after a call ends.
   * Empty = panel closes after every call.
   */
  keepOpenAfterCallOnPaths?: string[];
  /**
   * Current URL. Host passes from its router (e.g. useLocation().pathname).
   * If omitted, falls back to window.location.href at mount.
   */
  currentUrl?: string;
}

interface CallerMatchRecord {
  id: string;
  fullName: string;
  accountName?: string;
  phoneWork?: string;
  phoneMobile?: string;
  phoneOffice?: string;
}
interface CallerMatch {
  type: 'Contacts' | 'Leads' | 'Accounts';
  module: string;
  record: CallerMatchRecord;
}
interface AllCallerMatches {
  lead: CallerMatch | null;
  contact: CallerMatch | null;
  account: CallerMatch | null;
  case: { id: string; name: string } | null;
  opportunity: { id: string; name: string } | null;
}

const DIALPAD: Array<{ number: string; letters: string }> = [
  { number: '1', letters: '' },
  { number: '2', letters: 'ABC' },
  { number: '3', letters: 'DEF' },
  { number: '4', letters: 'GHI' },
  { number: '5', letters: 'JKL' },
  { number: '6', letters: 'MNO' },
  { number: '7', letters: 'PQRS' },
  { number: '8', letters: 'TUV' },
  { number: '9', letters: 'WXYZ' },
  { number: '*', letters: '' },
  { number: '0', letters: '+' },
  { number: '#', letters: '' }
];

function avatarUrl(name: string, known: boolean) {
  const seed = (name || '?').slice(0, 2);
  const bg = known ? '00A651' : '6c757d';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(seed)}&background=${bg}&color=fff`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function CallPanel(props: CallPanelProps) {
  const { theme = 'green', showToggleOnPaths = [], keepOpenAfterCallOnPaths = [] } = props;
  const client = useCallClient();
  const { adapter, callState, cti, providers } = client;

  // Reactive state
  const activeCall = useActiveCall();
  const incomingCall = useIncomingCall();
  const registerStatus = useRegisterStatus();
  const isMuted = useMuteStatus();
  const holdStatus = useHoldStatus();
  const isOnHold = holdStatus === 'held' || holdStatus === 'holding';

  const isRegistered = registerStatus === 'registered';
  const isConnecting = registerStatus === 'registering';
  const hasActiveCall = activeCall !== null;
  const hasIncomingCall = incomingCall !== null;

  // Local UI state
  const [isCallPanelOpen, setIsCallPanelOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [showDidToast, setShowDidToast] = useState(false);

  // DID state
  const [didList, setDidList] = useState<OutboundCallerId[]>([]);
  const [selectedDid, setSelectedDid] = useState<string>('');
  const [didDropdownOpen, setDidDropdownOpen] = useState(false);
  const [didLoading, setDidLoading] = useState(false);
  const [didSettingLoading, setDidSettingLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentProfile | null>(null);

  // CTI lookup state
  const [allMatches, setAllMatches] = useState<AllCallerMatches | null>(null);
  const [callerMatch, setCallerMatch] = useState<CallerMatch | null>(null);
  const [lookupCompleted, setLookupCompleted] = useState(false);
  const [linkExistingOpen, setLinkExistingOpen] = useState(false);
  const [associateWithOpen, setAssociateWithOpen] = useState(false);
  const [currentCallerNumber, setCurrentCallerNumber] = useState('');
  const [currentCallerName, setCurrentCallerName] = useState('');

  // Notification banner
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);

  // Track wasActive to detect call-ended transitions
  const wasActiveRef = useRef(hasActiveCall);

  // URL-based flags
  const [currentUrl, setCurrentUrl] = useState(
    props.currentUrl ?? (typeof window !== 'undefined' ? window.location.href : '')
  );
  useEffect(() => {
    if (props.currentUrl !== undefined) setCurrentUrl(props.currentUrl);
  }, [props.currentUrl]);

  const shouldShowToggle = useMemo(() => {
    if (showToggleOnPaths.length === 0) return true;
    const lower = currentUrl.toLowerCase();
    return showToggleOnPaths.some(p => lower.includes(p.toLowerCase()));
  }, [currentUrl, showToggleOnPaths]);

  const shouldKeepOpenAfterCall = useMemo(() => {
    if (keepOpenAfterCallOnPaths.length === 0) return false;
    const lower = currentUrl.toLowerCase();
    return keepOpenAfterCallOnPaths.some(p => lower.includes(p.toLowerCase()));
  }, [currentUrl, keepOpenAfterCallOnPaths]);

  // Forward URL changes to the optional panel extension
  useEffect(() => {
    providers.panelExtension?.onRouteChange?.(currentUrl);
  }, [currentUrl, providers.panelExtension]);

  useEffect(() => {
    return () => providers.panelExtension?.onDestroy?.();
  }, [providers.panelExtension]);

  // Resolve agent + connect adapter + fetch DIDs
  const credentialsLoadedRef = useRef(false);
  useEffect(() => {
    const sub = providers.agentIdentity.getCurrentAgent().subscribe(async (agent: AgentProfile | null) => {
      if (!agent) return;
      if (credentialsLoadedRef.current) return;

      setCurrentAgent(agent);
      const connectConfig = await providers.callCredentials.getConnectConfig(agent);
      if (!connectConfig) return;

      credentialsLoadedRef.current = true;

      // Fetch DIDs
      setDidLoading(true);
      const didSub = providers.agentPreferences.getOutboundCallerIds(agent).subscribe({
        next: (list) => {
          setDidList(list);
          setDidLoading(false);
          if (list.length > 0) {
            const saved = providers.agentPreferences.getActiveCallerId(agent);
            const match = saved ? list.find(d => d.number === saved) : null;
            const toSelect = match || list[0];
            if (toSelect) doSelectDid(agent, toSelect);
          }
        },
        error: (err) => {
          console.error('[Call] Error fetching outbound caller IDs:', err);
          setDidLoading(false);
        }
      });

      try {
        await adapter.connect(connectConfig);
      } catch (e) {
        console.error('[Call] Adapter connection failed:', e);
      }

      // Cleanup DID subscription with the outer effect
      return () => didSub.unsubscribe();
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, providers]);

  // CTI request notification permission on mount + check banner
  useEffect(() => {
    cti.requestNotificationPermission();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setShowNotificationBanner(Notification.permission === 'default');
    }
  }, [cti]);

  // When an active or incoming call starts, trigger CRM lookup + open panel
  const lookupRanForRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeCall && activeCall.direction === 'outgoing' && activeCall.callee?.number && !lookupCompleted) {
      if (lookupRanForRef.current !== activeCall.id) {
        lookupRanForRef.current = activeCall.id;
        setCurrentCallerNumber(activeCall.callee.number);
        setIsCallPanelOpen(true);
        void runLookup(activeCall.callee.number);
      }
    }
  }, [activeCall, lookupCompleted]);

  useEffect(() => {
    if (incomingCall) {
      setCurrentCallerNumber(incomingCall.caller.number);
      setCurrentCallerName(incomingCall.caller.displayName || '');
      setIsCallPanelOpen(true);
      void runLookup(incomingCall.caller.number);
    } else if (!hasActiveCall) {
      // Fully ended — reset matches
      setCallerMatch(null);
      resetAllMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingCall?.id]);

  // Call-ended: close panel unless keepOpenAfterCall
  useEffect(() => {
    if (wasActiveRef.current && !hasActiveCall) {
      setLookupCompleted(false);
      lookupRanForRef.current = null;
      if (!shouldKeepOpenAfterCall) setIsCallPanelOpen(false);
    }
    wasActiveRef.current = hasActiveCall;
  }, [hasActiveCall, shouldKeepOpenAfterCall]);

  async function runLookup(phone: string) {
    const variants = cti.normalizePhone(phone);
    const matches = await cti.findAllMatches(variants) as AllCallerMatches;
    setAllMatches(matches);
    let found: CallerMatch | null = null;
    let foundName = '';
    if (matches.contact) { found = matches.contact; foundName = matches.contact.record.fullName; }
    else if (matches.lead) { found = matches.lead; foundName = matches.lead.record.fullName; }
    else if (matches.account) { found = matches.account; foundName = matches.account.record.fullName; }
    setCallerMatch(found);
    setCurrentCallerName(foundName || 'Unknown');
    setLookupCompleted(true);
  }

  function resetAllMatches() {
    setAllMatches(null);
    setCurrentCallerNumber('');
    setCurrentCallerName('');
    setLookupCompleted(false);
    setLinkExistingOpen(false);
    setAssociateWithOpen(false);
  }

  function doSelectDid(agent: AgentProfile, did: OutboundCallerId) {
    if (!did?.number) return;
    setSelectedDid(did.number);
    setDidDropdownOpen(false);
    setDidSettingLoading(true);
    providers.agentPreferences.setActiveCallerId(agent, did)
      .catch(err => console.error('[Call] setActiveCallerId error:', err))
      .finally(() => setDidSettingLoading(false));
  }

  // Close DID dropdown on outside click
  useEffect(() => {
    if (!didDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.cc-did-dropdown-wrap')) setDidDropdownOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [didDropdownOpen]);

  // Keyboard dialpad
  useEffect(() => {
    if (!isCallPanelOpen) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' && target.id !== 'cc-phone-input') return;
      const key = event.key;
      if (/^[0-9*#+]$/.test(key)) {
        handleKeyPress(key);
        event.preventDefault();
      } else if (key === 'Backspace' && !hasActiveCall) {
        setPhoneNumber(v => v.slice(0, -1));
        event.preventDefault();
      } else if (key === 'Enter' && phoneNumber && !hasActiveCall && selectedDid) {
        void makeCall();
        event.preventDefault();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCallPanelOpen, hasActiveCall, phoneNumber, selectedDid]);

  function handleKeyPress(key: string) {
    if (hasActiveCall) adapter.sendDTMF(key);
    else setPhoneNumber(v => v + key);
  }

  async function makeCall() {
    if (!phoneNumber) return;
    if (!selectedDid) {
      setShowDidToast(true);
      setTimeout(() => setShowDidToast(false), 3000);
      return;
    }
    if (!isRegistered) {
      alert('Not connected to phone system. Please wait for registration.');
      return;
    }
    const numberToDial = phoneNumber;
    setPhoneNumber('');
    try {
      await adapter.makeCall(numberToDial);
    } catch (e) {
      alert('Failed to make call: ' + (e as Error).message);
    }
  }

  function onDial(key: { number: string }) {
    if (hasActiveCall) adapter.sendDTMF(key.number);
    else setPhoneNumber(v => v + key.number);
  }

  function confirmTransfer() {
    if (!transferTarget) return;
    adapter.transfer(transferTarget);
    setShowTransferDialog(false);
    setTransferTarget('');
  }

  async function requestNotifPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setShowNotificationBanner(permission === 'default');
      if (permission === 'granted') {
        new Notification('Notifications Enabled', {
          body: 'You will now receive incoming call notifications',
          icon: '/favicon.ico'
        });
      }
    } catch (e) {
      console.error('[Call] Error requesting notification permission:', e);
    }
  }

  // Caller display helpers
  const isCallerKnown = callerMatch !== null;
  const getIncomingCallerName = (): string => {
    if (callerMatch?.record?.fullName) return callerMatch.record.fullName;
    if (incomingCall?.caller?.displayName) return incomingCall.caller.displayName;
    return 'Unknown Caller';
  };
  const getCallerTypeLabel = (): string => {
    if (callerMatch) return callerMatch.type === 'Contacts' ? 'Contact' : 'Lead';
    return 'Unknown';
  };

  // Derived active call display
  const activeDisplay = useMemo(() => {
    if (!activeCall) return { name: '', number: '', avatar: '' };
    const rawNumber = activeCall.direction === 'outgoing' ? activeCall.callee.number : activeCall.caller.number;
    const rawName = activeCall.direction === 'outgoing' ? activeCall.callee.displayName : activeCall.caller.displayName;
    const lookupName = lookupCompleted ? (currentCallerName || rawName || rawNumber) : (rawName || rawNumber);
    return {
      name: lookupName,
      number: rawNumber,
      avatar: avatarUrl(lookupName, lookupCompleted && callerMatch !== null)
    };
  }, [activeCall, lookupCompleted, currentCallerName, callerMatch]);

  const callDuration = activeCall ? formatDuration(activeCall.duration) : '00:00';

  // CRM link helpers
  const existingLeadId = allMatches?.lead?.record.id || null;
  const existingContactId = allMatches?.contact?.record.id || null;
  const existingAccountId = allMatches?.account?.record.id || null;
  const existingCaseId = allMatches?.case?.id || null;
  const existingOpportunityId = allMatches?.opportunity?.id || null;

  const hasExistingLinks = !!(existingLeadId || existingContactId || existingAccountId || existingCaseId || existingOpportunityId);
  const hasUnlinkedModules = !existingLeadId || !existingContactId || !existingAccountId || !existingCaseId || !existingOpportunityId;

  function navigateToRecord(module: string, id: string) {
    setLinkExistingOpen(false);
    providers.crmIntegration.openRecordById(module, id);
  }
  function navigateToCreateRecord(module: string) {
    setAssociateWithOpen(false);
    providers.crmIntegration.openCreateRecord(module, {
      phoneNumber: currentCallerNumber || undefined,
      callerName: currentCallerName || undefined,
      linkedRecords: {
        contact: existingContactId || undefined,
        account: existingAccountId || undefined,
        lead: existingLeadId || undefined
      }
    });
  }

  return (
    <div className={`cc-root cc-theme-${theme}`}>
      {showNotificationBanner && (
        <div className="cc-notification-banner">
          <div className="cc-notification-banner-content">
            <span>Enable notifications to receive incoming call alerts</span>
          </div>
          <div className="cc-notification-banner-actions">
            <button className="cc-enable-btn" onClick={requestNotifPermission}>Enable</button>
            <button className="cc-dismiss-btn" onClick={() => setShowNotificationBanner(false)}>✕</button>
          </div>
        </div>
      )}

      {hasIncomingCall && incomingCall && (
        <div className="cc-incoming-call-overlay">
          <div className="cc-incoming-call-modal">
            <div className="cc-incoming-call-header">
              <span className="cc-incoming-label">Incoming Call</span>
              <span className={`cc-caller-type-badge ${isCallerKnown ? 'known' : 'unknown'}`}>
                {getCallerTypeLabel()}
              </span>
            </div>
            <div className="cc-incoming-call-info">
              <div className="cc-incoming-avatar">
                <img src={avatarUrl(getIncomingCallerName(), isCallerKnown)} alt="Caller" />
                <div className="cc-pulse-ring" />
              </div>
              <div className="cc-incoming-caller-name">{getIncomingCallerName()}</div>
              <div className="cc-incoming-caller-number">{incomingCall.caller.number}</div>
              {callerMatch?.record.accountName && (
                <div className="cc-incoming-caller-account">{callerMatch.record.accountName}</div>
              )}
            </div>
            <div className="cc-incoming-call-actions">
              <button className="cc-decline-btn" onClick={() => adapter.declineCall()}>Decline</button>
              <button className="cc-answer-btn" onClick={() => adapter.answerCall().catch(e => alert('Failed to answer: ' + e.message))}>Answer</button>
            </div>
          </div>
        </div>
      )}

      {showTransferDialog && (
        <div className="cc-transfer-dialog-overlay" onClick={() => setShowTransferDialog(false)}>
          <div className="cc-transfer-dialog" onClick={e => e.stopPropagation()}>
            <h4>Transfer Call</h4>
            <input
              type="text"
              value={transferTarget}
              onChange={e => setTransferTarget(e.target.value)}
              placeholder="Enter number to transfer"
            />
            <div className="cc-transfer-dialog-actions">
              <button className="cc-cancel-btn" onClick={() => { setShowTransferDialog(false); setTransferTarget(''); }}>Cancel</button>
              <button className="cc-confirm-btn" onClick={confirmTransfer} disabled={!transferTarget}>Transfer</button>
            </div>
          </div>
        </div>
      )}

      {(shouldShowToggle || hasActiveCall || hasIncomingCall) && (
        <button
          className={`cc-call-toggle-btn ${hasActiveCall ? 'has-active-call' : ''} ${hasIncomingCall ? 'has-incoming' : ''}`}
          onClick={() => setIsCallPanelOpen(v => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          {hasActiveCall && <span className="cc-call-badge">1</span>}
          {hasIncomingCall && !hasActiveCall && <span className="cc-call-badge incoming-badge">!</span>}
          <span className={`cc-status-dot ${isRegistered ? 'registered' : ''} ${isConnecting ? 'connecting' : ''}`} />
        </button>
      )}

      {isCallPanelOpen && (
        <div className="cc-call-panel">
          <div className="cc-call-header">
            <h3>Call Center</h3>
            <div className={`cc-registration-status ${registerStatus}`}>
              <span className="cc-status-indicator" />
              <span className="cc-status-text">
                {registerStatus === 'registered' ? 'Online' : registerStatus === 'registering' ? 'Connecting...' : 'Offline'}
              </span>
            </div>
            <button className="cc-minimize-btn" onClick={() => setIsCallPanelOpen(false)}>—</button>
          </div>

          <div className="cc-did-selector">
            <div className="cc-did-dropdown-wrap">
              <button
                className="cc-did-dropdown-btn"
                onClick={() => setDidDropdownOpen(v => !v)}
                disabled={didSettingLoading}
              >
                <span>{selectedDid || 'Select DID'}</span>
                <span className={`cc-did-arrow ${didDropdownOpen ? 'did-arrow-up' : ''}`}>▾</span>
              </button>
              {didDropdownOpen && (
                <div className="cc-did-dropdown-list">
                  {didLoading && <div className="cc-did-dropdown-loading">Loading...</div>}
                  {!didLoading && didList.length === 0 && <div className="cc-did-dropdown-empty">No DIDs available</div>}
                  {didList.map(did => (
                    <button
                      key={did.id}
                      className={`cc-did-dropdown-item ${selectedDid === did.number ? 'active' : ''}`}
                      onClick={() => currentAgent && doSelectDid(currentAgent, did)}
                    >
                      {did.number}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {hasActiveCall && activeCall && (
            <div className="cc-active-call">
              <div className="cc-call-info">
                <div className="cc-caller-avatar">
                  <img src={activeDisplay.avatar} alt="Caller" />
                </div>
                <div className="cc-caller-details">
                  <span className="cc-caller-name">{activeDisplay.name}</span>
                  <span className="cc-caller-number">{activeDisplay.number}</span>
                  <span className="cc-call-duration">{callDuration}</span>
                </div>
              </div>
              <div className="cc-call-controls">
                <button className={`cc-control-btn ${isMuted ? 'active' : ''}`} onClick={() => adapter.toggleMute()} title="Mute">M</button>
                <button className={`cc-control-btn ${isOnHold ? 'active' : ''}`} onClick={() => adapter.toggleHold()} title="Hold">H</button>
                <button className="cc-control-btn" onClick={() => setShowTransferDialog(true)} title="Transfer">T</button>
              </div>

              <div className="cc-styled-dropdowns">
                {hasExistingLinks && (
                  <div className="cc-dropdown-wrapper">
                    <button
                      className={`cc-dropdown-btn ${linkExistingOpen ? 'active' : ''}`}
                      onClick={() => { setLinkExistingOpen(v => !v); setAssociateWithOpen(false); }}
                    >
                      Link Existing <span className={`cc-dropdown-arrow ${linkExistingOpen ? 'rotated' : ''}`}>▾</span>
                    </button>
                    {linkExistingOpen && (
                      <div className="cc-dropdown-panel">
                        {existingLeadId && <a onClick={() => navigateToRecord('leads', existingLeadId)}>Lead</a>}
                        {existingContactId && <a onClick={() => navigateToRecord('contacts', existingContactId)}>Contact</a>}
                        {existingAccountId && <a onClick={() => navigateToRecord('accounts', existingAccountId)}>Account</a>}
                        {existingCaseId && <a onClick={() => navigateToRecord('cases', existingCaseId)}>Case</a>}
                        {existingOpportunityId && <a onClick={() => navigateToRecord('opportunities', existingOpportunityId)}>Opportunity</a>}
                      </div>
                    )}
                  </div>
                )}
                {hasUnlinkedModules && (
                  <div className="cc-dropdown-wrapper">
                    <button
                      className={`cc-dropdown-btn ${associateWithOpen ? 'active' : ''}`}
                      onClick={() => { setAssociateWithOpen(v => !v); setLinkExistingOpen(false); }}
                    >
                      Associate With <span className={`cc-dropdown-arrow ${associateWithOpen ? 'rotated' : ''}`}>▾</span>
                    </button>
                    {associateWithOpen && (
                      <div className="cc-dropdown-panel">
                        {!existingLeadId && <a onClick={() => navigateToCreateRecord('leads')}>Lead</a>}
                        {!existingContactId && <a onClick={() => navigateToCreateRecord('contacts')}>Contact</a>}
                        {!existingAccountId && <a onClick={() => navigateToCreateRecord('accounts')}>Account</a>}
                        {!existingCaseId && <a onClick={() => navigateToCreateRecord('cases')}>Case</a>}
                        {!existingOpportunityId && <a onClick={() => navigateToCreateRecord('opportunities')}>Opportunity</a>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {showDidToast && <div className="cc-did-toast">Please select a DID first</div>}

          <div className="cc-tab-content">
            <div className="cc-phone-display">
              <input
                id="cc-phone-input"
                type="text"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="Enter number..."
              />
              {phoneNumber && (
                <button className="cc-backspace-btn" onClick={() => setPhoneNumber(v => v.slice(0, -1))}>←</button>
              )}
            </div>
            <div className="cc-dialpad">
              {DIALPAD.map(key => (
                <button key={key.number} onClick={() => onDial(key)} className="cc-dial-key">
                  <span className="cc-key-number">{key.number}</span>
                  <span className="cc-key-letters">{key.letters}</span>
                </button>
              ))}
            </div>
            <div className="cc-call-actions">
              {!hasActiveCall && (
                <button className="cc-make-call-btn" onClick={makeCall} disabled={!phoneNumber || !selectedDid}>
                  Call
                </button>
              )}
              {hasActiveCall && (
                <button className="cc-hangup-call-btn" onClick={() => adapter.hangup()}>Hangup</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
