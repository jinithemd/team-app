// URLs for images served by /api/img. The ?v= part changes when the image does, so phones
// can keep a cached copy for good and still pick up a new crest straight away.

function shortHash(s: string) {
  // FNV-1a over the length and the last 256 characters: cheap, and a new image changes it.
  let h = 0x811c9dc5;
  const sample = `${s.length}:${s.slice(-256)}`;
  for (let i = 0; i < sample.length; i++) {
    h ^= sample.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function crestUrl(teamId: string, crest: string | null | undefined): string | null {
  return crest ? `/api/img/crest/${teamId}?v=${shortHash(crest)}` : null;
}
