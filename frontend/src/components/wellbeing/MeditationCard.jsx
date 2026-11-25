import { useEffect, useRef, useState } from 'react';
import { Flower2, Pause, Play, RotateCcw } from 'lucide-react';
import useCountdown, { formatClock } from './useCountdown';
import { localDateKey, readStored, writeStored } from './storage';
import MeditationVideos from './MeditationVideos';
import api from '../../api';

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

// Guided audios from Resources (breathing / mindfulness / meditation). When there are any,
// the session lengths become those recordings and the timer follows the audio.
const GUIDED_TITLE = /medit|mindful|breath|body scan|guided/i;

function useGuidedAudios() {
  const [audios, setAudios] = useState([]);
  const [lengths, setLengths] = useState({});

  useEffect(() => {
    let live = true;
    const probes = [];
    api.get('/api/resources/')
      .then(({ data }) => {
        if (!live) return;
        const list = Array.isArray(data) ? data : data.results || [];
        const found = list
          .filter((item) => item.type === 'audio' && !/sleep/i.test(item.category || '') && GUIDED_TITLE.test(item.title || ''))
          .map((item) => ({ id: item.id, title: item.title, src: item.audio_file || item.media_url || '' }))
          .filter((item) => item.src);
        setAudios(found);
        found.forEach((item) => {
          const probe = new Audio();
          probe.preload = 'metadata';
          probe.addEventListener('loadedmetadata', () => {
            if (live && Number.isFinite(probe.duration) && probe.duration > 0) {
              setLengths((current) => ({ ...current, [item.id]: Math.ceil(probe.duration) }));
            }
          });
          probe.src = item.src;
          probes.push(probe);
        });
      })
      .catch(() => { /* the prompt timer still works */ });
    return () => { live = false; probes.forEach((probe) => { probe.removeAttribute('src'); }); };
  }, []);

  return audios
    .filter((item) => lengths[item.id])
    .map((item) => ({ ...item, seconds: lengths[item.id], minutes: Number((/(\d+)[\s-]*min/i.exec(item.title) || [])[1]) || Math.max(1, Math.round(lengths[item.id] / 60)) }))
    .sort((a, b) => a.seconds - b.seconds);
}

export default function MeditationCard() {
  const guided = useGuidedAudios();
  const audioRef = useRef(null);
  const [audioId, setAudioId] = useState(null);
  const [playError, setPlayError] = useState(false);
  const selectedAudio = guided.length
    ? guided.find((item) => item.id === audioId) || guided.find((item) => item.minutes === 5) || guided[0]
    : null;
  const [minutes, setMinutes] = useState(5);
  const [focusKey, setFocusKey] = useState('body');
  const [minutesToday, setMinutesToday] = useState(readMinutesToday);
  const focus = focuses.find((item) => item.key === focusKey);

  const sessionMinutes = selectedAudio ? selectedAudio.minutes : minutes;
  const timer = useCountdown(minutes * 60, () => {
    const next = readMinutesToday() + sessionMinutes;
    writeStored(STORAGE_KEY, { date: localDateKey(), minutes: next });
    setMinutesToday(next);
  });

  const started = timer.remaining < timer.total;
  const active = timer.running || started;
  const idleAudio = selectedAudio && !started && !timer.done;
  const shownRemaining = idleAudio ? selectedAudio.seconds : timer.remaining;
  const shownProgress = idleAudio ? 0 : timer.progress;

  useEffect(() => {
    const element = audioRef.current;
    return () => { if (element) element.pause(); };
  }, []);

  let guide = 'Choose a length and a focus, then press begin.';
  if (selectedAudio) {
    guide = 'Find a comfortable position, press begin and follow the voice.';
    if (timer.done) guide = 'Session complete. Notice how your body feels before you move on.';
    else if (active) guide = playError ? 'The audio could not play. Check your connection and try again.' : 'Follow the voice. Let your breathing be natural.';
  } else if (timer.done) {
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

  const chooseAudio = (item) => {
    if (timer.running) return;
    setAudioId(item.id);
    setPlayError(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    timer.reset(item.seconds);
  };

  const toggle = () => {
    if (timer.running) {
      timer.pause();
      if (audioRef.current) audioRef.current.pause();
      return;
    }
    if (selectedAudio) {
      const element = audioRef.current;
      if (!started || timer.done) {
        timer.reset(selectedAudio.seconds);
        if (element) element.currentTime = 0;
      }
      setPlayError(false);
      if (element) element.play().catch(() => setPlayError(true));
    }
    timer.start();
  };

  const resetSession = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    timer.reset();
  };

  const chooseMinutes = (value) => {
    if (timer.running) return;
    setMinutes(value);
    timer.reset(value * 60);
  };

  return (
    <section id="meditation" className="panel practice-card meditation-card" aria-labelledby="meditation-title">
      <span className="wellbeing-practice-kicker">Guided practice · {sessionMinutes} minutes</span>
      <div className="section-title-row">
        <h2 id="meditation-title"><Flower2 size={21} aria-hidden="true" /> Quiet mind meditation</h2>
        <span className="practice-pill">{selectedAudio ? 'Guided audio' : focus.label}</span>
      </div>
      <p className="practice-lead">
        {selectedAudio ? 'Put on headphones if you can, and let the recording guide you. There is no right way to do this.' : 'Settle in and let the prompts guide you. There is no right way to do this.'}
      </p>

      <div className="practice-options">
        <div className="chip-row" role="group" aria-label="Session length">
          {selectedAudio
            ? guided.map((item) => (
              <button
                type="button"
                key={item.id}
                className="practice-chip"
                aria-pressed={selectedAudio.id === item.id}
                disabled={timer.running}
                title={item.title}
                onClick={() => chooseAudio(item)}
              >
                {item.minutes} min
              </button>
            ))
            : durations.map((value) => (
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
        {selectedAudio ? (
          <p className="practice-guide">{selectedAudio.title}</p>
        ) : (
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
        )}
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
              strokeDashoffset={RING_LENGTH * (1 - shownProgress)}
            />
          </svg>
          <div className="ring-copy">
            <strong>{formatClock(shownRemaining)}</strong>
            <span>{ringLabel}</span>
          </div>
        </div>
        <p className="practice-guide" aria-live="polite">{guide}</p>
        <p className="practice-stat">
          {minutesToday > 0 ? `${minutesToday} min of stillness today` : 'Your minutes today will show here'}
        </p>
      </div>

      <div className="practice-actions">
        <button type="button" className="button" onClick={toggle}>
          {timer.running
            ? <><Pause size={16} aria-hidden="true" /> Pause</>
            : <><Play size={16} aria-hidden="true" /> {primaryLabel}</>}
        </button>
        {(started || timer.done) && (
          <button type="button" className="practice-reset" onClick={resetSession}>
            <RotateCcw size={15} aria-hidden="true" /> Reset
          </button>
        )}
      </div>

      {selectedAudio && <audio ref={audioRef} src={selectedAudio.src} preload="auto" />}

      <MeditationVideos />
    </section>
  );
}
