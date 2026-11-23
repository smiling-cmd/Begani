import { useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { Activity, ArrowRight, BookOpen, Footprints, Hand, Heart, NotebookPen, Pause, Play, Sprout, TrendingDown, TrendingUp, Users, Wind } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';
import BoundariesTool from '../components/wellbeing/BoundariesTool';
import GratitudeTool from '../components/wellbeing/GratitudeTool';
import GroundingTool from '../components/wellbeing/GroundingTool';
import MeditationCard from '../components/wellbeing/MeditationCard';
import StudyFocusCard from '../components/wellbeing/StudyFocusCard';
import SleepSoundsCard from '../components/wellbeing/SleepSoundsCard';
import MovementTool from '../components/wellbeing/MovementTool';
import SelfCareCard from '../components/wellbeing/SelfCareCard';
import WeekChart from '../components/wellbeing/WeekChart';
import { getMoodLabel } from '../components/wellbeing/mood';

import wellbeingPhoto from '../assets/pages/wellbeing-reading.webp';
import './PageHeadingPhoto.css';
import './Wellbeing.css';

// Faces shown next to past check-ins. The daily check-in itself lives on Home.
const moods = [
  { score: 2, label: 'Very low', face: '☹' },
  { score: 4, label: 'Low', face: '🙁' },
  { score: 5, label: 'Okay', face: '😐' },
  { score: 8, label: 'Good', face: '🙂' },
  { score: 10, label: 'Great', face: '😁' },
];
// Breathing paces are [in, hold, out] in seconds.
const paces = [
  { key: 'gentle', label: 'Gentle', seconds: [4, 4, 6] },
  { key: 'relax', label: 'Relax', seconds: [4, 7, 8] },
  { key: 'even', label: 'Even', seconds: [4, 4, 4] },
];
const cycleOptions = [3, 4, 6];
const phaseNames = ['Breathe in', 'Hold', 'Breathe out'];

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
  const { hash } = useLocation();

  // Links from articles open a specific tool, e.g. /wellbeing#study-focus
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  const { token } = useContext(AuthContext);
  const [checkins, setCheckins] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [loadingMoods, setLoadingMoods] = useState(true);
  const [loadingJournal, setLoadingJournal] = useState(true);
  const [moodError, setMoodError] = useState('');
  const [journalError, setJournalError] = useState('');
  const [journalDraft, setJournalDraft] = useState('');
  const [savingJournal, setSavingJournal] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const [breathNotice, setBreathNotice] = useState('');
  const [paceKey, setPaceKey] = useState('gentle');
  const [totalCycles, setTotalCycles] = useState(4);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(paces[0].seconds[0]);
  const [cycles, setCycles] = useState(0);

  const pace = paces.find((item) => item.key === paceKey);
  const phases = useMemo(
    () => phaseNames.map((name, index) => ({ name, seconds: pace.seconds[index] })),
    [pace],
  );
  const practiceMinutes = Math.max(1, Math.round((pace.seconds.reduce((sum, value) => sum + value, 0) * totalCycles) / 60));

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
      if (completedCycles >= totalCycles) {
        setBreathing(false);
        setPhaseIndex(0);
        setSecondsLeft(phases[0].seconds);
        setBreathNotice(`You completed ${totalCycles} gentle breathing cycles. Take a moment before moving on.`);
        return;
      }
      setPhaseIndex(0);
      setSecondsLeft(phases[0].seconds);
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [breathing, secondsLeft, phaseIndex, cycles, phases, totalCycles]);

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

  const weekLine = moodInsight
    ? moodInsight.line
    : checkins.length
      ? 'One more check-in and your weekly trend will appear here.'
      : 'Do a check-in on Home and your week will start to take shape here.';

  const saveJournalBody = async (body) => {
    const { data } = await api.post('/api/wellbeing/journals/', { body });
    setJournalEntries((current) => [data, ...current]);
  };

  const handleSaveJournal = async (event) => {
    event.preventDefault();
    const body = journalDraft.trim();
    if (!body || savingJournal) return;
    setSavingJournal(true);
    setJournalError('');
    try {
      await saveJournalBody(body);
      setJournalDraft('');
    } catch (error) {
      setJournalError(getErrorMessage(error, 'Could not save your entry. Please try again.'));
    } finally {
      setSavingJournal(false);
    }
  };

  const handleSaveGratitude = async (items) => {
    const body = `Grateful for:\n${items.map((item, index) => `${index + 1}. ${item}`).join('\n')}`;
    try {
      await saveJournalBody(body);
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Could not save your gratitude note. Please try again.'));
    }
  };

  const resetBreathing = (nextPhases) => {
    setCycles(0);
    setPhaseIndex(0);
    setSecondsLeft(nextPhases[0].seconds);
    setBreathNotice('');
  };

  const startBreathing = () => {
    resetBreathing(phases);
    setBreathing(true);
  };

  const choosePace = (key) => {
    if (breathing) return;
    const next = paces.find((item) => item.key === key);
    setPaceKey(key);
    resetBreathing(phaseNames.map((name, index) => ({ name, seconds: next.seconds[index] })));
  };

  const chooseCycles = (count) => {
    if (breathing) return;
    setTotalCycles(count);
    resetBreathing(phases);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content">
        <header className="page-heading page-heading--photo">
          <div className="eyebrow"><Sprout size={16} /> Your daily reset</div>
          <h1>Make space for calm.</h1>
          <p>A small pause can change the shape of your day. Breathe, meditate, and take what you need.</p>
          <img className="page-heading-photo" src={wellbeingPhoto} alt="" width="640" height="400" loading="lazy" />
        </header>

        <div className="wellbeing-stack">
          <div className="wellbeing-grid">
            <section className="panel wellbeing-checkins" aria-labelledby="checkins-title">
              <div className="section-title-row">
                <h2 id="checkins-title"><Activity size={21} aria-hidden="true" /> Your check-ins</h2>
                <span>{checkins.length} total</span>
              </div>
              {moodError && <p className="form-message error" role="alert">{moodError}</p>}
              {loadingMoods ? <p className="muted-copy">Loading your check-ins…</p> : checkins.length === 0 ? (
                <p className="muted-copy">No check-ins yet. Your daily check-in lives on Home, and each one will show up here.</p>
              ) : (
                <>
                  <div className="mood-summary"><span>Recent average</span><strong>{average} <small>/ 10</small></strong></div>
                  <div className="checkin-list">
                    {checkins.slice(0, 5).map((checkin) => (
                      <article className="checkin-row" key={checkin.id}>
                        <span className="checkin-face" aria-hidden="true">{moods.find((mood) => mood.label === getMoodLabel(checkin.score))?.face || '😁'}</span>
                        <span className="checkin-copy"><strong>{getMoodLabel(checkin.score)}</strong><small>{formatDate(checkin.checked_in_at)}</small></span>
                        <span className="score-pill">{checkin.score}/10</span>
                      </article>
                    ))}
                  </div>
                </>
              )}
              <Link to="/home" className="text-button">Do today’s check-in on Home <ArrowRight size={16} aria-hidden="true" /></Link>
            </section>

            <section className="panel mood-insight-card" aria-labelledby="week-title">
              <div className="section-title-row">
                <h2 id="week-title">
                  {moodInsight?.trend === 'up' && <TrendingUp size={21} color="var(--brand-teal-deep)" aria-hidden="true" />}
                  {moodInsight?.trend === 'down' && <TrendingDown size={21} color="var(--terra)" aria-hidden="true" />}
                  {(!moodInsight || moodInsight.trend === 'neutral') && <Activity size={21} color="var(--muted)" aria-hidden="true" />}
                  Your week
                </h2>
                <span>7-day average</span>
              </div>
              {average === null ? (
                <div className="week-empty">
                  <div className="week-empty-bars" aria-hidden="true">
                    {[45, 70, 55, 85, 60, 75, 50].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
                  </div>
                  <p className="mood-insight-line">{loadingMoods ? 'Loading your week…' : weekLine}</p>
                </div>
              ) : (
                <>
                  <div className="mood-insight-avg">
                    <span className="mood-insight-number">{average}</span>
                    <span className="mood-insight-denom">/ 10</span>
                  </div>
                  <p className="mood-insight-line">{weekLine}</p>
                  <WeekChart checkins={checkins} />
                </>
              )}
            </section>
          </div>

          <div className="wellbeing-grid">
            <section className="panel practice-card breathing-card" aria-labelledby="breathing-title">
              <span className="wellbeing-practice-kicker">Today’s practice · about {practiceMinutes} min</span>
              <div className="section-title-row">
                <h2 id="breathing-title"><Wind size={21} aria-hidden="true" /> Deep breath reset</h2>
                <span className="practice-pill">{pace.seconds.join(' · ')}</span>
              </div>
              <p className="practice-lead">Let your shoulders soften. Follow a gentle pace: breathe in, pause, then breathe out slowly.</p>
              <div className="practice-options">
                <div className="chip-row" role="group" aria-label="Breathing pace">
                  {paces.map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      className="practice-chip"
                      aria-pressed={paceKey === item.key}
                      disabled={breathing}
                      onClick={() => choosePace(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="chip-row" role="group" aria-label="Number of cycles">
                  {cycleOptions.map((count) => (
                    <button
                      type="button"
                      key={count}
                      className="practice-chip"
                      aria-pressed={totalCycles === count}
                      disabled={breathing}
                      onClick={() => chooseCycles(count)}
                    >
                      {count} cycles
                    </button>
                  ))}
                </div>
              </div>
              <div className="practice-visual">
                <div className={`breath-orb${breathing ? ' is-breathing' : ''}`} aria-live="polite">
                  <strong>{breathing ? secondsLeft : 'Ready'}</strong>
                  <span>{breathing ? phases[phaseIndex].name : 'Take a pause'}</span>
                </div>
                <p className="practice-guide" role="status">{breathNotice || `${cycles} of ${totalCycles} cycles`}</p>
              </div>
              <div className="practice-actions">
                <button type="button" className="button" onClick={breathing ? () => setBreathing(false) : startBreathing}>
                  {breathing ? <><Pause size={16} aria-hidden="true" /> Pause exercise</> : <><Play size={16} aria-hidden="true" /> Start exercise</>}
                </button>
              </div>
            </section>

            <MeditationCard />
          </div>

          <div className="wellbeing-grid">
            <StudyFocusCard />
            <SleepSoundsCard />
          </div>

          <section className="panel selfcare-panel" aria-labelledby="selfcare-title">
            <div className="section-title-row">
              <div>
                <h2 id="selfcare-title">Everyday Self-Care &amp; Stress Tools</h2>
                <p className="muted-copy">Small habits you can use any day, whenever things feel heavy.</p>
              </div>
              <Heart size={22} aria-hidden="true" />
            </div>
            <div className="selfcare-grid">
              <SelfCareCard
                icon={Hand}
                title="5 Senses Grounding"
                text="Notice 5 things you see, 4 you can touch, 3 you hear, 2 you smell, and 1 you taste to anchor yourself in the present."
              >
                <GroundingTool />
              </SelfCareCard>
              <SelfCareCard
                icon={NotebookPen}
                title="Gratitude & Reflection"
                text="Write down a few positive moments or things you appreciate each day to shift focus toward helpful routines and perspective."
              >
                <GratitudeTool onSave={handleSaveGratitude} />
              </SelfCareCard>
              <SelfCareCard
                icon={Footprints}
                title="Mindfulness & Movement"
                text="Try slow breathing exercises, short walks, stretching, or consistent sleep habits to lower daily tension."
              >
                <MovementTool />
              </SelfCareCard>
              <SelfCareCard
                icon={Users}
                title="Boundaries & Social Support"
                text="Set clear limits on workload or screen time, and stay connected with supportive friends, family, or groups."
              >
                <BoundariesTool />
              </SelfCareCard>
            </div>
          </section>

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
        </div>
      </main>
    </div>
  );
}
