// Minimal stub for react-resizable-panels used in vitest/jsdom environment.
// Real implementation requires a browser resize observer; in tests we just render children.
// v4 API: Group, Panel, Separator
import React from "react";

export function Group({
  children,
  orientation: _orientation,
  style,
  ...rest
}: React.PropsWithChildren<{ orientation?: string; style?: React.CSSProperties; [key: string]: unknown }>) {
  return (
    <div style={style} data-testid="panel-group" {...rest}>
      {children}
    </div>
  );
}

export function Panel({
  children,
  defaultSize: _defaultSize,
  minSize: _minSize,
  maxSize: _maxSize,
  style,
  ...rest
}: React.PropsWithChildren<{
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  style?: React.CSSProperties;
  [key: string]: unknown;
}>) {
  return (
    <div style={style} data-testid="panel" {...rest}>
      {children}
    </div>
  );
}

export function Separator({
  style,
  className,
  ...rest
}: {
  style?: React.CSSProperties;
  className?: string;
  [key: string]: unknown;
}) {
  return (
    <div
      role="separator"
      data-testid="resize-handle"
      style={style}
      className={className}
      {...rest}
    />
  );
}
