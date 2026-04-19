/**
 * Call Audio Service — framework-agnostic.
 *
 * Shared audio management for any call adapter.
 * Handles ringtone, ringback, and remote audio element lifecycle.
 */

import type { CallAdapterConfig } from '../interfaces/call-adapter';

export class CallAudioService {
  private remoteAudio: HTMLAudioElement | null = null;
  private ringtoneAudio: HTMLAudioElement | null = null;
  private ringbackAudio: HTMLAudioElement | null = null;
  private initialized = false;

  constructor(private defaultConfig?: CallAdapterConfig) {}

  /** Initialize audio elements. Safe to call multiple times. */
  init(config?: CallAdapterConfig): void {
    if (this.initialized) return;
    if (typeof document === 'undefined') return;

    const audioConfig = config?.audio || this.defaultConfig?.audio;
    if (!audioConfig) {
      console.warn('[CallAudio] No audio config provided, using defaults');
    }

    const ringtoneUrl = audioConfig?.ringtoneUrl || '/assets/audio/whatsapp.mp3';
    const ringbackUrl = audioConfig?.ringbackUrl || '/assets/audio/ringback.mp3';
    const volume = audioConfig?.ringtoneVolume ?? 0.7;

    this.remoteAudio = document.createElement('audio');
    this.remoteAudio.id = 'webrtc-remote-audio';
    this.remoteAudio.autoplay = true;
    document.body.appendChild(this.remoteAudio);

    this.ringtoneAudio = new Audio(ringtoneUrl);
    this.ringtoneAudio.loop = true;
    this.ringtoneAudio.volume = volume;

    this.ringbackAudio = new Audio(ringbackUrl);
    this.ringbackAudio.loop = true;
    this.ringbackAudio.volume = volume;

    this.initialized = true;
    console.log('[CallAudio] Audio elements initialized');
  }

  setRemoteStream(stream: MediaStream): void {
    if (!this.remoteAudio) {
      console.warn('[CallAudio] Remote audio element not initialized');
      return;
    }
    this.remoteAudio.srcObject = stream;
    this.remoteAudio.play()
      .then(() => console.log('[CallAudio] Remote audio playing'))
      .catch(e => {
        console.warn('[CallAudio] Audio autoplay blocked, will play on interaction:', e.message);
        if (typeof document !== 'undefined') {
          document.addEventListener('click', () => {
            this.remoteAudio?.play().catch(() => {});
          }, { once: true });
        }
      });
  }

  clearRemoteStream(): void {
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
    }
  }

  playRingtone(): void {
    this.ringtoneAudio?.play().catch(e => console.warn('[CallAudio] Ringtone play failed:', e));
  }

  stopRingtone(): void {
    if (this.ringtoneAudio) {
      this.ringtoneAudio.pause();
      this.ringtoneAudio.currentTime = 0;
    }
  }

  playRingback(): void {
    this.ringbackAudio?.play().catch(e => console.warn('[CallAudio] Ringback play failed:', e));
  }

  stopRingback(): void {
    if (this.ringbackAudio) {
      this.ringbackAudio.pause();
      this.ringbackAudio.currentTime = 0;
    }
  }

  cleanup(): void {
    this.stopRingtone();
    this.stopRingback();
    this.clearRemoteStream();

    if (this.remoteAudio && this.remoteAudio.parentNode) {
      this.remoteAudio.parentNode.removeChild(this.remoteAudio);
    }
    this.remoteAudio = null;
    this.ringtoneAudio = null;
    this.ringbackAudio = null;
    this.initialized = false;
    console.log('[CallAudio] Cleaned up');
  }
}
