import { For, Show } from "solid-js";
import { useQuery } from "@tanstack/solid-query";
import { Link } from "@tanstack/solid-router";
import { LANDING_SECTIONS, getCurrentUser, hubQueries, type EntityType, type LandingSection } from "@exp/shared";
import { Alert, AlertTitle } from "@/components/ui";
import { BrowseSection } from "@/components/BrowseSection";

function CountLink(props: { type: EntityType; label: string }) {
  const count = useQuery(() => hubQueries.count(props.type));
  return (
    <Link to="/hub/$type/result" params={{ type: props.type }} class="text-blue-600 hover:underline">
      {count.data ?? 0} {props.label}
    </Link>
  );
}

function Section(props: { section: LandingSection }) {
  const uid = getCurrentUser()?.uid;
  // Both workflow sections use the same query key, so this is one request.
  const tops = useQuery(() => hubQueries.tops(props.section.type, props.section.actions, uid));
  return (
    <Show
      when={!tops.error}
      fallback={
        <Alert variant="destructive" class="mx-5 my-2 w-auto">
          <AlertTitle>
            {props.section.title}: {tops.error?.message}
          </AlertTitle>
        </Alert>
      }>
      <BrowseSection
        title={props.section.title}
        entries={tops.data?.[props.section.action]}
        loading={tops.isPending}
        currentUid={uid}
      />
    </Show>
  );
}

export function LandingPage() {
  return (
    <div class="flex w-full flex-col items-center px-4 lg:px-[133px]">
      <div class="mt-5 w-full max-w-[1400px] py-5">
        <div class="max-w-[500px]">
          <h1 class="m-0 text-[40px] font-bold">Texera Hub</h1>
          <p class="mb-5 text-[13px] font-light text-gray-500">
            Join our community to explore public workflows, collaborate with others, and enhance your data analytics
            capabilities. Access <CountLink type="workflow" label="workflows" />,{" "}
            <CountLink type="dataset" label="datasets" /> and <CountLink type="model" label="models" /> provided by
            Texera and our community.
          </p>
        </div>
      </div>
      <div class="w-full max-w-[1400px]">
        <For each={LANDING_SECTIONS}>{s => <Section section={s} />}</For>
      </div>
    </div>
  );
}
