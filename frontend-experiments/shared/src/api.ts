import { getToken } from "./auth";
import type { AccessResponse, ActionType, EntityType, OwnerInfo, SearchResultItem } from "./types";

// Framework-agnostic client for the endpoints the landing page uses. Every
// variant calls exactly these functions, so differences between variants come
// from the framework / data layer, never from the requests themselves.
// Paths are relative ("/api/..."); each variant's Vite dev server proxies them
// to the local-dev services (see ../vite-proxy.ts).

export class ApiError extends Error {
  constructor(
    public status: number,
    url: string
  ) {
    super(`${status} ${url}`);
  }
}

type Params = Record<string, string | number | (string | number)[] | undefined>;

function query(params: Params): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) sp.append(key, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function getJson<T>(path: string, params: Params = {}, signal?: AbortSignal): Promise<T> {
  const url = `/api/${path}${query(params)}`;
  const token = getToken();
  const res = await fetch(url, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, url);
  return res.json() as Promise<T>;
}

export const api = {
  /** GET /hub/count — number of public entities of a type. */
  count: (entityType: EntityType, signal?: AbortSignal) => getJson<number>("hub/count", { entityType }, signal),

  /** GET /hub/getTops — top entities per action; uid -1 means anonymous. */
  tops: (entityType: EntityType, actionTypes: ActionType[], uid: number | undefined, signal?: AbortSignal) =>
    getJson<Partial<Record<ActionType, SearchResultItem[]>>>(
      "hub/getTops",
      { entityType, uid: uid ?? -1, actionTypes },
      signal
    ),

  /** GET /dashboard/resultsOwnersInfo — owner name + avatar per user id. */
  ownersInfo: (userIds: number[], signal?: AbortSignal) =>
    getJson<Record<number, OwnerInfo>>("dashboard/resultsOwnersInfo", { userIds }, signal),

  /** GET /hub/user-access — which users can reach each entity (decides private vs hub link). */
  userAccess: (entityTypes: EntityType[], entityIds: number[], signal?: AbortSignal) =>
    getJson<AccessResponse[]>("hub/user-access", { entityType: entityTypes, entityId: entityIds }, signal),

  /** GET /config/settings/public — branding + sidebar flags (config-service), no auth needed. */
  publicSettings: (signal?: AbortSignal) => getJson<Record<string, string>>("config/settings/public", {}, signal),

  /** GET /dataset/{did}/cover-url or /model/{mid}/cover-url — resolves a stored cover path. */
  coverUrl: (type: "dataset" | "model", id: number, signal?: AbortSignal) =>
    getJson<{ url: string | null }>(`${type}/${id}/cover-url`, {}, signal),
};
