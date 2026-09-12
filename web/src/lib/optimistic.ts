/** A just-created optimistic row has no server id yet; let it settle first
 * before offering actions that need a real id. */
export function isSettled(id: string): boolean {
  return !id.startsWith("optimistic-");
}
