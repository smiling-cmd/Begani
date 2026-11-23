import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import ArtScene from './ResourceArt';
import { ArrowRight, Bookmark, X } from 'lucide-react';
import {
  ACTION_LABELS,
  ARTICLE_DISCLAIMER,
  featureLinksFor,
  TYPE_LABELS,
  formatReference,
  getEmbedUrl,
  isAudioUrl,
  isVideoUrl,
  parseBody,
  referenceLink,
} from '../utils/resourceMedia';

function ReferenceText({ ref_: ref }) {
  const text = formatReference(ref);
  const link = referenceLink(ref);
  const match = text.match(/https?:\/\/\S+/);
  if (match) {
    const url = match[0].replace(/[.,;]$/, '');
    const [before, after] = text.split(match[0]);
    return (
      <>
        {before}<a href={url} target="_blank" rel="noreferrer">{url}</a>{after}
      </>
    );
  }
  return link ? <a href={link} target="_blank" rel="noreferrer">{text}</a> : text;
}

function MediaPlayer({ resource }) {
  const { type, media_url: url, audio_file: audioFile, video_file: videoFile } = resource;

  if (type === 'audio') {
    const src = audioFile || (isAudioUrl(url) ? url : '');
    if (src) {
      return (
        <audio className="resource-audio" controls preload="metadata" src={src}>
          Your browser does not support audio playback.
        </audio>
      );
    }
  }

  if (type === 'video') {
    const src = videoFile || (isVideoUrl(url) ? url : '');
    if (src) {
      return (
        <video className="resource-video" controls preload="metadata" src={src} poster={resource.cover_image || undefined}>
          Your browser does not support video playback.
        </video>
      );
    }
    const embed = getEmbedUrl(url);
    if (embed) {
      return (
        <div className="resource-embed">
          <iframe
            src={embed}
            title={resource.title}
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      );
    }
  }

  if (url) {
    return (
      <a className="button" href={url} target="_blank" rel="noreferrer">
        {type === 'audio' ? 'Open audio' : type === 'video' ? 'Open video' : 'Open resource'} <ArrowRight size={16} />
      </a>
    );
  }

  if (type === 'audio' || type === 'video') {
    return <p className="muted-copy">This {type} is not available right now.</p>;
  }
  return null;
}

export default function ResourceViewer({ resource, saved, onToggleSaved, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isReading = resource.type === 'article' || resource.type === 'guide';
  const blocks = parseBody(resource.body);
  const published = resource.published_at
    ? new Date(resource.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const references = resource.references || [];

  const meta = [
    resource.author_display,
    published,
    isReading && resource.reading_time ? `${resource.reading_time} min read` : '',
  ].filter(Boolean);

  return (
    <div className="dialog-backdrop resource-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <article className="dialog-card resource-dialog resource-viewer" role="dialog" aria-modal="true" aria-labelledby="resource-dialog-title">
        <button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Close resource"><X size={20} /></button>

        {resource.cover_image ? (
          <img className="resource-viewer-cover" src={resource.cover_image} alt={resource.image_alt || ''} />
        ) : (
          <div className="resource-viewer-cover resource-viewer-art"><ArtScene resource={resource} /></div>
        )}

        <span className="category-label">{resource.category || 'Wellbeing'} · {TYPE_LABELS[resource.type] || resource.type}</span>
        <h2 id="resource-dialog-title">{resource.title}</h2>
        {meta.length > 0 && <p className="resource-meta">{meta.join(' · ')}</p>}
        {resource.summary && <p className="resource-summary">{resource.summary}</p>}

        {!isReading && <MediaPlayer resource={resource} />}

        {blocks.length > 0 && (
          <div className="resource-body">
            {blocks.map((block, index) => {
              if (block.kind === 'list') {
                return <ul key={index}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
              }
              if (block.kind === 'lead') return <p key={index} className="resource-lead">{block.text}</p>;
              const links = featureLinksFor(block.text);
              if (links.length === 0) return <p key={index}>{block.text}</p>;
              return (
                <div key={index} className="resource-callout">
                  <p>{block.text}</p>
                  <div className="resource-callout-links">
                    {links.map((link) => (
                      <Link key={link.to} className="button button-secondary" to={link.to} onClick={onClose}>
                        {link.label} <ArrowRight size={15} />
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isReading && resource.media_url && <MediaPlayer resource={resource} />}

        {references.length > 0 && (
          <section className="resource-references" aria-label="References">
            <h3>References</h3>
            <ol>
              {references.map((ref) => {
                return (
                  <li key={ref.id || `${ref.author}-${ref.year}-${ref.title}`}>
                    <ReferenceText ref_={ref} />
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {isReading && <p className="resource-disclaimer">{ARTICLE_DISCLAIMER}</p>}

        <div className="dialog-actions">
          <button type="button" className="button button-secondary" onClick={onToggleSaved}>
            <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
            {saved ? 'Saved' : 'Save for later'}
          </button>
          <button type="button" className="text-button" onClick={onClose}>Done</button>
        </div>
        <span className="sr-only">{ACTION_LABELS[resource.type]}</span>
      </article>
    </div>
  );
}
