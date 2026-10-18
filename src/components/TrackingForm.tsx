import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  normalizeTrackingCode,
  trackingCodeIsValid,
} from '../lib/api';
import { Search } from './Icons';

interface TrackingFormProps {
  initialCode?: string;
  compact?: boolean;
}

export default function TrackingForm({
  initialCode = '',
  compact = false,
}: TrackingFormProps) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeTrackingCode(code);

    if (!trackingCodeIsValid(normalized)) {
      setError('Use the format SNU-XXXX-XXXX. Check the code on your order.');
      return;
    }

    setError('');
    navigate(`/track/${normalized}`);
  }

  return (
    <form
      className={`tracking-form ${compact ? 'tracking-form--compact' : ''}`}
      onSubmit={submit}
      noValidate
    >
      <label htmlFor={inputId}>Tracking code</label>
      <div className="tracking-form__row">
        <input
          id={inputId}
          name="trackingCode"
          type="text"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            if (error) setError('');
          }}
          placeholder="SNU-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <button className="button button--ink" type="submit">
          <Search /> Find order
        </button>
      </div>
      {error ? (
        <p className="form-error" id={errorId} role="alert">
          {error}
        </p>
      ) : (
        <p className="tracking-form__hint">
          The code is on your order confirmation. Keep it somewhere safe.
        </p>
      )}
    </form>
  );
}
