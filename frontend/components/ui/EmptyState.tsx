import React from "react";
import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = "",
}) => (
  <div className={`be-empty ${className}`.trim()} role="status">
    <Icon size={40} className="be-empty__icon" aria-hidden="true" />
    <h3 className="be-empty__title">{title}</h3>
    {description && <p className="be-empty__desc">{description}</p>}
    {action}
  </div>
);

export default EmptyState;
