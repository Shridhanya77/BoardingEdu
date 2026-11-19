import Skeleton from "@/components/ui/Skeleton";

export function PanelRowsSkeleton({
  rows = 3,
  label = "Loading",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div className="pd-skel-list" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div className="pd-skel-row" key={index} aria-hidden>
          <Skeleton width={40} height={40} rounded />
          <div>
            <Skeleton height={14} width="46%" />
            <Skeleton height={11} width="72%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileFormSkeleton() {
  return (
    <div className="pd-skel-form" role="status" aria-label="Loading your profile">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} aria-hidden>
          <Skeleton height={12} width={90} />
          <Skeleton height={40} />
        </div>
      ))}
    </div>
  );
}

export function ParentOverviewSkeleton() {
  return (
    <div className="pd-skel" role="status" aria-label="Loading your dashboard">
      <div className="pd-skel-stats" aria-hidden>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} height={84} />
        ))}
      </div>
      <div className="dash-panel">
        <PanelRowsSkeleton rows={3} label="Loading your next steps" />
      </div>
      <div className="dash-panel">
        <PanelRowsSkeleton rows={3} label="Loading recent schools" />
      </div>
    </div>
  );
}

export function FeaturedSchoolsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="featured-cards" role="status" aria-label="Loading featured schools">
      {Array.from({ length: count }, (_, index) => (
        <article className="featured-card featured-card--skeleton" key={index} aria-hidden>
          <Skeleton height={116} style={{ borderRadius: 0 }} />
          <div className="featured-card--skeleton__body">
            <Skeleton height={18} width="78%" />
            <Skeleton height={12} width="48%" />
            <Skeleton height={12} width="64%" />
            <Skeleton height={36} />
          </div>
        </article>
      ))}
    </div>
  );
}
