import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { localDateKey, readStored, writeStored } from './storage';

const STORAGE_KEY = 'begani-boundaries-today';

const items = [
  { key: 'screens', label: 'Take a 15-minute screen-free break' },
  { key: 'no', label: 'Say “not now” to one extra request' },
  { key: 'stop', label: 'Set a stop time for studying tonight' },
  { key: 'reach', label: 'Message or call someone supportive' },
];

// Ticks reset every day. They are kept on this device only.
function readDone() {
  const saved = readStored(STORAGE_KEY, null);
  return saved && saved.date === localDateKey() && saved.done ? saved.done : {};
}

export default function BoundariesTool() {
  const [done, setDone] = useState(readDone);
  const count = items.filter((item) => done[item.key]).length;

  const toggle = (key) => {
    const next = { ...done, [key]: !done[key] };
    setDone(next);
    writeStored(STORAGE_KEY, { date: localDateKey(), done: next });
  };

  return (
    <div className="selfcare-tool">
      <ul className="check-list">
        {items.map((item) => (
          <li key={item.key}>
            <label className={`check-row${done[item.key] ? ' is-done' : ''}`}>
              <input type="checkbox" checked={Boolean(done[item.key])} onChange={() => toggle(item.key)} />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="selfcare-footer">
        <small aria-live="polite">{count} of {items.length} done today</small>
        <Link to="/support" className="text-button">Talk to someone <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </div>
  );
}
