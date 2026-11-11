import React from "react";

type Variant = "default" | "primary" | "gold" | "success" | "warn" | "danger";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variantClass: Record<Variant, string> = {
  default: "be-badge--default",
  primary: "be-badge--primary",
  gold: "be-badge--gold",
  success: "be-badge--success",
  warn: "be-badge--warn",
  danger: "be-badge--danger",
};

export const Badge: React.FC<BadgeProps> = ({
  variant = "default",
  className = "",
  children,
  ...rest
}) => (
  <span className={`be-badge ${variantClass[variant]} ${className}`.trim()} {...rest}>
    {children}
  </span>
);

export default Badge;
