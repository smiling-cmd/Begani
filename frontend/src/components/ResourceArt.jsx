import { useId } from 'react';

// Cover art for resources that have no uploaded image: a soft gradient and a simple
// scene chosen from the title, topic and format. Decorative only (aria-hidden).
const THEMES = {
  sleep: { from: '#1c2a4d', to: '#4a6aa3' },
  rain: { from: '#1d4744', to: '#4b8d85' },
  waves: { from: '#17566a', to: '#58b9c4' },
  calm: { from: '#35573f', to: '#a7cfae' },
  study: { from: '#7b4f32', to: '#e5b983' },
  sunrise: { from: '#9a4f3a', to: '#f2b878' },
  heart: { from: '#7a3f55', to: '#e6a0a6' },
  leaf: { from: '#27543b', to: '#93c58c' },
};

function detectTheme(text) {
  const t = text.toLowerCase();
  if (/sleep|night|moon|bedtime|insomnia|cricket/.test(t)) return 'sleep';
  if (/rain|storm/.test(t)) return 'rain';
  if (/ocean|wave|sea\b|water|beach|harbo/.test(t)) return 'waves';
  if (/forest|nature|bird|jungle|garden/.test(t)) return 'leaf';
  if (/meditat|breath|mindful|grounding|calm|anxiety|overthink|relax|piano|ambient|music/.test(t)) return 'calm';
  if (/worth|esteem|compar|confidence|social media/.test(t)) return 'sunrise';
  if (/help|support|coping|counsel|reach out/.test(t)) return 'heart';
  if (/exam|study|focus|revision|learn|academic|burnout|plan|rest\b/.test(t)) return 'study';
  return null;
}

// The title decides first, then the topic, then the format.
function artThemeFor(resource) {
  const fromTitle = detectTheme(resource.title || '');
  if (fromTitle) return fromTitle;
  const fromTopic = detectTheme(resource.category || '');
  if (fromTopic) return fromTopic;
  if (resource.type === 'audio') return 'waves';
  if (resource.type === 'video') return 'calm';
  return 'leaf';
}

