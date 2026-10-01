import { type ModelSpec } from '../catalog';

export type DownloadResult = {
  /** Model config with local file paths substituted for URLs. */
  resolved: unknown;
  bytes: number;
};

/**
 * The only component allowed to touch the network. Everything that leaves
 * the device goes through an implementation of this interface, which is what
 * makes the Privacy screen's claims checkable.
 */
export interface ModelDownloader {
  download(
    spec: ModelSpec,
    options: { onProgress: (fraction: number) => void; signal: AbortSignal },
  ): Promise<DownloadResult>;
  /** Bytes currently on disk for an installed model; 0 when its files are gone. */
  measure(resolved: unknown): Promise<number>;
  remove(resolved: unknown): Promise<void>;
}

/** Every string leaf of a resolved config that looks like a local file path. */
export function localPaths(resolved: unknown): string[] {
  const out = new Set<string>();
  const visit = (node: unknown) => {
    if (typeof node === 'string') {
      if (node.startsWith('/') || node.startsWith('file://')) out.add(node);
    } else if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === 'object') Object.values(node).forEach(visit);
  };
  visit(resolved);
  return [...out];
}
