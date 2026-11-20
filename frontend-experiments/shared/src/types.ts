// Wire types for the hub endpoints the landing page reads. Only the fields the
// page uses are declared; the backend sends more.
// Source of truth: frontend/src/app/hub/service/hub.service.ts and
// frontend/src/app/dashboard/type/*.

export type EntityType = "workflow" | "dataset" | "model";
export type ActionType = "like" | "clone";

export interface WorkflowPayload {
  workflow: {
    wid: number;
    name: string;
    description?: string;
    creationTime?: number;
    lastModifiedTime?: number;
  };
  ownerId: number;
  /** Downscaled data URL carried on the entry itself. */
  coverImage: string | null;
}

export interface DatasetPayload {
  dataset: {
    did: number;
    ownerUid: number;
    name: string;
    description?: string;
    creationTime?: number;
    /** Stored path; resolve with /dataset/{did}/cover-url. */
    coverImage?: string;
  };
}

export interface ModelPayload {
  model: {
    mid: number;
    ownerUid: number;
    name: string;
    description?: string;
    creationTime?: number;
    coverImage?: string;
  };
}

export interface SearchResultItem {
  resourceType: EntityType | "computing-unit";
  workflow?: WorkflowPayload;
  dataset?: DatasetPayload;
  model?: ModelPayload;
}

export interface OwnerInfo {
  userName: string;
  avatar?: string;
}

export interface AccessResponse {
  entityType: EntityType;
  entityId: number;
  userIds: number[];
}

/** One card on the landing page: the flattened, enriched form of a SearchResultItem. */
export interface HubEntry {
  type: EntityType;
  id: number;
  name: string;
  description?: string;
  lastModifiedTime?: number;
  ownerId?: number;
  ownerName?: string;
  ownerAvatar?: string;
  /** Workflow: data URL. Dataset/model: stored path that still needs resolving. */
  coverImage?: string;
  accessibleUserIds: number[];
}

export interface CurrentUser {
  uid: number;
  name: string;
  avatar?: string;
}
