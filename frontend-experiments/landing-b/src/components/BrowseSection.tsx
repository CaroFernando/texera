import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { abbreviate, defaultCover, entryLink, formatDate, hubQueries, type HubEntry } from "@exp/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const GRID = "grid w-full max-w-[1350px] grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4";

function Cover({ entry }: { entry: HubEntry }) {
  const { data } = useQuery(hubQueries.cover(entry));
  return (
    <div className="relative h-[150px] w-full overflow-hidden">
      <img
        alt=""
        className="h-full w-full object-cover"
        src={data ?? defaultCover}
        onError={e => (e.currentTarget.src = defaultCover)}
      />
      <Avatar className="absolute bottom-2.5 left-2.5">
        <AvatarFallback className="bg-gray-500 text-white">{entry.id}</AvatarFallback>
      </Avatar>
    </div>
  );
}

function EntityCard({ entry, currentUid }: { entry: HubEntry; currentUid?: number }) {
  return (
    <Link to={entryLink(entry, currentUid)} className="m-2.5 block">
      <Card className="h-full gap-0 pt-0 shadow-md transition duration-300 hover:-translate-y-2.5 hover:shadow-xl">
        <Cover entry={entry} />
        <CardContent className="flex flex-1 flex-col px-4">
          <h1 className="my-2.5 truncate text-center text-lg">{entry.name}</h1>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {entry.description || "No description available"}
          </p>
        </CardContent>
        <CardFooter className="mt-auto justify-between border-t bg-transparent px-4 py-2.5">
          <span className="text-xs text-muted-foreground">Edited: {formatDate(entry.lastModifiedTime)}</span>
          <Avatar>
            {entry.ownerAvatar && <AvatarImage src={entry.ownerAvatar} referrerPolicy="no-referrer" />}
            <AvatarFallback className="bg-gray-500 text-[10px] text-white">{abbreviate(entry.ownerName)}</AvatarFallback>
          </Avatar>
        </CardFooter>
      </Card>
    </Link>
  );
}

export function BrowseSection(props: { title: string; entries?: HubEntry[]; loading: boolean; currentUid?: number }) {
  const { title, entries, loading, currentUid } = props;
  // Like the Angular section: render nothing for an empty bucket.
  if (!loading && !entries?.length) return null;
  return (
    <section className="flex w-full flex-col items-start p-5">
      <h2 className="mb-5 w-full pl-2.5 text-2xl">{title}</h2>
      <div className={GRID}>
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <Card key={i} className="m-2.5 gap-3 pt-0">
                <Skeleton className="h-[150px] w-full rounded-none" />
                <CardContent className="space-y-2 px-4">
                  <Skeleton className="mx-auto h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </CardContent>
              </Card>
            ))
          : entries!.map(e => <EntityCard key={`${e.type}:${e.id}`} entry={e} currentUid={currentUid} />)}
      </div>
    </section>
  );
}
