import { useState } from 'react';
import { Flower2, Pause, Play, RotateCcw } from 'lucide-react';
import useCountdown, { formatClock } from './useCountdown';
import { localDateKey, readStored, writeStored } from './storage';

const STORAGE_KEY = 'begani-meditation-today';
const durations = [3, 5, 10];

// Each focus has seven prompts. The card shows them in order as the session
// moves along, so every length gets the same arc: settle, explore, return.
const focuses = [
  {
    key: 'body',
    label: 'Body scan',
    prompts: [
      'Settle into a comfortable position. Let your eyes close or soften your gaze.',
      'Take three slow breaths. With each out-breath, let your shoulders drop.',
      'Bring your attention to your feet. Notice any warmth, weight or tingling.',
      'Move up through your legs and hips. Let them feel heavy and supported.',
      'Notice your stomach and chest rising and falling. There is nothing to change.',
      'Soften your hands, arms, jaw and the space between your eyebrows.',
      'Rest in your whole body. When you are ready, open your eyes slowly.',
    ],
  },
  {
    key: 'calm',
    label: 'Calm mind',
    prompts: [
      'Sit comfortably and let your breath find its natural rhythm.',
      'Follow the breath at your nose or chest. Just notice in and out.',
      'When a thought appears, label it “thinking” and return to the breath.',
      'There is nothing to fix. Every return to the breath is the practice.',
      'Let the sounds around you come and go without following them.',
      'Rest here for a few more breaths, feeling steady.',
      'Gently bring your attention back to the room and open your eyes.',
    ],
  },
  {
    key: 'kindness',
    label: 'Kindness',
    prompts: [
      'Settle in. Rest a hand on your chest if that feels good.',
      'Silently say: may I be calm, and may I be kind to myself.',
      'Think of someone who cares about you and wish them well.',
      'May you be safe. May you be at ease.',
      'Picture a classmate or neighbour and wish them the same ease.',
      'Let that warmth spread outward, even to people you do not know.',
      'Return to your breath and carry this kindness into your day.',
    ],
  },
];

const RING_RADIUS = 56;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function readMinutesToday() {
  const saved = readStored(STORAGE_KEY, null);
  return saved && saved.date === localDateKey() ? Number(saved.minutes) || 0 : 0;
}

export default function MeditationCard() {
  const [minutes, setMinutes] = useState(5);
  const [focusKey, setFocusKey] = useState('body');
  const [minutesToday, setMinutesToday] = useState(readMinutesToday);
  const focus = focuses.find((item) => item.key === focusKey);

  const timer = useCountdown(minutes * 60, () => {
    const next = readMinutesToday() + minutes;
    writeStored(STORAGE_KEY, { date: localDateKey(), minutes: next });
    setMinutesToday(next);
  });

  const started = timer.remaining < timer.total;
  const active = timer.running || started;

  let guide = 'Choose a length and a focus, then press begin.';
  if (timer.done) {
    guide = 'Session complete. Notice how your body feels before you move on.';
  } else if (active) {
    const position = Math.min(focus.prompts.length - 1, Math.floor(timer.progress * focus.prompts.length));
    guide = focus.prompts[position];
  }

  let ringLabel = 'Ready';
  if (timer.done) ringLabel = 'Complete';
  else if (timer.running) ringLabel = 'Breathe';
  else if (started) ringLabel = 'Paused';

  let primaryLabel = 'Begin';
  if (timer.done) primaryLabel = 'Meditate again';
  else if (started) primaryLabel = 'Resume';

  const chooseMinutes = (value) => {
    if (timer.running) return;
    setMinutes(value);
    timer.reset(value * 60);
  };

  return (
    <section className="panel practice-card meditation-card" aria-labelledby="meditation-title">
      <span className="wellbeing-practice-kicker">Guided practice · {minutes} minutes</span>
      <div className="section-title-row">
        <h2 id="meditation-title"><Flower2 size={21} aria-hidden="true" /> Quiet mind meditation</h2>
        <span className="practice-pill">{focus.label}</span>
      </div>
      <p className="practice-lead">Settle in and let the prompts guide you. There is no right way to do this.</p>

      <div className="practice-options">
        <div className="chip-row" role="group" aria-label="Session length">
          {durations.map((value) => (
            <button
              type="button"
              key={value}
              className="practice-chip"
              aria-pressed={minutes === value}
              disabled={timer.running}
              onClick={() => chooseMinutes(value)}
            >
              {value} min
            </button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="Meditation focus">
          {focuses.map((item) => (
            <button
              type="button"
              key={item.key}
              className="practice-chip"
              aria-pressed={focusKey === item.key}
              disabled={timer.running}
              onClick={() => setFocusKey(item.key)}
            >
              {item.label}
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
            <span>{ringLabel}</span>
          </div>
        </div>
        <p className="practice-guide" aria-live="polite">{guide}</p>
        <p className="practice-stat">
          {minutesToday > 0 ? `${minutesToday} min of stillness today` : 'Your minutes today will show here'}
        </p>
      </div>

      <div className="practice-actions">
        <button type="button" className="button" onClick={timer.running ? timer.pause : timer.start}>
          {timer.running
            ? <><Pause size={16} aria-hidden="true" /> Pause</>
            : <><Play size={16} aria-hidden="true" /> {primaryLabel}</>}
        </button>
        {(started || timer.done) && (
          <button type="button" className="practice-reset" onClick={() => timer.reset()}>
            <RotateCcw size={15} aria-hidden="true" /> Reset
          </button>
        )}
      </div>
    </section>
  );
}
