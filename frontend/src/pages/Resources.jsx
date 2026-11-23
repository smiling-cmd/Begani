import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import { ArrowRight, BookOpen, Bookmark, Clock, Headphones, Heart, Pause, Play, Search, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import AudioDock from '../components/AudioDock';
import { AuthContext } from '../context/AuthContext';
import heroPhoto from '../assets/pages/resources-hero.webp';
import readPhoto from '../assets/pages/wellbeing-reading.webp';
import listenPhoto from '../assets/pages/listen-calm.webp';
import watchPhoto from '../assets/home/thumb-playing.webp';
import socialPhoto from '../assets/home/thumb-social.webp';
import relaxPhoto from '../assets/pages/settings-relax.webp';
import friendsPhoto from '../assets/pages/messages-friends.webp';
import ResourceViewer from '../components/ResourceViewer';
import { ACTION_LABELS, TYPE_LABELS, isAudioUrl } from '../utils/resourceMedia';
import './Resources.css';

const FORMATS = [
  { id: 'read', label: 'Read', blurb: 'Articles and guides', types: ['article', 'guide'], photo: readPhoto, icon: BookOpen },
  { id: 'audio', label: 'Listen', blurb: 'Calming sounds and guided audio', types: ['audio'], photo: listenPhoto, icon: Headphones },
  { id: 'video', label: 'Watch', blurb: 'Short videos', types: ['video'], photo: watchPhoto, icon: Video },
];

// Resources without their own cover still get a photo, picked by topic so a topic always looks the same.
const FALLBACK_COVERS = [readPhoto, relaxPhoto, socialPhoto, friendsPhoto, watchPhoto];

function coverFor(resource) {
  if (resource.cover_image) return resource.cover_image;
  const key = `${resource.category || ''}${resource.type}`;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) % 9973;
  return FALLBACK_COVERS[hash % FALLBACK_COVERS.length];
}

function audioSource(resource) {
  if (resource.type !== 'audio') return '';
  return resource.audio_file || (isAudioUrl(resource.media_url) ? resource.media_url : '');
}

function cardMeta(resource) {
  if (resource.type === 'article' || resource.type === 'guide') {
    return resource.reading_time ? `${resource.reading_time} min read` : TYPE_LABELS[resource.type];
  }
  return TYPE_LABELS[resource.type] || resource.type;
}

function getErrorMessage(error) {
  const detail = error.response?.data?.detail || error.response?.data;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.join(' ');
  if (detail && typeof detail === 'object') {
    const messages = Object.values(detail).flat().filter((message) => typeof message === 'string');
    if (messages.length) return messages.join(' ');
  }
  return 'Could not load resources. Please try again.';
}

