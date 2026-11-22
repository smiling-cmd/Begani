import { useState } from 'react';
import { Check } from 'lucide-react';

const prompts = [
  'Something that went well today',
  'Someone who helped you',
  'Something to look forward to',
];

// Three quick lines of gratitude. "Save to journal" hands them to the page,
// which stores them as a normal journal entry.
export default function GratitudeTool({ onSave }) {
  const [values, setValues] = useState(['', '', '']);
  const [status, setStatus] = useState({ saving: false, message: '', error: '' });
  const filled = values.map((value) => value.trim()).filter(Boolean);

  const update = (index, value) => {
    setValues((current) => current.map((item, position) => (position === index ? value : item)));
    setStatus((current) => (current.message || current.error ? { ...current, message: '', error: '' } : current));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!filled.length || status.saving) return;
    setStatus({ saving: true, message: '', error: '' });
    try {
      await onSave(filled);
      setValues(['', '', '']);
      setStatus({ saving: false, message: 'Saved. You can find it in your journal below.', error: '' });
    } catch (error) {
      setStatus({ saving: false, message: '', error: error.message || 'Could not save. Please try again.' });
    }
  };

  return (
    <form className="selfcare-tool" onSubmit={submit}>
      <div className="gratitude-fields">
        {prompts.map((placeholder, index) => (
          <label className="gratitude-field" key={placeholder}>
            <b aria-hidden="true">{index + 1}</b>
            <span className="sr-only">Gratitude {index + 1}</span>
            <input
              type="text"
              value={values[index]}
              maxLength={160}
              placeholder={placeholder}
              onChange={(event) => update(index, event.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="selfcare-footer">
        <small className={status.error ? 'is-error' : undefined} role={status.error ? 'alert' : 'status'}>
          {status.error || status.message || `${filled.length} of 3 filled`}
        </small>
        <button type="submit" className="button" disabled={!filled.length || status.saving}>
          {status.saving ? 'Saving…' : <><Check size={16} aria-hidden="true" /> Save to journal</>}
        </button>
      </div>
    </form>
  );
}
