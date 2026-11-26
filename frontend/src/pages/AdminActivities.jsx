import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { CalendarPlus, Mountain, Pencil } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { getErrorMessage } from '../components/admin/adminHelpers';
import { ConfirmDialog, Modal, StatusChip } from '../components/admin/AdminUi';

const TYPES = [
  ['hiking', 'Hiking'], ['painting', 'Painting'], ['yoga', 'Yoga'], ['music', 'Music'], ['reading_club', 'Reading club'],
  ['group_talk', 'Group talk'], ['mindfulness', 'Mindfulness'], ['picnic', 'Picnic'], ['trip', 'Wellbeing trip'], ['other', 'Other'],
];

const emptyForm = { title: '', type: 'group_talk', description: '', starts_at: '', duration_minutes: '60', location_text: '', capacity: '20', fee_kes: '0' };

const toLocalInput = (iso) => {
  const date = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatWhen = (iso) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Nairobi' });

function ActivityForm({ activity, onClose, onSaved }) {
  const editing = Boolean(activity);
  const [form, setForm] = useState(() => (activity ? {
    title: activity.title, type: activity.type, description: activity.description || '', starts_at: toLocalInput(activity.starts_at),
    duration_minutes: String(activity.duration_minutes), location_text: activity.location_text, capacity: String(activity.capacity), fee_kes: String(activity.fee_kes),
  } : emptyForm));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const start = new Date(form.starts_at);
    if (Number.isNaN(start.getTime())) {
      setError('Choose a valid date and time.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      ...form, starts_at: start.toISOString(), duration_minutes: Number(form.duration_minutes),
      capacity: Number(form.capacity), fee_kes: Number(form.fee_kes),
    };
    try {
      if (editing) await api.patch(`/api/activities/admin/${activity.id}/`, payload);
      else await api.post('/api/activities/admin/create/', payload);
      onSaved(editing ? 'Activity updated.' : 'Activity published. Students can now find it in Activities.');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not save the activity. Please try again.'));
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? 'Edit activity' : 'Create an activity'} onClose={onClose} wide busy={saving}>
      <form className="ap-form" onSubmit={submit}>
        <label className="admin-form-field"><span>Title</span>
          <input name="title" value={form.title} onChange={update} maxLength={200} required /></label>
        <div className="ap-grid">
          <label className="admin-form-field"><span>Activity type</span>
            <select name="type" value={form.type} onChange={update}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="admin-form-field"><span>Start date and time</span>
            <input name="starts_at" type="datetime-local" value={form.starts_at} onChange={update} required /></label>
        </div>
        <label className="admin-form-field"><span>Description</span>
          <textarea name="description" value={form.description} onChange={update} rows="4" /></label>
        <label className="admin-form-field"><span>Location</span>
          <input name="location_text" value={form.location_text} onChange={update} maxLength={255} required /></label>
        <div className="ap-grid">
          <label className="admin-form-field"><span>Duration (minutes)</span>
            <input name="duration_minutes" type="number" min="1" value={form.duration_minutes} onChange={update} required /></label>
          <label className="admin-form-field"><span>Capacity</span>
            <input name="capacity" type="number" min="1" value={form.capacity} onChange={update} required /></label>
          <label className="admin-form-field"><span>Fee (KES, 0 = free)</span>
            <input name="fee_kes" type="number" min="0" value={form.fee_kes} onChange={update} required /></label>
        </div>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <div className="ap-dialog-actions">
          <button className="button" type="submit" disabled={saving}><CalendarPlus size={16} /> {saving ? 'Saving…' : editing ? 'Save changes' : 'Publish activity'}</button>
          <button type="button" className="text-button" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminActivities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(null); // { activity } | {} for new
  const [confirm, setConfirm] = useState(null); // { kind: 'cancel' | 'delete', activity }
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/activities/admin/');
      setActivities(Array.isArray(data) ? data : data.results || []);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not load activities.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  const runConfirm = async () => {
    setConfirmBusy(true);
    setConfirmError('');
    try {
      if (confirm.kind === 'delete') {
        await api.delete(`/api/activities/admin/${confirm.activity.id}/`);
        setNotice(`“${confirm.activity.title}” was deleted.`);
      } else {
        const { data } = await api.post(`/api/activities/admin/${confirm.activity.id}/cancel/`);
        setNotice(data.message);
      }
      setConfirm(null);
      await load();
    } catch (requestError) {
      setConfirmError(getErrorMessage(requestError));
    } finally {
      setConfirmBusy(false);
    }
  };

  const onSaved = (message) => {
    setForm(null);
    setNotice(message);
    void load();
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content admin-content-page admin-content-page-wide">
        <header className="page-heading">
          <div className="eyebrow"><Mountain size={16} /> Community programming</div>
          <h1>Manage Activities</h1>
          <p>Schedule events for students, edit details, or cancel and remove them.</p>
        </header>

        <section className="panel admin-content-panel is-wide">
          <div className="ap-toolbar">
            <h2 style={{ margin: 0 }}>All activities</h2>
            <button type="button" className="button ap-small" onClick={() => setForm({})}><CalendarPlus size={15} /> New activity</button>
          </div>
          {error && <p className="form-message error" role="alert">{error}</p>}
          {notice && <p className="form-message success" role="status">{notice}</p>}

          {loading ? <p className="muted-copy" role="status">Loading activities…</p> : activities.length === 0 ? (
            <p className="ap-empty">No activities yet. Create the first one.</p>
          ) : (
            <ul className="ap-list">
              {activities.map((activity) => (
                <li className="ap-row" key={activity.id}>
                  <div className="ap-row-main">
                    <h3>{activity.title} <StatusChip status={activity.status} /></h3>
                    <p>{formatWhen(activity.starts_at)} · {activity.location_text}</p>
                    <div className="ap-meta">
                      <span>{activity.taken}/{activity.capacity} places taken</span>
                      <span>{activity.fee_kes > 0 ? `KES ${activity.fee_kes.toLocaleString()}` : 'Free'}</span>
                    </div>
                  </div>
                  <div className="ap-row-actions">
                    <button type="button" className="button button-secondary ap-small" onClick={() => setForm({ activity })}><Pencil size={14} /> Edit</button>
                    {activity.status === 'published' && (
                      <button type="button" className="button button-secondary ap-small" onClick={() => { setConfirmError(''); setConfirm({ kind: 'cancel', activity }); }}>Cancel activity</button>
                    )}
                    {activity.registrations_total === 0 && (
                      <button type="button" className="text-button" onClick={() => { setConfirmError(''); setConfirm({ kind: 'delete', activity }); }} aria-label={`Delete ${activity.title}`}>Delete</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {form && <ActivityForm activity={form.activity} onClose={() => setForm(null)} onSaved={onSaved} />}

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'delete' ? 'Delete this activity?' : 'Cancel this activity?'}
          confirmLabel={confirm.kind === 'delete' ? 'Delete activity' : 'Cancel activity'}
          danger busy={confirmBusy} error={confirmError} onConfirm={runConfirm} onClose={() => setConfirm(null)}
        >
          {confirm.kind === 'delete'
            ? <p><strong>{confirm.activity.title}</strong> will be removed for good. Only activities nobody registered for can be deleted.</p>
            : <p><strong>{confirm.activity.title}</strong> will disappear from the student list and all {confirm.activity.taken} registered place(s) will be released. Anyone who already paid is queued for a refund. This can’t be undone.</p>}
        </ConfirmDialog>
      )}
    </div>
  );
}
