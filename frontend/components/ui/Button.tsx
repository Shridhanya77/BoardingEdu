import React from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "className"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  href?: string;
  external?: boolean;
  className?: string;
}

const variantClass: Record<Variant, string> = {
  primary: "be-btn--primary",
  secondary: "be-btn--secondary",
  ghost: "be-btn--ghost",
  danger: "be-btn--danger",
};

const sizeClass: Record<Size, string> = {
  sm: "be-btn--sm",
  md: "be-btn--md",
  lg: "be-btn--lg",
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  type = "button",
  href,
  external = false,
  children,
  className = "",
  ...rest
}) => {
  const classes = `be-btn ${variantClass[variant]} ${sizeClass[size]} ${className}`.trim();
  const isDisabled = disabled || loading;

  if (href) {
    if (external || href.startsWith("http")) {
      return (
        <a
          href={href}
          className={classes}
          aria-disabled={isDisabled || undefined}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          {...rest}
        >
          {loading && <span className="be-btn__spinner" aria-hidden="true" />}
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} aria-disabled={isDisabled || undefined} {...rest}>
        {loading && <span className="be-btn__spinner" aria-hidden="true" />}
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="be-btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
};

export default Button;
