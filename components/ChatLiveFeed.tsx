'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CHAT_FEED_TOAST_INTERVAL_MS,
  getGlobalChatSnapshot,
  registerChatFeedDemand,
  subscribeGlobalChat,
} from '@/lib/chatFeed';

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

function LiveToastLine({ toast }: { toast: LiveToast }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const remaining = toast.createdAt + RECENT_MESSAGE_WINDOW_MS - Date.now();
    const startOpacity = Math.max(0, Math.min(1, remaining / RECENT_MESSAGE_WINDOW_MS));
    if (remaining <= 0 || typeof element.animate !== 'function') {
      element.style.opacity = String(startOpacity);
      return undefined;
    }
    const animation = element.animate(
      [{ opacity: startOpacity }, { opacity: 0 }],
      { duration: remaining, easing: 'linear', fill: 'forwards' },
    );
    return () => animation.cancel();
  }, [toast.createdAt]);

  return (
    <div ref={ref} className="chat-live-toast">
      <span className="chat-live-author">{toast.author}</span>
      <span className="chat-live-text">{toast.text}</span>
    </div>
  );
}

export default function ChatLiveFeed({ enabled = true }: ChatLiveFeedProps) {
  const [toasts, setToasts] = useState<LiveToast[]>([]);

  useEffect(() => {
    if (!enabled) return undefined;

    const seenIds = new Set<string>();
    let bootstrapped = false;

    const processSnapshot = () => {
      const current = getGlobalChatSnapshot();
      if (!current.loaded) return;

      const cutoff = Date.now() - RECENT_MESSAGE_WINDOW_MS;
      const messages = current.messages.filter(message => message.createdAt >= cutoff);

      if (!bootstrapped) {
        messages.forEach(message => seenIds.add(message.id));
        bootstrapped = true;
        return;
      }

      const fresh: LiveToast[] = [];
      messages.forEach(message => {
        if (seenIds.has(message.id)) return;
        seenIds.add(message.id);
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

    processSnapshot();
    const unsubscribe = subscribeGlobalChat(processSnapshot);
    const releaseDemand = registerChatFeedDemand(CHAT_FEED_TOAST_INTERVAL_MS);

    return () => {
      unsubscribe();
      releaseDemand();
    };
  }, [enabled]);

  useEffect(() => {
    if (toasts.length === 0) return undefined;
    const nextExpiry = Math.min(...toasts.map(toast => toast.createdAt + RECENT_MESSAGE_WINDOW_MS));
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setToasts(previous => previous.filter(toast => toast.createdAt + RECENT_MESSAGE_WINDOW_MS > now));
    }, Math.max(0, nextExpiry - Date.now()) + 50);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  if (!enabled || toasts.length === 0) return null;

  return (
    <div className="chat-live-feed" aria-live="polite">
      {toasts.map(toast => <LiveToastLine key={toast.id} toast={toast} />)}
    </div>
  );
}
