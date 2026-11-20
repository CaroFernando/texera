import { Link } from "@tanstack/solid-router";
import { buttonVariants } from "@/components/ui";

export function NotFoundPage() {
  return (
    <div class="flex flex-col items-center gap-4 py-24 text-center">
      <p class="text-6xl font-bold text-muted-foreground">404</p>
      <h2 class="text-xl">Page not found</h2>
      <Link to="/" class={buttonVariants()}>
        Back to the hub
      </Link>
    </div>
  );
}
