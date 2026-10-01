# Architecture

Murmur records voice notes, transcribes them, writes summaries and answers questions about them, all on the phone. This document explains how the code is laid out and records the decisions that shaped it, including the options that were rejected.

## Layout

```
src/
  app/                 Expo Router routes. One-line re-exports of feature screens.
  composition/         The composition root: builds the service container (real or demo).
  core/                Shared, feature-agnostic code.
    db/                SqlDriver contract, op-sqlite driver, migrations.
    errors/            AppError with typed codes.
    hooks/             useStore, useQuery.
    lib/               Pure helpers (ids, formatting, a tiny observable store).
    theme/             Design tokens and the light/dark theme provider.
    ui/                Primitives: Text, Button, Card, Chip, Toast, SegmentedControl...
  features/
    recording/         PCM capture, WAV codec, live waveform, record screen.
    transcription/     SpeechToText interface, Whisper engine, chunk planning, sentence timing.
    enrichment/        TextGenerator interface, LFM engine, prompts, JSON repair, heuristics.
    ask/               Embedder interface, chunking, sqlite-vec repository, ranking, citations.
    notes/             Notes repository, the processing pipeline, list and detail screens.
    models/            Model catalog, download policy, model manager, downloader.
    settings/          Settings repository, settings and privacy screens.
  demo/                Fictional seed notes and scripted engine responses for demo mode.
```

Inside a feature, `lib/` is pure TypeScript with no React or native imports (an ESLint rule enforces it), so it runs in plain Node tests. `data/` holds repositories over the `SqlDriver` contract, `engine/` holds an interface plus its implementations, and `pipeline/` orchestrates engines and repositories.

## Data flow

1. **Record.** `useRecorder` captures 16 kHz mono float PCM from `expo-audio`'s native stream, keeps it in a growable buffer, and pushes display levels into a Reanimated shared value. On stop, the samples are encoded as WAV and saved, and a note row is created with status `recorded`.
2. **Process.** The note processor runs one note at a time: `transcribing`, `enriching`, `indexing`, `ready`. Each stage writes its result and the next status in one transaction before the next stage starts, so a killed app resumes where it stopped.
3. **Ask.** A question is embedded, the nearest chunks come back from sqlite-vec, full-text matches are fused in, a few strong passages are kept, and the language model answers with numbered citations that map back to a note and a time.

## Decisions

### ADR-001: ExecuTorch for all three models, not llama.rn and whisper.rn

**Decision.** Use `react-native-executorch` 0.10.4 for speech recognition, text generation and embeddings.

**Why.** One runtime, one model format and one download and caching path for three different tasks. ExecuTorch runs inference on its own worklet runtime, so none of it blocks the JS thread. The library ships pre-exported, tested variants of Whisper, LFM2.5 and MiniLM, plus the tokenizers and chat templates that go with them.

**Rejected.**

- _llama.rn + whisper.rn (llama.cpp and whisper.cpp)._ Mature and fast, with GGUF's huge model choice and grammar-constrained sampling. But it is two native runtimes with separate download, threading and memory models, plus a third library for embeddings. For an app whose point is a small, auditable on-device surface, one runtime wins.
- _Platform APIs (Apple Foundation Models, Android AICore)._ Not available on most devices people own today, and not the same model on both platforms.

**Consequences.** The ExecuTorch JS API Murmur uses does not expose grammar-constrained decoding, so structured output needs its own guard rails (ADR-004). The library's chat preprocessor renders templates without a `bos_token`; LFM2.5's template starts with one, and without it the model often stopped after a single token. The text generator prepends the token when the template asks for it.

### ADR-002: op-sqlite, behind a driver interface

**Decision.** `@op-engineering/op-sqlite` 18 with FTS5 and sqlite-vec compiled in, behind a small `SqlDriver` interface.

**Why.** sqlite-vec and FTS5 are switched on in `package.json` and statically linked into the library on both platforms, so there is no extension to load at runtime and nothing to get wrong in a release build. Every `execute` runs on a native thread, blobs come back as `ArrayBuffer`, and bulk writes inside a transaction are fast, which matters when a note's vectors are replaced in one go.

