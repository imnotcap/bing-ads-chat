/**
 * Minimal ZIP reader: extracts the first file of an archive using the central
 * directory (works even when the local header uses a data descriptor).
 * Microsoft Advertising delivers reports as zipped CSV.
 */

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

export async function extractFirstFile(archive: ArrayBuffer): Promise<Uint8Array> {
  const view = new DataView(archive);
  let eocd = -1;
  for (let i = archive.byteLength - 22; i >= Math.max(0, archive.byteLength - 65_557); i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Ugyldig ZIP-fil');

  const cdOffset = view.getUint32(eocd + 16, true);
  if (view.getUint32(cdOffset, true) !== CEN_SIG) throw new Error('Ugyldig ZIP-katalog');
  const method = view.getUint16(cdOffset + 10, true);
  const compressedSize = view.getUint32(cdOffset + 20, true);
  const localOffset = view.getUint32(cdOffset + 42, true);

  if (view.getUint32(localOffset, true) !== LOC_SIG) throw new Error('Ugyldig ZIP-header');
  const nameLen = view.getUint16(localOffset + 26, true);
  const extraLen = view.getUint16(localOffset + 28, true);
  const start = localOffset + 30 + nameLen + extraLen;
  const data = new Uint8Array(archive, start, compressedSize);

  if (method === 0) return data.slice();
  if (method !== 8) throw new Error(`Ikke-understøttet ZIP-komprimering (${method})`);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Every file of an archive, by its path – read through the central directory. */
export async function extractAll(archive: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(archive);
  let eocd = -1;
  for (let i = archive.byteLength - 22; i >= Math.max(0, archive.byteLength - 65_557); i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Ugyldig ZIP-fil');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== CEN_SIG) throw new Error('Ugyldig ZIP-katalog');
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(archive, p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    if (view.getUint32(localOffset, true) !== LOC_SIG) throw new Error('Ugyldig ZIP-header');
    const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    const data = new Uint8Array(archive, start, compressedSize);
    if (method === 0) out.set(name, data.slice());
    else if (method === 8) {
      const stream = new Response(data).body!.pipeThrough(new DecompressionStream('deflate-raw'));
      out.set(name, new Uint8Array(await new Response(stream).arrayBuffer()));
    } else throw new Error(`Ikke-understøttet ZIP-komprimering (${method})`);
  }
  return out;
}
