import { useState } from 'react';
import api from '../api';
import { CalendarPlus, Mountain } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const emptyForm = {
  title: '',
  type: 'group_talk',
  description: '',
  starts_at: '',
  duration_minutes: '60',
  location_text: '',
  capacity: '20',
  fee_kes: '0',
};

function getErrorMessage(error) {
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const messages = Object.values(data).flat().filter((message) => typeof message === 'string');
    if (messages.length) return messages.join(' ');
  }
  return 'Could not publish the activity. Please try again.';
}

export default function AdminActivities() {
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
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const start = new Date(formData.starts_at);
      if (Number.isNaN(start.getTime())) {
        throw new Error('Choose a valid date and time.');
      }
      await api.post('/api/activities/admin/create/', {
        ...formData,
        starts_at: start.toISOString(),
        duration_minutes: Number(formData.duration_minutes),
        capacity: Number(formData.capacity),
        fee_kes: Number(formData.fee_kes),
      });
      setFormData(emptyForm);
      setNotice('Activity published. Students can now find it in Activities.');
    } catch (requestError) {
      setError(requestError.response ? getErrorMessage(requestError) : requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content admin-content-page">
        <header className="page-heading">
          <div className="eyebrow"><Mountain size={16} /> Community programming</div>
          <h1>Manage Activities</h1>
          <p>Schedule an upcoming event for students to discover and join.</p>
        </header>

        <section className="panel admin-content-panel">
          <h2><CalendarPlus size={20} /> Create an activity</h2>
          <p className="muted-copy">Activities are published immediately after creation.</p>
          <form className="admin-content-form" onSubmit={handleSubmit}>
            <label className="admin-form-field">
              <span>Title</span>
              <input name="title" value={formData.title} onChange={updateField} maxLength={200} required />
            </label>
            <div className="admin-form-grid">
              <label className="admin-form-field">
                <span>Activity type</span>
                <select name="type" value={formData.type} onChange={updateField}>
                  <option value="hiking">Hiking</option>
                  <option value="painting">Painting</option>
                  <option value="yoga">Yoga</option>
                  <option value="music">Music</option>
                  <option value="reading_club">Reading club</option>
                  <option value="group_talk">Group talk</option>
                  <option value="mindfulness">Mindfulness</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="admin-form-field">
                <span>Start date and time</span>
                <input name="starts_at" type="datetime-local" value={formData.starts_at} onChange={updateField} required />
              </label>
            </div>
            <label className="admin-form-field">
              <span>Description</span>
              <textarea name="description" value={formData.description} onChange={updateField} rows="4" />
            </label>
            <label className="admin-form-field">
              <span>Location</span>
              <input name="location_text" value={formData.location_text} onChange={updateField} maxLength={255} required />
            </label>
            <div className="admin-form-grid">
              <label className="admin-form-field">
                <span>Duration (minutes)</span>
                <input name="duration_minutes" type="number" min="1" value={formData.duration_minutes} onChange={updateField} required />
              </label>
              <label className="admin-form-field">
                <span>Capacity</span>
                <input name="capacity" type="number" min="1" value={formData.capacity} onChange={updateField} required />
              </label>
              <label className="admin-form-field">
                <span>Fee (KES)</span>
                <input name="fee_kes" type="number" min="0" value={formData.fee_kes} onChange={updateField} required />
              </label>
            </div>
            {error && <p className="form-message error" role="alert">{error}</p>}
            {notice && <p className="form-message success" role="status">{notice}</p>}
            <button className="button" type="submit" disabled={saving}>
              <CalendarPlus size={17} /> {saving ? 'Publishing…' : 'Publish activity'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
