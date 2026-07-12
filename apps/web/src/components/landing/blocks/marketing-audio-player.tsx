'use client';

import { useCallback, useEffect, useId, useReducer, useRef } from 'react';

import { body14, label14, mono12 } from '../text-styles';

type MarketingAudioPlayerProps = {
  src: string;
  title: string;
  description?: string;
  durationLabel?: string;
};

type PlayerState = {
  playing: boolean;
  currentTime: number;
  duration: number;
  ready: boolean;
};

type PlayerAction =
  | { type: 'loaded'; duration: number }
  | { type: 'time'; currentTime: number }
  | { type: 'ended' }
  | { type: 'pause' }
  | { type: 'play' };

const INITIAL_PLAYER_STATE: PlayerState = {
  playing: false,
  currentTime: 0,
  duration: 0,
  ready: false
};

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'loaded':
      return {
        ...state,
        duration: action.duration,
        ready: Number.isFinite(action.duration) && action.duration > 0
      };
    case 'time':
      return { ...state, currentTime: action.currentTime };
    case 'ended':
      return { ...state, playing: false, currentTime: 0 };
    case 'pause':
      return { ...state, playing: false };
    case 'play':
      return { ...state, playing: true };
    default:
      return state;
  }
}

const WAVE_HEIGHTS = [
  28, 42, 36, 58, 48, 62, 44, 70, 52, 38, 56, 64, 46, 72, 54, 40, 60, 50, 66, 44, 58, 34, 48,
  62, 40, 54, 68, 46, 52, 38, 60, 44
] as const;

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
      <path d="M4 3.2v9.6L13 8 4 3.2Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
      <path d="M4.5 3.5h2.5v9H4.5v-9Zm4.5 0h2.5v9H9v-9Z" fill="currentColor" />
    </svg>
  );
}

export function MarketingAudioPlayer({
  src,
  title,
  description,
  durationLabel
}: MarketingAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressId = useId();
  const [playerState, dispatch] = useReducer(playerReducer, INITIAL_PLAYER_STATE);
  const { playing, currentTime, duration, ready } = playerState;

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        dispatch({ type: 'play' });
      } catch {
        dispatch({ type: 'pause' });
      }
      return;
    }

    audio.pause();
    dispatch({ type: 'pause' });
  }, []);

  const seek = useCallback(
    (nextProgress: number) => {
      const audio = audioRef.current;
      if (!audio || duration <= 0) return;
      const clamped = Math.min(100, Math.max(0, nextProgress));
      audio.currentTime = (clamped / 100) * duration;
      dispatch({ type: 'time', currentTime: audio.currentTime });
    },
    [duration]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      dispatch({ type: 'loaded', duration: audio.duration });
    };
    const onTimeUpdate = () => dispatch({ type: 'time', currentTime: audio.currentTime });
    const onEnded = () => {
      dispatch({ type: 'ended' });
    };
    const onPause = () => dispatch({ type: 'pause' });
    const onPlay = () => dispatch({ type: 'play' });

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
    };
  }, [src]);

  const statusLabel = playing ? 'Playing' : ready ? 'Ready' : 'Loading';

  return (
    <section className="landing-block-audio" aria-label={title}>
      <div className="landing-block-audio__panel" data-border="true">
        <div className="landing-block-audio__chrome">
          <div className="landing-block-audio__dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <span className="landing-block-audio__chrome-title" style={mono12}>
            Premortem · audio brief
          </span>
          <span
            className={`landing-block-audio__status${playing ? ' landing-block-audio__status--live' : ''}`}
            style={mono12}
          >
            {statusLabel}
          </span>
        </div>

        <div className="landing-block-audio__layout">
          <div className="landing-block-audio__copy">
            <span className="landing-block-audio__badge" style={mono12}>
              Swarm overview
            </span>
            <h3 className="landing-block-audio__title" style={label14}>
              {title}
            </h3>
            {description ? (
              <p className="landing-block-audio__description" style={body14}>
                {description}
              </p>
            ) : null}
          </div>

          <div className="landing-block-audio__deck">
            <button
              type="button"
              className="landing-block-audio__play"
              onClick={() => void togglePlayback()}
              aria-label={playing ? 'Pause audio brief' : 'Play audio brief'}
              aria-pressed={playing}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>

            <div
              className={`landing-block-audio__wave${playing ? ' landing-block-audio__wave--active' : ''}`}
              aria-hidden
            >
              {WAVE_HEIGHTS.map((height) => (
                <span
                  key={height}
                  className="landing-block-audio__wave-bar"
                  style={{ ['--wave-height' as string]: `${height}%` }}
                />
              ))}
            </div>

            <div className="landing-block-audio__transport">
              <label className="landing-block-audio__scrub" htmlFor={progressId}>
                <span className="sr-only">Seek audio brief</span>
                <input
                  id={progressId}
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={progress}
                  disabled={!ready}
                  className="landing-block-audio__range"
                  onChange={(event) => seek(Number(event.target.value))}
                  style={{ ['--progress' as string]: `${progress}%` }}
                />
              </label>
              <div className="landing-block-audio__times" style={mono12}>
                <span>{formatAudioTime(currentTime)}</span>
                <span>{ready ? formatAudioTime(duration) : durationLabel ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <audio ref={audioRef} className="landing-block-audio__native" preload="metadata" src={src}>
        Your browser does not support audio playback.{' '}
        <a href={src} download>
          Download the audio file
        </a>
        .
      </audio>
    </section>
  );
}