**Rejected, narrowly.** _expo-sqlite._ It would also work: it can enable FTS5 and bundle sqlite-vec through its config plugin, and it stays inside the Expo SDK's versioning. For a simpler app it would be my default. Here the deciding factors were the static linking and op-sqlite's performance on the write-heavy indexing path. Because repositories only see `SqlDriver`, switching is one new driver file.

**Consequences.** The `SqlDriver` interface (`query`, `run`, `transaction`) is all the repositories see. Tests implement it with better-sqlite3 plus the `sqlite-vec` npm package, so every repository test runs real SQL against the same schema and extensions as the app.

### ADR-003: Vector search in SQLite with sqlite-vec, fused with FTS5

**Decision.** Store 384-dimensional embeddings in a `vec0` virtual table with cosine distance, keyed by the chunk's rowid. Run KNN in SQL. Fuse three rankings with reciprocal rank fusion: vector similarity, the full-text rank of the chunk's note, and how many question terms the chunk contains.

**Why.** KNN in native code keeps search cost off the JS heap and thread. Embeddings blur exact names and numbers, and full-text search misses paraphrases; rank fusion combines them without having to calibrate a cosine score against BM25. The chunk-level term ranking picks the right passage inside a note that matched ("what do I need to buy" lands on the sentence about oat milk, not on the dentist sentence before it).

**Rejected.**

- _Brute-force cosine in JS._ Fine for a few hundred notes but grows with the heap and blocks the thread. sqlite-vec does the same brute-force scan in C.
- _Cosine in a worklet._ Off the JS thread, but it means copying every vector across runtimes on every search.
- _An ANN index (HNSW)._ Not worth it at personal-journal scale; exact KNN over tens of thousands of 384-float vectors is fast.

**Details that matter.**

- `vec0` cannot filter on joined columns during KNN, so the query over-fetches and soft-deleted notes are dropped in the join.
- The relevance floor belongs to the embedding model (multi-qa MiniLM: 0.2; the fake embedder: 0.08), not to the ranking code.
- Notes that also match by keyword skip the floor: a word match is evidence on its own, and a small embedding model scores short, vague questions low against everything.
- Chunks are two or three sentences (240 characters) with one sentence of overlap, prefixed with the note title. Bigger chunks averaged several topics into one vector and lost to short questions.

### ADR-004: Structured output with prefill, per-field validation and a targeted repair

**Decision.** For enrichment, force the reply to start with `{"title":"`, validate every field separately with zod, ask once more for only the fields that are missing or invalid, and fill whatever is still missing from a heuristic, field by field. The note records whether its summary came from the model, a repaired model answer, or the heuristic, and the UI says so.

**Why.** Measured on the simulator with LFM2.5 350M, the first version (no prefill, one object, all-or-nothing validation, a full repair) fell back to the heuristic on most notes: the model either closed the object after the summary or copied the worked example. What fixed it, in order of effect:

1. _Prefilling the JSON opening._ The model can no longer start with prose.
2. _Putting the summary last._ The model tends to end the object after its longest field; everything before it now survives.
3. _Validating per field._ One bad field costs only that field.
4. _Repairing only what failed, with a token cap and a repeated-token stop._ Asking for the whole object again produced the same mistake or a loop of quotes.
5. _Dropping fields copied from the worked example._ "Brake pads" in a note about groceries is detected and discarded.

After these changes, the most recent recordings got complete JSON on the first attempt.

**Rejected.**

- _Grammar-constrained decoding._ The most robust option, but not available in the ExecuTorch API used here.
- _Tool calling._ ExecuTorch supports it, but a 350M model is less reliable at tool-call syntax than at plain JSON.
- _A larger model._ Qwen3 0.6B (506 MB) or LFM2.5 1.2B would do better, at two to three times the download and memory. The smallest model that gives usable output after these guard rails is the right default; a larger one is on the roadmap as an option.

### ADR-005: Engines behind interfaces, injected from a composition root

**Decision.** `SpeechToText`, `TextGenerator` and `Embedder` are interfaces. Each has an ExecuTorch implementation that loads lazily from the model manager's local paths and a deterministic fake. `buildServices` wires repositories, engines, the model manager and the note processor; `createNativeServices` chooses real or demo parts; screens get everything through `useServices()`.

