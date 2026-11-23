const AUDIO_FILE = /\.(mp3|wav|ogg|m4a|aac)(\?|#|$)/i;
const VIDEO_FILE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

export function isAudioUrl(url) {
  return AUDIO_FILE.test(url || '');
}

export function isVideoUrl(url) {
  return VIDEO_FILE.test(url || '');
}

// Turns a YouTube or Vimeo page link into an embeddable player address.
export function getEmbedUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v');
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
      const embed = parsed.pathname.match(/^\/(embed|shorts)\/([\w-]+)/);
      if (embed) return `https://www.youtube-nocookie.com/embed/${embed[2]}`;
    }
    if (host === 'vimeo.com') {
      const id = parsed.pathname.match(/^\/(\d+)/);
      if (id) return `https://player.vimeo.com/video/${id[1]}`;
    }
  } catch {
    return '';
  }
  return '';
}

// APA 7 style reference line.
export function formatReference(ref) {
  if (ref.apa_text) return ref.apa_text;
  const parts = [`${ref.author} (${ref.year || 'n.d.'}).`, `${ref.title}.`];
  if (ref.publication) parts.push(`${ref.publication}.`);
  const doi = (ref.doi || '').trim();
  if (doi) parts.push(doi.startsWith('http') ? doi : `https://doi.org/${doi}`);
  else if (ref.url) parts.push(ref.url);
  return parts.join(' ');
}

export function referenceLink(ref) {
  const doi = (ref.doi || '').trim();
  if (doi) return doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
  return ref.url || '';
}

export const TYPE_LABELS = { article: 'Article', guide: 'Guide', audio: 'Audio', video: 'Video' };
export const ACTION_LABELS = { article: 'Read this', guide: 'Read this', audio: 'Listen', video: 'Watch' };

// Splits article text into paragraphs, lists and short lead-in lines (lines starting "- " are bullets).
export function parseBody(body) {
  const lines = (body || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const blocks = [];
  lines.forEach((line, index) => {
    if (line.startsWith('- ')) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'list') last.items.push(line.slice(2));
      else blocks.push({ kind: 'list', items: [line.slice(2)] });
      return;
    }
    const next = lines[index + 1] || '';
    const leadsList = next.startsWith('- ') && /[:?]$/.test(line) && line.length <= 90;
    blocks.push({ kind: leadsList ? 'lead' : 'text', text: line });
  });
  return blocks;
}

export const ARTICLE_DISCLAIMER =
  'BEGANI provides educational wellbeing information and is not a substitute for professional diagnosis, treatment or emergency care. If you are experiencing persistent distress, consider contacting a qualified healthcare professional.';

// BEGANI tools an article can point to. Matched against the wording of a paragraph.
const FEATURE_LINKS = [
  { test: /Study & Focus|Pomodoro/i, label: 'Open Study & Focus timer', to: '/wellbeing#study-focus' },
  { test: /Sleep & Relaxation|rain sounds|relaxing sounds|gentle sounds/i, label: 'Open Sleep & Relaxation sounds', to: '/wellbeing#sleep-sounds' },
  { test: /guided meditation/i, label: 'Open guided meditation', to: '/wellbeing#meditation' },
  { test: /\bTua\b/, label: 'Talk to Tua', to: '/tua' },
];

export function featureLinksFor(text) {
  return FEATURE_LINKS.filter((link) => link.test.test(text || ''));
}
