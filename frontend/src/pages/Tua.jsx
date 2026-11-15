import { useState, useContext, useRef, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ArrowRight, Send } from 'lucide-react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { Link, useLocation } from 'react-router-dom';
import tuaImage from '../assets/TUA.png';

export default function Tua() {
  const { token } = useContext(AuthContext);
  const location = useLocation();
  
  // Chat State
  const [messages, setMessages] = useState([
    { role: 'tua', text: "Hi friend, I'm TUA. I can listen, help with small worries, and introduce you to the right counsellor when you're ready." }
  ]);
  const [input, setInput] = useState(location.state?.initialMessage || '');
  const [isTyping, setIsTyping] = useState(false);
  
  const chatEndRef = useRef(null);

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
      const res = await axios.post(
        'http://127.0.0.1:8000/api/tua/chat/',
        { message: text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Add the real AI reply
      setMessages([...newMessages, {
        role: 'tua',
        text: res.data.reply,
        therapistId: res.data.therapist_id || null,
      }]);
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

  const suggestions = ["I'm feeling stressed", "I can't sleep", "Exam anxiety", "I feel lonely", "I'd like to see a counsellor"];

  return (
    <div className="app-shell tua-page">
      <Sidebar />

      <main className="tua-main">
        <header className="tua-heading">
          <h1>TUA</h1>
          <p>A friendly AI companion for small worries. It helps you find the right counsellor when you're ready.</p>
        </header>

        <section className="panel tua-chat-panel" aria-label="TUA conversation">
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
                </div>
              );
            })}
            {isTyping && <p className="tua-typing" role="status">TUA is typing…</p>}
            <div ref={chatEndRef} />
          </div>

          {messages.length === 1 && (
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
    </div>
  );
}
