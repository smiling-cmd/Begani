import { useEffect, useState } from 'react';
import { Bookmark, X } from 'lucide-react';
import api from '../api';

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// The student's earlier TUA chats. Tap one to open it, or bookmark it to keep
// it past the 90-day clean-up.
export default function TuaPastChats({ currentId, onOpen, onClose, onSavedChange }) {
  const [chats, setChats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/api/tua/conversations/')
      .then((res) => { if (!cancelled) setChats(res.data?.conversations || []); })
      .catch(() => { if (!cancelled) setError('Could not load your past chats.'); });
    return () => { cancelled = true; };
  }, []);

  const toggleSaved = async (chat) => {
    setError('');
    try {
      const { data } = await api.patch(`/api/tua/conversations/${chat.id}/`, { saved: !chat.saved });
      setChats((current) => current.map((item) => (
        item.id === chat.id ? { ...item, saved: data.saved, days_left: data.saved ? null : 90 } : item
      )));
      onSavedChange(chat.id, data.saved);
    } catch {
      setError('Could not update that chat. Please try again.');
    }
  };

  return (
    <section className="tua-past" aria-label="Past chats">
      <div className="tua-past-header">
        <h2>Past chats</h2>
        <button type="button" className="tua-past-close" aria-label="Close past chats" onClick={onClose}>
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      {error && <p className="tua-new-chat-error" role="alert">{error}</p>}
      {chats === null && !error && <p className="tua-past-empty" role="status">Loading…</p>}
      {chats && chats.length === 0 && <p className="tua-past-empty">No past chats yet. Your conversations will show up here.</p>}
      {chats && chats.length > 0 && (
        <ul className="tua-past-list">
          {chats.map((chat) => (
            <li key={chat.id} className={`tua-past-item${chat.id === currentId ? ' is-current' : ''}`}>
              <button type="button" className="tua-past-open" onClick={() => onOpen(chat.id)}>
                <strong>{chat.title}</strong>
                <span className="tua-past-preview">{chat.preview}</span>
                <small>
                  {formatWhen(chat.last_message_at)}
                  {' · '}
                  {chat.saved ? 'Saved' : `Deleted in ${chat.days_left} ${chat.days_left === 1 ? 'day' : 'days'}`}
                </small>
              </button>
              <button
                type="button"
                className={`tua-past-save${chat.saved ? ' is-saved' : ''}`}
                aria-pressed={chat.saved}
                aria-label={chat.saved ? `Unsave chat: ${chat.title}` : `Save chat: ${chat.title}`}
                onClick={() => toggleSaved(chat)}
              >
                <Bookmark size={17} aria-hidden="true" fill={chat.saved ? 'currentColor' : 'none'} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
