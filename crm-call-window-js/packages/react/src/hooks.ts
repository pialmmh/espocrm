import { useEffect, useState } from 'react';
import type { Observable } from 'rxjs';
import type {
  ActiveCall,
  CallHistoryEntry,
  HoldStatus,
  RegisterStatus,
  TransferStatus,
  WebRTCConnectionState
} from '@telcobright/crm-call-core';
import { useCallClient } from './context';

/**
 * Subscribe to any rxjs Observable and render its latest value.
 * If the observable is a BehaviorSubject-like source the initial value is
 * emitted synchronously on subscribe; otherwise `initial` is used.
 */
export function useObservable<T>(source$: Observable<T>, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = source$.subscribe(v => setValue(v));
    return () => sub.unsubscribe();
  }, [source$]);
  return value;
}

// Convenience hooks — each returns the current value of one CallStateService slice.

export function useRegisterStatus(): RegisterStatus {
  const { callState } = useCallClient();
  return useObservable(callState.getRegisterStatus(), 'idle');
}

export function useActiveCall(): ActiveCall | null {
  const { callState } = useCallClient();
  return useObservable(callState.getActiveCall(), null);
}

export function useIncomingCall(): ActiveCall | null {
  const { callState } = useCallClient();
  return useObservable(callState.getIncomingCall(), null);
}

export function useCallHistory(): CallHistoryEntry[] {
  const { callState } = useCallClient();
  return useObservable(callState.getCallHistory(), []);
}

export function useMuteStatus(): boolean {
  const { callState } = useCallClient();
  return useObservable(callState.getMuteStatus(), false);
}

export function useHoldStatus(): HoldStatus {
  const { callState } = useCallClient();
  return useObservable(callState.getHoldStatus(), 'active');
}

export function useTransferStatus(): TransferStatus {
  const { callState } = useCallClient();
  return useObservable(callState.getTransferStatus(), 'idle');
}

export function useConnectionState(): WebRTCConnectionState {
  const { callState } = useCallClient();
  return useObservable(callState.getConnectionState(), {
    websocketConnected: false,
    sipRegistered: false
  });
}
