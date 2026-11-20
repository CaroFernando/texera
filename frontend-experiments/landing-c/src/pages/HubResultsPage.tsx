import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { hubQueries, pluralLabel } from "@exp/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

// Stub for /hub/$type/result. The route already parsed `type` (invalid → 404)
// and validated `q`, so there is no checking left to do here.
const route = getRouteApi("/hub/$type/result");

export function HubResultsPage() {
  const { type } = route.useParams();
  const { q } = route.useSearch();
  const navigate = route.useNavigate();
  const count = useQuery(hubQueries.count(type));

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-8">
      <h2 className="text-3xl font-semibold">{pluralLabel(type)} on the hub</h2>
      <p className="text-muted-foreground">
        {count.data ?? "…"} public {type}s (count served from the landing page cache when you came from there).
      </p>
      <form
        onSubmit={e => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("q")?.toString() || undefined;
          void navigate({ search: { q: value }, replace: true });
        }}>
        <Input name="q" placeholder={`Search ${type}s`} defaultValue={q} />
      </form>
      <Alert>
        <AlertTitle>Stub page</AlertTitle>
        <AlertDescription>
          {q ? `Would search ${type}s for "${q}".` : "Search results are out of scope for this experiment."}
        </AlertDescription>
      </Alert>
    </div>
  );
}
