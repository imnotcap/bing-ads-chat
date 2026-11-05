/**
 * A commit message as the "Nyheder" text in the update dialog.
 *
 * Used where the notes are made (scripts/publish.mjs, which Node runs straight from this
 * file – so: no imports, and only syntax Node can strip) and where they are shown
 * (UpdatePrompt.tsx), so notes already published come out right too.
 *
 * A commit message is wrapped at about 72 characters; shown as it is, every sentence
 * breaks in the middle. Here a paragraph becomes one line again, a list item stays its
 * own line, and file paths – there for developers – are left out.
 */

const TRAILER = /^(Co-Authored-By|Claude-Session|Signed-off-by):/i;
const LIST_ITEM = /^([-*•]|\d+[.)])\s/;
const FILE_PATH = /\s*\((?=[^()]*\/)[^()]*\.(?:tsx?|mjs|js|json|toml|jsonc)\)/g;

export const NOTES_FALLBACK = 'Forbedringer og fejlrettelser.';

/** Unwrapped paragraphs (list items on lines of their own), separated by a blank line. */
export function tidyNotes(raw: string | null | undefined): string {
  const paragraphs: string[] = [];
  for (const block of (raw ?? '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/)) {
    const lines: string[] = [];
    for (const line of block.split('\n')) {
      const l = line.trim();
      if (!l || TRAILER.test(l)) continue;
      if (!lines.length || LIST_ITEM.test(l)) lines.push(l);
      else lines[lines.length - 1] += ` ${l}`;
    }
    const text = lines.join('\n').replace(FILE_PATH, '').trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs.join('\n\n');
}

/**
 * The notes for a release: tidied, and cut at a whole paragraph so nothing stops in the
 * middle of a word. A first paragraph longer than the limit is cut at a word.
 */
export function releaseNotes(message: string | null | undefined, max = 1200): string {
  const paragraphs = tidyNotes(message).split('\n\n').filter(Boolean);
  let out = '';
  for (const p of paragraphs) {
    const next = out ? `${out}\n\n${p}` : p;
    if (next.length > max) {
      if (!out) out = `${p.slice(0, max).replace(/\s+\S*$/, '')} …`;
      break;
    }
    out = next;
  }
  return out || NOTES_FALLBACK;
}
