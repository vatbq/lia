"use client";

import { useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  RealtimeEvent,
  useOpenAIRealtime,
  TranscriptionData,
} from "@/contexts/openai-realtime-context";
import {
  MicrophoneState,
  useMicrophone,
} from "@/contexts/microphone-context";

interface Transcription {
  id: string;
  text: string;
  timestamp: number;
}

interface AudioRecording {
  id: string;
  audioBlob: Blob;
  timestamp: number;
  duration: number;
}

const VoiceInput: () => JSX.Element = () => {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
  const audioBufferRef = useRef<Int16Array[]>([]);
  const {
    connection,
    connectToOpenAI,
    connectionState,
    addListener,
    removeListener,
    send,
    commitAudioBuffer,
  } = useOpenAIRealtime();
  const { setupMicrophone, microphone, startMicrophone, stopMicrophone, microphoneState, addAudioDataListener, removeAudioDataListener } =
    useMicrophone();
  const transcriptionsEndRef = useRef<HTMLDivElement>(null);
  const hasMicrophoneStartedRef = useRef<boolean>(false);
  const hasSetupMicrophoneRef = useRef<boolean>(false);

  useEffect(() => {
    if (!hasSetupMicrophoneRef.current) {
      console.log("[VoiceInput] Setting up microphone on mount");
      setupMicrophone();
      hasSetupMicrophoneRef.current = true;
    }
  }, [setupMicrophone]);

  useEffect(() => {
    console.log("[VoiceInput] Microphone state changed:", microphoneState);
    if (microphoneState === MicrophoneState.Ready) {
      console.log("[VoiceInput] Microphone ready, connecting to OpenAI");
      connectToOpenAI({});
    }
  }, [microphoneState, connectToOpenAI]);

  useEffect(() => {
    console.log("[VoiceInput] Effect triggered. Microphone:", !!microphone, "Connection:", !!connection, "State:", connectionState);
    if (!microphone) {
      console.log("[VoiceInput] No microphone, returning");
      return;
    }
    if (!connection) {
      console.log("[VoiceInput] No connection, returning");
      return;
    }

    let audioDataCount = 0;
    const onAudioData = (pcm16Data: Int16Array) => {
      audioDataCount++;
      if (audioDataCount % 50 === 0) {
        console.log("[VoiceInput] Sending audio data #", audioDataCount, "Size:", pcm16Data.length);
      }

      audioBufferRef.current.push(new Int16Array(pcm16Data));

      send(pcm16Data.buffer);
    };

    const onTranscript = (data: unknown) => {
      console.log("[VoiceInput] 🎤 onTranscript callback triggered");
      console.log("[VoiceInput] Transcript data:", JSON.stringify(data, null, 2));
      const transcriptData = data as TranscriptionData;
      const transcript = transcriptData.transcript;

      if (transcript && transcript !== "") {
        console.log("[VoiceInput] Transcript received:", transcript);

        setTranscriptions((prev) => [
          ...prev,
          {
            id: transcriptData.item_id,
            text: transcript,
            timestamp: Date.now(),
          },
        ]);
        console.log("[VoiceInput] Transcript added to list");
      } else {
        console.log("[VoiceInput] Transcript was empty or undefined");
      }
    };

    console.log("[VoiceInput] Connection state:", connectionState);
    if (connectionState === ConnectionState.OPEN && isListening) {
      console.log("[VoiceInput] Connection is OPEN and listening enabled, setting up listeners");
      addListener(RealtimeEvent.Transcript, onTranscript);
      addAudioDataListener(onAudioData);

      if (!hasMicrophoneStartedRef.current) {
        console.log("[VoiceInput] Starting microphone");
        startMicrophone();
        hasMicrophoneStartedRef.current = true;
      } else {
        console.log("[VoiceInput] Microphone already started");
      }
    } else {
      console.log("[VoiceInput] Connection not open or not listening, resetting microphone started flag");
      if (hasMicrophoneStartedRef.current) {
        console.log("[VoiceInput] Stopping microphone");
        stopMicrophone();
        hasMicrophoneStartedRef.current = false;
      }
    }

    return () => {
      console.log("[VoiceInput] Cleaning up listeners");
      removeListener(RealtimeEvent.Transcript, onTranscript);
      removeAudioDataListener(onAudioData);
    };
  }, [
    connectionState,
    connection,
    microphone,
    isListening,
    addListener,
    removeListener,
    send,
    addAudioDataListener,
    removeAudioDataListener,
    startMicrophone,
    stopMicrophone,
  ]);

  useEffect(() => {
    transcriptionsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptions]);

  const createWavBlob = (pcm16Chunks: Int16Array[], sampleRate: number = 24000): Blob => {
    console.log("[VoiceInput] Creating WAV blob from", pcm16Chunks.length, "chunks");

    const totalLength = pcm16Chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const mergedBuffer = new Int16Array(totalLength);
    let offset = 0;

    for (const chunk of pcm16Chunks) {
      mergedBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    const numChannels = 1;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = mergedBuffer.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string): void => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    for (let i = 0; i < mergedBuffer.length; i++) {
      view.setInt16(44 + i * 2, mergedBuffer[i], true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  const saveCurrentRecording = (): void => {
    if (audioBufferRef.current.length === 0) {
      console.log("[VoiceInput] No audio to save");
      return;
    }

    console.log("[VoiceInput] Saving recording with", audioBufferRef.current.length, "chunks");
    const wavBlob = createWavBlob(audioBufferRef.current);
    const duration = audioBufferRef.current.reduce((acc, chunk) => acc + chunk.length, 0) / 24000;

    const recording: AudioRecording = {
      id: Date.now().toString(),
      audioBlob: wavBlob,
      timestamp: Date.now(),
      duration,
    };

    setRecordings((prev) => [...prev, recording]);
    audioBufferRef.current = [];
    console.log("[VoiceInput] Recording saved. Duration:", duration.toFixed(2), "seconds");
  };

  const toggleListening = (): void => {
    console.log("[VoiceInput] Toggle listening button clicked. Current state:", isListening);

    if (isListening) {
      console.log("[VoiceInput] Stopping listening");
      console.log("[VoiceInput] Audio buffer has", audioBufferRef.current.length, "chunks");

      // Wait a moment to ensure all audio has been sent before committing
      setTimeout(() => {
        console.log("[VoiceInput] Committing audio buffer after delay");
        commitAudioBuffer();
      }, 200);

      saveCurrentRecording();
    } else {
      console.log("[VoiceInput] Starting listening - clearing audio buffer");
      audioBufferRef.current = [];
    }

    setIsListening(!isListening);
  };

  const playRecording = (recording: AudioRecording): void => {
    console.log("[VoiceInput] Playing recording:", recording.id);
    const audio = new Audio(URL.createObjectURL(recording.audioBlob));
    audio.play().catch((error) => {
      console.error("[VoiceInput] Error playing audio:", error);
    });
  };

  const downloadRecording = (recording: AudioRecording): void => {
    console.log("[VoiceInput] Downloading recording:", recording.id);
    const url = URL.createObjectURL(recording.audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${recording.id}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen antialiased bg-gray-50">
      <div className="flex flex-col w-full max-w-6xl mx-auto p-8">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Real-time Transcription
            </h1>
            <button
              onClick={toggleListening}
              disabled={connectionState !== ConnectionState.OPEN}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                isListening
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
              }`}
            >
              {isListening ? "Stop Listening" : "Start Listening"}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div
              className={`w-3 h-3 rounded-full ${connectionState === ConnectionState.OPEN
                  ? "bg-green-500 animate-pulse"
                  : connectionState === ConnectionState.CONNECTING
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500"
                }`}
            />
            <span className="text-sm text-gray-600">
              {connectionState === ConnectionState.OPEN
                ? isListening
                  ? "Listening..."
                  : "Ready to listen"
                : connectionState === ConnectionState.CONNECTING
                  ? "Connecting..."
                  : "Disconnected"}
            </span>
          </div>
        </div>

        <div className="flex-1 flex gap-4 overflow-hidden">
          <div className="flex-1 overflow-y-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Full Transcript</h2>
            {transcriptions.length === 0 && !currentTranscript && (
              <p className="text-gray-400 text-center mt-8">
                {connectionState === ConnectionState.OPEN && !isListening
                  ? "Click 'Start Listening' to begin transcription..."
                  : isListening
                    ? "Start speaking to see transcriptions appear here..."
                    : "Connecting..."}
              </p>
            )}

            {(transcriptions.length > 0 || currentTranscript) && (
              <div className="prose max-w-none">
                <p className="text-gray-900 text-base leading-relaxed whitespace-pre-wrap">
                  {transcriptions.map((t) => t.text).join(" ")}
                  {currentTranscript && (
                    <span className="text-blue-600 animate-pulse">
                      {transcriptions.length > 0 ? " " : ""}
                      {currentTranscript}
                    </span>
                  )}
                </p>
                <div ref={transcriptionsEndRef} />
              </div>
            )}
          </div>

          <div className="w-80 overflow-y-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recordings</h2>
            {recordings.length === 0 ? (
              <p className="text-gray-400 text-center mt-8 text-sm">
                No recordings yet. Start and stop listening to save recordings.
              </p>
            ) : (
              <div className="space-y-3">
                {recordings.map((recording, index) => (
                  <div
                    key={recording.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Recording {recordings.length - index}
                      </span>
                      <span className="text-xs text-gray-500">
                        {recording.duration.toFixed(1)}s
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {new Date(recording.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => playRecording(recording)}
                        className="flex-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
                      >
                        Play
                      </button>
                      <button
                        onClick={() => downloadRecording(recording)}
                        className="flex-1 px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceInput;
