import { useQuery } from "@tanstack/react-query";
import { Alert, Input, Typography } from "antd";
import { useParams, useSearchParams } from "react-router";
import { hubQueries, isEntityType, pluralLabel } from "@exp/shared";
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
    <div className="mx-auto max-w-3xl p-8">
      <Typography.Title level={2}>{pluralLabel(type)} on the hub</Typography.Title>
      <Typography.Paragraph type="secondary">{count.data ?? "…"} public {type}s (count served from the landing page cache when you came from there).</Typography.Paragraph>
      <Input.Search
        placeholder={`Search ${type}s`}
        defaultValue={q}
        onSearch={value => setSearchParams(value ? { q: value } : {}, { replace: true })}
        className="mb-4"
      />
      <Alert type="info" showIcon title="Stub page" description={q ? `Would search ${type}s for "${q}".` : "Search results are out of scope for this experiment."} />
    </div>
  );
}
