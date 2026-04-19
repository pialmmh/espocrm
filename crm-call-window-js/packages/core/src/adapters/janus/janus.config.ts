/**
 * Default Janus adapter configuration.
 * Host apps may override the server URL per-session via
 * CallAdapterConnectConfig.server (set by their CallCredentialsProvider).
 */

import type { CallAdapterConfig } from '../../interfaces/call-adapter';

export const JANUS_CONFIG: CallAdapterConfig = {
  type: 'janus',
  server: 'wss://hippbx.btcliptelephony.gov.bd:3050/ws',
  iceServers: [
    {
      urls: 'turn:iptsp.cosmocom.net:3478',
      username: 'ccl',
      credential: 'ccl!pt$p'
    },
    { urls: 'stun:iptsp.cosmocom.net:3478' }
  ],
  iceTransportPolicy: 'relay',
  timeouts: {
    registration: 30000,
    call: 60000,
    reconnect: 5000,
    keepalive: 25000
  },
  audio: {
    ringtoneUrl: '/assets/audio/whatsapp.mp3',
    ringbackUrl: '/assets/audio/ringback.mp3',
    ringtoneVolume: 0.7
  },
  sip: {
    domain: 'cosmocom.net',
    proxy: 'sip:hippbx.btcliptelephony.gov.bd',
    port: 5060
  }
};
