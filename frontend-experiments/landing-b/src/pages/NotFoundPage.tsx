import { Link } from "react-router";
import { paths } from "@exp/shared";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-6xl font-bold text-muted-foreground">404</p>
      <h2 className="text-xl">Page not found</h2>
      <Button asChild>
        <Link to={paths.home}>Back to the hub</Link>
      </Button>
    </div>
  );
}
