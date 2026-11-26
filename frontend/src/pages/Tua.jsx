import { useState, useContext, useRef, useEffect, useLayoutEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ArrowRight, Bookmark, History, LifeBuoy, Phone, Send, SquarePen } from 'lucide-react';
import api from '../api';
import Sidebar from '../components/Sidebar';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import tuaImage from '../assets/TUA.png';
import PriorityRequestDialog from '../components/PriorityRequestDialog';
import TuaPastChats from '../components/TuaPastChats';
import './Tua.css';

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
  const inputRef = useRef(null);

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

  // The message box grows with what is typed, up to a few lines.
  useLayoutEffect(() => {
    const box = inputRef.current;
    if (!box) return;
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight, 140)}px`;
  }, [input]);

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

  const suggestions = [
    { text: "I'm feeling stressed", hint: 'Talk through what is weighing on you' },
    { text: "I can't sleep", hint: 'Wind down and get some rest' },
    { text: 'Exam anxiety', hint: 'Calm nerves before a test' },
    { text: 'I feel lonely', hint: 'You do not have to carry it alone' },
    { text: "I'd like to see a counsellor", hint: 'Find someone who fits' },
  ];
  const conversationId = messages.reduce((latest, message) => message.conversationId || latest, null);
  const isEmpty = !isLoadingHistory && messages.length === 1;

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSend(input);
    }
  };

  return (
    <div className="app-shell tua-page">
      <Sidebar />

      <main className="tua-main">
        <section className="card tua-chat-panel" aria-label="TUA conversation">
          <header className="tua-header">
            <img className="tua-header-avatar" src={tuaImage} alt="" />
            <div className="tua-header-text">
              <h1>TUA</h1>
              <p><span className="tua-status-dot" aria-hidden="true" /> AI companion<span className="tua-not-therapist"> · not a therapist</span></p>
            </div>
            <div className="tua-toolbar">
              {hasConversation && (
                <button type="button" className="tua-tool" onClick={handleNewChat} disabled={isTyping || isStartingNew} aria-label="New chat">
                  <SquarePen size={16} aria-hidden="true" /> <span>{isStartingNew ? 'Starting…' : 'New chat'}</span>
                </button>
              )}
              {isStudent && (
                <button type="button" className="tua-tool" aria-expanded={showPast} onClick={() => setShowPast((shown) => !shown)} aria-label="Past chats">
                  <History size={16} aria-hidden="true" /> <span>Past chats</span>
                </button>
              )}
              {isStudent && hasConversation && activeId && (
                <button type="button" className={`tua-tool${isSaved ? ' is-saved' : ''}`} aria-pressed={isSaved} onClick={toggleCurrentSaved} aria-label={isSaved ? 'Saved chat' : 'Save chat'}>
                  <Bookmark size={16} aria-hidden="true" fill={isSaved ? 'currentColor' : 'none'} /> <span>{isSaved ? 'Saved' : 'Save'}</span>
                </button>
              )}
              {conversationId && isStudent && (
                <button type="button" className="tua-tool tua-tool-urgent" aria-expanded={showUrgent} aria-controls="tua-urgent-panel" onClick={() => setShowUrgent((shown) => !shown)} aria-label="Need urgent support?">
                  <LifeBuoy size={16} aria-hidden="true" /> <span>Urgent help</span>
                </button>
              )}
            </div>
          </header>

          {(newChatError || pastError) && <p className="tua-new-chat-error" role="alert">{newChatError || pastError}</p>}

          {showUrgent && conversationId && isStudent && (
            <div className="tua-crisis-actions tua-urgent-panel" id="tua-urgent-panel" aria-label="Urgent counsellor request">
              <p>Request a chat with an approved school counsellor. If you may be in immediate danger, call 999 or 112 now.</p>
              <button type="button" onClick={() => setPriorityDialog({ conversationId })}>
                Connect me with a counsellor now
              </button>
            </div>
          )}

          {showPast && isStudent && (
            <TuaPastChats
              currentId={activeId}
              onOpen={openPastChat}
              onClose={() => setShowPast(false)}
              onSavedChange={(id, saved) => { if (id === activeId) setIsSaved(saved); }}
            />
          )}

          {isEmpty ? (
            <div className="tua-empty">
              <img className="tua-empty-avatar" src={tuaImage} alt="TUA" />
              <h2>Hi friend, I'm TUA.</h2>
              <p>I can listen, help with small worries, and introduce you to the right counsellor when you're ready.</p>
              <div className="tua-suggestion-grid" aria-label="Suggested messages">
                {suggestions.map((item) => (
                  <button key={item.text} type="button" disabled={isTyping} onClick={() => handleSend(item.text)}>
                    <strong>{item.text}</strong>
                    <small>{item.hint}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="tua-message-list" role="log" aria-live="polite">
              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                const startsRun = !isUser && messages[i - 1]?.role !== 'tua';
                return (
                  <div key={i} className={`tua-message-row${isUser ? ' is-user' : ''}`}>
                    <div className="tua-message-line">
                      {!isUser && (startsRun
                        ? <img className="tua-chat-avatar" src={tuaImage} alt="TUA" />
                        : <span className="tua-chat-avatar-spacer" aria-hidden="true" />)}
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
              {isTyping && (
                <div className="tua-message-row" role="status" aria-label="TUA is typing">
                  <div className="tua-message-line">
                    <img className="tua-chat-avatar" src={tuaImage} alt="" />
                    <div className="tua-message-bubble tua-typing-bubble" aria-hidden="true"><span /><span /><span /></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          <form onSubmit={(event) => { event.preventDefault(); handleSend(input); }} className="tua-composer">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share what's on your mind..."
              disabled={isTyping}
              aria-label="Message TUA"
              maxLength={2000}
            />
            <button type="submit" disabled={!input.trim() || isTyping} aria-label={isTyping ? 'TUA is responding' : 'Send message'}>
              <Send size={19} />
            </button>
          </form>
          <p className="tua-disclaimer">
            <span className="tua-disclaimer-full">TUA is an AI companion, not a therapist, and can't diagnose or treat. In an emergency, call 999 or 112, or use the emergency line on Home or Find Support.</span>
            <span className="tua-disclaimer-short">AI companion, not a therapist. Emergency? Call 999 or 112.</span>
          </p>
        </section>
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
