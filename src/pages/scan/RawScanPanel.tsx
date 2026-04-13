import type { ReactElement } from 'react';
import type { ClassifiedSignal } from '../../utils/classifyScan';

interface Props {
  signals: ClassifiedSignal[];
  sessionId: string;
}

export function RawScanPanel({ signals, sessionId }: Props): ReactElement {
  return (
    <div
      className="mt-6 rounded-[2px] p-3 font-mono text-[11px] leading-relaxed"
      style={{
        color: '#4ade80',
        border: '1px solid #0f2a18',
        background: '#030c06',
      }}
    >
      <div style={{ color: '#1a6632' }}>SESSION {sessionId}</div>
      <div className="mt-2 space-y-2">
        {signals.length === 0 && <div style={{ color: '#1a6632' }}>(no findings)</div>}
        {signals.map((sig) => (
          <div key={sig.kind}>
            <div>
              [{sig.kind}]{sig.confidence ? ` ${sig.confidence}` : ' DETECTED'}
            </div>
            {sig.rawSignals.map((r, i) => (
              <div key={i} style={{ color: '#1a6632', paddingLeft: '1rem' }}>
                {r.code} ({r.severity.toFixed(2)}): {r.evidence}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
