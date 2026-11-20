import { api } from "./api";
import { loadTops, resolveCover } from "./landing";
import type { ActionType, EntityType, HubEntry } from "./types";

// Query definitions shared by every TanStack Query variant. They are plain
// { queryKey, queryFn } objects, which both @tanstack/react-query and
// @tanstack/solid-query accept as-is: React passes them to useQuery(opts),
// Solid to useQuery(() => opts). Only the hook call differs per framework.

type Ctx = { signal: AbortSignal };

export const hubQueries = {
  count: (type: EntityType) => ({
    queryKey: ["hub", "count", type] as const,
    queryFn: ({ signal }: Ctx) => api.count(type, signal),
  }),

  tops: (type: EntityType, actions: ActionType[], uid: number | undefined) => ({
    queryKey: ["hub", "tops", type, actions, uid ?? -1] as const,
    queryFn: ({ signal }: Ctx) => loadTops(type, actions, uid, signal),
  }),

  cover: (entry: HubEntry) => ({
    queryKey: ["hub", "cover", entry.type, entry.id, entry.coverImage ?? null] as const,
    queryFn: ({ signal }: Ctx) => resolveCover(entry, signal),
    // Cover URLs for datasets/models are presigned; keep them for a while but not forever.
    staleTime: 5 * 60_000,
  }),
};

/**
 * Looks an entry up in whatever `tops` results are already cached, so a detail
 * page opened from a card renders its name without a request. Pass
 * `queryClient.getQueriesData({ queryKey: ["hub", "tops", type] })`.
 */
export function findCachedEntry(
  cached: ReadonlyArray<readonly [unknown, unknown]>,
  type: EntityType,
  id: number
): HubEntry | undefined {
  for (const [, data] of cached) {
    for (const list of Object.values((data ?? {}) as Partial<Record<ActionType, HubEntry[]>>)) {
      const hit = list?.find(e => e.type === type && e.id === id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Same defaults in every variant so caching behavior is comparable. */
export const queryClientDefaults = {
  queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
} as const;
