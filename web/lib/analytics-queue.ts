/** The shape the analytics script drains: `vaq.forEach(([command, payload]) => va(command, payload))`. */
export type AnalyticsQueueTarget = {
  va?: (...params: unknown[]) => void;
  vaq?: unknown[][];
};

/**
 * Install the same queue stub `<Analytics />` installs, if the script has not
 * loaded yet. `track()` only calls `window.va` and drops the event when it is
 * missing. The script replaces `va` and replays `vaq` when it loads.
 */
export function installAnalyticsQueue(target: object): void {
  const host = target as AnalyticsQueueTarget;
  if (host.va) return;
  host.va = (...params: unknown[]) => {
    host.vaq = host.vaq || [];
    host.vaq.push(params);
  };
}
