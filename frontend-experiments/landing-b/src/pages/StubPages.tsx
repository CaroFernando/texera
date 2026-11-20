import { useSearchParams } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Stubs for the shell's other links, so every sidebar/nav entry lands somewhere.

function Stub({ title, children }: { title: string; children: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-8">
      <h2 className="text-3xl font-semibold">{title}</h2>
      <Alert>
        <AlertTitle>Stub page</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
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

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  return <Stub title="Search">{q ? `Would search everything for "${q}".` : "Type in the search box and press Enter."}</Stub>;
}
