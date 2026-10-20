import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Bot, MessageCircle, RefreshCw, Send, UserRound } from "lucide-react";
import { Button } from "../components/ui/button";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface StudyBuddyChatProps {
  busy: boolean;
  error: string;
  onSend: (messages: ChatMessage[]) => Promise<string>;
}

export default function StudyBuddyChat({ busy, error, onSend }: StudyBuddyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingMessage, setPendingMessage] = useState<ChatMessage | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [failedMessages, setFailedMessages] = useState<ChatMessage[] | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, sendError]);

  async function send(nextMessages: ChatMessage[]) {
    setSending(true);
    setSendError("");
    setFailedMessages(null);
    setPendingMessage(nextMessages[nextMessages.length - 1] ?? null);
    try {
      const reply = await onSend(nextMessages);
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
      setPendingMessage(null);
      setDraft("");
    } catch (sendFailure) {
      setFailedMessages(nextMessages);
      setSendError(sendFailure instanceof Error ? sendFailure.message : "Your message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending || busy || content.length > 2000) return;
    void send(buildRecentContext(messages, content));
  }

  const hasMessages = messages.length > 0 || pendingMessage !== null;
  return (
    <main className="chat-page">
      <section className="dashboard-hero chat-hero">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" />{"A FRIENDLY AZ-900 STUDY PARTNER"}</div>
          <h1>{"Ask, explore, understand."}</h1>
          <p>{"Ask about an AZ-900 concept. Your study buddy keeps answers beginner-friendly and focused on the exam."}</p>
        </div>
      </section>

      <section className="chat-panel" aria-label={"Study buddy conversation"}>
        <div className="chat-panel-heading">
          <span className="chat-avatar"><Bot size={20} /></span>
          <div><strong>{"Your study buddy"}</strong><span>{"Answers use clear, beginner-friendly English."}</span></div>
          <span className="chat-topic-chip"><MessageCircle size={14} />AZ-900</span>
        </div>
        <div className="chat-messages" aria-live="polite" aria-relevant="additions text">
          {!hasMessages && (
            <div className="chat-welcome">
              <span className="chat-welcome-icon"><MessageCircle size={21} /></span>
              <p>{"Hello! Ask me about an AZ-900 concept, and we’ll work through it one small step at a time."}</p>
            </div>
          )}
          {messages.map((message, index) => (
            <article className={`chat-message ${message.role === "user" ? "chat-message-user" : "chat-message-buddy"}`} key={`${index}-${message.role}`}>
              <span className="message-avatar" aria-hidden="true">{message.role === "user" ? <UserRound size={15} /> : <Bot size={15} />}</span>
              <p>{message.content}</p>
            </article>
          ))}
          {pendingMessage && (
            <article className="chat-message chat-message-user" key="pending-user">
              <span className="message-avatar" aria-hidden="true"><UserRound size={15} /></span>
              <p>{pendingMessage.content}</p>
            </article>
          )}
          {sending && <div className="chat-typing" role="status"><span /><span /><span />{"Thinking through that…"}</div>}
          <div ref={bottomRef} />
        </div>
        {(sendError || error) && (
          <div className="chat-error" role="alert">
            <p>{sendError || error}</p>
            {failedMessages && <Button variant="secondary" disabled={sending || busy} onClick={() => void send(failedMessages)}><RefreshCw size={14} />{"Try again"}</Button>}
          </div>
        )}
        <form className="chat-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="chat-message">{"Your AZ-900 question"}</label>
          <textarea
            id="chat-message"
            rows={2}
            maxLength={2000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={"Ask about a cloud concept, Azure service, cost, or governance…"}
            disabled={sending || busy}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="chat-form-bottom">
            <span>{`${draft.length} / 2000`}</span>
            <Button type="submit" disabled={sending || busy || !draft.trim()}><Send size={15} />{"Send"}</Button>
          </div>
        </form>
        <p className="chat-safety-note">{"Study support only. Check official learning materials for your final exam preparation."}</p>
      </section>
    </main>
  );
}

function buildRecentContext(history: ChatMessage[], content: string): ChatMessage[] {
  const selected: ChatMessage[] = [];
  let characterCount = content.length;
  const maxMessages = 19;
  for (let end = history.length; end >= 2 && selected.length + 3 <= maxMessages; end -= 2) {
    const pair = history.slice(end - 2, end);
    if (pair[0].role !== "user" || pair[1].role !== "assistant") break;
    const pairCharacters = pair[0].content.length + pair[1].content.length;
    if (characterCount + pairCharacters > 8_000) break;
    selected.unshift(...pair);
    characterCount += pairCharacters;
  }
  return [...selected, { role: "user", content }];
}
