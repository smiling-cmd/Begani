import { useEffect, useRef, useState } from 'react';
import { Moon, Pause, Play } from 'lucide-react';
import { SOUNDS, createAmbientPlayer } from '../../utils/ambientSound';
import './FocusSleep.css';

const TIMERS = [
  { label: 'No timer', minutes: 0 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '60 min', minutes: 60 },
];

export default function SleepSoundsCard() {
    const sleepTimeout = useRef(null);
  const [sound, setSound] = useState('rain');
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [timerMinutes, setTimerMinutes] = useState(30);
  const [notice, setNotice] = useState('');

  const [player] = useState(createAmbientPlayer);

  useEffect(() => () => {
    window.clearTimeout(sleepTimeout.current);
    player.dispose();
  }, [player]);

  const stop = (message = '') => {
    window.clearTimeout(sleepTimeout.current);
    player.stop();
    setPlaying(false);
    setNotice(message);
  };

  const begin = async (kind) => {
    window.clearTimeout(sleepTimeout.current);
    const ok = await player.play(kind);
    if (!ok) {
      setNotice('Your browser cannot play generated sounds.');
      return;
    }
    setPlaying(true);
    setNotice('');
    if (timerMinutes > 0) {
      sleepTimeout.current = window.setTimeout(() => stop('Sleep timer finished. Sleep well.'), timerMinutes * 60 * 1000);
    }
  };

  const chooseSound = (kind) => {
    setSound(kind);
    if (playing) begin(kind);
  };

  const chooseTimer = (minutes) => {
    setTimerMinutes(minutes);
    if (playing) {
      window.clearTimeout(sleepTimeout.current);
      if (minutes > 0) {
        sleepTimeout.current = window.setTimeout(() => stop('Sleep timer finished. Sleep well.'), minutes * 60 * 1000);
      }
    }
  };

  const changeVolume = (event) => {
    const value = Number(event.target.value);
    setVolume(value);
    player.setVolume(value / 100);
  };

  return (
    <section id="sleep-sounds" className="panel practice-card sleep-card" aria-labelledby="sleep-title">
      <span className="wellbeing-practice-kicker">Sleep &amp; Relaxation</span>
      <div className="section-title-row">
        <h2 id="sleep-title"><Moon size={21} aria-hidden="true" /> Calming sounds</h2>
        <span className="practice-pill">{playing ? 'Playing' : 'Ready'}</span>
      </div>
      <p className="practice-lead">Play gentle sounds while you wind down, study or rest. They loop quietly in the background.</p>

      <div className="practice-options">
        <div className="chip-row" role="group" aria-label="Sound">
          {SOUNDS.map((item) => (
            <button
              type="button"
              key={item.key}
              className="practice-chip"
              aria-pressed={sound === item.key}
              onClick={() => chooseSound(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="Sleep timer">
          {TIMERS.map((item) => (
            <button
              type="button"
              key={item.minutes}
              className="practice-chip"
              aria-pressed={timerMinutes === item.minutes}
              onClick={() => chooseTimer(item.minutes)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <label className="sound-volume">
        <span>Volume</span>
        <input type="range" min="5" max="100" value={volume} onChange={changeVolume} aria-label="Volume" />
      </label>

      <p className="practice-guide" role="status">
        {notice || (playing ? `${SOUNDS.find((item) => item.key === sound).label} is playing.` : 'Choose a sound and press play.')}
      </p>

      <div className="practice-actions">
        <button type="button" className="button" onClick={playing ? () => stop() : () => begin(sound)}>
          {playing ? <><Pause size={16} aria-hidden="true" /> Stop</> : <><Play size={16} aria-hidden="true" /> Play</>}
        </button>
      </div>
      <p className="practice-stat">Sounds are generated on your device, so they work without downloads.</p>
    </section>
  );
}
