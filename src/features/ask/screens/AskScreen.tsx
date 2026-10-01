import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useServices } from '@/composition/ServicesProvider';
import { toAppError } from '@/core/errors/AppError';
import { useTheme } from '@/core/theme';
import { Banner, Chip, EmptyState, IconButton, Text } from '@/core/ui';
import { useModels } from '@/features/models/hooks/useModels';
import { type SettingsRepository } from '@/features/settings/data/settingsRepository';

import { AnswerText, SourceCard } from '../components/AnswerView';
import { askQuestion, type AskResult } from '../pipeline/askQuestion';

type Turn = {
  id: number;
  question: string;
  streamed: string;
  result: AskResult | null;
  error: string | null;
};

async function recordAnswerSpeed(settings: SettingsRepository, model: string, result: AskResult) {
  if (result.kind !== 'answer' || result.tokensPerSecond <= 0) return;
  await settings.recordPerf({
    at: Date.now(),
    kind: 'answer',
    model,
    value: result.tokensPerSecond,
    detail: `${result.sources.length} sources`,
  });
}

const SUGGESTIONS = [
  'What do I need to buy?',
  'When is my dentist cleaning?',
  'What did I plan for Lisbon?',
];

export function AskScreen() {
  const services = useServices();
  const router = useRouter();
  const { colors, radii, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { capabilities } = useModels();
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const nextId = useRef(1);

  const patch = (id: number, update: Partial<Turn>) =>
    setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, ...update } : turn)));

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !capabilities.canSearchByMeaning) return;
    const id = nextId.current++;
    setTurns((current) => [
      ...current,
      { id, question: trimmed, streamed: '', result: null, error: null },
    ]);
    setQuestion('');
    setBusy(true);
    try {
      const result = await askQuestion(
        {
          embedder: services.engines.embedder,
          chunks: services.chunks,
          keywordSearch: async (q) =>
            (await services.notes.list({ text: q, match: 'any', limit: 10 })).map((n) => n.id),
          generator: capabilities.canAnswer ? services.engines.textGenerator : null,
        },
        trimmed,
        { onToken: (streamed) => patch(id, { streamed }) },
      );
      patch(id, { result });
      void recordAnswerSpeed(services.settings, services.engines.textGenerator.modelId, result);
    } catch (error) {
      patch(id, { error: toAppError(error, 'GENERATION_FAILED').message });
    } finally {
      setBusy(false);
    }
  }

  const openSource = (noteId: string, startMs: number) =>
    router.push(`/note/${noteId}?t=${startMs}`);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      {/* Fixed header: the conversation scrolls beneath it, not beneath the status bar. */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
        <Text variant="display" accessibilityRole="header">
          Ask
        </Text>
        <Text variant="caption" color="textMuted">
          Answers come from your notes, on this phone, with sources.
        </Text>
      </View>
      <ScrollView
        ref={scroll}
        testID="ask-scroll"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        keyboardDismissMode="interactive"
        contentContainerStyle={{
          paddingTop: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xl,
          gap: spacing.lg,
        }}>
        {!capabilities.canSearchByMeaning ? (
          <Banner
            icon="download"
            tone="warning"
            title="Ask needs the search model"
            message="Download multi-qa MiniLM (and LFM2.5 for written answers) in Models."
            onPress={() => router.push('/models')}
            testID="ask-models-banner"
          />
        ) : !capabilities.canAnswer ? (
          <Banner
            icon="sparkles"
            title="Showing matching passages"
            message="Download LFM2.5 for written answers with citations."
            onPress={() => router.push('/models')}
          />
        ) : null}

        {turns.length === 0 && (
          <View style={{ gap: spacing.md }}>
            <EmptyState
              icon="quote"
              title="Ask your notes anything"
              message="Try one of these, or type your own."
            />
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.sm,
                justifyContent: 'center',
              }}>
              {SUGGESTIONS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  onPress={() => void ask(s)}
                  testID={`suggestion-${SUGGESTIONS.indexOf(s)}`}
                />
              ))}
            </View>
          </View>
        )}

        {turns.map((turn) => (
          <Animated.View
            key={turn.id}
            entering={FadeInUp.springify().damping(20)}
            style={{ gap: spacing.md }}>
            <View
              style={{
                alignSelf: 'flex-end',
                maxWidth: '85%',
                backgroundColor: colors.accent,
                borderRadius: radii.lg,
                borderBottomRightRadius: radii.sm,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              }}>
              <Text style={{ color: colors.onAccent }}>{turn.question}</Text>
            </View>
            <View
              testID={`answer-${turn.id}`}
              style={{
                gap: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: radii.lg,
                borderBottomLeftRadius: radii.sm,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
              }}>
              <TurnBody turn={turn} onOpen={openSource} />
            </View>
          </Animated.View>
        ))}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + 60,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}>
        <TextInput
          testID="ask-input"
          value={question}
          onChangeText={setQuestion}
          placeholder={
            capabilities.canSearchByMeaning ? 'Ask about your notes' : 'Download models to ask'
          }
          placeholderTextColor={colors.textFaint}
          editable={capabilities.canSearchByMeaning}
          multiline
          onSubmitEditing={() => void ask(question)}
          submitBehavior="submit"
          returnKeyType="send"
          accessibilityLabel="Question"
          style={[
            typography.body,
            {
              flex: 1,
              maxHeight: 120,
              minHeight: 44,
              color: colors.text,
              backgroundColor: colors.surfaceSunken,
              borderRadius: radii.lg,
              paddingHorizontal: spacing.lg,
              paddingTop: 11,
              paddingBottom: 11,
            },
          ]}
        />
        <IconButton
          icon="send"
          label="Ask"
          testID="ask-send"
          size={44}
          filled
          tone="accent"
          disabled={busy || !question.trim() || !capabilities.canSearchByMeaning}
          onPress={() => void ask(question)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function TurnBody({
  turn,
  onOpen,
}: {
  turn: Turn;
  onOpen: (noteId: string, startMs: number) => void;
}) {
  const { spacing } = useTheme();
  if (turn.error) return <Text color="danger">{turn.error}</Text>;
  if (!turn.result) {
    return <Text color="textMuted">{turn.streamed || 'Searching your notes...'}</Text>;
  }
  const { result } = turn;
  if (result.kind === 'nothing-found') {
    return <Text color="textMuted">Nothing in your notes matches that yet.</Text>;
  }
  const open = (n: number) => {
    const source = result.sources[n - 1];
    if (source) onOpen(source.noteId, source.startMs);
  };
  return (
    <View style={{ gap: spacing.md }}>
      {result.kind === 'answer' ? (
        <AnswerText parts={result.parts} onCite={open} />
      ) : (
        <Text color="textMuted">The closest passages in your notes:</Text>
      )}
      <View style={{ gap: spacing.sm }}>
        {result.sources.map((source, index) =>
          result.kind === 'answer' &&
          result.cited.length > 0 &&
          !result.cited.includes(index + 1) ? null : (
            <SourceCard
              key={source.chunkId}
              index={index + 1}
              source={source}
              onPress={() => open(index + 1)}
            />
          ),
        )}
      </View>
    </View>
  );
}
