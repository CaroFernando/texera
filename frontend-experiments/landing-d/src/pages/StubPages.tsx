import type { JSX } from "solid-js";
import { getRouteApi } from "@tanstack/solid-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui";

// Stubs for the shell's other links, so every sidebar/nav entry lands somewhere.

function Stub(props: { title: string; children: JSX.Element }) {
  return (
    <div class="mx-auto max-w-3xl space-y-4 p-8">
      <h2 class="text-3xl font-semibold">{props.title}</h2>
      <Alert>
        <AlertTitle>Stub page</AlertTitle>
        <AlertDescription>{props.children}</AlertDescription>
      </Alert>
    </div>
  );
}

export const AboutPage = () => <Stub title="About Texera">The About page is out of scope for this experiment.</Stub>;

export const LoginPage = () => (
  <Stub title="Sign in">
    Sign in through the Angular app (localhost:4200), then copy its access_token from localStorage into this
    origin's localStorage and reload.
  </Stub>
);

const searchRoute = getRouteApi("/search");

export function SearchPage() {
  const search = searchRoute.useSearch(); // validated on the route: { q?: string }
  return (
    <Stub title="Search">
      {search().q ? `Would search everything for "${search().q}".` : "Type in the search box and press Enter."}
    </Stub>
  );
}
