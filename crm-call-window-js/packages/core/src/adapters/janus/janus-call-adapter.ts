/**
 * Janus Call Adapter — framework-agnostic.
 *
 * Implements CallAdapter using Janus WebSocket Gateway + SIP plugin.
 *
 * Server URL precedence at connect time:
 *   connectConfig.server (from CallCredentialsProvider) > this.config.server (static).
 *
 * Note: This adapter does not wrap async callbacks in any framework change-detection
 * zone. UI wrappers (React/Angular/Vue) are responsible for bridging observable emissions
 * into their own rendering pipeline — they already do this via their CallStateService subscriptions.
 */

import type {
  CallAdapter,
  CallAdapterConfig,
  CallAdapterConnectConfig
} from '../../interfaces/call-adapter';
import { CallAudioService } from '../../services/call-audio';
import {
  CallStateService,
  ActiveCall,
  CallParticipant
} from '../../services/call-state';

interface JanusMessage {
  janus: string;
  session_id?: number;
  handle_id?: number;
  transaction?: string;
  data?: any;
  plugindata?: { plugin: string; data: any };
  jsep?: RTCSessionDescriptionInit;
  [key: string]: any;
}

export class JanusCallAdapter implements CallAdapter {
  readonly adapterName = 'janus';

  private ws: WebSocket | null = null;
  private sessionId: number | null = null;
  private handleId: number | null = null;

  private sipUsername: string | null = null;
  private sipPassword: string | null = null;
  private sipDomain: string;
  private sipDisplayName: string | null = null;
  private sipProxy: string | null = null;
  private sipAuthUser: string | null = null;

  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  private transactions: Map<string, (response: JanusMessage) => void> = new Map();

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: any = null;

  private keepaliveTimer: any = null;

  private pendingJsep: RTCSessionDescriptionInit | null = null;

  private pendingRegistrationResolve: (() => void) | null = null;
  private pendingRegistrationReject: ((error: Error) => void) | null = null;

  private isConnecting = false;
  private isConnected = false;

  private runtimeServerUrl: string | null = null;

  constructor(
    private callState: CallStateService,
    private audio: CallAudioService,
    private config: CallAdapterConfig
  ) {
    this.sipDomain = config.sip?.domain || 'cosmocom.net';
    this.audio.init(config);

    if (typeof window !== 'undefined') {
      (window as any).__callAdapter = this;
      (window as any).__janusWebSocketService = this; // legacy alias
    }
    console.log('[JanusAdapter] Initialized');
  }

  // ==================== CONNECTION ====================

