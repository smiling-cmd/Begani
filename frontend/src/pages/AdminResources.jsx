import { useState } from 'react';
import api from '../api';
import { BookOpen, PlusCircle } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const emptyForm = {
  title: '',
  summary: '',
  body: '',
  type: 'article',
  category: '',
  media_url: '',
  language: 'en',
};

function getErrorMessage(error) {
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const messages = Object.values(data).flat().filter((message) => typeof message === 'string');
    if (messages.length) return messages.join(' ');
  }
  return 'Could not publish the resource. Please try again.';
}

export default function AdminResources() {
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const updateField = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
    setNotice('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!formData.body.trim() && !formData.media_url.trim()) {
      setError('Add resource content or a media URL before publishing.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.post('/api/resources/admin/create/', {
        ...formData,
        title: formData.title.trim(),
        category: formData.category.trim(),
      });
      setFormData(emptyForm);
      setNotice('Resource published. Students can now find it in Resources.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content admin-content-page">
        <header className="page-heading">
          <div className="eyebrow"><BookOpen size={16} /> Content management</div>
          <h1>Manage Resources</h1>
          <p>Create wellbeing articles, guides, audio, or video resources for students.</p>
        </header>

        <section className="panel admin-content-panel">
          <h2><PlusCircle size={20} /> Create a resource</h2>
          <p className="muted-copy">Published resources appear in the student library immediately.</p>
          <form className="admin-content-form" onSubmit={handleSubmit}>
            <label className="admin-form-field">
              <span>Title</span>
              <input name="title" value={formData.title} onChange={updateField} maxLength={200} required />
            </label>
            <label className="admin-form-field">
              <span>Category</span>
              <input name="category" value={formData.category} onChange={updateField} maxLength={100} placeholder="e.g. Exam stress" required />
              <small>A category is created automatically if it does not exist.</small>
            </label>
            <label className="admin-form-field">
              <span>Summary</span>
              <textarea name="summary" value={formData.summary} onChange={updateField} rows="3" required />
            </label>
            <label className="admin-form-field">
              <span>Content</span>
              <textarea name="body" value={formData.body} onChange={updateField} rows="7" placeholder="Write the article or guide content." />
              <small>Enter text here or provide a media URL below.</small>
            </label>
            <div className="admin-form-grid">
              <label className="admin-form-field">
                <span>Type</span>
                <select name="type" value={formData.type} onChange={updateField}>
                  <option value="article">Article</option>
                  <option value="guide">Guide</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                </select>
              </label>
              <label className="admin-form-field">
                <span>Language</span>
                <input name="language" value={formData.language} onChange={updateField} maxLength={10} required />
              </label>
            </div>
            <label className="admin-form-field">
              <span>Media URL <small>(optional)</small></span>
              <input name="media_url" type="url" value={formData.media_url} onChange={updateField} placeholder="https://" />
            </label>
            {error && <p className="form-message error" role="alert">{error}</p>}
            {notice && <p className="form-message success" role="status">{notice}</p>}
            <button className="button" type="submit" disabled={saving}>
              <PlusCircle size={17} /> {saving ? 'Publishing…' : 'Publish resource'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
