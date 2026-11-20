import { useQuery } from "@tanstack/react-query";
import { Avatar, Card, Skeleton } from "antd";
import { Link } from "react-router";
import { abbreviate, defaultCover, entryLink, formatDate, hubQueries, type HubEntry } from "@exp/shared";

const GRID = "grid w-full max-w-[1350px] grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4";

function Cover({ entry }: { entry: HubEntry }) {
  const { data } = useQuery(hubQueries.cover(entry));
  return (
    <div className="relative flex h-[150px] w-full items-center justify-center overflow-hidden">
      <img
        alt=""
        className="h-full w-full object-cover"
        src={data ?? defaultCover}
        onError={e => (e.currentTarget.src = defaultCover)}
      />
      <Avatar className="!absolute bottom-2.5 left-2.5 !bg-gray-500" gap={4}>
        {entry.id}
      </Avatar>
    </div>
  );
}

function EntityCard({ entry, currentUid }: { entry: HubEntry; currentUid?: number }) {
  return (
    <Link to={entryLink(entry, currentUid)} className="m-2.5 block">
      <Card
        hoverable
        cover={<Cover entry={entry} />}
        className="flex h-full flex-col overflow-hidden !rounded-lg shadow-md transition duration-300 hover:-translate-y-2.5 hover:shadow-xl"
        styles={{ body: { padding: 0, display: "flex", flexDirection: "column", flex: 1 } }}>
        <h1 className="my-2.5 truncate px-4 text-center text-lg">{entry.name}</h1>
        <p className="line-clamp-2 px-4 text-sm text-gray-500">{entry.description || "No description available"}</p>
        <div className="mt-auto flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
          <span className="text-xs text-gray-400">Edited: {formatDate(entry.lastModifiedTime)}</span>
          <Avatar
            className="!bg-gray-500"
            src={entry.ownerAvatar ? <img src={entry.ownerAvatar} referrerPolicy="no-referrer" alt="" /> : undefined}>
            {abbreviate(entry.ownerName)}
          </Avatar>
        </div>
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
              <Card key={i} className="m-2.5" cover={<Skeleton.Node active className="!h-[150px] !w-full" />}>
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            ))
          : entries!.map(e => <EntityCard key={`${e.type}:${e.id}`} entry={e} currentUid={currentUid} />)}
      </div>
    </section>
  );
}