**Why.** Domain code never imports a native module, so it is testable in Node. Demo mode, tests and the real app run the same pipeline, prompts, parsing and ranking; only the engines differ. ExecuTorch modules are `require`d lazily, so demo builds and tests never start the native runtime.

**Rejected.** _Module-level singletons and React hooks per model_ (`useLLMChatSession` and friends). Convenient for a single screen, but they tie model lifetime to component lifetime and make the pipeline untestable without a device.

### ADR-006: One module may touch the network

**Decision.** Only `executorchModelDownloader.ts` performs network I/O. An ESLint rule bans `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` and ExecuTorch's `download` everywhere else, and a Jest test scans the source on every run (it cannot be silenced with a disable comment). The test also fails if an SDK that phones home (expo-updates, Sentry, Firebase and the like) is added.

**Why.** "Nothing leaves your phone" should be checkable, not a promise in a README. The Privacy screen lists exactly what the downloader sends.

**Details.** ExecuTorch sends anonymous analytics for each model download by default; Murmur switches that off. The library's fetcher also sends a `HEAD` request to the model's `config.json` on Hugging Face to bump its download counter. That one is not configurable, so it is disclosed instead.

### ADR-007: Capture PCM, store WAV

**Decision.** Record with `expo-audio`'s native audio stream at 16 kHz mono float PCM, and store WAV.

**Why.** Whisper needs 16 kHz PCM. Recording to m4a would need a decoder to get samples back, and Android has no built-in API that does that from JS. Capturing PCM directly gives the waveform its levels and the transcriber its input from one source. The WAV codec is about a hundred lines and fully tested, including the chunk layouts iOS writes.

**Trade-off.** WAV is about 32 KB per second, so a 10-minute note is about 19 MB. Compressing old recordings is a possible later step.

### ADR-008: Reanimated 4.5 rather than 4.7

**Decision.** `react-native-reanimated` 4.5.1 with `react-native-worklets` 0.10.1, the versions Expo SDK 57 ships.

**Why.** Reanimated 4.7 requires worklets 0.13. SDK 57's expo-modules-core accepts worklets only up to 0.10, and ExecuTorch 0.10.4 accepts `>=0.10 <0.13`. Two packages built against different worklets versions would mean two incompatible native runtimes. 4.5 is the release all three agree on, and nothing in Murmur needs 4.7.

### ADR-009: XNNPACK everywhere

**Decision.** Pin the XNNPACK (CPU) variant of every model and build only that backend into the app.

**Why.** It is the one backend that behaves the same on iOS devices, the iOS simulator and Android, so tests, CI screenshots and phones agree. ExecuTorch's `DEFAULT` variants pick Core ML or MLX on iOS, and MLX does not run in the simulator. Building one backend also keeps the app binary smaller.

**Later.** Core ML for Whisper on iOS devices is the obvious next speed-up.

### ADR-010: Chunked transcription with estimated sentence timings

**Decision.** Split recordings into 12–25 second chunks, cut at the quietest 30 ms frame in that window. Skip chunks that are entirely silent. Give each sentence a time span proportional to its length inside its chunk.

**Why.** Real progress, cancellation between chunks, and no Whisper hallucinations on silence. The ExecuTorch Whisper API returns text without word timings, so sentence timings are estimated; the UI says so. That is accurate enough to seek to the right moment, and word-level timing is on the roadmap.

**Rejected.** _Streaming transcription while recording._ ExecuTorch supports it, but it doubles the work during recording and gives no timestamps. It remains a good later feature for live captions.

## Testing strategy

| Layer            | How                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `lib/`           | Plain unit tests, no mocks.                                                                       |
| `data/`          | Real SQLite in memory (better-sqlite3 + sqlite-vec + FTS5) through the same `SqlDriver` contract. |
| `pipeline/`      | Real repositories with fake engines, including failure, cancellation and resume paths.            |
| Screens          | Testing Library over the demo container; only native views (Skia, SF Symbols, audio) are mocked.  |
| End to end       | Maestro flows against a demo-mode build.                                                          |
| Network boundary | A source-scanning test plus the ESLint rule.                                                      |
