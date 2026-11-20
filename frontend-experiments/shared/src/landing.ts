import { api } from "./api";
import type { ActionType, EntityType, HubEntry, SearchResultItem } from "./types";
import defaultCoverUrl from "../assets/card_background.svg";

export const defaultCover: string = defaultCoverUrl;

// --- routes ---------------------------------------------------------------
// Same URL shapes as the Angular app (app-routing.constant.ts), so links can be
// compared 1:1. Each variant declares these with its own router.

export const ENTITY_TYPES: EntityType[] = ["workflow", "dataset", "model"];

export const paths = {
  home: "/",
  about: "/about",
  login: "/login",
  /** Global search from the top bar (SEARCH in the Angular app). */
  search: "/search",
  hubResults: (type: EntityType) => `/hub/${type}/result`,
  hubDetail: (type: EntityType, id: number) => `/hub/${type}/result/detail/${id}`,
  userEntity: (type: EntityType, id: number) => `/user/${type}/${id}`,
};

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as string[]).includes(value);
}

/**
 * A card links to your own copy when you can reach it, and to the hub otherwise
 * (ResourceRegistryService.entryLink in the Angular app).
 */
export function entryLink(entry: HubEntry, currentUid: number | undefined): string {
  const reachable =
    currentUid !== undefined && (entry.ownerId === currentUid || entry.accessibleUserIds.includes(currentUid));
  return reachable ? paths.userEntity(entry.type, entry.id) : paths.hubDetail(entry.type, entry.id);
}

// --- sections ---------------------------------------------------------------

export interface LandingSection {
  title: string;
  type: EntityType;
  /** Which bucket of the getTops response this section shows. */
  action: ActionType;
  /** What the getTops request asks for. Both workflow sections share one request. */
  actions: ActionType[];
}

export const LANDING_SECTIONS: LandingSection[] = [
  { title: "Top Loved Workflows", type: "workflow", action: "like", actions: ["like", "clone"] },
  { title: "Top Cloned Workflows", type: "workflow", action: "clone", actions: ["like", "clone"] },
  { title: "Top Loved Datasets", type: "dataset", action: "like", actions: ["like"] },
  { title: "Top Loved Models", type: "model", action: "like", actions: ["like"] },
];

// --- data loading -----------------------------------------------------------

function toEntry(item: SearchResultItem): HubEntry | undefined {
  if (item.workflow) {
    const w = item.workflow;
    return {
      type: "workflow",
      id: w.workflow.wid,
      name: w.workflow.name,
      description: w.workflow.description,
      lastModifiedTime: w.workflow.lastModifiedTime,
      ownerId: w.ownerId,
      coverImage: w.coverImage ?? undefined,
      accessibleUserIds: [],
    };
  }
  if (item.dataset) {
    const d = item.dataset.dataset;
    return {
      type: "dataset",
      id: d.did,
      name: d.name,
      description: d.description,
      lastModifiedTime: d.creationTime,
      ownerId: d.ownerUid,
      coverImage: d.coverImage,
      accessibleUserIds: [],
    };
  }
  if (item.model) {
    const m = item.model.model;
    return {
      type: "model",
      id: m.mid,
      name: m.name,
      description: m.description,
      lastModifiedTime: m.creationTime,
      ownerId: m.ownerUid,
      coverImage: m.coverImage,
      accessibleUserIds: [],
    };
  }
  return undefined;
}

/** Adds owner name/avatar and access lists (SearchService.extendSearchResultsWithHubActivityInfo, "access"). */
async function enrich(items: SearchResultItem[], signal?: AbortSignal): Promise<HubEntry[]> {
  const entries = items.map(toEntry).filter((e): e is HubEntry => e !== undefined);
  if (entries.length === 0) return [];
  const ownerIds = [...new Set(entries.map(e => e.ownerId).filter((id): id is number => id !== undefined))];
  const [owners, access] = await Promise.all([
    ownerIds.length ? api.ownersInfo(ownerIds, signal) : Promise.resolve({}),
    api.userAccess(
      entries.map(e => e.type),
      entries.map(e => e.id),
      signal
    ),
  ]);
  const accessMap = new Map(access.map(a => [`${a.entityType}:${a.entityId}`, a.userIds]));
  return entries.map(e => {
    const owner = e.ownerId !== undefined ? (owners as Record<number, { userName: string; avatar?: string }>)[e.ownerId] : undefined;
    return {
      ...e,
      ownerName: owner?.userName,
      ownerAvatar: owner?.avatar || undefined,
      accessibleUserIds: accessMap.get(`${e.type}:${e.id}`) ?? [],
    };
  });
}

/** getTops + enrichment for each requested action, like LandingPageComponent.getTopLovedEntries. */
export async function loadTops(
  type: EntityType,
  actions: ActionType[],
  uid: number | undefined,
  signal?: AbortSignal
): Promise<Partial<Record<ActionType, HubEntry[]>>> {
  const tops = await api.tops(type, actions, uid, signal);
  const result: Partial<Record<ActionType, HubEntry[]>> = {};
  for (const action of actions) {
    result[action] = await enrich(tops[action] ?? [], signal);
  }
  return result;
}

/** Workflows carry their cover inline; datasets/models resolve a stored path. */
export async function resolveCover(entry: HubEntry, signal?: AbortSignal): Promise<string> {
  if (entry.type === "workflow") return entry.coverImage ?? defaultCover;
  if (!entry.coverImage) return defaultCover;
  const { url } = await api.coverUrl(entry.type, entry.id, signal);
  return url ?? defaultCover;
}

// --- formatting -------------------------------------------------------------

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Angular's `| date` default (mediumDate). */
export function formatDate(ms: number | undefined): string {
  return ms === undefined ? "" : dateFormat.format(new Date(ms));
}

/** UserAvatarComponent.abbreviate: avatar text is at most 5 characters. */
export function abbreviate(name: string | undefined): string {
  return (name ?? "").slice(0, 5);
}

/** "workflow" → "Workflows". */
export function pluralLabel(type: EntityType): string {
  return `${type[0].toUpperCase()}${type.slice(1)}s`;
}
