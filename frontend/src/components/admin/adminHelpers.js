/** Turn a DRF error response into one readable sentence. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data.length > 300 ? fallback : data;
  if (typeof data.error === 'string') return data.error;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data === 'object') {
    const parts = Object.entries(data).flatMap(([key, value]) => {
      const text = (Array.isArray(value) ? value : [value]).filter((item) => typeof item === 'string').join(' ');
      return text ? [key === 'non_field_errors' ? text : `${key.replace(/_/g, ' ')}: ${text}`] : [];
    });
    if (parts.length) return parts.join(' ');
  }
  return fallback;
}

export function formatLabel(value) {
  return value ? String(value).replace(/_/g, ' ') : '';
}
