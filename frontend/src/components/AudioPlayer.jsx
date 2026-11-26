import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Pause, Play, RotateCcw, RotateCw, X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import ArtScene from './ResourceArt';
import './AudioPlayer.css';

// One audio element for the whole app. It lives above the routes, so a track keeps
// playing while the student moves between pages.
const PlayerContext = createContext(null);

// The hook lives beside its provider on purpose: they are one feature and always used together.
// oxlint-disable-next-line react/only-export-components
export function usePlayer() {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return value;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function Art({ track, className }) {
  if (track.cover_image) return <img className={className} src={track.cover_image} alt="" />;
  return <span className={`${className} ap-art-fallback ap-art-scene`}><ArtScene resource={track} /></span>;
}

export function PlayerProvider({ children }) {
  const { token } = useContext(AuthContext);
  const audioRef = useRef(null);
  const collapseRef = useRef(null);
  const [track, setTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const trackId = track?.id;

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (audio.ended) audio.currentTime = 0;
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, []);

  const seekTo = useCallback((value) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setTime(value);
  }, []);

  const skip = useCallback((delta) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : Infinity;
    seekTo(Math.min(Math.max(audio.currentTime + delta, 0), max));
  }, [seekTo]);

  // Picking a new track starts it and opens the full player; picking the current one just play/pauses.
  const playTrack = useCallback((resource, src) => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (resource.id === trackId) {
      toggle();
      return;
    }
    audio.src = src;
    setTrack(resource);
    setTime(0);
    setDuration(0);
    setExpanded(true);
    audio.play().catch(() => setPlaying(false));
  }, [trackId, toggle]);

  const close = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setTrack(null);
    setPlaying(false);
    setExpanded(false);
    setTime(0);
    setDuration(0);
  }, []);

  // Signing out stops the audio so it doesn't carry on over the login page
  useEffect(() => {
    // Stopping the player when the session ends is the point of this effect.
    // oxlint-disable-next-line react/set-state-in-effect
    if (!token && trackId) close();
  }, [token, trackId, close]);

  // Lock screen / headset controls
  useEffect(() => {
    if (!track || !('mediaSession' in navigator)) return undefined;
    const session = navigator.mediaSession;
    try {
      session.metadata = new window.MediaMetadata({
        title: track.title,
        artist: track.category || 'Wellbeing',
        artwork: track.cover_image ? [{ src: track.cover_image }] : [],
      });
    } catch { /* metadata is optional */ }
    const handlers = {
      play: () => audioRef.current?.play(),
      pause: () => audioRef.current?.pause(),
      seekbackward: () => skip(-15),
      seekforward: () => skip(15),
    };
    Object.entries(handlers).forEach(([action, handler]) => {
      try { session.setActionHandler(action, handler); } catch { /* action not supported */ }
    });
    return () => {
      Object.keys(handlers).forEach((action) => {
        try { session.setActionHandler(action, null); } catch { /* ignore */ }
      });
    };
  }, [track, skip]);

  // Full player: Escape minimises, page behind does not scroll
  useEffect(() => {
    if (!expanded) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    collapseRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  const value = useMemo(() => ({ track, playing, playTrack }), [track, playing, playTrack]);
  const progress = duration ? Math.min(time / duration, 1) : 0;
  const playLabel = playing ? 'Pause' : 'Play';

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setPlaying(false)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      />

      {track && !expanded && (
        <div className="ap-mini" role="region" aria-label="Audio player">
          <button type="button" className="ap-mini-open" onClick={() => setExpanded(true)} aria-label={`Open player: ${track.title}`}>
            <Art track={track} className="ap-mini-art" />
            <span className="ap-mini-text"><strong>{track.title}</strong><small>{track.category || 'Audio'}</small></span>
          </button>
          <button type="button" className="ap-mini-play" onClick={toggle} aria-label={`${playLabel} ${track.title}`}>
            {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
          </button>
          <button type="button" className="ap-mini-close" onClick={close} aria-label="Stop and close player">
            <X size={18} aria-hidden="true" />
          </button>
          <span className="ap-mini-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
        </div>
      )}

      {track && expanded && (
        <div className="ap-full" role="dialog" aria-modal="true" aria-label={`Now playing: ${track.title}`}>
          <div className="ap-full-top">
            <button ref={collapseRef} type="button" className="ap-round" onClick={() => setExpanded(false)} aria-label="Minimise player, keep playing">
              <ChevronDown size={26} aria-hidden="true" />
            </button>
            <span className="ap-full-title">{track.title}</span>
            <span aria-hidden="true" />
          </div>

          <div className="ap-full-body">
            <Art track={track} className="ap-art" />
            <p className="ap-full-category">{track.category || 'Audio'}</p>

            <div className="ap-seek">
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="1"
                value={Math.min(time, duration || 0)}
                disabled={!duration}
                onChange={(event) => seekTo(Number(event.target.value))}
                aria-label="Seek"
                aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
              />
              <div className="ap-times"><span>{formatTime(time)}</span><span>{formatTime(duration)}</span></div>
            </div>

            <div className="ap-controls">
              <button type="button" className="ap-skip" onClick={() => skip(-15)} aria-label="Back 15 seconds">
                <RotateCcw size={30} aria-hidden="true" /><span aria-hidden="true">15</span>
              </button>
              <button type="button" className="ap-play" onClick={toggle} aria-label={playLabel}>
                {playing ? <Pause size={32} aria-hidden="true" /> : <Play size={32} aria-hidden="true" />}
              </button>
              <button type="button" className="ap-skip" onClick={() => skip(15)} aria-label="Forward 15 seconds">
                <RotateCw size={30} aria-hidden="true" /><span aria-hidden="true">15</span>
              </button>
            </div>
          </div>

          <button type="button" className="ap-stop" onClick={close} aria-label="Stop and close player">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </PlayerContext.Provider>
  );
}