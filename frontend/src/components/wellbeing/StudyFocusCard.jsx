import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import useCountdown, { formatClock } from './useCountdown';
import { localDateKey, readStored, writeStored } from './storage';
import './FocusSleep.css';

const STORAGE_KEY = 'begani-focus-today';
const PLANS = [
  { key: 'classic', label: '25 / 5', focus: 25, short: 5, long: 15 },
  { key: 'deep', label: '50 / 10', focus: 50, short: 10, long: 20 },
];
const MODE_LABELS = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const RING_RADIUS = 56;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function readToday() {
  const saved = readStored(STORAGE_KEY, null);
  return saved && saved.date === localDateKey() ? Number(saved.sessions) || 0 : 0;
}

export default function StudyFocusCard() {
  const [planKey, setPlanKey] = useState('classic');
  const [mode, setMode] = useState('focus');
  const [round, setRound] = useState(1);
  const [sessionsToday, setSessionsToday] = useState(readToday);
  const [message, setMessage] = useState('');
  const plan = PLANS.find((item) => item.key === planKey);
  const timerRef = useRef(null);

  const timer = useCountdown(plan.focus * 60, () => {
    if (mode === 'focus') {
      const next = readToday() + 1;
      writeStored(STORAGE_KEY, { date: localDateKey(), sessions: next });
      setSessionsToday(next);
      const takeLong = round % 4 === 0;
      const nextMode = takeLong ? 'long' : 'short';
      const minutes = takeLong ? plan.long : plan.short;
      setMode(nextMode);
      setMessage(`Focus session done. Take a ${minutes}-minute break, you earned it.`);
      timerRef.current.reset(minutes * 60);
    } else {
      setMode('focus');
      setRound((current) => (mode === 'long' ? 1 : current + 1));
      setMessage('Break over. Ready for the next focus session when you are.');
      timerRef.current.reset(plan.focus * 60);
    }
  });

  useEffect(() => {
    timerRef.current = timer;
  });

  const started = timer.remaining < timer.total;

  const choosePlan = (key) => {
    if (timer.running) return;
    const next = PLANS.find((item) => item.key === key);
    setPlanKey(key);
    setMode('focus');
    setRound(1);
    setMessage('');
    timer.reset(next.focus * 60);
  };

  const resetAll = () => {
    setMode('focus');
    setRound(1);
    setMessage('');
    timer.reset(plan.focus * 60);
  };

  let guide = 'Pick one task, press start, and keep going until the timer ends.';
  if (message) guide = message;
  else if (timer.running && mode === 'focus') guide = 'Stay with one task. Everything else can wait.';
  else if (timer.running) guide = 'Step away from your desk. Stretch, sip water, rest your eyes.';

  return (
    <section id="study-focus" className="panel practice-card focus-card" aria-labelledby="focus-title">
      <span className="wellbeing-practice-kicker">Study &amp; Focus · session {round} of 4</span>
      <div className="section-title-row">
        <h2 id="focus-title"><Timer size={21} aria-hidden="true" /> Pomodoro timer</h2>
        <span className="practice-pill">{MODE_LABELS[mode]}</span>
      </div>
      <p className="practice-lead">Work in short, focused sessions with real breaks. It makes a big workload feel manageable.</p>

      <div className="practice-options">
        <div className="chip-row" role="group" aria-label="Session plan">
          {PLANS.map((item) => (
            <button
              type="button"
              key={item.key}
              className="practice-chip"
              aria-pressed={planKey === item.key}
              disabled={timer.running}
              onClick={() => choosePlan(item.key)}
            >
              {item.label} min
            </button>
          ))}
        </div>
      </div>

      <div className="practice-visual">
        <div className={`meditation-ring${timer.running ? ' is-running' : ''}`}>
          <svg viewBox="0 0 128 128" aria-hidden="true">
            <circle className="ring-track" cx="64" cy="64" r={RING_RADIUS} />
            <circle
              className="ring-progress"
              cx="64"
              cy="64"
              r={RING_RADIUS}
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - timer.progress)}
            />
          </svg>
          <div className="ring-copy">
            <strong>{formatClock(timer.remaining)}</strong>
            <span>{timer.running ? MODE_LABELS[mode] : started ? 'Paused' : 'Ready'}</span>
          </div>
        </div>
        <p className="practice-guide" aria-live="polite">{guide}</p>
        <p className="practice-stat">
          {sessionsToday > 0
            ? `${sessionsToday} focus ${sessionsToday === 1 ? 'session' : 'sessions'} today`
            : 'Your focus sessions today will show here'}
        </p>
      </div>

      <div className="practice-actions">
        <button type="button" className="button" onClick={timer.running ? timer.pause : timer.start}>
          {timer.running
            ? <><Pause size={16} aria-hidden="true" /> Pause</>
            : <><Play size={16} aria-hidden="true" /> {started ? 'Resume' : 'Start'}</>}
        </button>
        {(started || mode !== 'focus' || round > 1) && (
          <button type="button" className="practice-reset" onClick={resetAll}>
            <RotateCcw size={15} aria-hidden="true" /> Reset
          </button>
        )}
      </div>
    </section>
  );
}
