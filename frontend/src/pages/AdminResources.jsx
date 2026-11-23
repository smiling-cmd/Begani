import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { BookOpen, PlusCircle, Upload, Plus, Trash2, Save } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const emptyReference = {
  author: '',
  year: '',
  title: '',
  publication: '',
  url: '',
  doi: '',
};

const emptyForm = {
  title: '',
  summary: '',
  body: '',
  type: 'article',
  category: '',
  media_url: '',
  language: 'en',
  author_display: 'BEGANI Editorial Team',
  image_alt: '',
};

function getErrorMessage(error) {
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const messages = Object.values(data).flat().filter((message) => typeof message === 'string');
    if (messages.length) return messages.join(' ');
  }
  return 'Could not save the resource. Please try again.';
}

export default function AdminResources() {
  const [formData, setFormData] = useState(emptyForm);
  const [coverImage, setCoverImage] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [references, setReferences] = useState([]);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [publishingId, setPublishingId] = useState(null);

  const loadDrafts = useCallback(() => {
    api.get('/api/resources/admin/')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setDrafts(list.filter((item) => item.status === 'draft' || item.status === 'pending_review'));
      })
      .catch(() => { /* the form still works without the drafts list */ });
  }, []);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  const publishDraft = async (id) => {
    setPublishingId(id);
    setError('');
    setNotice('');
    try {
      await api.post(`/api/resources/admin/${id}/publish/`);
      setNotice('Resource published. Students can now find it in Resources.');
      loadDrafts();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPublishingId(null);
    }
  };

  const updateField = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
    setNotice('');
  };

  const handleImageChange = (event) => {
    if (event.target.files && event.target.files[0]) setCoverImage(event.target.files[0]);
  };

  const handleVideoChange = (event) => {
    if (event.target.files && event.target.files[0]) setVideoFile(event.target.files[0]);
  };

  const handleAudioChange = (event) => {
    if (event.target.files && event.target.files[0]) setAudioFile(event.target.files[0]);
  };

  const addReference = () => {
    setReferences([...references, { ...emptyReference }]);
  };

  const removeReference = (index) => {
    setReferences(references.filter((_, i) => i !== index));
  };

  const updateReference = (index, field, value) => {
    const newRefs = [...references];
    newRefs[index][field] = value;
    setReferences(newRefs);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const asDraft = event.nativeEvent.submitter?.value === 'draft';
    if (saving) return;
    
    // Frontend validation matching backend (a draft can be incomplete, except for a title and topic)
    if (asDraft) {
      if (!formData.title.trim() || !formData.category.trim()) {
        setError('Add a title and a topic before saving a draft.');
        return;
      }
    } else if (formData.type === 'article' || formData.type === 'guide') {
      if (!formData.body.trim()) {
        setError('Article body is required.');
        return;
      }
    } else if (formData.type === 'audio' || formData.type === 'video') {
      if (!formData.media_url.trim() && !videoFile && !audioFile) {
        setError('Media URL or file upload is required for audio/video resources.');
        return;
      }
    }
    
    if (coverImage && !formData.image_alt.trim()) {
      setError('Alt text is required when a cover image is provided.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    const payload = new FormData();
    payload.append('save_as', asDraft ? 'draft' : 'publish');
    
    // 1. Append basic text fields
    Object.keys(formData).forEach(key => {
      payload.append(key, formData[key]);
    });

    // 2. Append files
    if (coverImage) payload.append('cover_image', coverImage);
    if (videoFile) payload.append('video_file', videoFile);
    if (audioFile) payload.append('audio_file', audioFile);

    // 3. Append References correctly for Django REST Framework
    const cleanRefs = references.filter(r => r.author.trim() !== '' && r.title.trim() !== '');
    cleanRefs.forEach((ref, index) => {
      payload.append(`references[${index}]author`, ref.author);
      payload.append(`references[${index}]year`, ref.year || new Date().getFullYear());
      payload.append(`references[${index}]title`, ref.title);
      payload.append(`references[${index}]publication`, ref.publication);
      payload.append(`references[${index}]url`, ref.url);
      payload.append(`references[${index}]doi`, ref.doi);
      payload.append(`references[${index}]order`, index);
    });

    try {
      await api.post('/api/resources/admin/create/', payload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setFormData(emptyForm);
      setCoverImage(null);
      setVideoFile(null);
      setAudioFile(null);
      setReferences([]);
      setNotice(asDraft ? 'Draft saved. Students cannot see it until you publish it.' : 'Resource published. Students can now find it in Resources.');
      loadDrafts();
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

            <div className="admin-form-grid">
              <label className="admin-form-field">
                <span>Category</span>
                <input name="category" value={formData.category} onChange={updateField} maxLength={100} placeholder="e.g. Exam stress" required />
              </label>
              <label className="admin-form-field">
                <span>Author Display</span>
                <input name="author_display" value={formData.author_display} onChange={updateField} maxLength={100} required />
              </label>
            </div>

            <label className="admin-form-field">
              <span>Summary</span>
              <textarea name="summary" value={formData.summary} onChange={updateField} rows="3" required />
            </label>

            <div className="admin-form-grid">
              <label className="admin-form-field">
                <span>Cover Image</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageChange} />
                  <Upload size={16} className="text-muted" />
                </div>
              </label>
              <label className="admin-form-field">
                <span>Image Alt Text</span>
                <input name="image_alt" value={formData.image_alt} onChange={updateField} maxLength={200} placeholder="Describe the image for accessibility" />
              </label>
            </div>

            <label className="admin-form-field">
              <span>Content</span>
              <textarea name="body" value={formData.body} onChange={updateField} rows="7" placeholder="Write the article or guide content." />
              <small>Enter text here or provide a media URL/upload below.</small>
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

            {(formData.type === 'video') && (
              <label className="admin-form-field">
                <span>Upload Video File <small>(Alternative to URL)</small></span>
                <input type="file" accept="video/*" onChange={handleVideoChange} />
              </label>
            )}

            {(formData.type === 'audio') && (
              <label className="admin-form-field">
                <span>Upload Audio File <small>(Alternative to URL)</small></span>
                <input type="file" accept="audio/*" onChange={handleAudioChange} />
              </label>
            )}

            <div className="admin-form-section" style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Sources and references (APA 7)
                <button type="button" onClick={addReference} className="button-secondary" style={{ fontSize: '0.8rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Plus size={14} /> Add reference
                </button>
              </h3>
              
              {references.map((ref, index) => (
                <div key={index} style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>Reference {index + 1}</strong>
                    <button type="button" onClick={() => removeReference(index)} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="admin-form-grid" style={{ marginTop: '10px' }}>
                    <input placeholder="Author(s)" value={ref.author} onChange={(e) => updateReference(index, 'author', e.target.value)} />
                    <input placeholder="Year" type="number" value={ref.year} onChange={(e) => updateReference(index, 'year', e.target.value)} />
                    <input placeholder="Title" value={ref.title} onChange={(e) => updateReference(index, 'title', e.target.value)} />
                    <input placeholder="Publication" value={ref.publication} onChange={(e) => updateReference(index, 'publication', e.target.value)} />
                    <input placeholder="URL" value={ref.url} onChange={(e) => updateReference(index, 'url', e.target.value)} />
                    <input placeholder="DOI" value={ref.doi} onChange={(e) => updateReference(index, 'doi', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="form-message error" role="alert">{error}</p>}
            {notice && <p className="form-message success" role="status">{notice}</p>}
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="button-secondary button" type="submit" value="draft" formNoValidate disabled={saving}>
                <Save size={17} /> Save draft
              </button>
              <button className="button" type="submit" value="publish" disabled={saving}>
                <PlusCircle size={17} /> {saving ? 'Saving…' : 'Publish resource'}
              </button>
            </div>
          </form>

          {drafts.length > 0 && (
            <div className="admin-drafts" style={{ marginTop: '28px' }}>
              <h2>Waiting to publish</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: '8px' }}>
                {drafts.map((item) => (
                  <li key={item.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--line)', borderRadius: '12px' }}>
                    <span><strong>{item.title}</strong> <small className="muted-copy">· {item.status === 'draft' ? 'Draft' : 'Pending review'}</small></span>
                    <button type="button" className="button" disabled={publishingId === item.id} onClick={() => publishDraft(item.id)}>
                      {publishingId === item.id ? 'Publishing…' : 'Publish'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}