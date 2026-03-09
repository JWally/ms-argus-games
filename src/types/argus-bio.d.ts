interface ArgusBioOptions {
  sessionId: string;
  onVerified: (token: string) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

interface ArgusBioGlobal {
  open: (options: ArgusBioOptions) => void;
}

declare const ArgusBio: ArgusBioGlobal;
