import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { MessageCircle, RefreshCw } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ChatInbox() {
  const { user, token } = useContext(AuthContext);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

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

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content">
        <header className="page-heading">
          <div className="eyebrow"><MessageCircle size={16} /> Messaging</div>
          <h1>Your chats</h1>
          <p>Continue a conversation with a counsellor or student.</p>
        </header>

        {loading ? (
          <div className="panel chat-state" role="status">Loading conversations…</div>
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
          <section className="chat-thread-list" aria-label="Conversations">
            {threads.map((thread) => {
              const latestMessage = thread.messages[thread.messages.length - 1];
              const otherName = user?.role === 'student' ? thread.therapist_name : thread.student_alias;
              return (
                <Link className="panel chat-thread-row" to={`/chat/${thread.id}`} key={thread.id}>
                  <span className="chat-thread-icon"><MessageCircle size={20} /></span>
                  <span className="chat-thread-copy">
                    <strong>{otherName}</strong>
                    <span>{latestMessage?.body || 'No messages yet'}</span>
                  </span>
                  <span className="chat-thread-date">{latestMessage ? formatDate(latestMessage.sent_at) : ''}</span>
                </Link>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
