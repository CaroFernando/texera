import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { findCachedEntry, formatDate } from "@exp/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

// Stub for /hub/$type/result/detail/$id and /user/$type/$id. Both routes parse
// `type` and `id` (id arrives as a number), so the component trusts them.
const hubRoute = getRouteApi("/hub/$type/result/detail/$id");
const userRoute = getRouteApi("/user/$type/$id");

export function EntityPage({ scope }: { scope: "hub" | "user" }) {
  const { type, id } = (scope === "hub" ? hubRoute : userRoute).useParams();
  const queryClient = useQueryClient();
  const entry = findCachedEntry(queryClient.getQueriesData({ queryKey: ["hub", "tops", type] }), type, id);
  const rows: [string, string | number][] = [
    ["Route", scope === "hub" ? "Hub detail (public view)" : "Your copy (private view)"],
    ["Type", type],
    ["Id", id],
    ["Owner", entry?.ownerName ?? "—"],
    ["Edited", formatDate(entry?.lastModifiedTime) || "—"],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-8">
      <h2 className="text-3xl font-semibold">{entry?.name ?? `${type} #${id}`}</h2>
      <Card className="py-0">
        <CardContent className="px-0">
          <dl className="divide-y text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-3 px-4 py-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="col-span-2">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Alert>
        <AlertTitle>Stub page</AlertTitle>
        <AlertDescription>
          {entry
            ? "Rendered from the landing page cache, no request made."
            : "Not in cache (opened directly): a real page would fetch it here."}
        </AlertDescription>
      </Alert>
      <Link to="/" className="inline-block text-blue-600 hover:underline">
        ← Back to the hub
      </Link>
    </div>
  );
}
