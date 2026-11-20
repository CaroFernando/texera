import { useQuery } from "@tanstack/react-query";
import { Alert, Typography } from "antd";
import { Link } from "react-router";
import { LANDING_SECTIONS, getCurrentUser, hubQueries, paths, type EntityType } from "@exp/shared";
import { BrowseSection } from "../components/BrowseSection";

function CountLink({ type, label }: { type: EntityType; label: string }) {
  const { data } = useQuery(hubQueries.count(type));
  return (
    <Link to={paths.hubResults(type)}>
      {data ?? 0} {label}
    </Link>
  );
}

function Section({ index }: { index: number }) {
  const s = LANDING_SECTIONS[index];
  const uid = getCurrentUser()?.uid;
  // Both workflow sections use the same query key, so this is one request.
  const { data, isPending, error } = useQuery(hubQueries.tops(s.type, s.actions, uid));
  if (error) return <Alert className="mx-5 my-2" type="error" showIcon title={`${s.title}: ${error.message}`} />;
  return <BrowseSection title={s.title} entries={data?.[s.action]} loading={isPending} currentUid={uid} />;
}

export function LandingPage() {
  return (
    <div className="flex w-full flex-col items-center px-4 lg:px-[133px]">
      <div className="mt-5 w-full max-w-[1400px] py-5">
        <div className="max-w-[500px]">
          <Typography.Title className="!m-0 !text-[40px] !font-bold">Texera Hub</Typography.Title>
          <p className="mb-5 text-[13px] font-light text-gray-500">
            Join our community to explore public workflows, collaborate with others, and enhance your data analytics
            capabilities. Access <CountLink type="workflow" label="workflows" />,{" "}
            <CountLink type="dataset" label="datasets" /> and <CountLink type="model" label="models" /> provided by
            Texera and our community.
          </p>
        </div>
      </div>
      <div className="w-full max-w-[1400px]">
        {LANDING_SECTIONS.map((s, i) => (
          <Section key={s.title} index={i} />
        ))}
      </div>
    </div>
  );
}
