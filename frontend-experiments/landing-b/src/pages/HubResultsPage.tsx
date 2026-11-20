import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router";
import { hubQueries, isEntityType, pluralLabel } from "@exp/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { NotFoundPage } from "./NotFoundPage";

// Stub for /hub/:type/result. React Router hands params and search params over
// as untyped strings, so the page validates them itself.
export function HubResultsPage() {
  const { type = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const count = useQuery({ ...hubQueries.count(isEntityType(type) ? type : "workflow"), enabled: isEntityType(type) });

  if (!isEntityType(type)) return <NotFoundPage />;
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-8">
      <h2 className="text-3xl font-semibold">{pluralLabel(type)} on the hub</h2>
      <p className="text-muted-foreground">
        {count.data ?? "…"} public {type}s (count served from the landing page cache when you came from there).
      </p>
      <form
        onSubmit={e => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("q")?.toString() ?? "";
          setSearchParams(value ? { q: value } : {}, { replace: true });
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
