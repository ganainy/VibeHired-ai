// electron/src/hooks/useAudioRecording.ts
// Records audio and transcribes using AssemblyAI via the backend
import { useRef, useState, useCallback } from 'react';
import { AuthPayload } from './electron.d';
import { buildTranscriptionStreamUrl } from '../services/api';

interface UseAudioRecordingReturn {
  startRecording: (auth: AuthPayload, language?: string, deviceId?: string | null) => void;
  stopRecording: () => Promise<string>;
  resetTranscript: () => void;
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string;
  interimTranscript: string;
  setTranscript: (text: string) => void;
  error: string | null;
  isSupported: boolean;
}

const STREAMING_STT_ENABLED =
  (import.meta.env.VITE_INTERVIEW_BUDDY_STREAMING_STT ?? 'true') !== 'false';

const TRANSCRIPTION_FINAL_WAIT_MS = 600;
const PCM_WORKLET_PROCESSOR_NAME = 'vh-pcm-chunk-processor';
const STREAM_MIN_CHUNK_MS = 60;
const STREAM_MAX_CHUNK_MS = 400;

function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  let offset = 0;

  for (let i = 0; i < float32.length; i++) {
    let sample = Math.max(-1, Math.min(1, float32[i]));
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, sample, true);
    offset += 2;
  }

  return buffer;
}

