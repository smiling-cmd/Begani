import { useState } from 'react';
import { Moon, Volume2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LateNightPrompt() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <section
      className="card late-night-prompt"
      style={{
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-start',
        marginBottom: '1.5rem',
        color: 'white',
        position: 'relative',
        borderRadius: '20px',
        padding: '1.5rem',
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <Moon size={32} color="#E07A5F" />
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 0.4rem', color: 'white', fontSize: '1.2rem' }}>
          Can't sleep?
        </h3>
        <p style={{ margin: '0 0 1rem', color: '#d6e0da', lineHeight: 1.5 }}>
          It's okay. Take a moment for yourself. You don't have to figure everything out tonight.
        </p>
        <Link
          to="/resources"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#E07A5F',
            color: 'white',
            padding: '0.6rem 1.2rem',
            borderRadius: '999px',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '0.9rem',
          }}
        >
          <Volume2 size={16} /> Explore night sounds
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'none',
          border: 'none',
          color: '#a8b9a3',
          cursor: 'pointer',
          padding: 4,
        }}
      >
        <X size={18} />
      </button>
    </section>
  );
}