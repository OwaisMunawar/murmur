import {
  models,
  type LLMModel,
  type TextEmbedderModel,
  type WhisperSttModel,
} from 'react-native-executorch';

/**
 * Catalog ids mapped to ExecuTorch registry entries. XNNPACK variants are
 * pinned explicitly instead of `DEFAULT`, which picks Core ML or MLX on iOS:
 * MLX does not run in the simulator, and one backend everywhere keeps
 * measurements comparable.
 */
const configs = {
  'whisper-tiny': models.speechToText.WHISPER.TINY.XNNPACK_FP32,
  'lfm2.5-350m': models.llm.LFM2_5_350M.XNNPACK_8DA4W,
  'minilm-qa': models.textEmbeddings.MULTI_QA_MINILM_L6_COS_V1.XNNPACK_FP32,
} satisfies Record<string, WhisperSttModel | LLMModel | TextEmbedderModel>;

export function executorchConfigFor(id: string): unknown {
  const config = (configs as Record<string, unknown>)[id];
  if (!config) throw new Error(`Unknown model ${id}`);
  return config;
}

export function executorchLanguagesFor(id: 'whisper-tiny'): readonly string[] {
  return configs[id].supportedLanguages;
}