function concatFloat32Arrays(a: Float32Array, b: Float32Array): Float32Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;

  const merged = new Float32Array(a.length + b.length);
  merged.set(a, 0);
  merged.set(b, a.length);
  return merged;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const backupStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<AudioNode | null>(null);
  const mutedGainNodeRef = useRef<GainNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamFinalsRef = useRef('');
  const isStreamingActiveRef = useRef(false);
  const authRef = useRef<AuthPayload | null>(null);
  const languageRef = useRef<string>('en');
  const resolveRef = useRef<((value: string) => void) | null>(null);
  const pendingPcmSamplesRef = useRef<Float32Array>(new Float32Array(0));

  const isSupported =
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const appendFinalTranscript = useCallback((text: string) => {
    const next = streamFinalsRef.current
      ? `${streamFinalsRef.current} ${text}`.trim()
      : text.trim();
    streamFinalsRef.current = next;
    setTranscript(next);
    setInterimTranscript('');
  }, []);

  const cleanupStreamingNodes = useCallback(() => {
    processorNodeRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    mutedGainNodeRef.current?.disconnect();

    processorNodeRef.current = null;
    sourceNodeRef.current = null;
    mutedGainNodeRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
    }
    audioContextRef.current = null;
    pendingPcmSamplesRef.current = new Float32Array(0);
    isStreamingActiveRef.current = false;
  }, []);

  const closeStreamingSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // no-op
      }
    }
    wsRef.current = null;
  }, []);

  const cleanupMediaStream = useCallback(() => {
    backupStreamRef.current?.getTracks().forEach((track) => track.stop());
    backupStreamRef.current = null;
  }, []);

  const startBackupRecorder = useCallback((stream: MediaStream) => {
    const mimeType = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
    ].find((type) => MediaRecorder.isTypeSupported(type)) || 'audio/webm';

    audioChunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.start(100);
  }, []);

  const startStreamingSession = useCallback(async (
    stream: MediaStream,
    auth: AuthPayload,
  ): Promise<boolean> => {
    if (!STREAMING_STT_ENABLED) return false;

    try {
      const audioContext = new AudioContext({ sampleRate: 16000 });

      // Some Chromium environments start suspended until explicitly resumed.
      if (audioContext.state === 'suspended') {
        await audioContext.resume().catch(() => undefined);
      }

      const wsUrl = buildTranscriptionStreamUrl(auth.apiUrl, auth.token, languageRef.current);
      const ws = new WebSocket(wsUrl);

      const wsReady = await new Promise<boolean>((resolve) => {
        const timeoutId = window.setTimeout(() => {
          resolve(false);
        }, 5000);

        ws.onopen = () => {
          window.clearTimeout(timeoutId);
          resolve(true);
        };

        ws.onerror = () => {
          window.clearTimeout(timeoutId);
          resolve(false);
        };
      });

      if (!wsReady) {
        try {
          ws.close();
        } catch {
          // no-op
        }
        return false;
      }

      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        try {
          const payload = JSON.parse(event.data) as {
            type?: string;
            text?: string;
            error?: string;
          };

          if (payload.type === 'partial' && payload.text) {
            setInterimTranscript(payload.text);
          } else if (payload.type === 'final' && payload.text) {
            appendFinalTranscript(payload.text);
          } else if (payload.type === 'error') {
            console.warn('[AudioRecording] Streaming transcription error:', payload.error);
          }
        } catch {
          // Ignore malformed WS payloads.
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
      };

      const source = audioContext.createMediaStreamSource(stream);
      const mutedGain = audioContext.createGain();
      mutedGain.gain.value = 0;

      pendingPcmSamplesRef.current = new Float32Array(0);
      const minChunkSamples = Math.max(
        1,
        Math.round((audioContext.sampleRate * STREAM_MIN_CHUNK_MS) / 1000),
      );
      const maxChunkSamples = Math.max(
        minChunkSamples,
        Math.round((audioContext.sampleRate * STREAM_MAX_CHUNK_MS) / 1000),
      );

      const sendPcmChunk = (channelData: Float32Array) => {
        if (!isStreamingActiveRef.current) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        if (!channelData.length) return;

        pendingPcmSamplesRef.current = concatFloat32Arrays(
          pendingPcmSamplesRef.current,
          channelData,
        );

        while (pendingPcmSamplesRef.current.length >= minChunkSamples) {
          const chunkSize = Math.min(maxChunkSamples, pendingPcmSamplesRef.current.length);
          const chunk = pendingPcmSamplesRef.current.slice(0, chunkSize);
          pendingPcmSamplesRef.current = pendingPcmSamplesRef.current.slice(chunkSize);

          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
          }

          const pcmBuffer = floatTo16BitPCM(chunk);
          wsRef.current.send(pcmBuffer);
        }
      };

      let processorNode: AudioNode;

      if (audioContext.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
        const workletCode = `
class VhPcmChunkProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    const firstChannel = input && input[0];
    if (firstChannel && firstChannel.length > 0) {
      this.port.postMessage(firstChannel.slice(0));
    }
    return true;
  }
}
registerProcessor('${PCM_WORKLET_PROCESSOR_NAME}', VhPcmChunkProcessor);
`;

        const workletBlob = new Blob([workletCode], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(workletBlob);
        try {
          await audioContext.audioWorklet.addModule(workletUrl);
        } finally {
          URL.revokeObjectURL(workletUrl);
        }

        const workletNode = new AudioWorkletNode(audioContext, PCM_WORKLET_PROCESSOR_NAME, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
        });
        workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
          sendPcmChunk(event.data);
        };
        processorNode = workletNode;
      } else {
        const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
        scriptProcessor.onaudioprocess = (event) => {
          const channelData = event.inputBuffer.getChannelData(0);
          sendPcmChunk(channelData);
        };
        processorNode = scriptProcessor;
      }

      source.connect(processorNode);
      processorNode.connect(mutedGain);
      mutedGain.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      sourceNodeRef.current = source;
      processorNodeRef.current = processorNode;
      mutedGainNodeRef.current = mutedGain;
      isStreamingActiveRef.current = true;

      return true;
    } catch (err) {
      console.warn('[AudioRecording] Failed to initialize streaming STT, fallback to REST:', err);
      closeStreamingSocket();
      cleanupStreamingNodes();
      return false;
    }
  }, [appendFinalTranscript, cleanupStreamingNodes, closeStreamingSocket]);

  const startRecording = useCallback((auth: AuthPayload, language = 'en', deviceId?: string | null) => {
    if (!isSupported) {
      setError('MediaRecorder is not supported in this browser.');
      return;
    }

    setError(null);
    setTranscript('');
    setInterimTranscript('');
    setIsTranscribing(false);
    authRef.current = auth;
    languageRef.current = language;
    streamFinalsRef.current = '';

    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    };
    navigator.mediaDevices.getUserMedia(constraints)
      .then(async (stream) => {
        backupStreamRef.current = stream;

        startBackupRecorder(stream);
        setIsRecording(true);

        const streamingStarted = await startStreamingSession(stream, auth);
        if (!streamingStarted) {
          // Stream-only mode: if realtime is unavailable, abort recording immediately.
          try {
            mediaRecorderRef.current?.stop();
          } catch {
            // no-op
          }
          mediaRecorderRef.current = null;
          cleanupStreamingNodes();
          closeStreamingSocket();
          cleanupMediaStream();
          setIsRecording(false);
          setIsTranscribing(false);
          setError('Real-time transcription stream unavailable. Please retry.');
          return;
        }

        console.log('[AudioRecording] Started recording', {
          streamingEnabled: STREAMING_STT_ENABLED,
          streamingStarted,
        });
      })
      .catch((err) => {
        console.error('[AudioRecording] Failed to access microphone:', err);
        setError('Failed to access microphone. Please check your permissions.');
      });
  }, [isSupported, startBackupRecorder, startStreamingSession]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    streamFinalsRef.current = '';
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        resolve('');
        return;
      }

      resolveRef.current = resolve;
      setIsRecording(false);
      setIsTranscribing(true);

      const recorderStopped = new Promise<void>((resolveStopped) => {
        recorder.onstop = () => {
          mediaRecorderRef.current = null;
          resolveStopped();
        };
      });

      recorder.stop();

      (async () => {
        const waitForFinals = new Promise<void>((resolveWait) => {
          window.setTimeout(() => resolveWait(), TRANSCRIPTION_FINAL_WAIT_MS);
        });

        cleanupStreamingNodes();
        closeStreamingSocket();

        await Promise.all([recorderStopped, waitForFinals]);
        cleanupMediaStream();

        let text = streamFinalsRef.current.trim();

        if (!text) {
          setError('No streamed transcript received. Please retry.');
        }
        setIsTranscribing(false);

        setTranscript(text);
        setInterimTranscript('');

        if (resolveRef.current) {
          resolveRef.current(text);
          resolveRef.current = null;
        }
      })().catch((err) => {
        console.error('[AudioRecording] Failed to stop recording cleanly:', err);
        setError('Failed to finalize recording. Please try again.');
        setIsTranscribing(false);
        cleanupStreamingNodes();
        closeStreamingSocket();
        cleanupMediaStream();
        if (resolveRef.current) {
          resolveRef.current('');
          resolveRef.current = null;
        }
      });

      console.log('[AudioRecording] Stopped recording');
    });
  }, [cleanupMediaStream, cleanupStreamingNodes, closeStreamingSocket, startBackupRecorder]);

  return {
    startRecording,
    stopRecording,
    resetTranscript,
    isRecording,
    isTranscribing,
    transcript,
    interimTranscript,
    setTranscript,
    error,
    isSupported,
  };
}

/**
 * Enumerate available microphone devices.
 * Requests temporary audio access to ensure device labels are populated
 * (labels are empty until the user grants microphone permission).
 */
export async function enumerateMicrophones(): Promise<MediaDeviceInfo[]> {
  try {
    const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    tempStream.getTracks().forEach(t => t.stop());
    return devices.filter(d => d.kind === 'audioinput');
  } catch {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
  }
}
