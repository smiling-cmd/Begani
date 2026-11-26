import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { CheckCircle, Copy, RefreshCw, ShieldCheck, UserPlus, UserRound, XCircle } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import TherapistDialog from '../components/admin/TherapistDialog';
import { formatLabel, getErrorMessage } from '../components/admin/adminHelpers';
import { ConfirmDialog, Modal, StatusChip } from '../components/admin/AdminUi';
import { AuthContext } from '../context/AuthContext';
import { SkeletonList } from '../components/Skeleton';

const FILTERS = [['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['suspended', 'Suspended']];

function formatDate(value) {
  if (!value) return 'not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'not provided' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminDashboard() {
  const { token } = useContext(AuthContext);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [dialog, setDialog] = useState(null); // { mode: 'create' } | { mode: 'review', id }
  const [credentials, setCredentials] = useState(null); // { email, password } shown once after creating
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchTherapists = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get('/api/counsellors/admin/list/');
      if (!Array.isArray(data)) {
        setError('The therapist list response was invalid.');
        return;
      }
      setTherapists(data);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not load therapists.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // This starts an async API request; state updates happen after the response.
    // oxlint-disable-next-line react/set-state-in-effect
    void fetchTherapists();
  }, [fetchTherapists]);

  const counts = useMemo(() => therapists.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), { all: therapists.length }), [therapists]);
  const visible = useMemo(() => (filter === 'all' ? therapists : therapists.filter((item) => item.status === filter)), [therapists, filter]);

  const handleAction = async (therapist, action) => {
    if (actionId) return;
    setActionId(therapist.id);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post(`/api/counsellors/admin/${therapist.id}/approve/`, { action });
      setNotice(data.message || `Therapist ${action}d.`);
      await fetchTherapists();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionId('');
    }
  };

  const onSaved = (result, meta) => {
    setDialog(null);
    if (meta.created) {
      setCredentials({ email: result.therapist.email, password: result.temporary_password, name: result.therapist.display_name });
      setNotice('');
    } else {
      setNotice(meta.approved ? 'Saved and approved. Students can now find this therapist.' : 'Changes saved.');
    }
    setError('');
    void fetchTherapists();
  };

  const confirmDelete = async () => {
    setActionId(deleting.id);
    setDeleteError('');
    try {
      await api.delete(`/api/counsellors/admin/${deleting.id}/`);
      setNotice(`${deleting.display_name} was deleted.`);
      setDeleting(null);
      await fetchTherapists();
    } catch (requestError) {
      setDeleteError(getErrorMessage(requestError, 'Could not delete this therapist.'));
    } finally {
      setActionId('');
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(credentials.password);
      setCopied(true);
    } catch { /* the password is also on screen */ }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content admin-dashboard-content">
        <header className="page-heading">
          <div className="eyebrow"><ShieldCheck size={16} /> University staff</div>
          <h1>University Admin Portal</h1>
          <p>Add therapists, review their registration and approve who students can book.</p>
        </header>

        <section className="panel admin-therapist-panel" aria-labelledby="admin-therapist-title">
          <div className="ap-toolbar">
            <div>
              <h2 id="admin-therapist-title">Therapist accounts</h2>
              <p className="muted-copy">Open Review to check registration details and tick the verification checklist before approving.</p>
            </div>
            <div className="ap-row-actions">
              <button className="button button-secondary ap-small" type="button" onClick={() => { setLoading(true); void fetchTherapists(); }} disabled={loading}>
                <RefreshCw size={15} /> Refresh
              </button>
              <button className="button ap-small" type="button" onClick={() => setDialog({ mode: 'create' })}>
                <UserPlus size={15} /> Add therapist
              </button>
            </div>
          </div>

          <div className="ap-filters" role="group" aria-label="Filter therapists by status" style={{ marginBottom: 14 }}>
            {FILTERS.map(([value, label]) => (
              <button key={value} type="button" className="ap-filter" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {label} ({counts[value] || 0})
              </button>
            ))}
          </div>

          {error && <p className="form-message error" role="alert">{error}</p>}
          {notice && <p className="form-message success" role="status">{notice}</p>}

          {loading ? (
            <SkeletonList label="Loading therapist accounts" rows={4} avatar />
          ) : visible.length === 0 ? (
            <p className="ap-empty">{therapists.length === 0 ? 'No therapists yet. Add the first one.' : 'No therapists with this status.'}</p>
          ) : (
            <ul className="ap-list">
              {visible.map((therapist) => (
                <li className="ap-row" key={therapist.id}>
                  <div className="ap-row-main">
                    <h3><UserRound size={16} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />{therapist.display_name} <StatusChip status={therapist.status} /></h3>
                    <p>{therapist.email}</p>
                    <div className="ap-meta">
                      <span>{formatLabel(therapist.category)} · {formatLabel(therapist.type)}</span>
                      {therapist.fee_kes ? <span>KES {therapist.fee_kes.toLocaleString()}</span> : null}
                      <span>Reg. {therapist.registration_number || 'not provided'}</span>
                      <span>Licence expires {formatDate(therapist.licence_expiry)}</span>
                    </div>
                  </div>
                  <div className="ap-row-actions">
                    <button className="button button-secondary ap-small" type="button" onClick={() => setDialog({ mode: 'review', id: therapist.id })}>Review</button>
                    {therapist.status !== 'approved' && (
                      <button className="button ap-small" type="button" disabled={Boolean(actionId)} onClick={() => void handleAction(therapist, 'approve')} aria-label={`Approve ${therapist.display_name}`}>
                        <CheckCircle size={15} /> {therapist.status === 'suspended' ? 'Reinstate' : 'Approve'}
                      </button>
                    )}
                    {therapist.status !== 'suspended' && (
                      <button className="button button-secondary ap-small" type="button" disabled={Boolean(actionId)} onClick={() => void handleAction(therapist, 'reject')} aria-label={`${therapist.status === 'approved' ? 'Suspend' : 'Reject'} ${therapist.display_name}`}>
                        <XCircle size={15} /> {therapist.status === 'approved' ? 'Suspend' : 'Reject'}
                      </button>
                    )}
                    <button className="text-button" type="button" disabled={Boolean(actionId)} onClick={() => { setDeleteError(''); setDeleting(therapist); }} aria-label={`Delete ${therapist.display_name}`}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {dialog && (
        <TherapistDialog mode={dialog.mode} therapistId={dialog.id} onClose={() => setDialog(null)} onSaved={onSaved} />
      )}

      {credentials && (
        <Modal title="Therapist created" onClose={() => { setCredentials(null); setCopied(false); }}>
          <p className="muted-copy"><strong>{credentials.name}</strong> can sign in with this email and one-time password. The password is shown only now, so hand it over securely. They can change it later with “Forgot password”. They stay pending until you approve them.</p>
          <p className="muted-copy" style={{ marginBottom: 0 }}>Email: {credentials.email}</p>
          <div className="ap-secret">
            <code>{credentials.password}</code>
            <button type="button" className="button button-secondary ap-small" onClick={copyPassword}><Copy size={14} /> {copied ? 'Copied' : 'Copy'}</button>
          </div>
          <div className="ap-dialog-actions">
            <button type="button" className="button" onClick={() => { setCredentials(null); setCopied(false); }}>Done</button>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog title="Delete this therapist?" confirmLabel="Delete therapist" danger busy={actionId === deleting.id} error={deleteError} onConfirm={confirmDelete} onClose={() => setDeleting(null)}>
          <p><strong>{deleting.display_name}</strong> ({deleting.email}) and their login will be removed for good. If they have booking history, deleting is blocked and you should suspend them instead.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
