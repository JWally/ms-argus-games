import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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

  // Auto-speak is intentionally NOT used here — browsers block
  // speechSynthesis until a user gesture has occurred. The user
  // clicks the speaker button instead.

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
      <div className="flex min-h-[100dvh] flex-col bg-arcade-bg px-4 pb-6 pt-4">
        <div className="mb-3 w-full max-w-[480px] mx-auto">
          <Link to="/" className="text-sm text-arcade-accent hover:underline">
            &larr; Back to Arcade
          </Link>
        </div>

        <h1 className="font-display text-lg text-arcade-accent text-center sm:text-2xl">
          SPELLING BEE
        </h1>
        <p className="mt-1 text-xs text-gray-400 text-center">
          Add a word list, then test your spelling
        </p>

        <div className="mx-auto mt-4 w-full max-w-[480px] flex-1 space-y-4">
          {/* Add new list */}
          <div className="rounded-xl border border-arcade-border bg-arcade-card p-4">
            <h2 className="text-sm font-semibold text-white mb-2">New Word List</h2>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name (e.g. Week 12)"
              className="w-full rounded-lg border border-arcade-border bg-arcade-bg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-arcade-accent"
            />
            <textarea
              value={newListWords}
              onChange={(e) => setNewListWords(e.target.value)}
              placeholder="Paste words here — one per line or comma-separated"
              rows={4}
              className="mt-2 w-full rounded-lg border border-arcade-border bg-arcade-bg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-arcade-accent resize-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {parseWords(newListWords).length} words detected
              </span>
              <button
                onClick={handleAddList}
                disabled={parseWords(newListWords).length === 0 || newListName.trim() === ''}
                className="rounded-lg bg-arcade-accent px-4 py-1.5 text-sm font-semibold text-white transition-all hover:bg-arcade-accent-hover active:scale-95 disabled:opacity-30"
              >
                Save List
              </button>
            </div>
          </div>

          {/* Saved lists */}
          {lists.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-400">Your Lists</h2>
              {lists.map((list) => (
                <div
                  key={list.id}
                  className={`flex items-center gap-3 rounded-xl border bg-arcade-card p-3 transition-all ${
                    list.id === activeId ? 'border-arcade-accent/50' : 'border-arcade-border'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{list.name}</h3>
                    <p className="text-xs text-gray-500">{list.words.length} words</p>
                  </div>
                  <button
                    onClick={() => handleStart(list)}
                    className="shrink-0 rounded-lg bg-arcade-accent px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-arcade-accent-hover active:scale-95"
                  >
                    Start
                  </button>
                  <button
                    onClick={() => handleDeleteList(list.id)}
                    className="shrink-0 rounded-lg bg-red-950/50 px-2 py-1.5 text-xs text-red-400 transition-all hover:bg-red-900/50 active:scale-95"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {lists.length === 0 && (
            <p className="text-center text-sm text-gray-600 mt-8">
              No word lists yet — add one above to get started!
            </p>
          )}
        </div>
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
      <div className="flex min-h-[100dvh] flex-col items-center overflow-auto bg-arcade-bg px-4 pb-6 pt-4">
        <div className="mb-4 w-full max-w-[480px]">
          <Link to="/" className="text-sm text-arcade-accent hover:underline">
            &larr; Back to Arcade
          </Link>
        </div>

        <div className="text-center">
          <p className="font-display text-lg text-arcade-accent sm:text-2xl">
            {perfect ? 'PERFECT!' : correct >= total * 0.8 ? 'GREAT JOB!' : 'KEEP PRACTICING!'}
          </p>
          <p className="mt-3 text-4xl font-bold text-white">
            {correct}/{total}
          </p>
          <p className="mt-1 text-sm text-gray-400">{formatTime(t)}</p>
        </div>

        {/* Word breakdown */}
        <div className="mt-5 w-full max-w-[480px] space-y-1">
          {game.answered.map((a, i) => (
            <div
              key={i}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                a.correct ? 'bg-green-950/30 text-green-300' : 'bg-red-950/30 text-red-300'
              }`}
            >
              <span className="flex-1">
                {a.correct ? (
                  a.word
                ) : (
                  <>
                    <span className="line-through opacity-60">{a.userAnswer || '(skipped)'}</span>{' '}
                    <span className="text-white font-medium">{a.word}</span>
                  </>
                )}
              </span>
              <span className="text-xs text-gray-500 ml-2">{formatTime(a.timeMs)}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => {
              const list = lists.find((l) => l.id === game.listId);
              if (list) handleStart(list);
            }}
            className="rounded-lg bg-arcade-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-arcade-accent-hover"
          >
            Again
          </button>
          <button
            onClick={() => setGame((prev) => ({ ...prev, phase: 'setup' }))}
            className="rounded-lg bg-arcade-card px-5 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:text-white"
          >
            Lists
          </button>
        </div>
      </div>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────

  const progress = game.current + 1;
  const total = game.words.length;

  const ROW1 = 'ABCDEFGHI'.split('');
  const ROW2 = 'JKLMNOPQR'.split('');
  const ROW3 = 'STUVWXYZ'.split('');

  const flashBorder =
    flash === 'correct'
      ? 'animate-[multiply-correct_0.4s_ease-out]'
      : flash === 'wrong'
        ? 'animate-[multiply-wrong_0.3s_ease-out]'
        : '';

  return (
    <div
      className={`flex h-[100dvh] flex-col overflow-hidden bg-arcade-bg px-2 pt-2 ${flashBorder}`}
    >
      {/* Header: progress + timer */}
      <div className="mx-auto flex w-full max-w-[480px] items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {progress}/{total}
          </span>
          <div className="flex gap-0.5">
            {game.words.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i < game.current
                    ? game.answered[i]?.correct
                      ? 'bg-green-500'
                      : 'bg-red-500'
                    : i === game.current
                      ? 'bg-white'
                      : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
        <span className="font-mono text-sm text-gray-400">{formatTime(elapsed)}</span>
      </div>

      {/* Top area: speaker + display */}
      <div className="mx-auto flex flex-1 flex-col items-center justify-center max-w-[480px] w-full">
        {/* Speak button */}
        <button
          onClick={() => speakWord(game.words[game.current])}
          className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-arcade-accent/50 bg-arcade-accent/10 text-4xl transition-all hover:border-arcade-accent hover:bg-arcade-accent/20 active:scale-95"
        >
          {'🔊'}
        </button>

        <p className="mt-2 text-xs text-gray-500">Tap to hear</p>

        {/* Feedback line */}
        <p className="mt-1 h-5 text-sm font-bold">
          {flash === 'correct' ? (
            <span className="text-green-400">Correct!</span>
          ) : flash === 'wrong' && showAnswer ? (
            <span className="text-red-400">{showAnswer}</span>
          ) : null}
        </p>

        {/* Display-only input (no native keyboard) */}
        <div
          className={`mt-2 w-full max-w-[360px] rounded-xl border-2 bg-arcade-card px-4 py-2.5 text-center text-xl font-bold transition-colors min-h-[48px] ${
            flash === 'correct'
              ? 'border-green-500 text-green-400'
              : flash === 'wrong'
                ? 'border-red-500 text-red-400'
                : 'border-arcade-border text-white'
          }`}
        >
          {input || <span className="text-gray-600">...</span>}
          <span className="animate-pulse text-arcade-accent">|</span>
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
                  className="flex h-11 w-[10%] max-w-[40px] items-center justify-center rounded-lg bg-arcade-card text-sm font-bold text-white transition-colors active:bg-arcade-accent active:scale-95 select-none"
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
            className="flex h-11 w-[15%] max-w-[60px] items-center justify-center rounded-lg bg-arcade-card text-lg text-gray-400 active:bg-red-900 active:text-red-300 active:scale-95 select-none"
          >
            {'⌫'}
          </button>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              handleKey("'");
            }}
            className="flex h-11 w-[10%] max-w-[40px] items-center justify-center rounded-lg bg-arcade-card text-lg font-bold text-gray-400 active:bg-arcade-accent active:scale-95 select-none"
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
            className="flex h-11 flex-1 max-w-[140px] items-center justify-center rounded-lg bg-arcade-accent text-sm font-bold text-white active:bg-arcade-accent-hover active:scale-95 disabled:opacity-30 select-none"
          >
            CHECK
          </button>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              buzz();
              handleSkip();
            }}
            className="flex h-11 w-[15%] max-w-[60px] items-center justify-center rounded-lg bg-arcade-card text-xs font-semibold text-gray-400 active:bg-arcade-card/50 active:scale-95 select-none"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
