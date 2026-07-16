'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocialChatMessages } from '@/lib/auth';

const RECENT_MESSAGE_WINDOW_MS = 60_000;
const MAX_VISIBLE_TOASTS = 6;

interface LiveToast {
  id: string;
  author: string;
  text: string;
  createdAt: number;
}

interface ChatLiveFeedProps {
  enabled?: boolean;
}

export default function ChatLiveFeed({ enabled = true }: ChatLiveFeedProps) {
  const [toasts, setToasts] = useState<LiveToast[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const seenIds = useRef(new Set<string>());
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const poll = () => {
      const cutoff = Date.now() - RECENT_MESSAGE_WINDOW_MS;
      const messages = getSocialChatMessages('global').filter(message => message.createdAt >= cutoff);

      if (!bootstrapped.current) {
        messages.forEach(message => seenIds.current.add(message.id));
        bootstrapped.current = true;
        return;
      }

      const fresh: LiveToast[] = [];

      messages.forEach(message => {
        if (seenIds.current.has(message.id)) return;
        seenIds.current.add(message.id);
        fresh.push({
          id: message.id,
          author: message.author,
          text: message.text,
          createdAt: message.createdAt,
        });
      });

      if (fresh.length > 0) {
        setToasts(previous => [...previous, ...fresh].slice(-MAX_VISIBLE_TOASTS));
      }
    };

    poll();
    const pollInterval = window.setInterval(poll, 900);
    const clockInterval = window.setInterval(() => setNow(Date.now()), 250);

    return () => {
      window.clearInterval(pollInterval);
      window.clearInterval(clockInterval);
    };
  }, [enabled]);

  const visibleToasts = toasts.filter(toast => toast.createdAt >= now - RECENT_MESSAGE_WINDOW_MS);

  if (!enabled || visibleToasts.length === 0) return null;

  return (
    <div className="chat-live-feed" aria-live="polite">
      {visibleToasts.map(toast => {
        const remaining = toast.createdAt + RECENT_MESSAGE_WINDOW_MS - now;
        const opacity = Math.max(0, Math.min(1, remaining / RECENT_MESSAGE_WINDOW_MS));

        return (
          <div
            key={toast.id}
            className="chat-live-toast"
            style={{ opacity }}
          >
            <span className="chat-live-author">{toast.author}</span>
            <span className="chat-live-text">{toast.text}</span>
          </div>
        );
      })}
    </div>
  );
}
