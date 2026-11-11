import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  rounded?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  rounded = false,
  className = "",
  style,
  ...rest
}) => (
  <div
    className={`be-skeleton ${rounded ? "" : ""} ${className}`.trim()}
    style={{
      width: width ?? "100%",
      height: height ?? 16,
      borderRadius: rounded ? "999px" : undefined,
      ...style,
    }}
    aria-hidden="true"
    {...rest}
  />
);

export default Skeleton;
