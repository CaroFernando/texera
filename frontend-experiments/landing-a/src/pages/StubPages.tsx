import { Alert, Typography } from "antd";
import { useSearchParams } from "react-router";

// Stubs for the shell's other links, so every sidebar/nav entry lands somewhere.

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <Typography.Title>About Texera</Typography.Title>
      <Alert type="info" showIcon title="Stub page" description="The About page is out of scope for this experiment." />
    </div>
  );
}

export function LoginPage() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <Typography.Title level={2}>Sign in</Typography.Title>
      <Alert
        type="info"
        showIcon
        title="Stub page"
        description="Sign in through the Angular app (localhost:4200), then copy its access_token from localStorage into this origin's localStorage and reload."
      />
    </div>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  return (
    <div className="mx-auto max-w-3xl p-8">
      <Typography.Title level={2}>Search</Typography.Title>
      <Alert type="info" showIcon title="Stub page" description={q ? `Would search everything for "${q}".` : "Type in the search box and press Enter."} />
    </div>
  );
}
