'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

type CinematicScrollVariant = 'dialog' | 'compact' | 'spellbook';

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
    ...props
  },
  ref,
) {
  return (
    <section
      ref={ref}
      className={`cinematic-scroll-shell cinematic-scroll-shell-${variant} ${className}`.trim()}
      {...props}
    >
      <div className={`cinematic-scroll-content ${contentClassName}`.trim()}>
        {children}
      </div>
    </section>
  );
});

export default CinematicScrollShell;
