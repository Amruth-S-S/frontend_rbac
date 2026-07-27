// Twilio's WhatsApp API needs a publicly fetchable URL for media attachments —
// it can't accept a raw file upload. Since the PPT is generated client-side and
// only exists as a base64 string, we stash the decoded bytes here under a random
// id for a short window, hand Twilio a URL pointing at /api/whatsapp-media/[id],
// and let it fetch the file once. Entries expire on their own so this never grows
// unbounded. Only works when the app runs as a single persistent Node process
// (not on multi-instance/serverless hosting, where this in-memory map wouldn't
// be shared across instances).

interface StoredMedia {
  buffer: Buffer;
  contentType: string;
  filename: string;
  expiresAt: number;
}

const TTL_MS = 15 * 60 * 1000; // 15 minutes — plenty of time for Twilio to fetch it
const store = new Map<string, StoredMedia>();

function sweepExpired() {
  const now = Date.now();
  for (const [id, media] of store) {
    if (media.expiresAt <= now) store.delete(id);
  }
}

export function putMedia(buffer: Buffer, contentType: string, filename: string): string {
  sweepExpired();
  const id = crypto.randomUUID();
  store.set(id, { buffer, contentType, filename, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function getMedia(id: string): StoredMedia | undefined {
  const media = store.get(id);
  if (!media) return undefined;
  if (media.expiresAt <= Date.now()) {
    store.delete(id);
    return undefined;
  }
  return media;
}
