import { useEffect, useState } from 'react';
import api from '../../api';
import { getErrorMessage } from './adminHelpers';
import { Modal } from './AdminUi';
import { SkeletonList } from '../Skeleton';

const PRIVATE_CATEGORIES = [
  ['counsellor', 'Counsellor'],
  ['psychologist', 'Psychologist'],
  ['psychiatrist', 'Psychiatrist'],
];

const CHECKS = [
  ['register_checked', 'Found on the professional register'],
  ['licence_current', 'Licence is current'],
  ['category_matches', 'Category matches their qualification'],
  ['id_matched', 'ID matches the applicant'],
  ['certificates_seen', 'Certificates seen'],
];

const blank = {
  email: '', full_name: '', phone: '', display_name: '', title: '', type: 'private', category: 'counsellor',
  format: 'online', fee_kes: '', session_length_minutes: '50', location_text: '', languages: '', bio: '', approach: '',
  registration_body: '', registration_number: '', licence_expiry: '',
  register_checked: false, licence_current: false, category_matches: false, id_matched: false, certificates_seen: false,
};

const fromServer = (data) => ({
  ...blank,
  ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null && value !== undefined)),
  fee_kes: data.fee_kes ?? '',
  session_length_minutes: String(data.session_length_minutes ?? 50),
});

/**
 * Add a therapist (mode "create") or review/edit one (mode "review", needs therapistId).
 * onSaved(result, { approved }) lets the page refresh and, for new accounts, show the temporary password.
 */
