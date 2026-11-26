import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { MessageCircle, RefreshCw, Search } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';
import { formatThreadTime, initials } from './chatFormat';
import './Chat.css';
import { SkeletonList } from '../components/Skeleton';

export default function ChatInbox() {
  const { user, token } = useContext(AuthContext);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const loadThreads = async () => {
      try {
        const { data } = await api.get('/api/messaging/threads/', {
          signal: controller.signal,
        });
        setThreads(data);
        setError('');
      } catch {
        if (!controller.signal.aborted) setError('Could not load conversations. Please try again.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadThreads();
    return () => controller.abort();
  }, [retry, token]);

  const nameFor = (thread) => (user?.role === 'student' ? thread.therapist_name : thread.student_alias);
  const sorted = useMemo(() => {
    const latest = (thread) => thread.messages[thread.messages.length - 1]?.sent_at || '';
    return [...threads].sort((a, b) => latest(b).localeCompare(latest(a)));
  }, [threads]);
  const visible = sorted.filter((thread) => String(nameFor(thread) || '').toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content">
        <header className="page-heading">
          <div className="eyebrow"><MessageCircle size={16} /> Messaging</div>
          <h1>Your chats</h1>
          <p>{threads.length > 0 ? `${threads.length} conversation${threads.length === 1 ? '' : 's'}. Pick up where you left off.` : 'Continue a conversation with a counsellor or student.'}</p>
        </header>

        {loading ? (
          <SkeletonList label="Loading conversations" rows={4} avatar />
        ) : error ? (
          <div className="panel chat-state" role="alert">
            <p>{error}</p>
            <button type="button" className="button button-secondary" onClick={() => { setLoading(true); setRetry((count) => count + 1); }}>
              <RefreshCw size={16} /> Try again
            </button>
          </div>
        ) : threads.length === 0 ? (
          <section className="panel empty-state">
            <h2>No conversations yet</h2>
            <p>{user?.role === 'student' ? 'Choose a counsellor in Find Support to start a chat.' : 'Chats started by students will appear here.'}</p>
            {user?.role === 'student' && <Link className="button" to="/support">Find support</Link>}
          </section>
        ) : (
          <section className="chat-inbox" aria-label="Conversations">
            {threads.length > 4 && (
              <label className="chat-search">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Search conversations</span>
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name" />
              </label>
            )}
            {visible.length === 0 ? (
              <p className="chat-no-match">No chats match “{query}”.</p>
            ) : (
              <ul className="chat-thread-list">
                {visible.map((thread) => {
                  const latestMessage = thread.messages[thread.messages.length - 1];
                  const otherName = nameFor(thread);
                  const mine = latestMessage?.sender_role === user?.role;
                  return (
                    <li key={thread.id}>
                      <Link className="chat-thread-row" to={`/chat/${thread.id}`}>
                        <span className="chat-avatar" aria-hidden="true">{initials(otherName)}</span>
                        <span className="chat-thread-copy">
                          <strong>{otherName}</strong>
                          <span>{latestMessage ? `${mine ? 'You: ' : ''}${latestMessage.body}` : 'No messages yet. Say hello.'}</span>
                        </span>
                        <time className="chat-thread-date" dateTime={latestMessage?.sent_at}>{latestMessage ? formatThreadTime(latestMessage.sent_at) : ''}</time>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
