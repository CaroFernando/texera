import { For, Show } from "solid-js";
import { useQuery } from "@tanstack/solid-query";
import { Link } from "@tanstack/solid-router";
import { abbreviate, defaultCover, entryLink, formatDate, hubQueries, type HubEntry } from "@exp/shared";
import { Avatar, Card, CardContent, CardFooter, Skeleton } from "@/components/ui";

const GRID = "grid w-full max-w-[1350px] grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4";

function Cover(props: { entry: HubEntry }) {
  // Solid: options are a function, so the query re-keys if props.entry changes.
  const cover = useQuery(() => hubQueries.cover(props.entry));
  return (
    <div class="relative h-[150px] w-full overflow-hidden">
      <img
        alt=""
        class="h-full w-full object-cover"
        src={cover.data ?? defaultCover}
        onError={e => (e.currentTarget.src = defaultCover)}
      />
      <Avatar class="absolute bottom-2.5 left-2.5" fallbackClass="bg-gray-500 text-white">
        {props.entry.id}
      </Avatar>
    </div>
  );
}

/** Same rule as the shared entryLink, expressed as a typed route + params. */
function linkTo(entry: HubEntry, currentUid?: number) {
  const params = { type: entry.type, id: entry.id };
  return entryLink(entry, currentUid).startsWith("/user/")
    ? ({ to: "/user/$type/$id", params } as const)
    : ({ to: "/hub/$type/result/detail/$id", params } as const);
}

function EntityCard(props: { entry: HubEntry; currentUid?: number }) {
  return (
    <Link {...linkTo(props.entry, props.currentUid)} class="m-2.5 block">
      <Card class="h-full gap-0 pt-0 shadow-md transition duration-300 hover:-translate-y-2.5 hover:shadow-xl">
        <Cover entry={props.entry} />
        <CardContent class="flex flex-1 flex-col px-4">
          <h1 class="my-2.5 truncate text-center text-lg">{props.entry.name}</h1>
          <p class="line-clamp-2 text-sm text-muted-foreground">
            {props.entry.description || "No description available"}
          </p>
        </CardContent>
        <CardFooter class="mt-auto justify-between border-t bg-transparent px-4 py-2.5">
          <span class="text-xs text-muted-foreground">Edited: {formatDate(props.entry.lastModifiedTime)}</span>
          <Avatar src={props.entry.ownerAvatar} fallbackClass="bg-gray-500 text-[10px] text-white">
            {abbreviate(props.entry.ownerName)}
          </Avatar>
        </CardFooter>
      </Card>
    </Link>
  );
}

export function BrowseSection(props: { title: string; entries?: HubEntry[]; loading: boolean; currentUid?: number }) {
  // Like the Angular section: render nothing for an empty bucket.
  return (
    <Show when={props.loading || props.entries?.length}>
      <section class="flex w-full flex-col items-start p-5">
        <h2 class="mb-5 w-full pl-2.5 text-2xl">{props.title}</h2>
        <div class={GRID}>
          <Show
            when={!props.loading}
            fallback={
              <For each={[0, 1, 2, 3]}>
                {() => (
                  <Card class="m-2.5 gap-3 pt-0">
                    <Skeleton class="h-[150px] w-full rounded-none" />
                    <CardContent class="space-y-2 px-4">
                      <Skeleton class="mx-auto h-5 w-2/3" />
                      <Skeleton class="h-4 w-full" />
                      <Skeleton class="h-4 w-5/6" />
                    </CardContent>
                  </Card>
                )}
              </For>
            }>
            <For each={props.entries}>{e => <EntityCard entry={e} currentUid={props.currentUid} />}</For>
          </Show>
        </div>
      </section>
    </Show>
  );
}
