import { useEffect, useRef, useState } from 'react';
import { GoogleMark } from './AuthLayout';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptRequest = null;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptRequest) {
    scriptRequest = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        scriptRequest = null; // allow a retry on the next visit
        script.remove();
        reject(new Error('Google script failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptRequest;
}

/* Google's own sign-in button (so the sign-in is the secure, official flow).
   `text` is Google's wording key: 'signin_with' or 'signup_with'.
   If Google is not configured or cannot load, a matching button explains why. */
export default function GoogleSignInButton({ text = 'signin_with', onCredential, onError, disabled = false }) {
  const slotRef = useRef(null);
  const callbacks = useRef({ onCredential, onError });
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    callbacks.current = { onCredential, onError };
  });

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;
    let observer;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !slotRef.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => callbacks.current.onCredential?.(response.credential),
        });

        const draw = () => {
          const slot = slotRef.current;
          if (!slot) return;
          const width = Math.max(200, Math.min(400, Math.floor(slot.clientWidth)));
          slot.replaceChildren();
          window.google.accounts.id.renderButton(slot, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text,
            logo_alignment: 'center',
            width,
          });
        };

        draw();
        let lastWidth = slotRef.current.clientWidth;
        observer = new ResizeObserver(() => {
          const next = slotRef.current?.clientWidth ?? 0;
          if (Math.abs(next - lastWidth) > 8) {
            lastWidth = next;
            draw();
          }
        });
        observer.observe(slotRef.current);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [text]);

  if (!CLIENT_ID || loadFailed) {
    const message = !CLIENT_ID
      ? 'Google sign-in is not set up yet. Please use your email below.'
      : 'Could not reach Google. Check your connection or use your email below.';
    return (
      <button className="auth-google auth-google--secondary" type="button" onClick={() => onError?.(message)}>
        <GoogleMark />
        <span>{text === 'signup_with' ? 'Sign up with Google' : 'Sign in with Google'}</span>
      </button>
    );
  }

  return (
    <div
      className={`auth-google-slot${disabled ? ' is-disabled' : ''}`}
      ref={slotRef}
      aria-busy={disabled}
    />
  );
}
