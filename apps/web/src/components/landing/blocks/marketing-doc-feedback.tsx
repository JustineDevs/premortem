'use client';

import { useState } from 'react';

import { body14, label14 } from '../text-styles';

export function MarketingDocFeedback() {
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="landing-doc-feedback landing-doc-feedback--done">
        <p style={body14}>Thanks. Your feedback helps us keep docs accurate.</p>
      </div>
    );
  }

  return (
    <div className="landing-doc-feedback">
      <p className="landing-doc-feedback__prompt" style={label14}>
        Was this article helpful?
      </p>
      <div className="landing-doc-feedback__actions">
        <button
          type="button"
          className={`landing-doc-feedback__btn${vote === 'up' ? ' landing-doc-feedback__btn--active' : ''}`}
          onClick={() => setVote('up')}
          aria-pressed={vote === 'up'}
        >
          Yes
        </button>
        <button
          type="button"
          className={`landing-doc-feedback__btn${vote === 'down' ? ' landing-doc-feedback__btn--active' : ''}`}
          onClick={() => setVote('down')}
          aria-pressed={vote === 'down'}
        >
          No
        </button>
      </div>
      {vote ? (
        <div className="landing-doc-feedback__comment">
          <label htmlFor="doc-feedback-comment" style={body14}>
            What was missing or unclear? (optional)
          </label>
          <textarea
            id="doc-feedback-comment"
            className="landing-doc-feedback__textarea"
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <button
            type="button"
            className="landing-doc-feedback__submit"
            onClick={() => setSubmitted(true)}
          >
            Send feedback
          </button>
        </div>
      ) : null}
    </div>
  );
}
