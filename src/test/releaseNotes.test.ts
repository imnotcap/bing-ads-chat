import { describe, expect, it } from 'vitest';
import { NOTES_FALLBACK, releaseNotes, tidyNotes } from '@/lib/releaseNotes';

/** The start of the commit message that showed up broken in the update dialog. */
const WRAPPED = `Dagligt overblik: kontoens dage gemt i Cloudflare og hentet af Worker'en

Før bad hver app Microsoft om den samme dagsrapport, hver gang en side
åbnede. Nu gemmer workspacet 13 måneders dage (cloudflare/src/adsDaily.ts),
appen læser kun derfra:

- Første gang en konto åbnes: 13 måneder i én rapport (~400
  rækker).
- Hver hverdagsmorgen: de seneste 30 dage igen.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_x`;

describe('release notes', () => {
  it('joins wrapped lines back into sentences and keeps list items apart', () => {
    expect(tidyNotes(WRAPPED)).toBe(
      [
        "Dagligt overblik: kontoens dage gemt i Cloudflare og hentet af Worker'en",
        'Før bad hver app Microsoft om den samme dagsrapport, hver gang en side åbnede. Nu gemmer workspacet 13 måneders dage, appen læser kun derfra:',
        '- Første gang en konto åbnes: 13 måneder i én rapport (~400 rækker).\n- Hver hverdagsmorgen: de seneste 30 dage igen.',
      ].join('\n\n'),
    );
  });

  it('leaves out the trailers and the file paths, but not other brackets', () => {
    const notes = tidyNotes('Ret (src/lib/x.ts) og (reportBasics, msErrors) her\n\nCo-Authored-By: A <a@b.c>');
    expect(notes).toBe('Ret og (reportBasics, msErrors) her');
  });

  it('cuts at a whole paragraph, never in the middle of a word', () => {
    const long = ['Første afsnit.', 'Andet afsnit er langt nok til at blive skåret fra.', 'Tredje.'].join('\n\n');
    expect(releaseNotes(long, 40)).toBe('Første afsnit.');
    expect(releaseNotes('Et meget langt første afsnit uden pause overhovedet', 20)).toBe('Et meget langt …');
  });

  it('falls back when there is nothing to say', () => {
    expect(releaseNotes('Co-Authored-By: A <a@b.c>')).toBe(NOTES_FALLBACK);
    expect(releaseNotes(undefined)).toBe(NOTES_FALLBACK);
  });

  it('reads Windows line endings too', () => {
    expect(tidyNotes('En linje\r\nder fortsætter\r\n\r\nNyt afsnit')).toBe('En linje der fortsætter\n\nNyt afsnit');
  });
});
