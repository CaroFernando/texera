import { useQueryClient } from "@tanstack/react-query";
import { Alert, Descriptions, Typography } from "antd";
import { Link, useParams } from "react-router";
import { findCachedEntry, formatDate, isEntityType, paths } from "@exp/shared";
import { NotFoundPage } from "./NotFoundPage";

// Stub for /hub/:type/result/detail/:id and /user/:type/:id.
export function EntityPage({ scope }: { scope: "hub" | "user" }) {
  const { type = "", id: rawId = "" } = useParams();
  const id = Number(rawId);
  const queryClient = useQueryClient();

  if (!isEntityType(type) || !Number.isInteger(id)) return <NotFoundPage />;
  const entry = findCachedEntry(queryClient.getQueriesData({ queryKey: ["hub", "tops", type] }), type, id);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Typography.Title level={2}>{entry?.name ?? `${type} #${id}`}</Typography.Title>
      <Descriptions
        bordered
        size="small"
        column={1}
        items={[
          { key: "route", label: "Route", children: scope === "hub" ? "Hub detail (public view)" : "Your copy (private view)" },
          { key: "type", label: "Type", children: type },
          { key: "id", label: "Id", children: id },
          { key: "owner", label: "Owner", children: entry?.ownerName ?? "—" },
          { key: "edited", label: "Edited", children: formatDate(entry?.lastModifiedTime) || "—" },
        ]}
      />
      <Alert className="!mt-4" type="info" showIcon title="Stub page" description={entry ? "Rendered from the landing page cache, no request made." : "Not in cache (opened directly): a real page would fetch it here."} />
      <Link to={paths.home} className="mt-4 inline-block">
        ← Back to the hub
      </Link>
    </div>
  );
}
