# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-01

### Added

- Recording with a live Skia waveform, pause and resume, discard, and a 10-minute length guard. Audio is captured as 16 kHz PCM and stored as WAV.
- On-device transcription with Whisper Tiny (ExecuTorch), split at natural pauses, with silent chunks skipped and estimated sentence timings.
- On-device enrichment with LFM2.5 350M: title, summary, tags, to-dos and mood, validated per field with zod, with a targeted repair round and a heuristic fallback.
- Ask your notes: sentence-level chunks embedded with multi-qa MiniLM into sqlite-vec, hybrid retrieval with FTS5, and answers with tappable citations that open the note at the passage.
- Notes list grouped by day, with full-text and semantic search, tag filters, and swipe to delete with undo.
- Note detail with a drag-to-seek playback scrubber, tap-to-seek transcript, editable title and tags, to-do checkboxes, and a rewrite action once the language model is installed.
- Model manager with per-model download, cancel and delete, progress, size on disk, licences, and Wi-Fi-only downloads.
- Privacy screen, a single network module, an ESLint rule and a source-scanning test that keep it that way; ExecuTorch download telemetry switched off.
- Demo mode (`EXPO_PUBLIC_DEMO=1`) with 12 fictional notes and deterministic engines.
- Light and dark themes, CI for format, lint, types, tests with a coverage gate, expo-doctor, an iOS simulator build and an Android debug build.

### Known issues

- Audio playback could not be confirmed in the iOS simulator used for development: the simulator's audio output reported CoreAudio errors and the player never loaded an item. Seeking and the scrubber are covered by screen tests with a mocked player; playback needs checking on a device.
- Whisper Tiny mishears some names and places. Larger Whisper variants are supported by ExecuTorch and can be swapped in through the model catalog (`catalog.ts` and `executorchModels.ts`).
