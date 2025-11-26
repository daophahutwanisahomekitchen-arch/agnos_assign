// Simple UI event bus for cross-component signals (counts, notifications)
const bus = new EventTarget();

export type CountsPayload = { drafts: number; submissions: number };

export function emitCounts(payload: CountsPayload) {
  bus.dispatchEvent(new CustomEvent('ui:counts', { detail: payload }));
}

export function onCounts(cb: (p: CountsPayload) => void) {
  const handler = (e: Event) => cb((e as CustomEvent).detail as CountsPayload);
  bus.addEventListener('ui:counts', handler as EventListener);
  return () => bus.removeEventListener('ui:counts', handler as EventListener);
}

export default bus;