  async connect(connectConfig: CallAdapterConnectConfig): Promise<void> {
    if (this.isConnecting) {
      console.log('[JanusAdapter] Already connecting...');
      return;
    }
    if (this.isConnected && this.sipUsername === connectConfig.username) {
      console.log('[JanusAdapter] Already connected as:', connectConfig.username);
      return;
    }

    this.isConnecting = true;
    this.sipUsername = connectConfig.username;
    this.sipPassword = connectConfig.password;
    this.sipDomain = connectConfig.domain || this.config.sip?.domain || 'cosmocom.net';
    this.sipDisplayName = connectConfig.displayName || connectConfig.username;
    this.sipProxy = connectConfig.proxy || this.config.sip?.proxy || 'sip:hippbx.btcliptelephony.gov.bd';
    this.sipAuthUser = connectConfig.authUser || `${connectConfig.username}@${this.sipDomain}`;
    this.runtimeServerUrl = connectConfig.server || null;

    console.log('[JanusAdapter] Connecting for:', connectConfig.username, '@', this.sipDomain);
    this.callState.setRegisterStatus('registering');

    try {
      await this.connectWebSocket();
      await this.createSession();
      await this.attachSipPlugin();
      this.startKeepalive();
      await this.registerSip();

      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      console.log('[JanusAdapter] Connected and registered successfully');
    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;
      console.error('[JanusAdapter] Connection failed:', error);
      this.callState.setRegisterStatus('failed', String(error));
      this.scheduleReconnect();
      throw error;
    }
  }

  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.runtimeServerUrl || this.config.server;
      console.log('[JanusAdapter] Connecting to:', url);
      this.ws = new WebSocket(url, 'janus-protocol');

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, this.config.timeouts.registration);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        console.log('[JanusAdapter] WebSocket connected');
        this.callState.updateConnectionState({ websocketConnected: true });
        resolve();
      };

      this.ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = (event) => {
        console.log('[JanusAdapter] WebSocket closed:', event.code, event.reason);
        this.handleDisconnect();
      };

      this.ws.onmessage = (event) => this.handleMessage(event);
    });
  }

  private createSession(): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.generateTransaction();
      this.transactions.set(transaction, (response) => {
        if (response.janus === 'success' && response.data?.id) {
          this.sessionId = response.data.id;
          console.log('[JanusAdapter] Session created:', this.sessionId);
          resolve();
        } else {
          reject(new Error('Failed to create session'));
        }
      });
      this.sendMessage({ janus: 'create', transaction });
      setTimeout(() => {
        this.transactions.delete(transaction);
        reject(new Error('Session creation timeout'));
      }, this.config.timeouts.registration);
    });
  }

  private attachSipPlugin(): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.generateTransaction();
      this.transactions.set(transaction, (response) => {
        if (response.janus === 'success' && response.data?.id) {
          this.handleId = response.data.id;
          console.log('[JanusAdapter] SIP plugin attached:', this.handleId);
          resolve();
        } else {
          reject(new Error('Failed to attach SIP plugin'));
        }
      });
      this.sendMessage({
        janus: 'attach',
        session_id: this.sessionId!,
        plugin: 'janus.plugin.sip',
        transaction
      });
      setTimeout(() => {
        this.transactions.delete(transaction);
        reject(new Error('Plugin attach timeout'));
      }, this.config.timeouts.registration);
    });
  }

  private registerSip(): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.generateTransaction();
      const sipUri = `sip:${this.sipUsername}@${this.sipDomain}`;
      const displayName = this.sipDisplayName || this.sipUsername || '';
      console.log('[JanusAdapter] Registering SIP:', sipUri, 'display:', displayName);

      this.pendingRegistrationResolve = resolve;
      this.pendingRegistrationReject = reject;

      this.transactions.set(transaction, (response) => {
        if (response.plugindata?.data?.result?.event === 'registered') {
          console.log('[JanusAdapter] SIP registered (via transaction)');
          this.callState.setRegisterStatus('registered');
          this.pendingRegistrationResolve = null;
          this.pendingRegistrationReject = null;
          resolve();
        } else if (response.plugindata?.data?.result?.event === 'registration_failed') {
          const reason = response.plugindata?.data?.result?.reason || 'Unknown error';
          this.pendingRegistrationResolve = null;
          this.pendingRegistrationReject = null;
          reject(new Error(`Registration failed: ${reason}`));
        }
      });

      this.sendMessage({
        janus: 'message',
        body: {
          request: 'register',
          username: sipUri,
          authuser: this.sipUsername,
          display_name: displayName,
          secret: this.sipPassword,
          outbound_proxy: this.sipProxy,
          send_register: true
        },
        transaction,
        session_id: this.sessionId!,
        handle_id: this.handleId!
      });

      setTimeout(() => {
        this.transactions.delete(transaction);
        if (this.pendingRegistrationReject) {
          this.pendingRegistrationReject(new Error('SIP registration timeout'));
          this.pendingRegistrationResolve = null;
          this.pendingRegistrationReject = null;
        }
      }, this.config.timeouts.registration);
    });
  }

  // ==================== MESSAGE HANDLING ====================

  private handleMessage(event: MessageEvent): void {
    try {
      const message: JanusMessage = JSON.parse(event.data);
      if (message.transaction && this.transactions.has(message.transaction)) {
        const callback = this.transactions.get(message.transaction)!;
        callback(message);
        if (message.janus !== 'ack') {
          this.transactions.delete(message.transaction);
        }
        return;
      }
      this.handleJanusEvent(message);
    } catch (e) {
      console.error('[JanusAdapter] Failed to parse message:', e);
    }
  }

  private handleJanusEvent(message: JanusMessage): void {
    switch (message.janus) {
      case 'event':    this.handlePluginEvent(message); break;
      case 'webrtcup': console.log('[JanusAdapter] WebRTC connection established'); break;
      case 'hangup':   console.log('[JanusAdapter] Janus hangup'); this.handleHangup('Janus hangup'); break;
      case 'detached': console.log('[JanusAdapter] Plugin detached'); break;
      case 'slowlink': console.warn('[JanusAdapter] Slow link detected'); break;
      case 'media':    console.log('[JanusAdapter] Media event:', message.data); break;
    }
  }

  private handlePluginEvent(message: JanusMessage): void {
    const data = message.plugindata?.data;
    if (!data) return;
    const event = data.result?.event || data.sip;
    const jsep = message.jsep;
    console.log('[JanusAdapter] SIP event:', event, data);

    switch (event) {
      case 'registered':
        this.callState.setRegisterStatus('registered');
        if (this.pendingRegistrationResolve) {
          this.pendingRegistrationResolve();
          this.pendingRegistrationResolve = null;
          this.pendingRegistrationReject = null;
        }
        break;
      case 'registration_failed':
        this.callState.setRegisterStatus('failed', data.result?.reason);
        if (this.pendingRegistrationReject) {
          this.pendingRegistrationReject(new Error(data.result?.reason || 'Registration failed'));
          this.pendingRegistrationResolve = null;
          this.pendingRegistrationReject = null;
        }
        break;
      case 'calling':
        this.callState.updateActiveCall({ status: 'dialing' });
        break;
      case 'ringing':
        this.callState.updateActiveCall({ status: 'ringing' });
        this.audio.playRingback();
        break;
      case 'progress':
        if (jsep) this.handleRemoteSdp(jsep);
        break;
      case 'accepted': {
        this.audio.stopRingback();
        this.audio.stopRingtone();
        const acceptedCallId = data.call_id || data.result?.call_id || data.sip_call_id || '';
        if (acceptedCallId) {
          this.callState.updateActiveCall({ sipCallId: acceptedCallId, status: 'connected' });
        } else {
          this.callState.updateActiveCall({ status: 'connected' });
        }
        if (jsep) this.handleRemoteSdp(jsep);
        break;
      }
      case 'incomingcall': {
        const incomingCallId = data.call_id || data.result?.call_id || data.sip_call_id || '';
        this.handleIncomingCall(data, jsep, incomingCallId);
        break;
      }
      case 'hangup': {
        const hangupCallId = data.call_id || data.result?.call_id || '';
        if (hangupCallId) this.callState.updateActiveCall({ sipCallId: hangupCallId });
        this.handleHangup(data.result?.reason);
        break;
      }
      case 'holding':
        this.callState.setHoldStatus('held');
        break;
      case 'resuming':
        this.callState.setHoldStatus('active');
        break;
      case 'transfer':
        this.callState.setTransferStatus(data.result?.code === 200 ? 'transferred' : 'failed');
        break;
      default:
        if (jsep && jsep.type === 'offer' && !this.callState.hasActiveCall && !this.callState.hasIncomingCall) {
          console.log('[JanusAdapter] Incoming call detected via JSEP offer (fallback)');
          this.handleIncomingCall(data, jsep);
        }
        break;
    }
  }

  // ==================== CALL ACTIONS ====================

  async makeCall(phoneNumber: string, displayName?: string): Promise<void> {
    if (!this.isRegistered()) throw new Error('Not registered to SIP server');
    if (this.callState.hasActiveCall) throw new Error('Already have an active call');

    console.log('[JanusAdapter] Making call to:', phoneNumber);

    const call: ActiveCall = {
      id: this.callState.generateCallId(),
      direction: 'outgoing',
      status: 'dialing',
      caller: { displayName: this.sipUsername || 'Agent', number: this.sipUsername || '' },
      callee: { displayName: displayName || phoneNumber, number: phoneNumber },
      startTime: new Date(),
      duration: 0,
      isMuted: false,
      isOnHold: false,
      isLocalHold: false,
      isRemoteHold: false,
      dtmfBuffer: ''
    };
    this.callState.setActiveCall(call);

    try {
      const peerConnection = new RTCPeerConnection({
        iceServers: this.config.iceServers,
        iceTransportPolicy: this.config.iceTransportPolicy || 'relay'
      });
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.localStream.getTracks().forEach(track => peerConnection.addTrack(track, this.localStream!));

      const offer = await peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await peerConnection.setLocalDescription(offer);

      const sipUri = `sip:${phoneNumber}@${this.sipDomain}`;
      this.sendMessage({
        janus: 'message',
        body: { request: 'call', uri: sipUri, proxy: this.sipProxy },
        jsep: peerConnection.localDescription,
        transaction: this.generateTransaction(),
        session_id: this.sessionId!,
        handle_id: this.handleId!
      });

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendMessage({
            janus: 'trickle',
            candidate: event.candidate,
            transaction: this.generateTransaction(),
            session_id: this.sessionId!,
            handle_id: this.handleId!
          });
        } else {
          this.sendMessage({
            janus: 'trickle',
            candidate: { completed: true },
            transaction: this.generateTransaction(),
            session_id: this.sessionId!,
            handle_id: this.handleId!
          });
        }
      };

      peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          this.audio.setRemoteStream(this.remoteStream);
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log('[JanusAdapter] ICE state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
          this.handleHangup('ICE failed');
        }
      };

      this.peerConnection = peerConnection;
    } catch (error) {
      console.error('[JanusAdapter] makeCall error:', error);
      this.callState.updateActiveCall({ status: 'failed' });
      this.cleanupMedia();
      throw error;
    }
  }

  async answerCall(): Promise<void> {
    if (!this.pendingJsep) throw new Error('No incoming call to answer');
    if (!this.callState.hasIncomingCall) throw new Error('No incoming call');

    console.log('[JanusAdapter] Answering call');
    this.audio.stopRingtone();

    const incoming = this.callState.currentIncomingCall!;
    this.callState.setActiveCall({ ...incoming, status: 'answering' });

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      await this.createPeerConnection();
      this.localStream.getTracks().forEach(track => this.peerConnection!.addTrack(track, this.localStream!));

      await this.peerConnection!.setRemoteDescription(this.pendingJsep);
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);

      this.sendMessage({
        janus: 'message',
        session_id: this.sessionId!,
        handle_id: this.handleId!,
        transaction: this.generateTransaction(),
        body: { request: 'accept' },
        jsep: answer
      });
      this.pendingJsep = null;
    } catch (error) {
      console.error('[JanusAdapter] answerCall error:', error);
      this.callState.updateActiveCall({ status: 'failed' });
      this.cleanupMedia();
      throw error;
    }
  }

  declineCall(): void {
    console.log('[JanusAdapter] Declining call');
    this.audio.stopRingtone();
    this.sendMessage({
      janus: 'message',
      session_id: this.sessionId!,
      handle_id: this.handleId!,
      transaction: this.generateTransaction(),
      body: { request: 'decline', code: 486 }
    });
    this.callState.clearIncomingCall();
    this.pendingJsep = null;
  }

  hangup(): void {
    console.log('[JanusAdapter] Hanging up');
    this.audio.stopRingtone();
    this.audio.stopRingback();
    this.sendMessage({
      janus: 'message',
      session_id: this.sessionId!,
      handle_id: this.handleId!,
      transaction: this.generateTransaction(),
      body: { request: 'hangup' }
    });
    this.handleHangup('User hangup');
  }

  toggleMute(): boolean {
    if (!this.localStream) return false;
    const newMuteState = this.callState.toggleMute();
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !newMuteState;
      console.log('[JanusAdapter] Mute:', newMuteState);
    }
    return newMuteState;
  }

  toggleHold(): void {
    const currentStatus = this.callState.toggleHold();
    const request = currentStatus === 'holding' ? 'hold' : 'unhold';
    this.sendMessage({
      janus: 'message',
      session_id: this.sessionId!,
      handle_id: this.handleId!,
      transaction: this.generateTransaction(),
      body: { request }
    });
  }

  sendDTMF(digit: string): void {
    if (!this.callState.hasActiveCall) return;
    this.sendMessage({
      janus: 'message',
      session_id: this.sessionId!,
      handle_id: this.handleId!,
      transaction: this.generateTransaction(),
      body: { request: 'dtmf_info', digit }
    });
  }

  transfer(targetNumber: string): void {
    if (!this.callState.hasActiveCall) return;
    const sipUri = targetNumber.includes('@') ? `sip:${targetNumber}` : `sip:${targetNumber}@${this.sipDomain}`;
    console.log('[JanusAdapter] Transferring to:', sipUri);
    this.callState.setTransferStatus('transferring', targetNumber);
    this.sendMessage({
      janus: 'message',
      session_id: this.sessionId!,
      handle_id: this.handleId!,
      transaction: this.generateTransaction(),
      body: { request: 'transfer', uri: sipUri }
    });
  }

  // ==================== INCOMING CALL HANDLING ====================

  private handleIncomingCall(data: any, jsep?: RTCSessionDescriptionInit, sipCallId?: string): void {
    if (this.callState.hasActiveCall) {
      console.log('[JanusAdapter] Already in call, declining incoming');
      this.sendMessage({
        janus: 'message',
        session_id: this.sessionId!,
        handle_id: this.handleId!,
        transaction: this.generateTransaction(),
        body: { request: 'decline', code: 486 }
      });
      return;
    }

    const callerInfo = this.parseCallerInfo(data);
    const callIdFromData = sipCallId || data.call_id || data.result?.call_id || data.sip_call_id || '';

    const call: ActiveCall = {
      id: this.callState.generateCallId(),
      direction: 'incoming',
      status: 'incomingcall',
      caller: callerInfo,
      callee: { displayName: this.sipUsername || 'Agent', number: this.sipUsername || '' },
      startTime: new Date(),
      duration: 0,
      isMuted: false,
      isOnHold: false,
      isLocalHold: false,
      isRemoteHold: false,
      dtmfBuffer: '',
      sipCallId: callIdFromData || undefined
    };

    this.pendingJsep = jsep || null;
    this.callState.setIncomingCall(call);
    this.audio.playRingtone();
  }

  private parseCallerInfo(data: any): CallParticipant {
    const displayName = data.result?.displayname || data.displayname || 'Unknown';
    let number = data.result?.username || data.username || '';
    const match = number.match(/sip:([^@]+)@/);
    if (match) number = match[1];
    return { displayName, number, uri: data.result?.username || data.username };
  }

  // ==================== WEBRTC ====================

  private async createPeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceTransportPolicy: this.config.iceTransportPolicy || 'relay'
    });

    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.audio.setRemoteStream(this.remoteStream);
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendMessage({
          janus: 'trickle',
          session_id: this.sessionId!,
          handle_id: this.handleId!,
          transaction: this.generateTransaction(),
          candidate: event.candidate
        });
      } else {
        this.sendMessage({
          janus: 'trickle',
          session_id: this.sessionId!,
          handle_id: this.handleId!,
          transaction: this.generateTransaction(),
          candidate: { completed: true }
        });
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[JanusAdapter] ICE state:', this.peerConnection?.iceConnectionState);
      if (this.peerConnection?.iceConnectionState === 'failed') {
        this.handleHangup('ICE failed');
      }
    };
  }

  private async handleRemoteSdp(jsep: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      console.error('[JanusAdapter] No peer connection for remote SDP');
      return;
    }
    try {
      await this.peerConnection.setRemoteDescription(jsep);
    } catch (e) {
      console.error('[JanusAdapter] Failed to set remote SDP:', e);
    }
  }

  // ==================== HANGUP & CLEANUP ====================

  private handleHangup(reason?: string): void {
    console.log('[JanusAdapter] Handling hangup:', reason);
    this.audio.stopRingtone();
    this.audio.stopRingback();
    this.callState.clearActiveCall(reason);
    this.callState.clearIncomingCall();
    this.pendingJsep = null;
    this.cleanupMedia();
  }

  private cleanupMedia(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.audio.clearRemoteStream();
    this.remoteStream = null;
  }

  // ==================== KEEPALIVE & RECONNECTION ====================

  private startKeepalive(): void {
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    const interval = this.config.timeouts.keepalive || 25000;
    this.keepaliveTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.sessionId) {
        this.sendMessage({
          janus: 'keepalive',
          session_id: this.sessionId,
          transaction: this.generateTransaction()
        });
      }
    }, interval);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private handleDisconnect(): void {
    console.log('[JanusAdapter] Handling disconnect');
    this.isConnected = false;
    this.callState.updateConnectionState({ websocketConnected: false, sipRegistered: false });
    this.callState.setRegisterStatus('unregistered');
    this.stopKeepalive();
    this.handleHangup('Disconnected');
    this.sessionId = null;
    this.handleId = null;
    this.ws = null;
    if (this.sipUsername && this.sipPassword) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[JanusAdapter] Max reconnect attempts reached');
      return;
    }
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.min(this.config.timeouts.reconnect * this.reconnectAttempts, 30000);
    console.log(`[JanusAdapter] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.sipUsername && this.sipPassword && !this.isConnected) {
        this.connect({
          username: this.sipUsername,
          password: this.sipPassword,
          domain: this.sipDomain,
          displayName: this.sipDisplayName || undefined,
          proxy: this.sipProxy || undefined,
          authUser: this.sipAuthUser || undefined
        }).catch(e => console.error('[JanusAdapter] Reconnect failed:', e));
      }
    }, delay);
  }

  // ==================== DISCONNECT ====================

  disconnect(): void {
    console.log('[JanusAdapter] Disconnecting...');
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.callState.hasActiveCall) this.hangup();
    if (this.callState.hasIncomingCall) this.declineCall();

    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.handleId) {
      this.sendMessage({
        janus: 'message',
        session_id: this.sessionId!,
        handle_id: this.handleId!,
        transaction: this.generateTransaction(),
        body: { request: 'unregister' }
      });
    }

    this.stopKeepalive();
    this.cleanupMedia();
    this.audio.cleanup();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.sessionId = null;
    this.handleId = null;
    this.sipUsername = null;
    this.sipPassword = null;
    this.reconnectAttempts = 0;

    this.callState.reset();
    console.log('[JanusAdapter] Disconnected');
  }

  // ==================== UTILITY ====================

  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[JanusAdapter] Cannot send - WebSocket not open');
    }
  }

  private generateTransaction(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  isRegistered(): boolean {
    return this.callState.isRegistered && this.isConnected;
  }

  getCurrentUsername(): string | null {
    return this.sipUsername;
  }
}
