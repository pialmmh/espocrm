/**
 * Optional per-host extension hook for the call panel UI.
 *
 * Hosts (e.g. a specific CRM) can provide an implementation to run side
 * effects when the app navigates — useful for CRM-specific DOM surgery
 * that must happen when the user opens a particular record page.
 *
 * UI wrappers call these methods only if an extension is configured.
 */
export interface CallPanelExtension {
  /** Fires on every navigation event. Full URL (post-redirect) is passed. */
  onRouteChange?(url: string): void;

  /** Called once when the panel is destroyed. */
  onDestroy?(): void;
}
