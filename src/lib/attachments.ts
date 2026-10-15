/**
 * Files attached to a chat message. Images and PDFs are sent to Claude as base64
 * image/document blocks; text-like files (CSV, TXT, JSON …) as plain-text documents.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { uid } from './utils';

export type AttachmentKind = 'image' | 'pdf' | 'text';

export interface AttachmentMeta {
  id: string;
  name: string;
  kind: AttachmentKind;
  size: number;
  /** Small data-URL preview for images. */
  thumb?: string;
}

export interface Attachment extends AttachmentMeta {
  mediaType: string;
  /** base64 for images/PDFs, the text itself for text files. */
  data: string;
}

export const TEXT_EXTENSIONS = ['csv', 'tsv', 'txt', 'md', 'json', 'xml', 'html', 'htm', 'log', 'yaml', 'yml', 'sql', 'js', 'ts', 'py'];
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
export const ACCEPT_ALL = ['.pdf', ...TEXT_EXTENSIONS.map((e) => `.${e}`), 'image/png', 'image/jpeg', 'image/gif', 'image/webp'].join(',');
export const MAX_ATTACHMENTS = 20;

const MAX_IMAGE_EDGE = 1568;
const MAX_IMAGE_BYTES = 3_700_000; // base64 must stay under Claude's 5 MB image limit
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MAX_TEXT_CHARS = 1_500_000;

export function extension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export function classify(file: { name: string; type: string }): AttachmentKind | null {
  const ext = extension(file.name);
  if (IMAGE_TYPES.includes(file.type) || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
  if (file.type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (file.type.startsWith('text/') || TEXT_EXTENSIONS.includes(ext) || file.type === 'application/json') return 'text';
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} kB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function renderImage(file: File, maxEdge: number, type: string, quality?: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d')!;
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL(type, quality);
}

export async function readAttachment(file: File): Promise<Attachment> {
  const kind = classify(file);
  const base = { id: uid('f_'), name: file.name || 'udklip.png', size: file.size };
  if (!kind) {
    const ext = extension(file.name);
    if (['xlsx', 'xls', 'docx', 'doc', 'pptx'].includes(ext)) throw new Error(`${file.name}: Office-filer understøttes ikke direkte – gem som CSV eller PDF.`);
    throw new Error(`${file.name}: filtypen understøttes ikke (brug billeder, PDF, CSV eller tekstfiler).`);
  }
  if (kind === 'image') {
    let dataUrl = await renderImage(file, MAX_IMAGE_EDGE, file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88);
    if (dataUrl.length * 0.75 > MAX_IMAGE_BYTES) dataUrl = await renderImage(file, MAX_IMAGE_EDGE, 'image/jpeg', 0.8);
    const [head, data] = dataUrl.split(',') as [string, string];
    const mediaType = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
    const thumb = await renderImage(file, 160, 'image/jpeg', 0.7);
    return { ...base, kind, mediaType, data, thumb };
  }
  if (kind === 'pdf') {
    if (file.size > MAX_PDF_BYTES) throw new Error(`${file.name}: PDF'en er for stor (maks. 30 MB).`);
    return { ...base, kind, mediaType: 'application/pdf', data: arrayBufferToBase64(await file.arrayBuffer()) };
  }
  const text = await file.text();
  if (text.length > MAX_TEXT_CHARS) throw new Error(`${file.name}: filen er for stor (maks. ca. 1,5 mio. tegn) – del den op eller filtrér den først.`);
  return { ...base, kind, mediaType: 'text/plain', data: text };
}

export function toMeta(a: Attachment): AttachmentMeta {
  return { id: a.id, name: a.name, kind: a.kind, size: a.size, thumb: a.thumb };
}

/** Content blocks for the Messages API. */
export function toContentBlocks(list: Attachment[]): Anthropic.Beta.BetaContentBlockParam[] {
  return list.map((a): Anthropic.Beta.BetaContentBlockParam => {
    if (a.kind === 'image') {
      return { type: 'image', source: { type: 'base64', media_type: a.mediaType as 'image/png', data: a.data } };
    }
    if (a.kind === 'pdf') {
      return { type: 'document', title: a.name, source: { type: 'base64', media_type: 'application/pdf', data: a.data } };
    }
    return { type: 'document', title: a.name, source: { type: 'text', media_type: 'text/plain', data: a.data } };
  });
}
