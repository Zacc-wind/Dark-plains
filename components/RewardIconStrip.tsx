'use client';

import Image from 'next/image';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RewardChip } from '@/lib/rewardDisplay';

interface RewardIconStripProps {
  chips: RewardChip[];
  emptyLabel?: string;
  className?: string;
}

type PopoverSide = 'left' | 'right';

export default function RewardIconStrip({
  chips,
  emptyLabel = 'No rewards',
  className = '',
}: RewardIconStripProps) {
  const [activeChip, setActiveChip] = useState<RewardChip | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [side, setSide] = useState<PopoverSide>('right');
  const hideTimer = useRef<number | null>(null);
  const portalTarget = typeof document === 'undefined' ? null : document.body;

  const clearHideTimer = () => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const updateAnchor = useCallback((node: HTMLElement) => {
    const rect = node.getBoundingClientRect();
    const gap = 12;
    const popoverWidth = 248;
    const roomRight = window.innerWidth - rect.right;
    const roomLeft = rect.left;
    const nextSide: PopoverSide = roomRight >= popoverWidth + gap || roomRight >= roomLeft
      ? 'right'
      : 'left';

    setSide(nextSide);
    setAnchorRect(rect);
  }, []);

  const showChip = (chip: RewardChip, node: HTMLElement) => {
    clearHideTimer();
    setActiveChip(chip);
    updateAnchor(node);
  };

  const scheduleHide = () => {
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => {
      setActiveChip(null);
      setAnchorRect(null);
      hideTimer.current = null;
    }, 80);
  };

  const keepOpen = () => {
    clearHideTimer();
  };

  useLayoutEffect(() => {
    if (!activeChip) return;
    const handle = () => {
      const node = document.querySelector(`[data-reward-chip-id="${activeChip.id}"]`);
      if (node instanceof HTMLElement) updateAnchor(node);
    };
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [activeChip, updateAnchor]);

  useEffect(() => () => clearHideTimer(), []);

  if (chips.length === 0) {
    return <span className="reward-icon-strip-empty ui-faint text-[10px] font-bold">{emptyLabel}</span>;
  }

  const popoverCoords = anchorRect
    ? {
        top: anchorRect.top + anchorRect.height / 2,
        left: side === 'right' ? anchorRect.right + 12 : anchorRect.left - 12,
      }
    : null;

  return (
    <>
      <div className={`reward-icon-grid ${className}`.trim()} role="list" aria-label="Rewards">
        {chips.map(chip => (
          <div
            key={chip.id}
            data-reward-chip-id={chip.id}
            role="listitem"
            className="reward-icon-anchor"
            onMouseEnter={(event) => showChip(chip, event.currentTarget)}
            onMouseLeave={scheduleHide}
            onFocus={(event) => showChip(chip, event.currentTarget)}
            onBlur={scheduleHide}
          >
            <div className={`reward-icon-tile rounded border ${chip.rarityClass || ''}`} tabIndex={-1}>
              <span className="reward-icon-image overflow-hidden rounded">
                <Image
                  src={chip.iconPath}
                  alt=""
                  width={34}
                  height={34}
                  className="object-contain p-0.5"
                  style={{ imageRendering: 'pixelated' }}
                  unoptimized
                />
              </span>
              {chip.quantity !== undefined && (
                <span className="reward-icon-quantity">{chip.quantity}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {activeChip && popoverCoords && portalTarget && createPortal(
        <RewardHoverPopover
          chip={activeChip}
          side={side}
          coords={popoverCoords}
          onMouseEnter={keepOpen}
          onMouseLeave={scheduleHide}
        />,
        portalTarget,
      )}
    </>
  );
}

function RewardHoverPopover({
  chip,
  side,
  coords,
  onMouseEnter,
  onMouseLeave,
}: {
  chip: RewardChip;
  side: PopoverSide;
  coords: { top: number; left: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      className={`reward-hover-popover reward-hover-popover-${side} rounded border ${chip.rarityClass || ''}`}
      role="tooltip"
      style={{ top: coords.top, left: coords.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <RewardHoverPopoverContent chip={chip} />
    </div>
  );
}

export function RewardHoverPopoverContent({ chip }: { chip: RewardChip }) {
  return (
    <>
      <div className="reward-hover-popover-hero">
        <span className="reward-hover-popover-icon">
          <Image
            src={chip.iconPath}
            alt=""
            width={56}
            height={56}
            className="object-contain"
            style={{ imageRendering: 'pixelated' }}
            unoptimized
          />
        </span>
        <div className="reward-hover-popover-heading">
          <div className="reward-hover-popover-title fantasy-heading">{chip.title}</div>
          {chip.meta && <div className="reward-hover-popover-meta arcane-label">{chip.meta}</div>}
          {chip.quantity !== undefined && (
            <div className="reward-hover-popover-amount ui-value">×{chip.quantity}</div>
          )}
        </div>
      </div>
      {chip.description && (
        <p className="reward-hover-popover-copy ui-muted">{chip.description}</p>
      )}
    </>
  );
}
