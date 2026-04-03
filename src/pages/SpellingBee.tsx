import { useCallback, useEffect, useRef, useState } from 'react';
import { BackLink, CrtOverlay, GameDivider } from '../components/GameShell';
import {
  type GameState,
  type WordList,
  getSavedLists,
  saveList,
  deleteList,
  parseWords,
  startGame,
  submitAnswer,
  skipWord,
  correctCount,
  totalTime,
  formatTime,
  speakWord,
  getActiveListId,
  setActiveListId,
} from '../games/spelling-bee/engine';
import { launchConfetti } from '../games/confetti';

export default function SpellingBee() {
  const [game, setGame] = useState<GameState>({
    phase: 'setup',
    listId: null,
    words: [],
    current: 0,
    answered: [],
    startTime: 0,
    wordStartTime: 0,
  });
  const [lists, setLists] = useState<WordList[]>(getSavedLists);
  const [newListName, setNewListName] = useState('');
  const [newListWords, setNewListWords] = useState('');
  const [input, setInput] = useState('');
  const [flash, setFlash] = useState<'correct' | 'wrong' | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showAnswer, setShowAnswer] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const celebratedRef = useRef(false);

  // Timer
  useEffect(() => {
    if (game.phase === 'playing') {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - game.startTime);
      }, 100);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, [game.phase, game.startTime]);

  // Confetti on perfect score
  useEffect(() => {
    if (game.phase === 'done' && !celebratedRef.current) {
      celebratedRef.current = true;
      const perfect = correctCount(game) === game.words.length;
      if (perfect) launchConfetti();
    }
    if (game.phase !== 'done') celebratedRef.current = false;
  }, [game]);

  const handleAddList = useCallback(() => {
    const words = parseWords(newListWords);
    if (words.length === 0 || newListName.trim() === '') return;
    const name = newListName.trim();
    const list = saveList(name, words);
    setLists(getSavedLists());
    setNewListName('');
    setNewListWords('');
    setActiveListId(list.id);
  }, [newListName, newListWords]);

  const handleDeleteList = useCallback((id: string) => {
    deleteList(id);
    setLists(getSavedLists());
  }, []);

  const handleStart = useCallback((list: WordList) => {
    setActiveListId(list.id);
    setGame(startGame(list.words, list.id));
    setInput('');
    setFlash(null);
    setElapsed(0);
    setShowAnswer(null);
  }, []);

  const handleSubmit = () => {
    if (game.phase !== 'playing' || input.trim() === '') return;

    const word = game.words[game.current];
    const correct = input.trim().toLowerCase() === word.toLowerCase();

    setFlash(correct ? 'correct' : 'wrong');
    if (!correct) setShowAnswer(word);
    setTimeout(
      () => {
        setFlash(null);
        setShowAnswer(null);
      },
      correct ? 400 : 1200
    );
    setInput('');

    setGame((prev) => submitAnswer(prev, input));
  };

  const handleSkip = () => {
    if (game.phase !== 'playing') return;
    const word = game.words[game.current];
    setFlash('wrong');
    setShowAnswer(word);
    setTimeout(() => {
      setFlash(null);
      setShowAnswer(null);
    }, 1200);
    setInput('');
    setGame((prev) => skipWord(prev));
  };

  const buzz = useCallback(() => {
    if ('vibrate' in navigator) navigator.vibrate(15);
  }, []);

  const handleKey = useCallback(
    (letter: string) => {
      buzz();
      setInput((prev) => prev + letter);
    },
    [buzz]
  );

  const handleBackspace = useCallback(() => {
    buzz();
    setInput((prev) => prev.slice(0, -1));
  }, [buzz]);

  // ── Setup ─────────────────────────────────────────────────────────

  if (game.phase === 'setup') {
    const activeId = getActiveListId();

    return (
      <div
        className="flex min-h-[100dvh] flex-col px-4 pb-6 pt-4"
        style={{ background: '#030c06', color: '#4ade80' }}
      >
        <CrtOverlay />

        <div className="mb-3 mx-auto w-full max-w-[480px]">
          <BackLink />
        </div>

        <h1
          className="font-display text-lg tracking-[0.3em] text-center"
          style={{
            color: '#4ade80',
            textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66, 0 0 60px #22c55e33',
          }}
        >
          SPELLING BEE
        </h1>
        <p className="mt-1 text-xs tracking-[0.3em] text-center" style={{ color: '#166534' }}>
          PHONETIC INTELLIGENCE DRILL
        </p>

        <GameDivider className="my-2 mx-auto max-w-md" />

        <div className="mx-auto mt-2 w-full max-w-[480px] flex-1 space-y-4">
          {/* Add new list */}
          <div
            className="p-4"
            style={{
              background: '#040e07',
              border: '1px solid #1a6632',
              borderRadius: '2px',
            }}
          >
            <h2 className="text-sm font-semibold mb-2" style={{ color: '#86efac' }}>
              NEW WORD LIST
            </h2>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name (e.g. Week 12)"
              className="w-full px-3 py-2 text-sm outline-none"
              style={{
                background: '#040e07',
                border: '1px solid #1a6632',
                color: '#86efac',
                borderRadius: '2px',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#22c55e')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#1a6632')}
            />
            <textarea
              value={newListWords}
              onChange={(e) => setNewListWords(e.target.value)}
              placeholder="Paste words here — one per line or comma-separated"
              rows={4}
              className="mt-2 w-full px-3 py-2 text-sm outline-none resize-none"
              style={{
                background: '#040e07',
                border: '1px solid #1a6632',
                color: '#86efac',
                borderRadius: '2px',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#22c55e')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#1a6632')}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs" style={{ color: '#166534' }}>
                {parseWords(newListWords).length} words detected
              </span>
              <button
                onClick={handleAddList}
                disabled={parseWords(newListWords).length === 0 || newListName.trim() === ''}
                className="px-4 py-1.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                style={{
                  background: '#040e07',
                  border: '1px solid #22c55e',
                  color: '#4ade80',
                  boxShadow: '0 0 10px #22c55e44',
                  borderRadius: '2px',
                }}
              >
                Save List
              </button>
            </div>
          </div>

          {/* Saved lists */}
          {lists.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold" style={{ color: '#86efac' }}>
                YOUR LISTS
              </h2>
              {lists.map((list) => (
                <div
                  key={list.id}
                  className="flex items-center gap-3 p-3 transition-all"
                  style={{
                    background: '#040e07',
                    border: `1px solid ${list.id === activeId ? '#22c55e' : '#1a6632'}`,
                    borderRadius: '2px',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate" style={{ color: '#86efac' }}>
                      {list.name}
                    </h3>
                    <p className="text-xs" style={{ color: '#166534' }}>
                      {list.words.length} words
                    </p>
                  </div>
                  <button
                    onClick={() => handleStart(list)}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                    style={{
                      background: '#040e07',
                      border: '1px solid #22c55e',
                      color: '#4ade80',
                      boxShadow: '0 0 10px #22c55e44',
                      borderRadius: '2px',
                    }}
                  >
                    START
                  </button>
                  <button
                    onClick={() => handleDeleteList(list.id)}
                    className="shrink-0 px-2 py-1.5 text-xs transition-all hover:scale-105 active:scale-95"
                    style={{
                      background: '#1c0607',
                      border: '1px solid #7f1d1d',
                      color: '#f87171',
                      borderRadius: '2px',
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {lists.length === 0 && (
            <p className="text-center text-sm mt-8" style={{ color: '#166534' }}>
              No word lists yet — add one above to get started!
            </p>
          )}
        </div>

        <style>{`
          @keyframes bs-victory {
            0%   { transform: scale(0.92) rotate(-1deg); filter: brightness(0.6); }
            15%  { transform: scale(1.06) rotate(1.5deg); filter: brightness(2.2); }
            100% { transform: scale(1); filter: brightness(1); }
          }
          @keyframes bs-defeat {
            0%,100% { transform: translate(0,0); }
            20%  { transform: translate(-8px,2px) rotate(-2deg); filter: brightness(1.8); }
            50%  { transform: translate(6px,-1px) rotate(1deg); }
          }
          @keyframes multiply-correct {
            0%   { box-shadow: inset 0 0 0 2px #22c55e; }
            100% { box-shadow: inset 0 0 0 0px #22c55e00; }
          }
          @keyframes multiply-wrong {
            0%,20%,60% { transform: translateX(-4px); }
            40%,80%    { transform: translateX(4px); }
            100%       { transform: translateX(0); }
          }
        `}</style>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────

  if (game.phase === 'done') {
    const correct = correctCount(game);
    const total = game.words.length;
    const perfect = correct === total;
    const t = totalTime(game);

    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center overflow-auto px-4 pb-6 pt-4"
        style={{ background: '#030c06', color: '#4ade80' }}
      >
        <CrtOverlay />

        <div className="mb-4 w-full max-w-[480px]">
          <BackLink />
        </div>

        <div className="text-center">
          <p
            className="font-display text-lg tracking-[0.3em]"
            style={{
              color: '#4ade80',
              textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66, 0 0 60px #22c55e33',
            }}
          >
            {perfect ? 'PERFECT!' : correct >= total * 0.8 ? 'WELL DONE!' : 'KEEP TRAINING!'}
          </p>
          <p className="mt-3 text-4xl font-bold" style={{ color: '#4ade80' }}>
            {correct}/{total}
          </p>
          <p className="mt-1 text-sm" style={{ color: '#166534' }}>
            {formatTime(t)}
          </p>
        </div>

        {/* Word breakdown */}
        <div className="mt-5 w-full max-w-[480px] space-y-1">
          {game.answered.map((a, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2 text-sm"
              style={
                a.correct
                  ? { background: '#0a2a14', color: '#4ade80', borderRadius: '2px' }
                  : { background: '#1c0607', color: '#f87171', borderRadius: '2px' }
              }
            >
              <span className="flex-1">
                {a.correct ? (
                  a.word
                ) : (
                  <>
                    <span className="line-through opacity-60">{a.userAnswer || '(skipped)'}</span>{' '}
                    <span style={{ color: '#86efac', fontWeight: 500 }}>{a.word}</span>
                  </>
                )}
              </span>
              <span className="text-xs ml-2" style={{ color: '#166534' }}>
                {formatTime(a.timeMs)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => {
              const list = lists.find((l) => l.id === game.listId);
              if (list) handleStart(list);
            }}
            className="px-5 py-2.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95"
            style={{
              background: '#040e07',
              border: '1px solid #22c55e',
              color: '#4ade80',
              boxShadow: '0 0 10px #22c55e44',
              borderRadius: '2px',
            }}
          >
            AGAIN
          </button>
          <button
            onClick={() => setGame((prev) => ({ ...prev, phase: 'setup' }))}
            className="px-5 py-2.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95"
            style={{
              background: '#040e07',
              border: '1px solid #1a4a2a',
              color: '#166534',
              borderRadius: '2px',
            }}
          >
            LISTS
          </button>
        </div>

        <style>{`
          @keyframes bs-victory {
            0%   { transform: scale(0.92) rotate(-1deg); filter: brightness(0.6); }
            15%  { transform: scale(1.06) rotate(1.5deg); filter: brightness(2.2); }
            100% { transform: scale(1); filter: brightness(1); }
          }
          @keyframes bs-defeat {
            0%,100% { transform: translate(0,0); }
            20%  { transform: translate(-8px,2px) rotate(-2deg); filter: brightness(1.8); }
            50%  { transform: translate(6px,-1px) rotate(1deg); }
          }
        `}</style>
      </div>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────

  const progress = game.current + 1;
  const total = game.words.length;

  const ROW1 = 'ABCDEFGHI'.split('');
  const ROW2 = 'JKLMNOPQR'.split('');
  const ROW3 = 'STUVWXYZ'.split('');

  const flashBorderAnim =
    flash === 'correct'
      ? 'animate-[multiply-correct_0.4s_ease-out]'
      : flash === 'wrong'
        ? 'animate-[multiply-wrong_0.3s_ease-out]'
        : '';

  return (
    <div
      className={`flex h-[100dvh] flex-col overflow-hidden px-2 pt-2 ${flashBorderAnim}`}
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      <CrtOverlay />

      {/* Header: progress + timer */}
      <div className="mx-auto flex w-full max-w-[480px] items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: '#166534' }}>
            {progress}/{total}
          </span>
          <div className="flex gap-0.5">
            {game.words.map((_, i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background:
                    i < game.current
                      ? game.answered[i]?.correct
                        ? '#22c55e'
                        : '#dc2626'
                      : i === game.current
                        ? '#86efac'
                        : '#0f2a18',
                }}
              />
            ))}
          </div>
        </div>
        <span className="font-mono text-sm" style={{ color: '#86efac' }}>
          {formatTime(elapsed)}
        </span>
      </div>

      {/* Top area: speaker + display */}
      <div className="mx-auto flex flex-1 flex-col items-center justify-center max-w-[480px] w-full">
        {/* Speak button */}
        <button
          aria-label="Hear word"
          onClick={() => speakWord(game.words[game.current])}
          className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#22c55e] bg-[#040e07] text-4xl text-[#4ade80] [box-shadow:0_0_10px_#22c55e44] transition-all hover:scale-105 hover:[box-shadow:0_0_20px_#22c55e88] active:scale-95"
        >
          {'🔊'}
        </button>

        <p className="mt-2 text-xs tracking-[0.2em]" style={{ color: '#166534' }}>
          TAP TO HEAR
        </p>

        {/* Feedback line */}
        <p className="mt-1 h-5 text-sm font-bold tracking-[0.1em]">
          {flash === 'correct' ? (
            <span style={{ color: '#22c55e' }}>CORRECT!</span>
          ) : flash === 'wrong' && showAnswer ? (
            <span style={{ color: '#dc2626' }}>{showAnswer}</span>
          ) : null}
        </p>

        {/* Display-only input (no native keyboard) */}
        <div
          className="mt-2 w-full max-w-[360px] px-4 py-2.5 text-center text-xl font-bold transition-colors min-h-[48px]"
          style={{
            background: '#040e07',
            border: `2px solid ${
              flash === 'correct' ? '#22c55e' : flash === 'wrong' ? '#dc2626' : '#1a6632'
            }`,
            color: flash === 'correct' ? '#22c55e' : flash === 'wrong' ? '#dc2626' : '#86efac',
            borderRadius: '2px',
          }}
        >
          {input || <span style={{ color: '#166534' }}>...</span>}
          <span style={{ color: '#4ade80' }} className="animate-pulse">
            |
          </span>
        </div>
      </div>

      {/* ABC Keyboard — pinned to bottom */}
      <div className="mx-auto w-full max-w-[480px] pb-3 pt-2">
        {/* Letter rows */}
        <div className="flex flex-col gap-1">
          {[ROW1, ROW2, ROW3].map((row, ri) => (
            <div key={ri} className="flex justify-center gap-[3px]">
              {row.map((letter) => (
                <button
                  key={letter}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleKey(letter.toLowerCase());
                  }}
                  className="flex h-11 w-[10%] max-w-[40px] select-none items-center justify-center rounded-[2px] border border-[#1a6632] bg-[#040e07] text-sm font-bold text-[#86efac] transition-colors hover:border-[#22c55e] hover:bg-[#0a2a14]"
                >
                  {letter}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom row: backspace, apostrophe, CHECK, skip */}
        <div className="mt-1 flex justify-center gap-[3px]">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              handleBackspace();
            }}
            className="flex h-11 w-[15%] max-w-[60px] select-none items-center justify-center rounded-[2px] border border-[#1a6632] bg-[#040e07] text-lg text-[#86efac] transition-colors hover:border-[#7f1d1d] hover:bg-[#1c0607] hover:text-[#f87171]"
          >
            {'⌫'}
          </button>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              handleKey("'");
            }}
            className="flex h-11 w-[10%] max-w-[40px] select-none items-center justify-center rounded-[2px] border border-[#1a6632] bg-[#040e07] text-lg font-bold text-[#86efac] transition-colors hover:border-[#22c55e] hover:bg-[#0a2a14]"
          >
            {"'"}
          </button>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              buzz();
              handleSubmit();
            }}
            disabled={input.trim() === ''}
            className="flex h-11 flex-1 max-w-[140px] items-center justify-center text-sm font-bold select-none transition-all active:scale-95 disabled:opacity-30"
            style={{
              background: '#040e07',
              border: '1px solid #22c55e',
              color: '#4ade80',
              boxShadow: '0 0 10px #22c55e44',
              borderRadius: '2px',
            }}
          >
            CHECK
          </button>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              buzz();
              handleSkip();
            }}
            className="flex h-11 w-[15%] max-w-[60px] items-center justify-center text-xs font-semibold select-none transition-colors"
            style={{
              background: '#040e07',
              border: '1px solid #1a4a2a',
              color: '#166534',
              borderRadius: '2px',
            }}
          >
            Skip
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bs-victory {
          0%   { transform: scale(0.92) rotate(-1deg); filter: brightness(0.6); }
          15%  { transform: scale(1.06) rotate(1.5deg); filter: brightness(2.2); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes bs-defeat {
          0%,100% { transform: translate(0,0); }
          20%  { transform: translate(-8px,2px) rotate(-2deg); filter: brightness(1.8); }
          50%  { transform: translate(6px,-1px) rotate(1deg); }
        }
        @keyframes multiply-correct {
          0%   { box-shadow: inset 0 0 0 2px #22c55e; }
          100% { box-shadow: inset 0 0 0 0px #22c55e00; }
        }
        @keyframes multiply-wrong {
          0%,20%,60% { transform: translateX(-4px); }
          40%,80%    { transform: translateX(4px); }
          100%       { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
