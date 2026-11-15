import { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import tuaImage from '../assets/TUA.png';

export default function WelcomeScreen() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const destination = user?.role === 'therapist' ? '/therapist-dashboard' : '/home';

  useEffect(() => {
    if (!user) return undefined;
    const timer = window.setTimeout(() => navigate(destination, { replace: true }), 5000);
    return () => window.clearTimeout(timer);
  }, [destination, navigate, user]);

  return (
    <main className="welcome-screen">
      <section className="welcome-content">
        <p className="welcome-eyebrow">Begani</p>
        <img className="welcome-mascot" src={tuaImage} alt="TUA, your Begani support companion" />
        <h1 className="welcome-title">Welcome, {user?.full_name || 'friend'}!</h1>
        <p className="welcome-copy">Share the load. You’re not alone.</p>
        {user && (
          <button
            className="welcome-continue"
            type="button"
            onClick={() => navigate(destination, { replace: true })}
          >
            Continue now
          </button>
        )}
      </section>
    </main>
  );
}
