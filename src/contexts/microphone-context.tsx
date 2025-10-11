"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";

interface MicrophoneContextType {
  microphone: {
    stream: MediaStream;
    audioContext: AudioContext;
  } | null;
  startMicrophone: () => void;
  stopMicrophone: () => void;
  setupMicrophone: () => Promise<void>;
  microphoneState: MicrophoneState;
  addAudioDataListener: (callback: (data: Int16Array) => void) => void;
  removeAudioDataListener: (callback: (data: Int16Array) => void) => void;
}

export enum MicrophoneState {
  NotSetup = -1,
  SettingUp = 0,
  Ready = 1,
  Opening = 2,
  Open = 3,
  Error = 4,
  Pausing = 5,
  Paused = 6,
}

const MicrophoneContext = createContext<MicrophoneContextType | undefined>(
  undefined
);

interface MicrophoneContextProviderProps {
  children: ReactNode;
}

const MicrophoneContextProvider: React.FC<MicrophoneContextProviderProps> = ({
  children,
}) => {
  const [microphoneState, setMicrophoneState] = useState<MicrophoneState>(
    MicrophoneState.NotSetup
  );
  const [microphone, setMicrophone] = useState<{
    stream: MediaStream;
    audioContext: AudioContext;
  } | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const audioDataListenersRef = useRef<Set<(data: Int16Array) => void>>(new Set());

  const addAudioDataListener = useCallback((callback: (data: Int16Array) => void) => {
    console.log("[Microphone] Adding audio data listener");
    audioDataListenersRef.current.add(callback);
    console.log("[Microphone] Total audio data listeners:", audioDataListenersRef.current.size);
  }, []);

  const removeAudioDataListener = useCallback((callback: (data: Int16Array) => void) => {
    console.log("[Microphone] Removing audio data listener");
    audioDataListenersRef.current.delete(callback);
  }, []);

  const convertFloat32ToInt16 = (buffer: Float32Array): Int16Array => {
    const int16 = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16;
  };

  const resampleTo24kHz = (
    audioBuffer: Float32Array,
    originalSampleRate: number
  ): Float32Array => {
    if (originalSampleRate === 24000) {
      return audioBuffer;
    }

    const targetSampleRate = 24000;
    const ratio = originalSampleRate / targetSampleRate;
    const newLength = Math.round(audioBuffer.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, audioBuffer.length - 1);
      const t = srcIndex - srcIndexFloor;

      result[i] = audioBuffer[srcIndexFloor] * (1 - t) + audioBuffer[srcIndexCeil] * t;
    }

    return result;
  };

  const setupMicrophone = useCallback(async () => {
    console.log("[Microphone] Starting microphone setup");
    setMicrophoneState(MicrophoneState.SettingUp);

    // Clean up existing stream if any
    if (mediaStreamRef.current) {
      console.log("[Microphone] Cleaning up existing media stream");
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      console.log("[Microphone] Closing existing audio context");
      await audioContextRef.current.close();
    }

    try {
      console.log("[Microphone] Requesting microphone access");
      const userMedia = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
        },
      });

      console.log("[Microphone] Microphone access granted");
      mediaStreamRef.current = userMedia;

      // Create audio context with default sample rate (usually 48kHz)
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      console.log("[Microphone] Audio context created. Sample rate:", audioContext.sampleRate);

      const source = audioContext.createMediaStreamSource(userMedia);
      sourceNodeRef.current = source;
      console.log("[Microphone] Media stream source created");

      // Create processor node (4096 buffer size)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;
      console.log("[Microphone] Script processor node created");

      let audioChunkCount = 0;
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const sampleRate = e.inputBuffer.sampleRate;

        audioChunkCount++;
        if (audioChunkCount % 50 === 0) {
          console.log("[Microphone] Processing audio chunk #", audioChunkCount, "Sample rate:", sampleRate, "Buffer size:", inputData.length);
        }

        // Resample to 24kHz if needed
        const resampled = resampleTo24kHz(inputData, sampleRate);

        // Convert to Int16Array (PCM16)
        const pcm16Data = convertFloat32ToInt16(resampled);

        if (audioChunkCount % 50 === 0) {
          console.log("[Microphone] Resampled audio. Original:", inputData.length, "Resampled:", resampled.length, "PCM16:", pcm16Data.length);
        }

        // Notify all listeners
        const listenerCount = audioDataListenersRef.current.size;
        if (audioChunkCount % 50 === 0) {
          console.log("[Microphone] Notifying", listenerCount, "listeners");
        }
        audioDataListenersRef.current.forEach((callback) => {
          callback(pcm16Data);
        });
      };

      setMicrophone({ stream: userMedia, audioContext });
      setMicrophoneState(MicrophoneState.Ready);
      console.log("[Microphone] Microphone setup complete");
    } catch (error) {
      console.error("[Microphone] Error setting up microphone:", error);
      setMicrophoneState(MicrophoneState.Error);
      throw error;
    }
  }, []);

  const stopMicrophone = useCallback(() => {
    console.log("[Microphone] Stopping microphone");
    if (!sourceNodeRef.current || !processorNodeRef.current) {
      console.warn("[Microphone] Cannot stop: nodes not initialized");
      return;
    }

    setMicrophoneState(MicrophoneState.Pausing);

    try {
      sourceNodeRef.current.disconnect();
      processorNodeRef.current.disconnect();
      setMicrophoneState(MicrophoneState.Paused);
      console.log("[Microphone] Microphone stopped");
    } catch (error) {
      console.error("[Microphone] Error stopping microphone:", error);
    }
  }, []);

  const startMicrophone = useCallback(() => {
    console.log("[Microphone] Starting microphone");
    if (!sourceNodeRef.current || !processorNodeRef.current || !audioContextRef.current) {
      console.error("[Microphone] Cannot start: microphone components not initialized");
      return;
    }

    const stream = mediaStreamRef.current;
    if (!stream || !stream.active) {
      console.error("[Microphone] MediaStream is not active. Please setup microphone again.");
      setMicrophoneState(MicrophoneState.Error);
      return;
    }

    setMicrophoneState(MicrophoneState.Opening);

    try {
      // Connect source -> processor -> destination
      console.log("[Microphone] Connecting audio nodes");
      sourceNodeRef.current.connect(processorNodeRef.current);
      processorNodeRef.current.connect(audioContextRef.current.destination);

      setMicrophoneState(MicrophoneState.Open);
      console.log("[Microphone] Microphone started successfully");
    } catch (error) {
      console.error("[Microphone] Error starting microphone:", error);
      setMicrophoneState(MicrophoneState.Error);
    }
  }, []);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (processorNodeRef.current) {
        processorNodeRef.current.disconnect();
      }
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  return (
    <MicrophoneContext.Provider
      value={{
        microphone,
        startMicrophone,
        stopMicrophone,
        setupMicrophone,
        microphoneState,
        addAudioDataListener,
        removeAudioDataListener,
      }}
    >
      {children}
    </MicrophoneContext.Provider>
  );
};

function useMicrophone(): MicrophoneContextType {
  const context = useContext(MicrophoneContext);

  if (context === undefined) {
    throw new Error(
      "useMicrophone must be used within a MicrophoneContextProvider"
    );
  }

  return context;
}

export { MicrophoneContextProvider, useMicrophone };
