import { For, createMemo } from "solid-js";
import { useQueryClient } from "@tanstack/solid-query";
import { getRouteApi, Link } from "@tanstack/solid-router";
import { findCachedEntry, formatDate } from "@exp/shared";
import { Alert, AlertDescription, AlertTitle, Card, CardContent } from "@/components/ui";

// Stub for /hub/$type/result/detail/$id and /user/$type/$id. Both routes parse
// `type` and `id` (id arrives as a number), so the component trusts them.
const hubRoute = getRouteApi("/hub/$type/result/detail/$id");
const userRoute = getRouteApi("/user/$type/$id");

export function EntityPage(props: { scope: "hub" | "user" }) {
  const params = (props.scope === "hub" ? hubRoute : userRoute).useParams();
  const queryClient = useQueryClient();
  const entry = createMemo(() =>
    findCachedEntry(queryClient.getQueriesData({ queryKey: ["hub", "tops", params().type] }), params().type, params().id)
  );
  const rows = (): [string, string | number][] => [
    ["Route", props.scope === "hub" ? "Hub detail (public view)" : "Your copy (private view)"],
    ["Type", params().type],
    ["Id", params().id],
    ["Owner", entry()?.ownerName ?? "—"],
    ["Edited", formatDate(entry()?.lastModifiedTime) || "—"],
  ];

  return (
    <div class="mx-auto max-w-3xl space-y-4 p-8">
      <h2 class="text-3xl font-semibold">{entry()?.name ?? `${params().type} #${params().id}`}</h2>
      <Card class="py-0">
        <CardContent class="px-0">
          <dl class="divide-y text-sm">
            <For each={rows()}>
              {([label, value]) => (
                <div class="grid grid-cols-3 px-4 py-2">
                  <dt class="text-muted-foreground">{label}</dt>
                  <dd class="col-span-2">{value}</dd>
                </div>
              )}
            </For>
          </dl>
        </CardContent>
      </Card>
      <Alert>
        <AlertTitle>Stub page</AlertTitle>
        <AlertDescription>
          {entry()
            ? "Rendered from the landing page cache, no request made."
            : "Not in cache (opened directly): a real page would fetch it here."}
        </AlertDescription>
      </Alert>
      <Link to="/" class="inline-block text-blue-600 hover:underline">
        ← Back to the hub
      </Link>
    </div>
  );
}
