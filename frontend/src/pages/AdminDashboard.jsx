import { useCallback, useContext, useEffect, useState } from 'react';
import api from '../api';
import { CheckCircle, RefreshCw, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';

function getErrorMessage(error) {
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  if (typeof data?.error === 'string') return data.error;
  if (typeof data?.detail === 'string') return data.detail;
  return 'Could not complete the request. Please try again.';
}

function formatLabel(value) {
  return value ? value.replace(/_/g, ' ') : 'Not provided';
}

function formatDate(value) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleDateString();
}

export default function AdminDashboard() {
  const { token } = useContext(AuthContext);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // This starts an async API request; state updates happen after the response.
    // oxlint-disable-next-line react/set-state-in-effect
    void fetchTherapists();
  }, [fetchTherapists]);

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

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-content admin-dashboard-content">
        <header className="page-heading">
          <div className="eyebrow"><ShieldCheck size={16} /> University staff</div>
          <h1>University Admin Portal</h1>
          <p>Review therapist applications and manage platform access.</p>
        </header>

        <section className="panel admin-therapist-panel" aria-labelledby="admin-therapist-title">
          <div className="admin-therapist-heading">
            <div>
              <h2 id="admin-therapist-title">Therapist accounts</h2>
              <p className="muted-copy">Review registration details before approving access.</p>
            </div>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                setLoading(true);
                void fetchTherapists();
              }}
              disabled={loading}
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {error && <p className="form-message error" role="alert">{error}</p>}
          {notice && <p className="form-message success" role="status">{notice}</p>}

          {loading ? (
            <p className="muted-copy" role="status">Loading therapist accounts…</p>
          ) : therapists.length === 0 ? (
            <p className="muted-copy">No therapist accounts found.</p>
          ) : (
            <div className="admin-therapist-list">
              {therapists.map((therapist) => (
                <article className="admin-therapist-row" key={therapist.id}>
                  <div className="admin-therapist-details">
                    <div className="admin-therapist-avatar" aria-hidden="true"><UserRound size={22} /></div>
                    <div className="admin-therapist-copy">
                      <h3>{therapist.display_name}</h3>
                      <p>{therapist.email} · {formatLabel(therapist.category)} · {formatLabel(therapist.type)}</p>
                      <p>Registration: {therapist.registration_number || 'Not provided'} · Licence expires: {formatDate(therapist.licence_expiry)}</p>
                    </div>
                  </div>

                  <div className="admin-therapist-actions">
                    <span className={`admin-therapist-status is-${therapist.status}`}>
                      {formatLabel(therapist.status)}
                    </span>
                    {therapist.status !== 'approved' && (
                      <button
                        className="button admin-approve-button"
                        type="button"
                        disabled={Boolean(actionId)}
                        onClick={() => void handleAction(therapist, 'approve')}
                        aria-label={`Approve ${therapist.display_name}`}
                      >
                        <CheckCircle size={16} /> Approve
                      </button>
                    )}
                    {therapist.status !== 'suspended' && (
                      <button
                        className="button button-secondary admin-reject-button"
                        type="button"
                        disabled={Boolean(actionId)}
                        onClick={() => void handleAction(therapist, 'reject')}
                        aria-label={`Reject ${therapist.display_name}`}
                      >
                        <XCircle size={16} /> Reject
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
