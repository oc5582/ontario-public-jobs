/**
 * Up to three ranks around `rn` in a 1-based list of `total` jobs.
 * Prefer the previous job, the next job, and the one after that.
 * At either end, fill from the nearest remaining ranks so the box still has
 * three links when the employer has enough open jobs.
 * Ranks come back in list order.
 */
export function neighbourRanks(rn: number, total: number): number[] {
  if (!Number.isInteger(rn) || !Number.isInteger(total) || total < 2 || rn < 1 || rn > total) return [];
  const want = Math.min(3, total - 1);
  const chosen: number[] = [];
  const seen = new Set<number>();
  const add = (rank: number) => {
    if (chosen.length >= want || rank < 1 || rank > total || rank === rn || seen.has(rank)) return;
    seen.add(rank);
    chosen.push(rank);
  };
  for (const rank of [rn - 1, rn + 1, rn + 2]) add(rank);
  for (let distance = 1; chosen.length < want && distance < total; distance += 1) {
    add(rn - distance);
    add(rn + distance);
  }
  return chosen.sort((left, right) => left - right);
}

/** Jobs reachable by walking neighbour links, starting from the given ranks. */
export function ranksReachableFrom(total: number, starts: readonly number[]): Set<number> {
  const seen = new Set<number>();
  const queue = [...starts];
  while (queue.length) {
    const rank = queue.pop();
    if (rank == null || seen.has(rank)) continue;
    seen.add(rank);
    for (const next of neighbourRanks(rank, total)) {
      if (!seen.has(next)) queue.push(next);
    }
  }
  return seen;
}
