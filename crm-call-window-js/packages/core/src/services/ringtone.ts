/**
 * Ringtone Service — framework-agnostic.
 *
 * Plays ringtone audio and shows browser notifications for incoming calls.
 * Subscribes to CallStateService; no NgZone (consumers of UI state handle
 * their own change detection).
 */

import type { Subscription } from 'rxjs';
import { CallStateService, ActiveCall } from './call-state';

export interface RingtoneServiceOptions {
  ringtoneUrl?: string;
  volume?: number;
  /** Enable browser Notification API. Default: true. */
  notifications?: boolean;
  /** Custom notification icon URL. Default: '/favicon.ico'. */
  notificationIcon?: string;
}

export class RingtoneService {
  private audioElement: HTMLAudioElement | null = null;
  private isPlaying = false;
  private audioUnlocked = false;
  private subscriptions: Subscription[] = [];
  private ringtoneUrl: string;
  private volume: number;
  private notificationsEnabled: boolean;
  private notificationIcon: string;

  private activeNotification: Notification | null = null;
  private notificationPermission: NotificationPermission = 'default';

  constructor(
    private callState: CallStateService,
    options: RingtoneServiceOptions = {}
  ) {
    this.ringtoneUrl = options.ringtoneUrl || '/assets/audio/whatsapp.mp3';
    this.volume = options.volume ?? 0.7;
    this.notificationsEnabled = options.notifications !== false;
    this.notificationIcon = options.notificationIcon || '/favicon.ico';

    console.log('[Ringtone] Service initialized');
    this.initAudio();
    this.subscribeToCallEvents();
    this.setupAudioUnlock();
    if (this.notificationsEnabled) {
      this.requestNotificationPermission();
    }
  }

  private initAudio(): void {
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      this.audioElement = new Audio(this.ringtoneUrl);
      this.audioElement.loop = true;
      this.audioElement.volume = this.volume;
      this.audioElement.preload = 'auto';
      this.audioElement.onerror = (e) => console.error('[Ringtone] Audio error:', e);
      this.audioElement.oncanplaythrough = () => console.log('[Ringtone] Audio loaded and ready');
      console.log('[Ringtone] Audio element created');
    }
  }

  private setupAudioUnlock(): void {
    if (typeof document === 'undefined') return;
    const unlockAudio = () => {
      if (this.audioUnlocked) return;
      const silentAudio = new Audio();
      silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      silentAudio.volume = 0;
      silentAudio.play()
        .then(() => {
          silentAudio.pause();
          this.audioUnlocked = true;
          console.log('[Ringtone] Audio unlocked');
          if (this.audioElement) this.audioElement.load();
        })
        .catch(() => {});
    };
    ['click', 'touchstart', 'keydown', 'scroll'].forEach(event => {
      document.addEventListener(event, unlockAudio, { once: true });
    });
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      this.notificationPermission = 'granted';
      return true;
    }
    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        this.notificationPermission = permission;
        console.log('[Ringtone] Notification permission:', permission);
        return permission === 'granted';
      } catch (error) {
        console.error('[Ringtone] Error requesting notification permission:', error);
        return false;
      }
    }
    return false;
  }

  private subscribeToCallEvents(): void {
    this.subscriptions.push(
      this.callState.getIncomingCall().subscribe(call => {
        if (call && call.status === 'incomingcall') {
          console.log('[Ringtone] Incoming call detected');
          this.play();
          if (this.notificationsEnabled) this.showBrowserNotification(call);
        } else if (!call && this.isPlaying) {
          this.stop();
          this.closeNotification();
        }
      })
    );

    this.subscriptions.push(
      this.callState.getActiveCall().subscribe(call => {
        if (call && (call.status === 'connected' || call.status === 'answering')) {
          if (this.isPlaying) {
            this.stop();
            this.closeNotification();
          }
        }
      })
    );

    this.subscriptions.push(
      this.callState.getCallEvents().subscribe(event => {
        if (event.type === 'call_ended' || event.type === 'call_rejected') {
          if (this.isPlaying) {
            this.stop();
            this.closeNotification();
          }
        }
      })
    );
  }

  play(): void {
    if (!this.audioElement) return;
    if (this.isPlaying) return;
    this.audioElement.currentTime = 0;
    this.audioElement.play()
      .then(() => {
        this.isPlaying = true;
        console.log('[Ringtone] Playing');
      })
      .catch((error) => {
        console.warn('[Ringtone] Autoplay blocked, waiting for interaction:', error.message);
        const retryPlay = () => {
          if (this.audioElement && !this.isPlaying) {
            this.audioElement.play()
              .then(() => {
                this.isPlaying = true;
                document.removeEventListener('click', retryPlay);
              })
              .catch(() => {});
          }
        };
        if (typeof document !== 'undefined') {
          document.addEventListener('click', retryPlay, { once: true });
        }
      });
  }

  stop(): void {
    if (!this.audioElement) return;
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.isPlaying = false;
    console.log('[Ringtone] Stopped');
  }

  showBrowserNotification(call: ActiveCall): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      this.requestNotificationPermission();
      return;
    }
    this.closeNotification();
    const callerNumber = call.caller?.number || 'Unknown';
    const callerName = call.caller?.displayName || callerNumber;
    const options: NotificationOptions = {
      body: `${callerName} is calling you\n${callerNumber}`,
      icon: this.notificationIcon,
      badge: this.notificationIcon,
      tag: 'incoming-call',
      requireInteraction: true,
      silent: false
    };
    try {
      this.activeNotification = new Notification('Incoming Call', options);
      this.activeNotification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        window.dispatchEvent(new CustomEvent('focusIncomingCall'));
      };
      this.activeNotification.onclose = () => { this.activeNotification = null; };
      this.activeNotification.onerror = (error) => console.error('[Ringtone] Notification error:', error);
    } catch (error) {
      console.error('[Ringtone] Error creating notification:', error);
    }
  }

  closeNotification(): void {
    if (this.activeNotification) {
      this.activeNotification.close();
      this.activeNotification = null;
    }
  }

  setVolume(volume: number): void {
    if (this.audioElement) {
      this.audioElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  getVolume(): number {
    return this.audioElement?.volume ?? this.volume;
  }

  get playing(): boolean { return this.isPlaying; }

  setRingtoneUrl(url: string): void {
    this.ringtoneUrl = url;
    if (this.audioElement) {
      const wasPlaying = this.isPlaying;
      this.stop();
      this.audioElement.src = url;
      this.audioElement.load();
      if (wasPlaying) this.play();
    }
  }

  destroy(): void {
    this.stop();
    this.closeNotification();
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    this.audioElement = null;
  }
}
