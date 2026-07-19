'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

type CinematicScrollVariant = 'dialog' | 'compact' | 'spellbook' | 'surface' | 'hud';

interface CinematicScrollShellProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  contentClassName?: string;
  variant?: CinematicScrollVariant;
}

const CinematicScrollShell = forwardRef<HTMLElement, CinematicScrollShellProps>(function CinematicScrollShell(
  {
    children,
    className = '',
    contentClassName = '',
    variant = 'dialog',
    style,
    ...props
  },
  ref,
) {
  const position = className.split(/\s+/).includes('fixed')
    ? 'fixed'
    : className.split(/\s+/).includes('absolute')
      ? 'absolute'
      : className.split(/\s+/).includes('sticky')
        ? 'sticky'
        : undefined;

  return (
    <section
      ref={ref}
      className={`cinematic-scroll-shell cinematic-scroll-shell-${variant} ${className}`.trim()}
      style={position ? { ...style, position } : style}
      {...props}
    >
      <div className={`cinematic-scroll-content ${contentClassName}`.trim()}>
        {children}
      </div>
    </section>
  );
});

export default CinematicScrollShell;