export default function Resources() {
  const { token } = useContext(AuthContext);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [kind, setKind] = useState('all');
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState([]);
  const [track, setTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    api.get('/api/resources/')
      .then(({ data }) => {
        if (active) setResources(Array.isArray(data) ? data : data.results || []);
      })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, retryCount]);

  const categories = useMemo(() => ['All', ...new Set(resources.map((resource) => resource.category).filter(Boolean))], [resources]);
  const counts = useMemo(() => Object.fromEntries(FORMATS.map((format) => [
    format.id,
    resources.filter((resource) => format.types.includes(resource.type)).length,
  ])), [resources]);

  const filtersActive = kind !== 'all' || category !== 'All' || query.trim() !== '';
  const visibleResources = useMemo(() => resources.filter((resource) => {
    const matchesCategory = category === 'All' || resource.category === category;
    const kindTypes = FORMATS.find((option) => option.id === kind)?.types;
    const matchesKind = !kindTypes || kindTypes.includes(resource.type);
    const matchesQuery = `${resource.title} ${resource.summary} ${resource.category || ''} ${resource.type} ${resource.language}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesCategory && matchesKind && matchesQuery;
  }), [category, kind, query, resources]);

  const featured = useMemo(() => resources
    .filter((resource) => resource.type !== 'audio')
    .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')))
    .slice(0, 3), [resources]);
  const listenItems = useMemo(() => resources.filter((resource) => audioSource(resource)), [resources]);

  const toggleSaved = (id) => {
    setSaved((current) => current.includes(id)
      ? current.filter((savedId) => savedId !== id)
      : [...current, id]);
  };

  const playTrack = (resource) => {
    if (track?.id === resource.id) {
      const audio = audioRef.current;
      if (audio) {
        if (audio.paused) audio.play().catch(() => setPlaying(false));
        else audio.pause();
      }
      return;
    }
    setPlaying(false);
    setTrack(resource);
  };

  const chooseFormat = (id) => setKind((current) => (current === id ? 'all' : id));

  const renderCard = (resource, { large = false } = {}) => {
    const isSaved = saved.includes(resource.id);
    const src = audioSource(resource);
    const isCurrent = track?.id === resource.id;
    return (
      <article className={`rx-card${large ? ' is-large' : ''}`} key={resource.id}>
        <div className="rx-card-cover">
          <img src={coverFor(resource)} alt={resource.cover_image ? (resource.image_alt || '') : ''} loading="lazy" />
          <span className="rx-badge">{TYPE_LABELS[resource.type] || resource.type}</span>
          <button type="button" className={`rx-save${isSaved ? ' is-saved' : ''}`} aria-label={isSaved ? `Remove ${resource.title} from saved` : `Save ${resource.title}`} aria-pressed={isSaved} onClick={() => toggleSaved(resource.id)}>
            <Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
          {src && (
            <button type="button" className="rx-play" aria-label={isCurrent && playing ? `Pause ${resource.title}` : `Play ${resource.title}`} onClick={() => playTrack(resource)}>
              {isCurrent && playing ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}
            </button>
          )}
        </div>
        <div className="rx-card-body">
          <div className="rx-labels"><span>{resource.category || 'Wellbeing'}</span><span><Clock size={12} aria-hidden="true" /> {cardMeta(resource)}</span></div>
          <h3>{resource.title}</h3>
          <p>{resource.summary || 'Explore this wellbeing resource.'}</p>
          <button type="button" className="text-button" onClick={() => setSelected(resource)}>{ACTION_LABELS[resource.type] || 'Open'} <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      </article>
    );
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className={`page-content rx-page${track ? ' has-dock' : ''}`}>
        <section className="rx-hero" aria-labelledby="rx-title">
          <img src={heroPhoto} alt="" className="rx-hero-photo" />
          <div className="rx-hero-copy">
            <span className="rx-eyebrow"><BookOpen size={15} aria-hidden="true" /> Your wellbeing space</span>
            <h1 id="rx-title">Resources</h1>
            <p>Gentle, practical ideas for your wellbeing. Keep what feels useful and skip the rest.</p>
            <label className="rx-search">
              <Search size={19} aria-hidden="true" />
              <span className="sr-only">Search resources</span>
              <input aria-label="Search resources" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guides, sounds or topics..." />
            </label>
          </div>
        </section>

        {!loading && !error && resources.length > 0 && (
          <div className="rx-tiles" role="group" aria-label="Browse by format">
            {FORMATS.map((format) => {
              const Icon = format.icon;
              return (
                <button key={format.id} type="button" className={`rx-tile${kind === format.id ? ' selected' : ''}`} aria-pressed={kind === format.id} onClick={() => chooseFormat(format.id)}>
                  <img src={format.photo} alt="" loading="lazy" />
                  <span className="rx-tile-text">
                    <span className="rx-tile-icon"><Icon size={18} aria-hidden="true" /></span>
                    <strong>{format.label}</strong>
                    <small>{counts[format.id]} {counts[format.id] === 1 ? 'item' : 'items'} · {format.blurb}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {loading ? <p className="muted-copy">Loading resources…</p> : error ? (
          <section className="empty-state panel" role="alert">
            <h2>Resources are unavailable</h2>
            <p>{error}</p>
            <button type="button" className="button button-secondary" onClick={() => { setError(''); setLoading(true); setRetryCount((count) => count + 1); }}>Try again</button>
          </section>
        ) : (
          <>
            {!filtersActive && listenItems.length > 0 && (
              <section className="rx-section" aria-labelledby="rx-listen-title">
                <div className="rx-section-head">
                  <div><h2 id="rx-listen-title">Listen and unwind</h2><p>Put your headphones on and let the sounds do the work.</p></div>
                </div>
                <ul className="rx-listen">
                  {listenItems.map((resource) => {
                    const isCurrent = track?.id === resource.id;
                    return (
                      <li key={resource.id}>
                        <button type="button" className={`rx-listen-item${isCurrent ? ' is-current' : ''}`} onClick={() => playTrack(resource)} aria-label={`${isCurrent && playing ? 'Pause' : 'Play'} ${resource.title}`}>
                          <img src={coverFor(resource)} alt="" loading="lazy" />
                          <span className="rx-listen-text"><strong>{resource.title}</strong><small>{resource.category || 'Audio'}</small></span>
                          <span className="rx-listen-icon">{isCurrent && playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {!filtersActive && featured.length > 0 && (
              <section className="rx-section" aria-labelledby="rx-featured-title">
                <div className="rx-section-head"><div><h2 id="rx-featured-title">Start here</h2><p>A few good places to begin.</p></div></div>
                <div className="rx-featured">{featured.map((resource, index) => renderCard(resource, { large: index === 0 }))}</div>
              </section>
            )}

            <section className="rx-section" aria-labelledby="rx-library-title">
              <div className="rx-section-head">
                <div><h2 id="rx-library-title">Explore the library</h2><p>{saved.length} saved this visit · saved items stay on this page only.</p></div>
              </div>
              {categories.length > 1 && (
                <div className="rx-chips" role="group" aria-label="Filter resources by topic">
                  {categories.map((option) => (
                    <button key={option} type="button" className={`filter-chip${category === option ? ' selected' : ''}`} onClick={() => setCategory(option)} aria-pressed={category === option}>{option}</button>
                  ))}
                </div>
              )}
              {visibleResources.length === 0 ? (
                <section className="empty-state panel">
                  <h2>{resources.length ? 'No resources found' : 'No resources published yet'}</h2>
                  <p>{resources.length ? 'Try another search or choose a different topic.' : 'New guides and practices will appear here when they are published.'}</p>
                  {resources.length > 0 && <button type="button" className="button button-secondary" onClick={() => { setQuery(''); setCategory('All'); setKind('all'); }}>Clear filters</button>}
                </section>
              ) : (
                <div className="rx-grid">{visibleResources.map((resource) => renderCard(resource))}</div>
              )}
            </section>
          </>
        )}

        <div className="rx-support panel">
          <Heart size={22} aria-hidden="true" />
          <p>Take what helps and leave what doesn’t. These resources are for general wellbeing and aren’t a substitute for personalised care.</p>
          <Link to="/support" className="button button-secondary">Find someone to talk to <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </main>

      {track && (
        <AudioDock
          track={track}
          src={audioSource(track)}
          audioRef={audioRef}
          playing={playing}
          onPlayingChange={setPlaying}
          onClose={() => { setTrack(null); setPlaying(false); }}
        />
      )}

      {selected && (
        <ResourceViewer
          resource={selected}
          saved={saved.includes(selected.id)}
          onToggleSaved={() => toggleSaved(selected.id)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
