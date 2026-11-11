import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  header,
  footer,
  children,
  className = "",
  ...rest
}) => (
  <div className={`be-card ${className}`.trim()} {...rest}>
    {header && <div className="be-card__header">{header}</div>}
    <div className="be-card__body">{children}</div>
    {footer && <div className="be-card__footer">{footer}</div>}
  </div>
);

export default Card;
