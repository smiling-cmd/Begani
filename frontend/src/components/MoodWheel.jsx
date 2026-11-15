import './MoodWheel.css';

const moods = [
  { label: 'Very low', score: 2, face: '😞', range: '1–2' },
  { label: 'Low', score: 4, face: '🙁', range: '3–4' },
  { label: 'Okay', score: 5, face: '😐', range: '5–6' },
  { label: 'Good', score: 8, face: '🙂', range: '7–8' },
  { label: 'Great', score: 10, face: '😁', range: '9–10' },
];

export default function MoodWheel({ selected, onChange, size = 240 }) {
  return (
    <div className="mood-wheel" style={{ '--mood-wheel-size': `${size}px` }}>
      <div className="mood-wheel-options" role="group" aria-label="Choose your mood">
        {moods.map((mood) => {
          const isSelected = selected?.score === mood.score;
          return (
            <button
              className={`mood-wheel-option${isSelected ? ' selected' : ''}`}
              type="button"
              key={mood.score}
              onClick={() => onChange(mood)}
              aria-pressed={isSelected}
            >
              <span className="mood-wheel-face" aria-hidden="true">{mood.face}</span>
              <span className="mood-wheel-label">{mood.label}</span>
              <span className="mood-wheel-range">{mood.range}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
