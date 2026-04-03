import { useState, useEffect } from 'react';
import { CONTEST_END } from '../constants';

const DEADLINE = CONTEST_END.getTime();

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(): TimeLeft | null {
  const diff = DEADLINE - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft);

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!timeLeft) {
    return (
      <div className="rounded-lg bg-red-50 p-3 text-center">
        <p className="text-sm font-semibold text-red-700">Contest has ended!</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gray-50 p-3 text-center">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
        Contest ends in
      </p>
      <div className="flex items-center justify-center gap-1 font-mono text-lg font-bold text-gray-900">
        <span>{timeLeft.days}d</span>
        <span className="text-gray-400">:</span>
        <span>{pad(timeLeft.hours)}h</span>
        <span className="text-gray-400">:</span>
        <span>{pad(timeLeft.minutes)}m</span>
        <span className="text-gray-400">:</span>
        <span>{pad(timeLeft.seconds)}s</span>
      </div>
    </div>
  );
}