export default function TherapistDialog({ mode, therapistId, onClose, onSaved }) {
  const creating = mode === 'create';
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(!creating);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [hasBookings, setHasBookings] = useState(false);

  useEffect(() => {
    if (creating) return undefined;
    let active = true;
    api.get(`/api/counsellors/admin/${therapistId}/`)
      .then(({ data }) => {
        if (!active) return;
        setForm(fromServer(data));
        setStatus(data.status);
        setHasBookings(Boolean(data.has_bookings));
      })
      .catch((requestError) => { if (active) setError(getErrorMessage(requestError, 'Could not load this therapist.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [creating, therapistId]);

  const set = (event) => {
    const { name, type, checked, value } = event.target;
    setError('');
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const setType = (event) => {
    const type = event.target.value;
    setForm((current) => ({
      ...current,
      type,
      category: type === 'school_counsellor' ? 'school_staff' : (current.category === 'school_staff' ? 'counsellor' : current.category),
      fee_kes: type === 'school_counsellor' ? '' : current.fee_kes,
    }));
  };

  const payload = () => {
    const school = form.type === 'school_counsellor';
    const body = {
      full_name: form.full_name, phone: form.phone, display_name: form.display_name, title: form.title,
      type: form.type, category: form.category, format: form.format,
      fee_kes: school || form.fee_kes === '' ? null : Number(form.fee_kes),
      session_length_minutes: Number(form.session_length_minutes) || 50,
      location_text: form.location_text, languages: form.languages, bio: form.bio, approach: form.approach,
      registration_body: form.registration_body, registration_number: form.registration_number,
      licence_expiry: form.licence_expiry,
    };
    if (creating) body.email = form.email;
    else CHECKS.forEach(([key]) => { body[key] = form[key]; });
    return body;
  };

  const submit = async (event, approveAfter = false) => {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (creating) {
        const { data } = await api.post('/api/counsellors/admin/create/', payload());
        onSaved(data, { created: true });
        return;
      }
      await api.patch(`/api/counsellors/admin/${therapistId}/`, payload());
      if (approveAfter) await api.post(`/api/counsellors/admin/${therapistId}/approve/`, { action: 'approve' });
      onSaved({}, { approved: approveAfter });
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not save. Please check the details and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const school = form.type === 'school_counsellor';
  const categories = school ? [['school_staff', 'School staff']] : PRIVATE_CATEGORIES;

  return (
    <Modal title={creating ? 'Add a therapist' : 'Review therapist'} onClose={onClose} wide busy={busy}>
      {loading ? <SkeletonList label="Loading therapist" rows={4} /> : (
        <form className="ap-form" onSubmit={submit}>
          <fieldset>
            <legend>Account</legend>
            <div className="ap-grid">
              <label className="admin-form-field"><span>Full name</span>
                <input name="full_name" value={form.full_name} onChange={set} maxLength={150} required /></label>
              <label className="admin-form-field"><span>Email</span>
                <input name="email" type="email" value={form.email} onChange={set} required={creating} disabled={!creating} /></label>
              <label className="admin-form-field"><span>Phone <small>(optional)</small></span>
                <input name="phone" type="tel" value={form.phone} onChange={set} maxLength={20} /></label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Profile students will see</legend>
            <div className="ap-grid">
              <label className="admin-form-field"><span>Display name</span>
                <input name="display_name" value={form.display_name} onChange={set} maxLength={100} required placeholder="e.g. Dr. Amina Otieno" /></label>
              <label className="admin-form-field"><span>Title <small>(optional)</small></span>
                <input name="title" value={form.title} onChange={set} maxLength={100} placeholder="e.g. Clinical psychologist" /></label>
              <label className="admin-form-field"><span>Type</span>
                <select name="type" value={form.type} onChange={setType}>
                  <option value="private">Private therapist (paid sessions)</option>
                  <option value="school_counsellor">School counsellor (free)</option>
                </select></label>
              <label className="admin-form-field"><span>Category</span>
                <select name="category" value={form.category} onChange={set}>
                  {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
              <label className="admin-form-field"><span>Session format</span>
                <select name="format" value={form.format} onChange={set}>
                  <option value="online">Online</option>
                  <option value="in_person">In person</option>
                  <option value="both">Both</option>
                </select></label>
              <label className="admin-form-field"><span>Session length (minutes)</span>
                <input name="session_length_minutes" type="number" min="10" max="240" value={form.session_length_minutes} onChange={set} required /></label>
              {!school && (
                <label className="admin-form-field"><span>Session fee (KES)</span>
                  <input name="fee_kes" type="number" min="1" value={form.fee_kes} onChange={set} required /></label>
              )}
              <label className="admin-form-field"><span>Languages <small>(optional)</small></span>
                <input name="languages" value={form.languages} onChange={set} maxLength={200} placeholder="English, Kiswahili" /></label>
            </div>
            <label className="admin-form-field"><span>Location <small>(optional)</small></span>
              <input name="location_text" value={form.location_text} onChange={set} maxLength={255} /></label>
            <label className="admin-form-field"><span>Bio <small>(optional)</small></span>
              <textarea name="bio" value={form.bio} onChange={set} rows="3" /></label>
            <label className="admin-form-field"><span>Approach <small>(optional)</small></span>
              <textarea name="approach" value={form.approach} onChange={set} rows="2" /></label>
          </fieldset>

          <fieldset>
            <legend>Registration</legend>
            <div className="ap-grid">
              <label className="admin-form-field"><span>Registration body</span>
                <input name="registration_body" value={form.registration_body} onChange={set} maxLength={100} required placeholder="e.g. Kenya Counselling & Psychological Association" /></label>
              <label className="admin-form-field"><span>Registration number</span>
                <input name="registration_number" value={form.registration_number} onChange={set} maxLength={100} required /></label>
              <label className="admin-form-field"><span>Licence expires</span>
                <input name="licence_expiry" type="date" value={form.licence_expiry} onChange={set} required /></label>
            </div>
          </fieldset>

          {!creating && (
            <fieldset>
              <legend>Verification checklist</legend>
              <p className="muted-copy">Tick each item once you have checked it yourself. All five are needed to approve.</p>
              <div className="ap-checks">
                {CHECKS.map(([key, label]) => (
                  <label key={key} className="ap-check">
                    <input type="checkbox" name={key} checked={Boolean(form[key])} onChange={set} /> {label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {creating && <p className="muted-copy">The account is created with a one-time password that you hand over yourself. The therapist stays pending until you review and approve them.</p>}
          {!creating && hasBookings && <p className="muted-copy">This therapist has booking history, so they can be suspended but not deleted.</p>}
          {error && <p className="form-message error" role="alert">{error}</p>}

          <div className="ap-dialog-actions">
            <button type="submit" className={`button${creating || status === 'approved' ? '' : ' button-secondary'}`} disabled={busy}>
              {busy ? 'Saving…' : creating ? 'Create therapist' : 'Save changes'}
            </button>
            {!creating && status !== 'approved' && (
              <button type="button" className="button" disabled={busy} onClick={() => submit(null, true)}>Save and approve</button>
            )}
            <button type="button" className="text-button" onClick={onClose} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
