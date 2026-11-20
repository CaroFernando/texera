// shadcn-style components for Solid, ported by hand from the ones the shadcn
// CLI generated for variants B/C (same class strings, Nova preset). Where
// shadcn/ui uses Radix, these use Kobalte (Image, Alert); where it uses plain
// elements, so do these. This mirrors what shadcn-solid ships, but the
// shadcn-solid CLI itself was not run for this experiment (see README).
import { Alert as KAlert } from "@kobalte/core/alert";
import { Image } from "@kobalte/core/image";
import { cva, type VariantProps } from "class-variance-authority";
import { splitProps, type ComponentProps } from "solid-js";
import { cn } from "@/lib/utils";

// --- card -------------------------------------------------------------------
export function Card(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card"
      class={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0",
        local.class
      )}
      {...rest}
    />
  );
}
export function CardContent(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return <div data-slot="card-content" class={cn("px-(--card-spacing)", local.class)} {...rest} />;
}
export function CardFooter(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-footer"
      class={cn("flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)", local.class)}
      {...rest}
    />
  );
}

// --- avatar (Kobalte Image: shows the fallback until the image loads) --------
export function Avatar(props: ComponentProps<"span"> & { src?: string; fallbackClass?: string }) {
  const [local, rest] = splitProps(props, ["class", "src", "fallbackClass", "children"]);
  return (
    <Image
      data-slot="avatar"
      class={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken",
        local.class
      )}
      {...rest}>
      {local.src && (
        <Image.Img src={local.src} referrerPolicy="no-referrer" class="aspect-square size-full rounded-full object-cover" />
      )}
      <Image.Fallback
        class={cn(
          "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground",
          local.fallbackClass
        )}>
        {local.children}
      </Image.Fallback>
    </Image>
  );
}

// --- skeleton / badge / input ------------------------------------------------
export function Skeleton(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return <div data-slot="skeleton" class={cn("animate-pulse rounded-md bg-muted", local.class)} {...rest} />;
}

export function Badge(props: ComponentProps<"span">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <span
      data-slot="badge"
      class={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent bg-secondary px-2 py-0.5 text-xs font-medium whitespace-nowrap text-secondary-foreground",
        local.class
      )}
      {...rest}
    />
  );
}

export function Input(props: ComponentProps<"input">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <input
      data-slot="input"
      class={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
        local.class
      )}
      {...rest}
    />
  );
}

// --- alert (Kobalte Alert: role="alert") ------------------------------------
const alertVariants = cva("group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm", {
  variants: {
    variant: {
      default: "bg-card text-card-foreground",
      destructive: "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Alert(props: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const [local, rest] = splitProps(props, ["class", "variant"]);
  return <KAlert data-slot="alert" class={cn(alertVariants({ variant: local.variant }), local.class)} {...rest} />;
}
export function AlertTitle(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return <div data-slot="alert-title" class={cn("font-medium", local.class)} {...rest} />;
}
export function AlertDescription(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div data-slot="alert-description" class={cn("text-sm text-balance text-muted-foreground", local.class)} {...rest} />
  );
}

// --- button styles (applied to router <Link>s; Solid has no asChild) ---------
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  {
    variants: { variant: { default: "h-8 gap-1.5 bg-primary px-2.5 text-primary-foreground hover:bg-primary/80" } },
    defaultVariants: { variant: "default" },
  }
);

/** shadcn NavigationMenuLink styling, for router links. */
export const navLinkClass =
  "flex items-center gap-2 rounded-lg p-2 text-sm transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";
