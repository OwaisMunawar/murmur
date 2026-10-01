import { File } from 'expo-file-system';

/** Native libraries hand back bare absolute paths; expo-file-system wants URIs. */
export function fileAt(path: string): File {
  return new File(path.startsWith('file://') ? path : `file://${path}`);
}
