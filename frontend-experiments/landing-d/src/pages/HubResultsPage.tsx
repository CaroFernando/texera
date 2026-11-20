import { useQuery } from "@tanstack/solid-query";
import { getRouteApi } from "@tanstack/solid-router";
import { hubQueries, pluralLabel } from "@exp/shared";
import { Alert, AlertDescription, AlertTitle, Input } from "@/components/ui";

// Stub for /hub/$type/result. The route already parsed `type` (invalid → 404)
// and validated `q`. In Solid, params/search are accessors: call them to read.
const route = getRouteApi("/hub/$type/result");

export function HubResultsPage() {
  const params = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const count = useQuery(() => hubQueries.count(params().type));

  return (
    <div class="mx-auto max-w-3xl space-y-4 p-8">
      <h2 class="text-3xl font-semibold">{pluralLabel(params().type)} on the hub</h2>
      <p class="text-muted-foreground">
        {count.data ?? "…"} public {params().type}s (count served from the landing page cache when you came from
        there).
      </p>
      <form
        onSubmit={e => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("q")?.toString() || undefined;
          void navigate({ search: { q: value }, replace: true });
        }}>
        <Input name="q" placeholder={`Search ${params().type}s`} value={search().q ?? ""} />
      </form>
      <Alert>
        <AlertTitle>Stub page</AlertTitle>
        <AlertDescription>
          {search().q
            ? `Would search ${params().type}s for "${search().q}".`
            : "Search results are out of scope for this experiment."}
        </AlertDescription>
      </Alert>
    </div>
  );
}
