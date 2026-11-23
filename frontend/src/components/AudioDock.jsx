import { useState } from 'react';
import { Pause, Play, X } from 'lucide-react';

function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

// A small player pinned to the bottom of the page. The page owns the audio
// element through audioRef so cards can start, pause and resume the same track.
export default function AudioDock({ track, src, audioRef, playing, onPlayingChange, onClose }) {
  const [time, setTime] = useState({ current: 0, total: 0 });

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => onPlayingChange(false));
    else audio.pause();
  };

  const seek = (event) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Number(event.target.value);
  };

  return (
    <div className="rx-dock" role="region" aria-label="Audio player">
      <audio
        key={track.id}
        ref={audioRef}
        src={src}
        autoPlay
        preload="metadata"
        onPlay={() => onPlayingChange(true)}
        onPause={() => onPlayingChange(false)}
        onEnded={() => onPlayingChange(false)}
        onLoadedMetadata={(event) => setTime({ current: 0, total: event.currentTarget.duration })}
        onTimeUpdate={(event) => setTime({ current: event.currentTarget.currentTime, total: event.currentTarget.duration })}
      />
      <button type="button" className="rx-dock-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
      </button>
      <div className="rx-dock-main">
        <strong>{track.title}</strong>
        <div className="rx-dock-seek">
          <span>{clock(time.current)}</span>
          <input
            type="range"
            min="0"
            max={Number.isFinite(time.total) && time.total > 0 ? time.total : 0}
            step="1"
            value={Math.min(time.current, time.total || 0)}
            onChange={seek}
            aria-label="Seek"
          />
          <span>{clock(time.total)}</span>
        </div>
      </div>
      <button type="button" className="rx-dock-close" onClick={onClose} aria-label="Close player">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
