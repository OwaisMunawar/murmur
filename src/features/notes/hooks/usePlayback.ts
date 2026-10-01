import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect } from 'react';

/**
 * Playback for one recording. The audio session is reset to playback on
 * every play: the recorder leaves it in a record-only category, under which
 * iOS plays nothing.
 */
export function usePlayback(uri: string | null) {
  const player = useAudioPlayer(uri ? { uri } : null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (status.didJustFinish) void player.seekTo(0);
  }, [status.didJustFinish, player]);

  const play = useCallback(async () => {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    player.play();
  }, [player]);

  const toggle = useCallback(() => {
    if (status.playing) player.pause();
    else void play();
  }, [status.playing, player, play]);

  const seek = useCallback(
    async (ms: number, thenPlay = false) => {
      await player.seekTo(ms / 1000);
      if (thenPlay && !status.playing) await play();
    },
    [player, play, status.playing],
  );

  return {
    positionMs: Math.round(status.currentTime * 1000),
    durationMs: Math.round(status.duration * 1000),
    playing: status.playing,
    loaded: status.isLoaded,
    toggle,
    seek,
  };
}