function hashOf(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

function Scene({ theme }) {
  if (theme === 'sleep') {
    return (
      <g>
        <path d="M232 36a34 34 0 1 0 22 60a28 28 0 1 1-22-60z" fill="#f6ecc8" opacity=".95" />
        {[[60, 40, 2.2], [110, 70, 1.6], [150, 28, 2], [190, 90, 1.5], [40, 110, 1.8], [270, 130, 1.6], [90, 20, 1.4]].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff" opacity=".8" />
        ))}
        <path d="M0 170c50-28 90-28 140-8s110 18 180-10v48H0z" fill="#0f1a35" opacity=".55" />
      </g>
    );
  }
  if (theme === 'rain') {
    return (
      <g>
        <g fill="#e8f3ef" opacity=".92">
          <ellipse cx="110" cy="62" rx="52" ry="22" />
          <ellipse cx="150" cy="52" rx="42" ry="26" />
          <ellipse cx="190" cy="66" rx="48" ry="20" />
        </g>
        <g stroke="#d6efe9" strokeWidth="2.2" strokeLinecap="round" opacity=".75">
          {[[80, 100], [105, 116], [130, 98], [155, 118], [180, 100], [205, 120], [230, 102], [95, 140], [145, 150], [195, 142], [245, 140]].map(([x, y]) => (
            <line key={`${x}-${y}`} x1={x} y1={y} x2={x - 6} y2={y + 18} />
          ))}
        </g>
        <path d="M0 176c60-18 120-12 180-4s100 4 140-10v38H0z" fill="#0e2b29" opacity=".5" />
      </g>
    );
  }
  if (theme === 'waves') {
    return (
      <g fill="none" strokeLinecap="round">
        <circle cx="250" cy="48" r="22" fill="#fff6d6" opacity=".9" />
        <path d="M-10 110c40-22 80 22 120 0s80-22 120 0 80 22 110 0" stroke="#e6faf8" strokeWidth="5" opacity=".85" />
        <path d="M-10 138c40-22 80 22 120 0s80-22 120 0 80 22 110 0" stroke="#bfeaf0" strokeWidth="5" opacity=".7" />
        <path d="M-10 166c40-22 80 22 120 0s80-22 120 0 80 22 110 0" stroke="#8fd4df" strokeWidth="5" opacity=".6" />
      </g>
    );
  }
  if (theme === 'calm') {
    return (
      <g>
        <circle cx="160" cy="100" r="78" fill="#fff" opacity=".1" />
        <circle cx="160" cy="100" r="54" fill="#fff" opacity=".12" />
        <g fill="#f4fbf3" opacity=".92" transform="translate(160 118)">
          {[-48, -24, 0, 24, 48].map((angle) => (
            <ellipse key={angle} cx="0" cy="-26" rx="13" ry="34" transform={`rotate(${angle})`} opacity={angle === 0 ? 1 : 0.8} />
          ))}
        </g>
      </g>
    );
  }
  if (theme === 'study') {
    return (
      <g>
        <circle cx="258" cy="46" r="24" fill="#fff0c4" opacity=".9" />
        <rect x="90" y="120" width="140" height="22" rx="4" fill="#fdf3e2" />
        <rect x="100" y="98" width="124" height="22" rx="4" fill="#f1c996" />
        <rect x="84" y="76" width="132" height="22" rx="4" fill="#fffaf0" />
        <rect x="0" y="152" width="320" height="48" fill="#5b3820" opacity=".4" />
      </g>
    );
  }
  if (theme === 'sunrise') {
    return (
      <g>
        <circle cx="160" cy="132" r="46" fill="#fff0c4" opacity=".95" />
        <g stroke="#fff0c4" strokeWidth="4" strokeLinecap="round" opacity=".6">
          {[-70, -45, -22, 0, 22, 45, 70].map((angle) => (
            <line key={angle} x1="160" y1="132" x2="160" y2="62" transform={`rotate(${angle} 160 132)`} />
          ))}
        </g>
        <path d="M0 150c60-24 110-18 160-4s100 14 160-6v60H0z" fill="#6b2f22" opacity=".55" />
        <path d="M0 176c70-14 120-8 180 0s90 6 140-6v30H0z" fill="#4a2018" opacity=".5" />
      </g>
    );
  }
  if (theme === 'heart') {
    return (
      <g>
        <circle cx="160" cy="100" r="80" fill="#fff" opacity=".1" />
        <circle cx="160" cy="100" r="54" fill="#fff" opacity=".12" />
        <path d="M160 142c-34-22-52-42-52-62a26 26 0 0 1 52-6a26 26 0 0 1 52 6c0 20-18 40-52 62z" fill="#fff3f0" opacity=".95" />
      </g>
    );
  }
  return (
    <g fill="#eaf7e6" opacity=".9">
      <path d="M160 170C110 150 96 100 130 52c36 22 52 70 30 118z" />
      <path d="M170 176c8-42 40-76 92-84-4 46-38 78-92 84z" opacity=".75" />
      <path d="M150 178c-8-34-40-54-84-52 6 36 36 54 84 52z" opacity=".6" />
    </g>
  );
}

const DIRECTIONS = [[0, 0, 1, 1], [1, 0, 0, 1], [0, 1, 1, 0]];

export default function ArtScene({ resource, className = '' }) {
  const gradientId = useId();
  const theme = artThemeFor(resource);
  const colours = THEMES[theme];
  const variant = hashOf(String(resource.id ?? resource.title ?? '')) % 3;
  const [x1, y1, x2, y2] = DIRECTIONS[variant];
  const shift = [0, -22, 22][variant];

  return (
    <svg className={`art-scene ${className}`} viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1={x1} y1={y1} x2={x2} y2={y2}>
          <stop offset="0" stopColor={colours.from} />
          <stop offset="1" stopColor={colours.to} />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${gradientId})`} />
      <g transform={`translate(${shift} 0)`}><Scene theme={theme} /></g>
    </svg>
  );
}
