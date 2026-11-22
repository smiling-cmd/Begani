import { useState } from 'react';
import { getMoodLabel } from './mood';

const band = (score) => (score >= 7 ? 'is-high' : score >= 5 ? 'is-mid' : 'is-low');
const shortDay = (value) => new Date(value).toLocaleDateString([], { weekday: 'short' });
const longDay = (value) => new Date(value).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });

// Last seven check-ins as bars. Hover, focus or tap a bar to read its details.
export default function WeekChart({ checkins }) {
  const week = checkins.slice(0, 7).reverse();
  const [selected, setSelected] = useState(null);
  if (!week.length) return null;

  const index = Math.min(selected ?? week.length - 1, week.length - 1);
  const current = week[index];

  return (
    <div className="week-chart">
      <div className="week-bars" role="group" aria-label="Your most recent check-ins, oldest to newest">
        {week.map((checkin, position) => (
          <button
            type="button"
            key={checkin.id}
            className={`week-bar ${band(checkin.score)}${position === index ? ' is-active' : ''}`}
            aria-pressed={position === index}
            aria-label={`${longDay(checkin.checked_in_at)}: ${getMoodLabel(checkin.score)}, ${checkin.score} out of 10`}
            onMouseEnter={() => setSelected(position)}
            onFocus={() => setSelected(position)}
            onClick={() => setSelected(position)}
          >
            <span className="week-bar-track">
              <span className="week-bar-fill" style={{ height: `${checkin.score * 10}%` }} />
            </span>
            <small>{shortDay(checkin.checked_in_at)}</small>
          </button>
        ))}
      </div>
      <p className="week-readout" aria-live="polite">
        {longDay(current.checked_in_at)} · {getMoodLabel(current.score)} · {current.score}/10
      </p>
    </div>
  );
}
