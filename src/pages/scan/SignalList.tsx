import type { ReactElement } from 'react';
import { confidenceColor, confidenceLabel, type ClassifiedSignal } from '../../utils/classifyScan';

interface Props {
  signals: ClassifiedSignal[];
}

export function SignalList({ signals }: Props): ReactElement {
  if (signals.length === 0) {
    return (
      <div className="mt-4">
        <div
          className="inline-block rounded-[2px] px-3 py-2 font-mono text-sm tracking-widest"
          style={{
            color: '#4ade80',
            border: '1px solid #1a6632',
            background: '#0a2a14',
          }}
        >
          [ ALL CLEAR ]
        </div>
        <p className="mt-3 font-mono text-xs" style={{ color: '#1a6632' }}>
          STATUS: NO SIGNALS DETECTED
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {signals.map((sig) => {
        const color = confidenceColor(sig);
        const label = confidenceLabel(sig);
        return (
          <div
            key={sig.kind}
            className="flex items-center justify-between gap-4 rounded-[2px] px-3 py-2 font-mono text-sm tracking-widest"
            style={{
              color,
              border: `1px solid ${color}55`,
              background: `${color}0c`,
            }}
          >
            <span className="whitespace-nowrap">[{sig.kind}]</span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
