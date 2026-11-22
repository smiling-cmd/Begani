import { useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import useCountdown, { formatClock } from './useCountdown';

const lengths = [1, 2, 3];

const resets = [
  {
    key: 'stretch',
    label: 'Stretch',
    steps: [
      'Stand tall and reach both arms overhead.',
      'Lean gently to one side, then the other.',
      'Roll your shoulders back and let them drop.',
    ],
  },
  {
    key: 'walk',
    label: 'Short walk',
    steps: [
      'Walk at an easy pace and leave your phone in your pocket.',
      'Feel each step land, heel to toe.',
      'Look up and notice three things around you.',
    ],
  },
  {
    key: 'breathe',
    label: 'Slow breaths',
    steps: [
      'Sit tall and relax your jaw.',
      'Breathe in for four counts, out for six.',
      'Let your shoulders soften with every out-breath.',
    ],
  },
];

// A short reset: pick something and a length, press start, follow the prompt.
export default function MovementTool() {
  const [choice, setChoice] = useState('stretch');
  const [minutes, setMinutes] = useState(1);
  const timer = useCountdown(minutes * 60);
  const reset = resets.find((item) => item.key === choice);
  const started = timer.remaining < timer.total;
  const active = timer.running || started;

  let instruction = 'Pick a quick reset and how long you have, then press start.';
  if (timer.done) {
    instruction = 'Nice work. Even a short pause can loosen tension.';
  } else if (active) {
    const position = Math.min(reset.steps.length - 1, Math.floor(timer.progress * reset.steps.length));
    instruction = reset.steps[position];
  }

  let primaryLabel = 'Start';
  if (timer.done) primaryLabel = 'Go again';
  else if (started) primaryLabel = 'Resume';

  return (
    <div className="selfcare-tool">
      <div className="chip-row" role="group" aria-label="Choose a reset">
        {resets.map((item) => (
          <button
            type="button"
            key={item.key}
            className="tool-chip"
            aria-pressed={choice === item.key}
            disabled={timer.running}
            onClick={() => { setChoice(item.key); timer.reset(); }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="chip-row" role="group" aria-label="Choose a length">
        {lengths.map((value) => (
          <button
            type="button"
            key={value}
            className="tool-chip"
            aria-pressed={minutes === value}
            disabled={timer.running}
            onClick={() => { setMinutes(value); timer.reset(value * 60); }}
          >
            {value} min
          </button>
        ))}
      </div>
      <p className="tool-instruction" aria-live="polite">{instruction}</p>
      <div
        className="movement-progress"
        role="progressbar"
        aria-label="Reset progress"
        aria-valuemin={0}
        aria-valuemax={timer.total}
        aria-valuenow={timer.total - timer.remaining}
      >
        <span style={{ width: `${timer.progress * 100}%` }} />
      </div>
      <div className="selfcare-footer">
        <small>{timer.done ? 'Done' : `${formatClock(timer.remaining)} left`}</small>
        <span className="selfcare-buttons">
          {(started || timer.done) && (
            <button type="button" className="text-button" onClick={() => timer.reset()}>
              <RotateCcw size={14} aria-hidden="true" /> Reset
            </button>
          )}
          <button type="button" className="button" onClick={timer.running ? timer.pause : timer.start}>
            {timer.running
              ? <><Pause size={16} aria-hidden="true" /> Pause</>
              : <><Play size={16} aria-hidden="true" /> {primaryLabel}</>}
          </button>
        </span>
      </div>
    </div>
  );
}
