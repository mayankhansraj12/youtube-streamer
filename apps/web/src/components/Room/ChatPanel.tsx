import { useEffect, useRef, useState, type FormEvent, type UIEvent } from 'react';
import { FaPaperPlane } from 'react-icons/fa';
import { LIMITS } from '../../config';
import { getErrorMessage } from '../../lib/api';
import { formatTimeOfDay } from '../../lib/format';
import { splitLinks } from '../../lib/links';
import type { ChatItem } from '../../types';

interface ChatPanelProps {
  items: ChatItem[];
  selfUserId: string;
  onSend: (text: string) => Promise<void>;
}

const LOW_ALLOWANCE = 100;

/** Room chat. Auto-scrolls only while the reader is at the bottom, so reading history is never interrupted. */
export default function ChatPanel({ items, selfUserId, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    const list = listRef.current;
    if (list && pinnedRef.current) list.scrollTop = list.scrollHeight;
  }, [items]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    pinnedRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    try {
      await onSend(text);
      setDraft('');
      pinnedRef.current = true;
    } catch (caught) {
      setError(getErrorMessage(caught, 'Your message could not be sent.'));
    } finally {
      setSending(false);
    }
  };

  const remaining = LIMITS.maxMessageLength - draft.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={listRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4"
      >
        {items.length === 0 && (
          <p className="pt-10 text-center text-sm text-white/40">No messages yet. Say hello to the room.</p>
        )}

        {items.map((item, index) => {
          if (item.kind === 'system') {
            return (
              <p key={item.id} className="py-1 text-center text-xs italic text-white/40">
                {item.text}
              </p>
            );
          }

          const mine = item.userId === selfUserId;
          const previous = items[index - 1];
          const startsGroup = !previous || previous.kind !== 'message' || previous.userId !== item.userId;

          return (
            <div key={item.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {startsGroup && (
                <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-white/50">
                  <span className="font-semibold uppercase tracking-wide">{mine ? 'You' : item.username}</span>
                  <time dateTime={new Date(item.createdAt).toISOString()}>{formatTimeOfDay(item.createdAt)}</time>
                </div>
              )}
              <div
                className={`max-w-[85%] break-words rounded-2xl px-3.5 py-2 text-sm ${
                  mine
                    ? 'rounded-tr-sm bg-white font-medium text-black'
                    : 'rounded-tl-sm border border-white/5 bg-brand-black/60 text-white'
                }`}
              >
                {splitLinks(item.text).map((segment, segmentIndex) =>
                  segment.type === 'link' ? (
                    <a
                      key={segmentIndex}
                      href={segment.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all underline underline-offset-2"
                    >
                      {segment.value}
                    </a>
                  ) : (
                    <span key={segmentIndex} className="whitespace-pre-wrap">
                      {segment.value}
                    </span>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="border-t border-white/5 p-3">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <div className="flex gap-2">
          <input
            id="chat-input"
            value={draft}
            maxLength={LIMITS.maxMessageLength}
            autoComplete="off"
            placeholder="Send a message"
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError(null);
            }}
            className="min-w-0 flex-1 rounded-xl border border-white/5 bg-brand-black/60 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-brand-cyan/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || draft.trim() === ''}
            aria-label="Send message"
            className="flex shrink-0 items-center justify-center rounded-xl bg-white px-4 text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FaPaperPlane size={13} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-1 flex min-h-4 justify-between text-[11px]">
          <span role="alert" className="text-red-400">
            {error ?? ''}
          </span>
          {remaining <= LOW_ALLOWANCE && (
            <span className={remaining < 20 ? 'text-amber-300' : 'text-white/40'}>{remaining} characters left</span>
          )}
        </div>
      </form>
    </div>
  );
}
