import { useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';
import {
  Activity,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Flower2,
  Footprints,
  Hand,
  Headphones,
  Heart,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  Wind,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';
import BoundariesTool from '../components/wellbeing/BoundariesTool';
import BreathingCard from '../components/wellbeing/BreathingCard';
import GroundingTool from '../components/wellbeing/GroundingTool';
import MeditationCard from '../components/wellbeing/MeditationCard';
import StudyFocusCard from '../components/wellbeing/StudyFocusCard';
import SleepSoundsCard from '../components/wellbeing/SleepSoundsCard';
import MovementTool from '../components/wellbeing/MovementTool';
import SelfCareCard from '../components/wellbeing/SelfCareCard';
import WeekChart from '../components/wellbeing/WeekChart';
import { getMoodLabel } from '../components/wellbeing/mood';

import heroPhoto from '../assets/pages/wellbeing-hero.webp';
import './Wellbeing.css';
import '../components/wellbeing/FocusSleep.css';
import './WellbeingHub.css';

// Faces shown next to past check-ins. The daily check-in itself lives on Home.
const moods = [
  { score: 2, label: 'Very low', face: '☹' },
  { score: 4, label: 'Low', face: '🙁' },
  { score: 5, label: 'Okay', face: '😐' },
  { score: 8, label: 'Good', face: '🙂' },
  { score: 10, label: 'Great', face: '😁' },
];

// The tools students can open. Each one gets a tile; the chosen tool opens beside the tiles.
const TOOLS = [
  { id: 'breathing', hash: 'breathing', label: 'Breathing', blurb: 'Slow down. Breathe.', icon: Wind, tone: 'green' },
  { id: 'meditation', hash: 'meditation', label: 'Meditation', blurb: 'Find calm, one breath at a time.', icon: Flower2, tone: 'sage' },
  { id: 'study-focus', hash: 'study-focus', label: 'Study focus', blurb: 'Stay focused, beat distractions.', icon: Timer, tone: 'amber' },
  { id: 'sleep-sounds', hash: 'sleep-sounds', label: 'Sleep sounds', blurb: 'Drift into better sleep.', icon: Headphones, tone: 'rose' },
  { id: 'movement', hash: 'movement', label: 'Movement', blurb: 'Move your body, lift your mood.', icon: Footprints, tone: 'green' },
  { id: 'grounding', hash: 'grounding', label: 'Grounding', blurb: 'Come back to the present.', icon: Hand, tone: 'sage' },
  { id: 'boundaries', hash: 'boundaries', label: 'Boundaries', blurb: 'Protect your peace.', icon: Users, tone: 'rose' },
];
const TOOL_BY_HASH = Object.fromEntries(TOOLS.map((tool) => [tool.hash, tool.id]));

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

const scrollBehavior = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

export default function Wellbeing() {
  const { hash } = useLocation();
  const { token } = useContext(AuthContext);
  const [checkins, setCheckins] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [loadingMoods, setLoadingMoods] = useState(true);
  const [loadingJournal, setLoadingJournal] = useState(true);
  const [moodError, setMoodError] = useState('');
  const [journalError, setJournalError] = useState('');
  const [journalDraft, setJournalDraft] = useState('');
  const [savingJournal, setSavingJournal] = useState(false);
  const [journalSaved, setJournalSaved] = useState(false);

  // Which tool is open. A link such as /wellbeing#study-focus opens that tool; picking a tile afterwards wins.
  const hashTool = TOOL_BY_HASH[hash.slice(1)];
  const [picked, setPicked] = useState(null);
  const active = picked && picked.hash === hash ? picked.tool : hashTool || picked?.tool || 'breathing';
  // Tools stay mounted once opened, so a running timer or sound keeps going while you look at another tool.
  const [opened, setOpened] = useState(() => new Set([hashTool || 'breathing']));

  const chooseTool = (id) => {
    setPicked({ tool: id, hash });
    setOpened((current) => new Set([...current, active, id]));
    if (window.matchMedia('(max-width: 900px)').matches) {
      window.requestAnimationFrame(() => {
        document.getElementById('wb-workspace')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      });
    }
    document.getElementById('wb-workspace')?.focus({ preventScroll: true });
  };

  // Links from articles scroll to the tool they mention.
  useEffect(() => {
    if (!hashTool) return;
    document.getElementById('wb-workspace')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  }, [hashTool, hash]);

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
      setJournalSaved(true);
      window.setTimeout(() => setJournalSaved(false), 3000);
    } catch (error) {
      setJournalError(getErrorMessage(error, 'Could not save your entry. Please try again.'));
    } finally {
      setSavingJournal(false);
    }
  };

  const renderTool = (id) => {
    switch (id) {
      case 'breathing': return <BreathingCard />;
      case 'meditation': return <MeditationCard />;
      case 'study-focus': return <StudyFocusCard />;
      case 'sleep-sounds': return <SleepSoundsCard />;
      case 'movement':
        return (
          <section className="panel wb-selfcare">
            <SelfCareCard icon={Footprints} title="Mindfulness & Movement" text="Try slow breathing, a short walk or a stretch to lower daily tension.">
              <MovementTool />
            </SelfCareCard>
          </section>
        );
      case 'grounding':
        return (
          <section className="panel wb-selfcare">
            <SelfCareCard icon={Hand} title="5 Senses Grounding" text="Notice 5 things you see, 4 you can touch, 3 you hear, 2 you smell and 1 you taste to anchor yourself in the present.">
              <GroundingTool />
            </SelfCareCard>
          </section>
        );
      default:
        return (
          <section className="panel wb-selfcare">
            <SelfCareCard icon={Users} title="Boundaries & Social Support" text="Set clear limits on workload or screen time, and stay connected with people who support you.">
              <BoundariesTool />
            </SelfCareCard>
          </section>
        );
    }
  };

  const activeTool = TOOLS.find((tool) => tool.id === active);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content wb-page">
        <header className="wb-hero">
          <img className="wb-hero-photo" src={heroPhoto} alt="" width="1600" height="480" />
          <div className="wb-hero-copy">
            <span className="wb-hero-chip"><Heart size={14} aria-hidden="true" /> Wellbeing</span>
            <h1>Take care of your mind.</h1>
            <p>Small steps. Big difference.</p>
          </div>
        </header>

        <div className="wb-row">
          <section className="panel wb-checkins" aria-labelledby="checkins-title">
            <div className="wb-title">
              <span className="wb-title-icon" aria-hidden="true"><Activity size={19} /></span>
              <div><h2 id="checkins-title">Your check-ins</h2><p>A snapshot of your recent moods</p></div>
              <span className="wb-count">{checkins.length} total</span>
            </div>
            {moodError && <p className="form-message error" role="alert">{moodError}</p>}
            {loadingMoods ? <p className="muted-copy">Loading your check-ins…</p> : checkins.length === 0 ? (
              <p className="muted-copy wb-empty">No check-ins yet. Your daily check-in lives on Home, and each one will show up here.</p>
            ) : (
              <>
                <div className="wb-average"><span>Recent average</span><strong>{average}<small> /10</small></strong></div>
                <div className="checkin-list">
                  {checkins.slice(0, 4).map((checkin) => (
                    <article className="checkin-row" key={checkin.id}>
                      <span className="checkin-face" aria-hidden="true">{moods.find((mood) => mood.label === getMoodLabel(checkin.score))?.face || '😐'}</span>
                      <span className="checkin-copy"><strong>{getMoodLabel(checkin.score)}</strong><small>{formatDate(checkin.checked_in_at)}</small></span>
                      <span className="score-pill">{checkin.score}/10</span>
                    </article>
                  ))}
                </div>
              </>
            )}
            <Link to="/home" className="text-button">Do today’s check-in on Home <ArrowRight size={16} aria-hidden="true" /></Link>
          </section>

          <section className="panel wb-week" aria-labelledby="week-title">
            <div className="wb-title">
              <span className="wb-title-icon" aria-hidden="true">
                {moodInsight?.trend === 'down' ? <TrendingDown size={19} /> : <TrendingUp size={19} />}
              </span>
              <div><h2 id="week-title">Your week</h2><p>Mood trend over the past 7 days</p></div>
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
                <div className="wb-week-top">
                  <div className="wb-average"><span>Weekly average</span><strong>{average}<small> /10</small></strong></div>
                  <p className="mood-insight-line">{weekLine}</p>
                </div>
                <WeekChart checkins={checkins} />
              </>
            )}
          </section>
        </div>

        <section className="wb-tools" aria-labelledby="tools-title">
          <div className="wb-section-head">
            <h2 id="tools-title">Wellbeing tools</h2>
            <p>Pick one. Take what helps.</p>
          </div>
          <div className="wb-tools-layout">
            <div className="wb-tiles" role="group" aria-label="Wellbeing tools">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const isActive = active === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className={`wb-tile wb-tone-${tool.tone}${isActive ? ' is-active' : ''}`}
                    aria-pressed={isActive}
                    aria-controls="wb-workspace"
                    onClick={() => chooseTool(tool.id)}
                  >
                    <span className="wb-tile-icon" aria-hidden="true"><Icon size={22} /></span>
                    <span className="wb-tile-text"><strong>{tool.label}</strong><small>{tool.blurb}</small></span>
                    <ChevronRight size={18} aria-hidden="true" className="wb-tile-arrow" />
                  </button>
                );
              })}
            </div>
            <div className="wb-workspace" id="wb-workspace" tabIndex={-1} role="region" aria-label={`${activeTool.label} tool`}>
              {TOOLS.filter((tool) => opened.has(tool.id) || tool.id === active).map((tool) => (
                <div key={tool.id} hidden={tool.id !== active}>{renderTool(tool.id)}</div>
              ))}
            </div>
          </div>
        </section>

        <div className="wb-row wb-row--journal">
          <section className="panel journal-panel wb-journal">
            <div className="wb-title">
              <span className="wb-title-icon" aria-hidden="true"><BookOpen size={19} /></span>
              <div><h2>Your journal</h2><p>What would make tomorrow a little easier?</p></div>
            </div>
            <form onSubmit={handleSaveJournal} className="journal-form">
              <label className="sr-only" htmlFor="journal-entry">Write a private journal entry</label>
              <textarea id="journal-entry" value={journalDraft} onChange={(event) => { setJournalDraft(event.target.value); setJournalSaved(false); }} placeholder="Write whatever is on your mind, or three things that went well today..." rows="4" maxLength="4000" />
              <div className="journal-form-footer"><span role="status">{journalSaved ? 'Entry saved' : `${journalDraft.length}/4000`}</span><button type="submit" className="button" disabled={!journalDraft.trim() || savingJournal}>{savingJournal ? 'Saving…' : 'Save entry'}</button></div>
            </form>
            {journalError && <p className="form-message error" role="alert">{journalError}</p>}
            {loadingJournal ? <p className="muted-copy">Loading your journal…</p> : journalEntries.length === 0 ? (
              <p className="muted-copy journal-empty">No entries yet. Your writing is private to your account.</p>
            ) : (
              <div className="journal-list">
                {journalEntries.slice(0, 3).map((entry) => (
                  <article className="journal-entry" key={entry.id}>
                    <p>{entry.body}</p>
                    <time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="wb-support" aria-labelledby="support-title">
            <span className="wb-support-icon" aria-hidden="true"><Heart size={24} /></span>
            <h2 id="support-title">Need a little more support?</h2>
            <p>You don’t have to figure everything out on your own. Talk to a counsellor or explore support options.</p>
            <Link to="/support" className="button">Find support <ArrowRight size={16} aria-hidden="true" /></Link>
          </section>
        </div>
      </main>
    </div>
  );
}