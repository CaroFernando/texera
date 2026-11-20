import { api } from "./api";
import type { EntityType } from "./types";

// The app shell around the page, mirroring DashboardComponent in the Angular app
// (dashboard/component/dashboard.component.html): a collapsible light sider with
// the logo, a "Hub" submenu and About, plus a 70px top bar with search + Sign in.
// Which tabs show comes from the same public settings the Angular app reads.

export const SIDER_WIDTH = 200;
export const SIDER_COLLAPSED_WIDTH = 45;
export const NAV_HEIGHT = 70;
/** ng-zorro's default primary (antd v4 palette), so every variant uses Texera's blue. */
export const PRIMARY = "#1890ff";

export const shellQueries = {
  publicSettings: () => ({
    queryKey: ["config", "public-settings"] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => api.publicSettings(signal),
    staleTime: Infinity,
  }),
};

export type HubIcon = "home" | "project" | "database" | "model";

export interface HubTab {
  key: string;
  label: string;
  /** Tooltip text from hub.component.html. */
  tooltip: string;
  icon: HubIcon;
  /** Undefined for Home. */
  type?: EntityType;
}

const HUB_TABS: (HubTab & { flag: string })[] = [
  { key: "home", flag: "home_enabled", label: "Home", tooltip: "Home Page", icon: "home" },
  { key: "workflow", flag: "workflow_enabled", label: "Workflows", tooltip: "Search public workflows", icon: "project", type: "workflow" },
  { key: "dataset", flag: "dataset_enabled", label: "Datasets", tooltip: "Search public dataset", icon: "database", type: "dataset" },
  { key: "model", flag: "model_enabled", label: "Models", tooltip: "Search public models", icon: "model", type: "model" },
];

/**
 * Sidebar flags as DashboardComponent applies them: a tab shows unless its
 * setting is the string "false". While settings load, everything but Models
 * shows (Models defaults off in the shipped config).
 */
export function shellLayout(settings: Record<string, string> | undefined) {
  const on = (flag: string, fallback = true) => (settings?.[flag] ?? String(fallback)) === "true";
  return {
    hubEnabled: on("hub_enabled"),
    aboutEnabled: on("about_enabled"),
    hubTabs: HUB_TABS.filter(t => on(t.flag, t.key !== "model")).map(({ flag: _flag, ...t }) => t),
    logo: assetUrl(settings?.logo) ?? "/assets/logos/logo.png",
    miniLogo: assetUrl(settings?.mini_logo) ?? "/assets/logos/full_logo_small.png",
  };
}

/**
 * Settings hold either a data URI (uploaded by an admin) or a path into the Angular
 * app's assets ("assets/logos/logo.png"). The default logos are copied into
 * shared/public, which every variant serves as its publicDir.
 */
function assetUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.startsWith("data:") || value.startsWith("http") || value.startsWith("/") ? value : `/${value}`;
}

export const BUILD_LABEL = "Build: dev";
