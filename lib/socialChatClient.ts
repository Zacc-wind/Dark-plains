import {
  getSocialChatMessages,
  sendSocialChatMessage,
  type SocialChatChannel,
  type SocialChatMessage,
  type User,
} from './auth';

export const MAX_VISIBLE_CHAT_HISTORY = 50;

type ChatUser = Pick<User, 'username' | 'social'> | null | undefined;

function normalizeMessages(value: unknown): SocialChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap(message => {
    if (!message || typeof message !== 'object') return [];
    const candidate = message as Partial<SocialChatMessage>;
    if (
      typeof candidate.id !== 'string'
      || candidate.channel !== 'global'
      || typeof candidate.author !== 'string'
      || typeof candidate.text !== 'string'
      || !Number.isFinite(candidate.createdAt)
    ) {
      return [];
    }

    return [{
      id: candidate.id,
      channel: 'global' as const,
      author: candidate.author,
      text: candidate.text.slice(0, 180),
      createdAt: Number(candidate.createdAt),
    }];
  }).slice(-MAX_VISIBLE_CHAT_HISTORY);
}

export async function fetchSharedChatHistory(
  channel: SocialChatChannel,
  user?: ChatUser,
): Promise<SocialChatMessage[]> {
  const localMessages = getSocialChatMessages(channel, user).slice(-MAX_VISIBLE_CHAT_HISTORY);
  if (channel === 'party') return localMessages;

  try {
    const response = await fetch('/api/chat', { cache: 'no-store' });
    const payload = await response.json() as { ok?: boolean; messages?: unknown };
    if (!response.ok || !payload.ok) return localMessages;
    return normalizeMessages(payload.messages);
  } catch {
    return localMessages;
  }
}

export async function sendSharedChatMessage(
  channel: SocialChatChannel,
  text: string,
): Promise<{ success: boolean; message?: string; error?: string; chat?: SocialChatMessage }> {
  if (channel === 'party') return sendSocialChatMessage(channel, text);

  const trimmedText = text.trim().slice(0, 180);
  if (!trimmedText) return { success: false, error: 'Enter a message.' };

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmedText }),
    });
    const payload = await response.json() as { ok?: boolean; error?: string; message?: unknown };
    const [chat] = normalizeMessages(payload.message ? [payload.message] : []);
    if (!response.ok || !payload.ok || !chat) {
      if (response.status === 401 || response.status === 503) {
        return sendSocialChatMessage(channel, trimmedText);
      }
      return { success: false, error: payload.error || 'Message failed.' };
    }
    return { success: true, chat };
  } catch {
    return sendSocialChatMessage(channel, trimmedText);
  }
}
