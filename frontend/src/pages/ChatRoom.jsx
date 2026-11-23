import { Fragment, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, Lock, RefreshCw, Send } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';
import { dayKeyOf, formatClock, formatDayLabel, initials } from './chatFormat';
import './Chat.css';

function getMessage(error, fallback) {
  const detail = error.response?.data?.error || error.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

export default function ChatRoom() {
  const { id } = useParams();
  const location = useLocation();
  const { user, token } = useContext(AuthContext);
  const [thread, setThread] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const endOfChatRef = useRef(null);
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);
  const fetchThreadRef = useRef(null);

  useEffect(() => {
    const fetchThread = async (silent = false) => {
      const requestId = ++requestIdRef.current;
      try {
        const { data } = await api.get(`/api/messaging/${id}/`);
        if (requestId === requestIdRef.current) setThread(data);
      } catch (error) {
        if (requestId === requestIdRef.current && !silent) {
          setLoadError(getMessage(error, 'Could not load this chat. Please try again.'));
        }
      }
    };
    fetchThreadRef.current = fetchThread;
    void fetchThread();
    const interval = window.setInterval(() => void fetchThread(true), 3000);
    return () => {
      window.clearInterval(interval);
      requestIdRef.current += 1;
      fetchThreadRef.current = null;
    };
  }, [id, token]);

  const lastMessageId = thread?.messages?.[thread.messages.length - 1]?.id;
  useEffect(() => {
    endOfChatRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastMessageId]);

  // The message box grows with what is typed, up to a few lines.
  useLayoutEffect(() => {
    const box = inputRef.current;
    if (!box) return;
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight, 140)}px`;
  }, [input]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const body = input.trim();
    if (!body || sending) return;

    setSending(true);
    setSendError('');
    try {
      await api.post(`/api/messaging/${id}/send/`, { body });
      setInput('');
      await fetchThreadRef.current?.(true);
    } catch (error) {
      setSendError(getMessage(error, 'Could not send your message. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const otherName = user?.role === 'student' ? thread?.therapist_name : thread?.student_alias;
  const backTo = user?.role === 'student' ? '/support' : '/therapist-chats';
  const currentThread = thread?.id === id ? thread : null;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content chat-page-content">
        <header className="chat-room-header">
          <Link className="chat-back" to={backTo} aria-label="Back to chats"><ArrowLeft size={19} /></Link>
          <span className="chat-avatar" aria-hidden="true">{initials(otherName)}</span>
          <div className="chat-room-title">
            <h1>{otherName || 'Your counsellor'}</h1>
            <p><Lock size={12} aria-hidden="true" /> Only you and {user?.role === 'student' ? 'your counsellor' : 'the student'} can read this. <Link to="/privacy" target="_blank" rel="noopener">How we protect it</Link></p>
          </div>
        </header>

        {location.state?.priorityRequestSent && (
          <div className="priority-chat-notice" role="status">
            A priority request was sent and the counsellor was alerted. If you may be in immediate danger, call <a href="tel:999">999</a> or <a href="tel:112">112</a>.
          </div>
        )}

        {!currentThread && loadError ? (
          <div className="panel chat-state" role="alert">
            <p>{loadError}</p>
            <button type="button" className="button button-secondary" onClick={() => { setLoadError(''); void fetchThreadRef.current?.(); }}>
              <RefreshCw size={16} /> Try again
            </button>
          </div>
        ) : !currentThread ? (
          <div className="panel chat-state" role="status">Loading conversation…</div>
        ) : (
          <section className="panel chat-room-panel" aria-label={`Conversation with ${otherName || 'counsellor'}`}>
            <div className="chat-feed" aria-live="polite" aria-relevant="additions">
              {currentThread.messages.length === 0 ? (
                <p className="chat-empty">Start the conversation with a message.</p>
              ) : currentThread.messages.map((message, index, all) => {
                const isMine = message.sender_role === user?.role;
                const newDay = index === 0 || dayKeyOf(all[index - 1].sent_at) !== dayKeyOf(message.sent_at);
                const sameSender = !newDay && all[index - 1].sender_role === message.sender_role;
                return (
                  <Fragment key={message.id}>
                    {newDay && <div className="chat-day-divider"><span>{formatDayLabel(message.sent_at)}</span></div>}
                    <div className={`chat-message-row${isMine ? ' mine' : ''}${sameSender ? ' grouped' : ''}`}>
                      <div className={`chat-message${isMine ? ' mine' : ''}`}>
                        <p>{message.body}</p>
                        <time dateTime={message.sent_at}>{formatClock(message.sent_at)}</time>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
              <div ref={endOfChatRef} />
            </div>

            {sendError && <p className="form-message error" role="alert">{sendError}</p>}
            <form className="chat-composer" onSubmit={handleSend}>
              <label className="sr-only" htmlFor="chat-message">Message</label>
              <textarea
                id="chat-message"
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a message…"
                maxLength={5000}
                rows={1}
                disabled={sending}
              />
              <button type="submit" className="chat-send" disabled={sending || !input.trim()} aria-label={sending ? 'Sending' : 'Send message'}>
                <Send size={18} />
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
