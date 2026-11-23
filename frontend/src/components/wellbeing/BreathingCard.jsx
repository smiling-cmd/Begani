import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, Wind } from 'lucide-react';

// Breathing paces are [in, hold, out] in seconds.
const paces = [
  { key: 'gentle', label: 'Gentle', seconds: [4, 4, 6] },
  { key: 'relax', label: 'Relax', seconds: [4, 7, 8] },
  { key: 'even', label: 'Even', seconds: [4, 4, 4] },
];
const cycleOptions = [3, 4, 6];
const phaseNames = ['Breathe in', 'Hold', 'Breathe out'];

export default function BreathingCard() {
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
  );
}
