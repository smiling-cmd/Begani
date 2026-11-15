import { useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { Activity, ArrowRight, BookOpen, Heart, Pause, Play, Sprout, TrendingDown, TrendingUp, Wind } from 'lucide-react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MoodWheel from '../components/MoodWheel';
import { AuthContext } from '../context/AuthContext';

// Legacy moods array kept for check-in history display only
const moods = [
  { score: 2, label: 'Very low', face: '☹' },
  { score: 4, label: 'Low', face: '🙁' },
  { score: 5, label: 'Okay', face: '😐' },
  { score: 8, label: 'Good', face: '🙂' },
  { score: 10, label: 'Great', face: '😁' },
];
const phases = [
  { name: 'Breathe in', seconds: 4 },
  { name: 'Hold', seconds: 4 },
  { name: 'Breathe out', seconds: 6 },
];

function getMoodLabel(score) {
  if (score <= 2) return 'Very low';
  if (score <= 4) return 'Low';
  if (score <= 6) return 'Okay';
  if (score <= 8) return 'Good';
  return 'Great';
}

function getErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail || error.response?.data;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.join(' ');
  if (detail && typeof detail === 'object') {
    const messages = Object.values(detail).flat().filter((message) => typeof message === 'string');
    if (messages.length) return messages.join(' ');
  }
  return fallback;
}

