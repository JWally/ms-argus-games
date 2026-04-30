/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public client id (cpi) for arcades.click. Forwarded to argus.run() so
   *  the integrity SDK tags ingest payloads with the right tenant id. */
  readonly VITE_MERCHANT_CPI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
