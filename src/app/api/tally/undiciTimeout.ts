import { Agent, setGlobalDispatcher } from 'undici';

// Node's built-in fetch runs on undici, whose default Agent gives every
// request a ~5 minute headersTimeout/bodyTimeout — far too short for Tally
// extractions on large files, which can legitimately take 25+ minutes on the
// backend. Raise that ceiling once, globally, for every outbound fetch() this
// server makes. The per-request AbortSignal.timeout() in each route is still
// the actual hard cutoff; this just stops undici from giving up first.
let configured = false;

export function ensureLongFetchTimeouts() {
  if (configured) return;
  configured = true;
  setGlobalDispatcher(new Agent({
    headersTimeout: 45 * 60 * 1000, // 45 minutes
    bodyTimeout: 45 * 60 * 1000,
  }));
}
