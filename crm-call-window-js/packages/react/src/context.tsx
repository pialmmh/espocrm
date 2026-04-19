import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createCallClient, type CallClient, type CreateCallClientOptions } from '@telcobright/crm-call-core';

const CallClientContext = createContext<CallClient | null>(null);

export interface CallClientProviderProps extends CreateCallClientOptions {
  children: ReactNode;
  /**
   * If true (default), the provider tears down the client on unmount. Set to
   * false if the client is managed externally and shared across providers.
   */
  autoDestroy?: boolean;
}

/**
 * Builds a CallClient from the supplied options and exposes it via context.
 * The options are captured at mount — changing them later does not rebuild
 * the client. Destroy and rebuild the provider to reconnect against a new config.
 */
export function CallClientProvider(props: CallClientProviderProps) {
  const { children, autoDestroy = true, ...options } = props;
  const [client] = useState<CallClient>(() => createCallClient(options));

  useEffect(() => {
    return () => {
      if (autoDestroy) client.destroy();
    };
  }, [client, autoDestroy]);

  return <CallClientContext.Provider value={client}>{children}</CallClientContext.Provider>;
}

/** Grab the active CallClient. Throws if used outside a provider. */
export function useCallClient(): CallClient {
  const client = useContext(CallClientContext);
  if (!client) {
    throw new Error('useCallClient must be called inside a <CallClientProvider>.');
  }
  return client;
}

/** Lower-level accessor that returns null outside a provider (useful for opt-in UI). */
export function useCallClientOptional(): CallClient | null {
  return useContext(CallClientContext);
}