function formatDate(value) {
  return new Date(value).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Wellbeing() {
  const { token } = useContext(AuthContext);
  const [checkins, setCheckins] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [loadingMoods, setLoadingMoods] = useState(true);
  const [loadingJournal, setLoadingJournal] = useState(true);
  const [moodError, setMoodError] = useState('');
  const [journalError, setJournalError] = useState('');
  const [selectedMood, setSelectedMood] = useState(null);
  const [savingMood, setSavingMood] = useState(false);
  const [moodNotice, setMoodNotice] = useState('');
  const [journalDraft, setJournalDraft] = useState('');
  const [savingJournal, setSavingJournal] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(phases[0].seconds);
  const [cycles, setCycles] = useState(0);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    api.get('/api/wellbeing/moods/')
      .then(({ data }) => {
        if (active) setCheckins(Array.isArray(data) ? data : data.results || []);
      })
      .catch(() => { if (active) setMoodError('Could not load your check-ins. Please try again later.'); })
      .finally(() => { if (active) setLoadingMoods(false); });

    api.get('/api/wellbeing/journals/')
      .then(({ data }) => {
        if (active) setJournalEntries(Array.isArray(data) ? data : data.results || []);
      })
      .catch(() => { if (active) setJournalError('Could not load your journal entries.'); })
      .finally(() => { if (active) setLoadingJournal(false); });

    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!breathing) return undefined;
    const timeout = window.setTimeout(() => {
      if (secondsLeft > 1) {
        setSecondsLeft(secondsLeft - 1);
        return;
      }

      if (phaseIndex < phases.length - 1) {
        const nextPhase = phaseIndex + 1;
        setPhaseIndex(nextPhase);
        setSecondsLeft(phases[nextPhase].seconds);
        return;
      }

      const completedCycles = cycles + 1;
      setCycles(completedCycles);
      if (completedCycles >= 4) {
        setBreathing(false);
        setPhaseIndex(0);
        setSecondsLeft(phases[0].seconds);
        setMoodNotice('You completed four gentle breathing cycles. Take a moment before moving on.');
        return;
      }
      setPhaseIndex(0);
      setSecondsLeft(phases[0].seconds);
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [breathing, secondsLeft, phaseIndex, cycles]);

  const average = useMemo(() => {
    if (!checkins.length) return null;
    const recent = checkins.slice(0, 7);
    return (recent.reduce((total, mood) => total + mood.score, 0) / recent.length).toFixed(1);
  }, [checkins]);

  // Mood insight: compare this week (last 7) vs previous week (8–14)
  const moodInsight = useMemo(() => {
    if (checkins.length < 2) return null;
    const thisWeek = checkins.slice(0, 7);
    const lastWeek = checkins.slice(7, 14);
    const thisAvg = thisWeek.reduce((s, c) => s + c.score, 0) / thisWeek.length;
    if (lastWeek.length === 0) {
      if (thisAvg >= 8) return { trend: 'up', line: "You've been doing really well this week. Keep it up." };
      if (thisAvg >= 6) return { trend: 'neutral', line: "You're holding steady. That's worth acknowledging." };
      return { trend: 'down', line: "It's been a tough week. You showed up anyway — that matters." };
    }
    const lastAvg = lastWeek.reduce((s, c) => s + c.score, 0) / lastWeek.length;
    const diff = thisAvg - lastAvg;
    if (diff >= 1) return { trend: 'up', line: `Up ${diff.toFixed(1)} points from last week. Something's going right.` };
    if (diff <= -1) return { trend: 'down', line: `Down ${Math.abs(diff).toFixed(1)} points from last week. Be gentle with yourself.` };
    return { trend: 'neutral', line: "Your mood has been consistent week over week." };
  }, [checkins]);

  const handleSaveMood = async () => {
    if (!selectedMood || savingMood) return;
    setSavingMood(true);
    setMoodNotice('');
    setMoodError('');
    try {
      const { data } = await api.post('/api/wellbeing/moods/', { score: selectedMood.score, source: 'wellbeing' });
      setCheckins((current) => [data, ...current]);
      setSelectedMood(null);
      setMoodNotice('Your check-in is saved. Thanks for taking a moment for yourself.');
    } catch (error) {
      setMoodError(getErrorMessage(error, 'Could not save your check-in. Please try again.'));
    } finally {
      setSavingMood(false);
    }
  };

  const handleSaveJournal = async (event) => {
    event.preventDefault();
    const body = journalDraft.trim();
    if (!body || savingJournal) return;
    setSavingJournal(true);
    setJournalError('');
    try {
      const { data } = await api.post('/api/wellbeing/journals/', { body });
      setJournalEntries((current) => [data, ...current]);
      setJournalDraft('');
    } catch (error) {
      setJournalError(getErrorMessage(error, 'Could not save your entry. Please try again.'));
    } finally {
      setSavingJournal(false);
    }
  };

  const startBreathing = () => {
    setCycles(0);
    setPhaseIndex(0);
    setSecondsLeft(phases[0].seconds);
    setMoodNotice('');
    setBreathing(true);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content">
        <header className="page-heading">
          <div className="eyebrow"><Sprout size={16} /> Your daily reset</div>
          <h1>Make space for calm.</h1>
          <p>A small pause can change the shape of your day. Check in, breathe, and take what you need.</p>
        </header>

        <div className="wellbeing-grid">
          <section className="panel wellbeing-checkins">
            <div className="section-title-row">
              <h2><Activity size={21} /> Your check-ins</h2>
              <span>{checkins.length} total</span>
            </div>
            {moodError && <p className="form-message error" role="alert">{moodError}</p>}
            {moodNotice && <p className="form-message success" role="status">{moodNotice}</p>}
            {loadingMoods ? <p className="muted-copy">Loading your check-ins…</p> : checkins.length === 0 ? (
              <p className="muted-copy">Your check-ins will appear here when you start tracking.</p>
            ) : (
              <>
                <div className="mood-summary"><span>Recent average</span><strong>{average} <small>/ 10</small></strong></div>
                <div className="checkin-list">
                  {checkins.slice(0, 6).map((checkin) => (
                    <article className="checkin-row" key={checkin.id}>
                      <span className="checkin-face" aria-hidden="true">{moods.find((mood) => mood.label === getMoodLabel(checkin.score))?.face || '😁'}</span>
                      <span className="checkin-copy"><strong>{getMoodLabel(checkin.score)}</strong><small>{formatDate(checkin.checked_in_at)}</small></span>
                      <span className="score-pill">{checkin.score}/10</span>
                    </article>
                  ))}
                </div>
              </>
            )}
            <Link to="/home" className="text-button">Back to home <ArrowRight size={16} /></Link>
          </section>

          <section className="panel mood-tracker">
            <div className="section-title-row">
              <h2><Heart size={21} /> How are you feeling?</h2>
            </div>
            <p className="muted-copy">There's no right answer. Choose what feels closest right now.</p>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 16px' }}>
              <MoodWheel selected={selectedMood} onChange={setSelectedMood} size={270} />
            </div>
            <button type="button" className="button mood-save" onClick={handleSaveMood} disabled={!selectedMood || savingMood}>
              {savingMood ? 'Saving…' : 'Save check-in'}
            </button>
          </section>

          <section className="panel breathing-card">
            <span className="wellbeing-practice-kicker">Today’s practice · 3 minutes</span>
            <div className="section-title-row">
              <h2><Wind size={21} /> Deep breath reset</h2>
              <span className="breathing-pattern">4 · 4 · 6</span>
            </div>
            <p>Let your shoulders soften. Follow a gentle pace: breathe in, pause, then breathe out slowly.</p>
            <div className={`breath-orb${breathing ? ' is-breathing' : ''}`} aria-live="polite">
              <strong>{breathing ? secondsLeft : 'Ready'}</strong>
              <span>{breathing ? phases[phaseIndex].name : 'Take a pause'}</span>
            </div>
            <p className="breathing-progress">{cycles} of 4 cycles</p>
            <button type="button" className="button button-light" onClick={breathing ? () => setBreathing(false) : startBreathing}>
              {breathing ? <><Pause size={16} /> Pause exercise</> : <><Play size={16} /> Start exercise</>}
            </button>
          </section>

          {moodInsight && (
            <section className="panel mood-insight-card">
              <div className="section-title-row">
                <h2>
                  {moodInsight.trend === 'up' && <TrendingUp size={21} color="var(--sky)" />}
                  {moodInsight.trend === 'down' && <TrendingDown size={21} color="var(--terra)" />}
                  {moodInsight.trend === 'neutral' && <Activity size={21} color="var(--sage)" />}
                  {' '}Your week
                </h2>
              </div>
              <div className="mood-insight-avg">
                <span className="mood-insight-number">{average}</span>
                <span className="mood-insight-denom">/ 10</span>
              </div>
              <p className="mood-insight-line">{moodInsight.line}</p>
              <div className="mood-insight-bar-wrap">
                <div
                  className="mood-insight-bar"
                  style={{ width: `${(parseFloat(average) / 10) * 100}%` }}
                  role="progressbar"
                  aria-valuenow={parseFloat(average)}
                  aria-valuemin={0}
                  aria-valuemax={10}
                />
              </div>
              <p className="mood-insight-label">7-day average</p>
            </section>
          )}
        </div>

        <section className="panel journal-panel">
          <div className="section-title-row">
            <div><h2>A little reflection</h2><p className="muted-copy">What would make tomorrow a little easier?</p></div>
            <BookOpen size={22} aria-hidden="true" />
          </div>
          <form onSubmit={handleSaveJournal} className="journal-form">
            <label className="sr-only" htmlFor="journal-entry">Write a private journal entry</label>
            <textarea id="journal-entry" value={journalDraft} onChange={(event) => setJournalDraft(event.target.value)} placeholder="Write whatever is on your mind..." rows="4" maxLength="4000" />
            <div className="journal-form-footer"><span>{journalDraft.length}/4000</span><button type="submit" className="button" disabled={!journalDraft.trim() || savingJournal}>{savingJournal ? 'Saving…' : 'Save entry'}</button></div>
          </form>
          {journalError && <p className="form-message error" role="alert">{journalError}</p>}
          {loadingJournal ? <p className="muted-copy">Loading your journal…</p> : journalEntries.length === 0 ? (
            <p className="muted-copy journal-empty">No entries yet. Your writing is private to your account.</p>
          ) : (
            <div className="journal-list">
              {journalEntries.slice(0, 5).map((entry) => (
                <article className="journal-entry" key={entry.id}>
                  <p>{entry.body}</p>
                  <time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="support-nudge">
          <div><strong>Need a little more support?</strong><p>You don't have to figure everything out on your own.</p></div>
          <Link to="/support" className="button button-warning">Find support <ArrowRight size={16} /></Link>
        </section>
      </main>
    </div>
  );
}
