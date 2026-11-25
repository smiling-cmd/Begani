import { useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import api from '../../api';
import { MediaPlayer } from '../ResourceViewer';

// Videos published in Resources about meditation, mindfulness, breathing or relaxing.
const MEDITATION_TOPIC = /medit|mindful|breath|relax|calm|body scan/i;

export default function MeditationVideos() {
  const [videos, setVideos] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let live = true;
    api.get('/api/resources/')
      .then(({ data }) => {
        if (!live) return;
        const list = Array.isArray(data) ? data : data.results || [];
        setVideos(list.filter((item) => item.type === 'video' && MEDITATION_TOPIC.test(`${item.title} ${item.category} ${item.summary}`)));
      })
      .catch(() => { /* the timer works without them */ });
    return () => { live = false; };
  }, []);

  if (videos.length === 0) return null;
  const selected = videos.find((video) => video.id === selectedId);

  return (
    <div className="wb-videos">
      <h3>Guided meditation videos</h3>
      <p>Prefer to follow along? Pick a video and watch it here.</p>
      <ul>
        {videos.map((video) => (
          <li key={video.id}>
            <button type="button" aria-pressed={video.id === selectedId} onClick={() => setSelectedId(video.id === selectedId ? null : video.id)}>
              <PlayCircle size={20} aria-hidden="true" />
              <span><strong>{video.title}</strong>{video.summary && <small>{video.summary}</small>}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <div className="wb-video-player">
          <MediaPlayer key={selected.id} resource={selected} />
        </div>
      )}
    </div>
  );
}
