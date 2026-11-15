import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, RefreshCw, Send } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';

const api = 'http://127.0.0.1:8000/api/messaging/';

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
  const requestIdRef = useRef(0);
  const fetchThreadRef = useRef(null);

  useEffect(() => {
    const fetchThread = async (silent = false) => {
      const requestId = ++requestIdRef.current;
      try {
        const { data } = await axios.get(`${api}${id}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
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

  const handleSend = async (event) => {
    event.preventDefault();
    const body = input.trim();
    if (!body || sending) return;

    setSending(true);
    setSendError('');
    try {
      await axios.post(`${api}${id}/send/`, { body }, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
        <header className="page-heading chat-page-heading">
          <Link className="text-button" to={backTo}><ArrowLeft size={17} /> Back</Link>
          <h1>Chat with {otherName || 'your counsellor'}</h1>
          <p>Messages are visible to you and the other participant in this conversation.</p>
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
            <p className="chat-privacy-note">Messages are stored by Begani and are not end-to-end encrypted.</p>
            <div className="chat-feed" aria-live="polite" aria-relevant="additions">
              {currentThread.messages.length === 0 ? (
                <p className="chat-empty">Start the conversation with a message.</p>
              ) : currentThread.messages.map((message) => {
                const isMine = message.sender_role === user?.role;
                return (
                  <div className={`chat-message-row${isMine ? ' mine' : ''}`} key={message.id}>
                    <div className={`chat-message${isMine ? ' mine' : ''}`}>
                      <p>{message.body}</p>
                      <time dateTime={message.sent_at}>
                        {new Date(message.sent_at).toLocaleString()}
                      </time>
                    </div>
                  </div>
                );
              })}
              <div ref={endOfChatRef} />
            </div>

            {sendError && <p className="form-message error" role="alert">{sendError}</p>}
            <form className="chat-composer" onSubmit={handleSend}>
              <label className="sr-only" htmlFor="chat-message">Message</label>
              <textarea
                id="chat-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Write a message…"
                maxLength={5000}
                rows={2}
                disabled={sending}
              />
              <button type="submit" className="button" disabled={sending || !input.trim()}>
                <Send size={17} /> {sending ? 'Sending…' : 'Send'}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
