import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

const senses = [
  { count: 5, label: 'see', hint: 'Look around slowly: a colour, a shape, the light on a surface.' },
  { count: 4, label: 'touch', hint: 'Feel your feet on the floor, fabric on your skin, the air on your hands.' },
  { count: 3, label: 'hear', hint: 'Listen for nearby sounds first, then ones further away.' },
  { count: 2, label: 'smell', hint: 'Notice any scent around you, or recall one that comforts you.' },
  { count: 1, label: 'taste', hint: 'Notice what is in your mouth, or take a slow sip of water.' },
];

// Step through 5-4-3-2-1: tap once for every thing you notice and the
// exercise moves on by itself.
export default function GroundingTool() {
  const [progress, setProgress] = useState({ step: 0, taps: 0 });
  const finished = progress.step >= senses.length;
  const current = senses[progress.step];
  const started = progress.step > 0 || progress.taps > 0;

  const noticeOne = () => {
    setProgress(({ step, taps }) => {
      if (step >= senses.length) return { step, taps };
      const nextTaps = taps + 1;
      return nextTaps >= senses[step].count ? { step: step + 1, taps: 0 } : { step, taps: nextTaps };
    });
  };
  const restart = () => setProgress({ step: 0, taps: 0 });

  const remaining = current ? current.count - progress.taps : 0;

  return (
    <div className="selfcare-tool">
      <ol className="senses-steps" aria-label="Grounding steps">
        {senses.map((sense, index) => {
          let state;
          if (index < progress.step) state = 'is-done';
          else if (index === progress.step) state = 'is-active';
          return (
            <li key={sense.count} className={state} aria-current={state === 'is-active' ? 'step' : undefined}>
              <b>{sense.count}</b>{sense.label}
            </li>
          );
        })}
      </ol>

      {finished ? (
        <div className="grounding-focus" role="status">
          <strong>You are here, in this moment.</strong>
          <p>Take one slow breath and notice how your body feels now.</p>
        </div>
      ) : (
        <div className="grounding-focus" aria-live="polite">
          <strong>Find {remaining} more {remaining === 1 ? 'thing' : 'things'} you can {current.label}</strong>
          <p>{current.hint}</p>
          <div className="grounding-dots" aria-hidden="true">
            {Array.from({ length: current.count }, (_, index) => (
              <i key={index} className={index < progress.taps ? 'is-filled' : undefined} />
            ))}
          </div>
        </div>
      )}

      <div className="selfcare-footer">
        {finished
          ? <button type="button" className="button" onClick={restart}>Do it again</button>
          : <button type="button" className="button" onClick={noticeOne}>I noticed one</button>}
        {started && !finished && (
          <button type="button" className="text-button" onClick={restart}>
            <RotateCcw size={14} aria-hidden="true" /> Start over
          </button>
        )}
      </div>
    </div>
  );
}
