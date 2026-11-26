import { DOMParser, type Document, type Element } from '@xmldom/xmldom';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export function children(element: Element, tag: string): Element[] {
  return Array.from(element.childNodes)
    .filter((child): child is Element => child.nodeType === 1 && child.nodeName === tag);
}

export function childText(element: Element, tag: string): string {
  return children(element, tag)[0]?.textContent?.trim() ?? '';
}

export function attribute(element: Element, name: string): string {
  const value = element.getAttribute(name);
  if (!value) throw new Error(`Missing ${name} in ${element.tagName}`);
  return value;
}

export function required<T>(value: T | undefined, description: string): T {
  if (value === undefined) throw new Error(`Missing ${description} in the Steam snapshot`);
  return value;
}

export async function readSteamXml(root: string, path: string): Promise<Document> {
  const xml = await readFile(join(root, path), 'utf8');
  const document = new DOMParser({
    onError(level, message) {
      if (level !== 'warning') throw new Error(`${path}: ${message}`);
    },
  }).parseFromString(xml.replace(/^\uFEFF/, ''), 'application/xml');
  if (document.doctype) throw new Error(`Unexpected DOCTYPE in ${path}`);
  return document;
}

export function steamSnapshot(root: string) {
  const documents = new Map<string, Promise<Document>>();
  return (relativePath: string): Promise<Document> => {
    const cached = documents.get(relativePath);
    if (cached) return cached;

    const pending = readSteamXml(root, relativePath);
    documents.set(relativePath, pending);
    return pending;
  };
}

export function rows(document: Document, table: string): Element[] {
  return Array.from(document.getElementsByTagName(table)).flatMap(section => children(section, 'Row'));
}
