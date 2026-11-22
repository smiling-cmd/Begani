import { useState, useContext, useRef, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ArrowRight, Bookmark, History, LifeBuoy, Phone, Send, SquarePen } from 'lucide-react';
import api from '../api';
import Sidebar from '../components/Sidebar';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import tuaImage from '../assets/TUA.png';
import PriorityRequestDialog from '../components/PriorityRequestDialog';
import TuaPastChats from '../components/TuaPastChats';

const welcomeMessage = {
  role: 'tua',
  text: "Hi friend, I'm TUA. I can listen, help with small worries, and introduce you to the right counsellor when you're ready.",
};

export default function Tua() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Chat State
  const [messages, setMessages] = useState([welcomeMessage]);
  const [isStartingNew, setIsStartingNew] = useState(false);
  const [newChatError, setNewChatError] = useState('');
  const [input, setInput] = useState(location.state?.initialMessage || '');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [priorityDialog, setPriorityDialog] = useState(null);
  const [showUrgent, setShowUrgent] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [pastError, setPastError] = useState('');
  
  const chatEndRef = useRef(null);

  // Restore the saved conversation so Tua remembers past chats
  useEffect(() => {
    let cancelled = false;
    api.get('/api/tua/history/')
      .then((res) => {
        if (cancelled) return;
        const saved = res.data?.messages || [];
        if (!saved.length) return;
        setActiveId(res.data.conversation_id);
        setIsSaved(Boolean(res.data.saved));
        const restored = saved.map((m) => ({
          role: m.role,
          text: m.text,
          therapistId: m.therapist_id || null,
          crisisDetected: Boolean(m.crisis_detected),
          conversationId: res.data.conversation_id,
        }));
        // Keep anything the student typed or sent before the history arrived.
        setMessages((current) => [...restored, ...current.slice(1)]);
      })
      .catch(() => { /* Chat still works without history */ })
      .finally(() => { if (!cancelled) setIsLoadingHistory(false); });
    return () => { cancelled = true; };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (text) => {
    if (!text.trim() || isTyping) return;
    
    const newMessages = [...messages, { role: 'user', text }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      // Call the Django backend
      const res = await api.post('/api/tua/chat/', activeId ? { message: text, conversation_id: activeId } : { message: text });
      
      // Add the real AI reply
      setMessages([...newMessages, {
        role: 'tua',
        text: res.data.reply,
        therapistId: res.data.therapist_id || null,
        crisisDetected: Boolean(res.data.crisis_detected),
        conversationId: res.data.conversation_id,
      }]);
      setActiveId(res.data.conversation_id);
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.error;
      setMessages([...newMessages, {
        role: 'tua',
        text: typeof message === 'string' ? message : "I'm having a little trouble connecting right now. Please try again.",
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // A new chat is only worth starting once the current one has something in it.
  const hasConversation = messages.some((message) => message.role === 'user' || message.conversationId);

  const handleNewChat = async () => {
    if (isTyping || isStartingNew) return;
    setIsStartingNew(true);
    setNewChatError('');
    try {
      const { data } = await api.post('/api/tua/new/');
      setActiveId(data.conversation_id);
      setIsSaved(false);
      setMessages([welcomeMessage]);
      setInput('');
      setShowUrgent(false);
    } catch {
      setNewChatError('Could not start a new chat. Please try again.');
    } finally {
      setIsStartingNew(false);
    }
  };

  const openPastChat = async (id) => {
    if (isTyping) return;
    setPastError('');
    try {
      const { data } = await api.get('/api/tua/history/', { params: { conversation_id: id } });
      setMessages((data.messages || []).map((m) => ({
        role: m.role,
        text: m.text,
        therapistId: m.therapist_id || null,
        crisisDetected: Boolean(m.crisis_detected),
        conversationId: data.conversation_id,
      })));
      setActiveId(data.conversation_id);
      setIsSaved(Boolean(data.saved));
      setShowUrgent(false);
      setShowPast(false);
      setInput('');
    } catch {
      setPastError('Could not open that chat. Please try again.');
    }
  };

  const toggleCurrentSaved = async () => {
    if (!activeId) return;
    setPastError('');
    try {
      const { data } = await api.patch(`/api/tua/conversations/${activeId}/`, { saved: !isSaved });
      setIsSaved(data.saved);
    } catch {
      setPastError('Could not save this chat. Please try again.');
    }
  };

  const isStudent = user?.role === 'student';

  const suggestions = ["I'm feeling stressed", "I can't sleep", "Exam anxiety", "I feel lonely", "I'd like to see a counsellor"];
  const conversationId = messages.reduce((latest, message) => message.conversationId || latest, null);

  return (
    <div className="app-shell tua-page">
      <Sidebar />

      <main className="tua-main">
        <header className="tua-heading">
          <h1>TUA</h1>
          <p>A friendly AI companion for small worries. It helps you find the right counsellor when you're ready.</p>
          {(newChatError || pastError) && <p className="tua-new-chat-error" role="alert">{newChatError || pastError}</p>}
        </header>

        <section className="card tua-chat-panel" aria-label="TUA conversation">
          {showPast && isStudent && (
            <TuaPastChats
              currentId={activeId}
              onOpen={openPastChat}
              onClose={() => setShowPast(false)}
              onSavedChange={(id, saved) => { if (id === activeId) setIsSaved(saved); }}
            />
          )}
          <div className="tua-message-list" role="log" aria-live="polite">
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              return (
                <div key={i} className={`tua-message-row${isUser ? ' is-user' : ''}`}>
                  <div className="tua-message-line">
                    {!isUser && <img className="tua-chat-avatar" src={tuaImage} alt="TUA" />}
                    <div className={`tua-message-bubble${isUser ? ' is-user' : ''}`}>
                      {msg.text}
                    </div>
                  </div>
                  {!isUser && msg.therapistId && (
                    <Link className="tua-book-link" to={`/therapist/${msg.therapistId}`}>
                      View therapist &amp; book <ArrowRight size={16} />
                    </Link>
                  )}
                  {!isUser && msg.crisisDetected && (
                    <div className="tua-crisis-actions" role="alert">
                      <p>If you may be in immediate danger, call emergency services now.</p>
                      <div className="tua-crisis-links">
                        <a href="tel:999"><Phone size={15} /> Call 999</a>
                        <a href="tel:112"><Phone size={15} /> Call 112</a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {isTyping && <p className="tua-typing" role="status">TUA is typing…</p>}
            <div ref={chatEndRef} />
          </div>

          {(isStudent || hasConversation) && (
            <div className="tua-urgent">
              <div className="tua-action-row">
                {hasConversation && (
                  <button
                    type="button"
                    className="tua-new-chat"
                    onClick={handleNewChat}
                    disabled={isTyping || isStartingNew}
                  >
                    <SquarePen size={15} aria-hidden="true" /> {isStartingNew ? 'Starting…' : 'New chat'}
                  </button>
                )}
                {isStudent && (
                  <button
                    type="button"
                    className="tua-new-chat"
                    aria-expanded={showPast}
                    onClick={() => setShowPast((shown) => !shown)}
                  >
                    <History size={15} aria-hidden="true" /> Past chats
                  </button>
                )}
                {isStudent && hasConversation && activeId && (
                  <button
                    type="button"
                    className={`tua-new-chat${isSaved ? ' is-saved' : ''}`}
                    aria-pressed={isSaved}
                    onClick={toggleCurrentSaved}
                  >
                    <Bookmark size={15} aria-hidden="true" fill={isSaved ? 'currentColor' : 'none'} /> {isSaved ? 'Saved' : 'Save chat'}
                  </button>
                )}
                {conversationId && isStudent && (
                  <button
                    type="button"
                    className="tua-urgent-toggle"
                    aria-expanded={showUrgent}
                    aria-controls="tua-urgent-panel"
                    onClick={() => setShowUrgent((shown) => !shown)}
                  >
                    <LifeBuoy size={15} aria-hidden="true" /> Need urgent support?
                  </button>
                )}
              </div>
              {showUrgent && conversationId && (
                <div className="tua-crisis-actions" id="tua-urgent-panel" aria-label="Urgent counsellor request">
                  <p>Request a chat with an approved school counsellor.</p>
                  <button type="button" onClick={() => setPriorityDialog({ conversationId })}>
                    Connect me with a counsellor now
                  </button>
                </div>
              )}
            </div>
          )}

          {!isLoadingHistory && messages.length === 1 && (
            <div className="tua-suggestions" aria-label="Suggested messages">
              {suggestions.map((sug) => (
                <button key={sug} type="button" disabled={isTyping} onClick={() => handleSend(sug)}>
                  {sug}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={(event) => { event.preventDefault(); handleSend(input); }} className="tua-composer">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Share what's on your mind..."
              disabled={isTyping}
              aria-label="Message TUA"
            />
            <button type="submit" disabled={!input.trim() || isTyping} aria-label={isTyping ? 'TUA is responding' : 'Send message'}>
              <Send size={20} />
            </button>
          </form>
        </section>

        <p className="tua-disclaimer">
          TUA is an AI companion, not a therapist. It can support small worries and introduce you to a counsellor, but it can't diagnose or treat. In an emergency, use the emergency line on Home or Find Support.
        </p>
      </main>
      {priorityDialog && <PriorityRequestDialog
        hasPhone={Boolean(user?.phone)}
        source="tua"
        conversationId={priorityDialog.conversationId}
        onClose={() => setPriorityDialog(null)}
        onCreated={(request) => navigate(`/chat/${request.thread_id}`, { state: { priorityRequestSent: true } })}
      />}
    </div>
  );
}
