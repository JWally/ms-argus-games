import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCabinet } from '../components/GameCabinet';
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

const BORDER_GREEN_DIM = '1px solid #1a6632';
const BORDER_GREEN_BRIGHT = '1px solid #22c55e';
const GLOW_GREEN = '0 0 10px #22c55e44';

const ROW1 = 'ABCDEFGHI'.split('');
const ROW2 = 'JKLMNOPQR'.split('');
const ROW3 = 'STUVWXYZ'.split('');

const KEYFRAMES = `
  @keyframes multiply-correct {
    0%   { box-shadow: inset 0 0 0 2px #22c55e; }
    100% { box-shadow: inset 0 0 0 0px #22c55e00; }
  }
  @keyframes multiply-wrong {
    0%,20%,60% { transform: translateX(-4px); }
    40%,80%    { transform: translateX(4px); }
    100%       { transform: translateX(0); }
  }
`;

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

  const rules = (
    <ul
      className="flex flex-col gap-3 font-mono text-xs leading-relaxed lg:text-sm"
      style={{ color: '#3f9e68' }}
    >
      <li>· ADD A WORD LIST, THEN HIT START</li>
      <li>· TAP THE SPEAKER TO HEAR YOUR WORD</li>
      <li>· TYPE IT ON THE KEYBOARD AND HIT CHECK</li>
      <li>· SKIP SHOWS THE ANSWER AND MOVES ON</li>
      <li>· THE CLOCK IS RUNNING — SPELL FAST!</li>
    </ul>
  );

  if (game.phase === 'setup') {
    // ── Setup ─────────────────────────────────────────────────────────
    const activeId = getActiveListId();

    return (
      <GameCabinet
        title="SPELLING BEE"
        subtitle="HEAR IT · SPELL IT · BEAT THE CLOCK"
        tag="Brain"
        rules={rules}
      >
        <div className="w-full space-y-4">
          {/* Add new list */}
          <div
            className="p-4"
            style={{
              background: '#040e07',
              border: BORDER_GREEN_DIM,
              borderRadius: '2px',
            }}
          >
            <h2 className="text-sm font-semibold mb-2 lg:text-base" style={{ color: '#86efac' }}>
              NEW WORD LIST
            </h2>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name (e.g. Week 12)"
              className="w-full px-3 py-2 text-sm outline-none lg:text-base"
              style={{
                background: '#040e07',
                border: BORDER_GREEN_DIM,
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
              className="mt-2 w-full px-3 py-2 text-sm outline-none resize-none lg:text-base"
              style={{
                background: '#040e07',
                border: BORDER_GREEN_DIM,
                color: '#86efac',
                borderRadius: '2px',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#22c55e')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#1a6632')}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs lg:text-sm" style={{ color: '#3f9e68' }}>
                {parseWords(newListWords).length} words detected
              </span>
              <button
                onClick={handleAddList}
                disabled={parseWords(newListWords).length === 0 || newListName.trim() === ''}
                className="px-4 py-1.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-30 lg:text-base"
                style={{
                  background: '#040e07',
                  border: BORDER_GREEN_BRIGHT,
                  color: '#4ade80',
                  boxShadow: GLOW_GREEN,
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
              <h2 className="text-sm font-semibold lg:text-base" style={{ color: '#86efac' }}>
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
                    <h3
                      className="text-sm font-semibold truncate lg:text-base"
                      style={{ color: '#86efac' }}
                    >
                      {list.name}
                    </h3>
                    <p className="text-xs lg:text-sm" style={{ color: '#3f9e68' }}>
                      {list.words.length} words
                    </p>
                  </div>
                  <button
                    onClick={() => handleStart(list)}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95 lg:text-sm"
                    style={{
                      background: '#040e07',
                      border: BORDER_GREEN_BRIGHT,
                      color: '#4ade80',
                      boxShadow: GLOW_GREEN,
                      borderRadius: '2px',
                    }}
                  >
                    START
                  </button>
                  <button
                    onClick={() => handleDeleteList(list.id)}
                    className="shrink-0 px-2 py-1.5 text-xs transition-all hover:scale-105 active:scale-95 lg:text-sm"
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
            <p className="text-center text-sm mt-8 lg:text-base" style={{ color: '#3f9e68' }}>
              No word lists yet — add one above to get started!
            </p>
          )}
        </div>
        <style>{KEYFRAMES}</style>
      </GameCabinet>
    );
  }

  if (game.phase === 'done') {
    // ── Results ───────────────────────────────────────────────────────
    const correct = correctCount(game);
    const total = game.words.length;
    const perfect = correct === total;
    const t = totalTime(game);

    return (
      <GameCabinet
        title="SPELLING BEE"
        subtitle="HEAR IT · SPELL IT · BEAT THE CLOCK"
        tag="Brain"
        rules={rules}
      >
        <div className="flex w-full flex-col items-center">
          <div className="text-center">
            <p
              className="font-display text-lg tracking-[0.3em] lg:text-xl"
              style={{
                color: '#4ade80',
                textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66, 0 0 60px #22c55e33',
              }}
            >
              {perfect ? 'PERFECT!' : correct >= total * 0.8 ? 'WELL DONE!' : 'KEEP AT IT!'}
            </p>
            <p className="mt-3 text-4xl font-bold lg:text-5xl" style={{ color: '#4ade80' }}>
              {correct}/{total}
            </p>
            <p className="mt-1 text-sm lg:text-base" style={{ color: '#3f9e68' }}>
              {formatTime(t)}
            </p>
          </div>

          {/* Word breakdown */}
          <div className="mt-5 w-full space-y-1">
            {game.answered.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 text-sm lg:text-base"
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
                <span className="text-xs ml-2 lg:text-sm" style={{ color: '#3f9e68' }}>
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
              className="px-5 py-2.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95 lg:text-base"
              style={{
                background: '#040e07',
                border: BORDER_GREEN_BRIGHT,
                color: '#4ade80',
                boxShadow: GLOW_GREEN,
                borderRadius: '2px',
              }}
            >
              PLAY AGAIN
            </button>
            <button
              onClick={() => setGame((prev) => ({ ...prev, phase: 'setup' }))}
              className="px-5 py-2.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95 lg:text-base"
              style={{
                background: '#040e07',
                border: '1px solid #1a4a2a',
                color: '#3f9e68',
                borderRadius: '2px',
              }}
            >
              LISTS
            </button>
          </div>
        </div>
        <style>{KEYFRAMES}</style>
      </GameCabinet>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────
  const progress = game.current + 1;
  const total = game.words.length;

  const flashBorderAnim =
    flash === 'correct'
      ? 'animate-[multiply-correct_0.4s_ease-out]'
      : flash === 'wrong'
        ? 'animate-[multiply-wrong_0.3s_ease-out]'
        : '';

  const status = (
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-2">
        <span className="text-xs lg:text-sm" style={{ color: '#3f9e68' }}>
          {progress}/{total}
        </span>
        <div className="flex gap-0.5">
          {game.words.map((_, i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full lg:h-2 lg:w-2"
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
      <span className="font-mono text-sm lg:text-base" style={{ color: '#86efac' }}>
        {formatTime(elapsed)}
      </span>
    </div>
  );

  return (
    <GameCabinet
      title="SPELLING BEE"
      subtitle="HEAR IT · SPELL IT · BEAT THE CLOCK"
      tag="Brain"
      status={status}
      rules={rules}
    >
      <div className={`flex w-full flex-col ${flashBorderAnim}`}>
        {/* Top area: speaker + display */}
        <div className="flex flex-col items-center justify-center">
          {/* Speak button */}
          <button
            aria-label="Hear word"
            onClick={() => speakWord(game.words[game.current])}
            className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#22c55e] bg-[#040e07] text-4xl text-[#4ade80] [box-shadow:0_0_10px_#22c55e44] transition-all hover:scale-105 hover:[box-shadow:0_0_20px_#22c55e88] active:scale-95 lg:h-24 lg:w-24 lg:text-5xl"
          >
            {'🔊'}
          </button>

          <p className="mt-2 text-xs tracking-[0.2em] lg:text-sm" style={{ color: '#3f9e68' }}>
            TAP TO HEAR
          </p>

          {/* Feedback line */}
          <p className="mt-1 h-5 text-sm font-bold tracking-[0.1em] lg:text-base">
            {flash === 'correct' ? (
              <span style={{ color: '#22c55e' }}>CORRECT!</span>
            ) : flash === 'wrong' && showAnswer ? (
              <span style={{ color: '#dc2626' }}>{showAnswer}</span>
            ) : null}
          </p>

          {/* Display-only input (no native keyboard) */}
          <div
            className="mt-2 w-full px-4 py-2.5 text-center text-xl font-bold transition-colors min-h-[48px] lg:text-2xl"
            style={{
              background: '#040e07',
              border: `2px solid ${
                flash === 'correct' ? '#22c55e' : flash === 'wrong' ? '#dc2626' : '#1a6632'
              }`,
              color: flash === 'correct' ? '#22c55e' : flash === 'wrong' ? '#dc2626' : '#86efac',
              borderRadius: '2px',
            }}
          >
            {input || <span style={{ color: '#3f9e68' }}>...</span>}
            <span style={{ color: '#4ade80' }} className="animate-pulse">
              |
            </span>
          </div>
        </div>

        {/* ABC Keyboard */}
        <div className="w-full pt-4">
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
                    className="flex h-11 w-[10%] select-none items-center justify-center rounded-[2px] border border-[#1a6632] bg-[#040e07] text-sm font-bold text-[#86efac] transition-colors hover:border-[#22c55e] hover:bg-[#0a2a14] lg:h-12 lg:text-base"
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
              className="flex h-11 w-[15%] select-none items-center justify-center rounded-[2px] border border-[#1a6632] bg-[#040e07] text-lg text-[#86efac] transition-colors hover:border-[#7f1d1d] hover:bg-[#1c0607] hover:text-[#f87171] lg:h-12 lg:text-xl"
            >
              {'⌫'}
            </button>
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                handleKey("'");
              }}
              className="flex h-11 w-[10%] select-none items-center justify-center rounded-[2px] border border-[#1a6632] bg-[#040e07] text-lg font-bold text-[#86efac] transition-colors hover:border-[#22c55e] hover:bg-[#0a2a14] lg:h-12 lg:text-xl"
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
              className="flex h-11 flex-1 items-center justify-center text-sm font-bold select-none transition-all active:scale-95 disabled:opacity-30 lg:h-12 lg:text-base"
              style={{
                background: '#040e07',
                border: BORDER_GREEN_BRIGHT,
                color: '#4ade80',
                boxShadow: GLOW_GREEN,
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
              className="flex h-11 w-[15%] items-center justify-center text-xs font-semibold select-none transition-colors lg:h-12 lg:text-sm"
              style={{
                background: '#040e07',
                border: '1px solid #1a4a2a',
                color: '#3f9e68',
                borderRadius: '2px',
              }}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
      <style>{KEYFRAMES}</style>
    </GameCabinet>
  );
}
