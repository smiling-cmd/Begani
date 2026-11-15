import { useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { ArrowRight, BookOpen, Bookmark, Headphones, Heart, Search, Video, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';
import studentsPhoto from '../assets/students.jpeg';

function getResourceIcon(type) {
  if (type === 'audio') return Headphones;
  if (type === 'video') return Video;
  return BookOpen;
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
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState([]);

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

  useEffect(() => {
    if (!selected) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  const categories = useMemo(() => ['All', ...new Set(resources.map((resource) => resource.category).filter(Boolean))], [resources]);
  const visibleResources = useMemo(() => resources.filter((resource) => {
    const matchesCategory = category === 'All' || resource.category === category;
    const matchesQuery = `${resource.title} ${resource.summary} ${resource.category || ''} ${resource.type} ${resource.language}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  }), [category, query, resources]);

  const toggleSaved = (id) => {
    setSaved((current) => current.includes(id)
      ? current.filter((savedId) => savedId !== id)
      : [...current, id]);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content">
        <header className="page-heading">
          <div className="eyebrow"><BookOpen size={16} /> A little help, when you need it</div>
          <h1>Resources</h1>
          <p>Explore gentle, practical ideas for your wellbeing. Keep what feels useful and skip the rest.</p>
        </header>

        <section className="resource-hero panel">
          <div>
            <span className="category-label">START HERE</span>
            <h2>Small steps can make a difference.</h2>
            <p>Find a quick practice, learn what support can look like, or browse by topic.</p>
            <Link to="/support" className="button">Find someone to talk to <ArrowRight size={16} /></Link>
          </div>
          <img className="resource-hero-photo" src={studentsPhoto} alt="Two students smiling together" />
        </section>

        <div className="resource-controls">
          <label className="search-field">
            <Search size={19} aria-hidden="true" />
            <span className="sr-only">Search resources</span>
            <input aria-label="Search resources" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guides, practices, or topics..." />
          </label>
          {!loading && !error && categories.length > 1 && (
            <div className="filter-list" aria-label="Filter resources by topic">
              {categories.map((option) => (
                <button key={option} type="button" className={`filter-chip${category === option ? ' selected' : ''}`} onClick={() => setCategory(option)} aria-pressed={category === option}>
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="section-title-row">
          <h2>Explore the library</h2>
          <span>{saved.length} saved this visit</span>
        </div>
        <p className="preview-note">Published wellbeing resources · Saved items stay in this visit only.</p>

        {loading ? <p className="muted-copy">Loading resources…</p> : error ? (
          <section className="empty-state panel" role="alert">
            <h2>Resources are unavailable</h2>
            <p>{error}</p>
            <button type="button" className="button button-secondary" onClick={() => { setError(''); setLoading(true); setRetryCount((count) => count + 1); }}>Try again</button>
          </section>
        ) : visibleResources.length === 0 ? (
          <section className="empty-state panel">
            <h2>{resources.length ? 'No resources found' : 'No resources published yet'}</h2>
            <p>{resources.length ? 'Try another search or choose a different topic.' : 'New guides and practices will appear here when they are published.'}</p>
            {resources.length > 0 && <button type="button" className="button button-secondary" onClick={() => { setQuery(''); setCategory('All'); }}>Clear filters</button>}
          </section>
        ) : (
          <div className="resource-grid">
            {visibleResources.map((resource) => {
              const Icon = getResourceIcon(resource.type);
              const isSaved = saved.includes(resource.id);
              return (
                <article className="resource-card panel" key={resource.id}>
                  <div className="resource-card-top">
                    <span className="resource-icon"><Icon size={23} /></span>
                    <button type="button" className={`icon-button${isSaved ? ' is-saved' : ''}`} aria-label={isSaved ? `Remove ${resource.title} from saved` : `Save ${resource.title}`} aria-pressed={isSaved} onClick={() => toggleSaved(resource.id)}>
                      <Bookmark size={19} fill={isSaved ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div className="resource-labels"><span>{resource.category || 'Wellbeing'}</span><span>{resource.type}</span></div>
                  <h3>{resource.title}</h3>
                  <p>{resource.summary || 'Explore this wellbeing resource.'}</p>
                  <button type="button" className="text-button" onClick={() => setSelected(resource)}>Read this <ArrowRight size={16} /></button>
                </article>
              );
            })}
          </div>
        )}

        <div className="privacy-note panel"><Heart size={21} /><p>Take what helps and leave what doesn’t. These resources are for general wellbeing and aren’t a substitute for personalised care.</p></div>
      </main>

      {selected && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <article className="dialog-card resource-dialog" role="dialog" aria-modal="true" aria-labelledby="resource-dialog-title">
            <button type="button" className="icon-button dialog-close" onClick={() => setSelected(null)} aria-label="Close resource"><X size={20} /></button>
            <span className="category-label">{selected.category || 'Wellbeing'} · {selected.type}</span>
            <h2 id="resource-dialog-title">{selected.title}</h2>
            {selected.summary && <p className="resource-summary">{selected.summary}</p>}
            {selected.body && <p>{selected.body}</p>}
            {selected.media_url && <a className="button" href={selected.media_url} target="_blank" rel="noreferrer">Open resource <ArrowRight size={16} /></a>}
            <div className="dialog-actions">
              <button type="button" className="button button-secondary" onClick={() => toggleSaved(selected.id)}>
                <Bookmark size={16} fill={saved.includes(selected.id) ? 'currentColor' : 'none'} />
                {saved.includes(selected.id) ? 'Saved' : 'Save for later'}
              </button>
              <button type="button" className="text-button" onClick={() => setSelected(null)}>Done</button>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
