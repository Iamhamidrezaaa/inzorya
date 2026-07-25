import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  secondaryActions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  secondaryActions,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8 space-y-4", className)}>
      {breadcrumb ? <div className="text-sm text-muted-foreground">{breadcrumb}</div> : null}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-foreground md:text-[1.75rem]">
            {title}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {(actions || secondaryActions) ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {secondaryActions}
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  icon?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/30 px-8 py-20 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <h2 className="text-[15px] font-medium tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {actionLabel && (onAction || actionHref) ? (
        <div className="mt-7">
          {actionHref ? (
            <Button asChild>
              <a href={actionHref}>{actionLabel}</a>
            </Button>
          ) : (
            <Button onClick={onAction}>{actionLabel}</Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="skeleton-shimmer h-8 w-52 rounded-md bg-muted" />
        <div className="skeleton-shimmer h-4 w-80 max-w-full rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-shimmer h-40 rounded-xl border border-border/60 bg-muted/30"
          />
        ))}
      </div>
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  description?: string;
  reset?: () => void;
};

export function ErrorState({
  title = "Something went wrong",
  description = "This page failed to load. Retry, or return to Home.",
  reset,
}: ErrorStateProps) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-border/80 bg-card px-8 py-20 text-center shadow-xs">
      <h2 className="text-[15px] font-medium tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {reset ? (
        <Button className="mt-7" onClick={reset} variant="outline">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

type DashboardPageProps = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  actions?: ReactNode;
  children?: ReactNode;
};

export function DashboardPage({
  title,
  description,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  emptyActionHref,
  actions,
  children,
}: DashboardPageProps) {
  return (
    <div>
      <PageHeader title={title} description={description} actions={actions} />
      {children ?? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          actionHref={emptyActionHref}
        />
      )}
    </div>
  );
}
