import React from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface EmptyStateLink {
  label: string;
  href: string;
  meta?: string;
}

export interface EmptyStateLinkGroup {
  label: string;
  links: EmptyStateLink[];
  /** "chips" renders compact pills; "list" renders stacked text links (long labels). */
  layout?: "chips" | "list";
}

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Non-interactive guidance, e.g. "Remove a filter to widen the results". */
  hints?: React.ReactNode[];
  /** Labelled groups of navigational suggestions (nearby cities, related guides…). */
  linkGroups?: EmptyStateLinkGroup[];
  /** Frame style. "panel" reuses the listing `state-panel` card; "plain" uses `be-empty`. */
  variant?: "plain" | "panel";
}

/**
 * Shared empty state used across discovery surfaces. Supports optional hints and
 * labelled link groups so a no-result screen can suggest nearby places, alternate
 * searches and related guides without repeating markup.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = "",
  hints,
  linkGroups,
  variant = "plain",
}) => {
  const panel = variant === "panel";
  const visibleGroups = (linkGroups ?? []).filter((group) => group.links.length > 0);
  return (
    <div
      className={panel ? `state-panel state-panel--empty ${className}`.trim() : `be-empty ${className}`.trim()}
      role="status"
    >
      <Icon size={panel ? 25 : 40} className={panel ? undefined : "be-empty__icon"} aria-hidden="true" />
      <h3 className={panel ? undefined : "be-empty__title"}>{title}</h3>
      {description && <p className={panel ? undefined : "be-empty__desc"}>{description}</p>}
      {hints && hints.length > 0 ? (
        <ul className="be-empty__hints">
          {hints.map((hint, index) => (
            <li key={index}>{hint}</li>
          ))}
        </ul>
      ) : null}
      {action}
      {visibleGroups.map((group) => (
        <nav
          className={`be-empty__links be-empty__links--${group.layout ?? "chips"}`}
          key={group.label}
          aria-label={group.label}
        >
          <span className="be-empty__links-label">{group.label}</span>
          <ul>
            {group.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>
                  {link.label}
                  {link.meta ? <span className="be-empty__link-meta">{link.meta}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
  );
};

export default EmptyState;
