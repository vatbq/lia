"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
  ReactNode,
} from "react";

interface OpenAIRealtimeContextType {
  connection: WebSocket | null;
  connectToOpenAI: (config: SessionConfig) => void;
  disconnect: () => void;
  connectionState: ConnectionState;
  addListener: (
    event: RealtimeEvent,
    callback: (data: unknown) => void,
  ) => void;
  removeListener: (
    event: RealtimeEvent,
    callback: (data: unknown) => void,
  ) => void;
  send: (data: ArrayBuffer | Blob) => void;
  commitAudioBuffer: () => void;
}

export enum ConnectionState {
  CLOSED = "CLOSED",
  CONNECTING = "CONNECTING",
  OPEN = "OPEN",
  ERROR = "ERROR",
}

export enum RealtimeEvent {
  Transcript = "conversation.item.input_audio_transcription.completed",
  Error = "error",
  SessionCreated = "session.created",
  SessionUpdated = "session.updated",
  InputAudioBufferCommitted = "input_audio_buffer.committed",
  InputAudioBufferSpeechStarted = "input_audio_buffer.speech_started",
  InputAudioBufferSpeechStopped = "input_audio_buffer.speech_stopped",
  ConversationItemCreated = "conversation.item.created",
}

interface SessionConfig {
  input_audio_format?: "pcm16" | "g711_ulaw" | "g711_alaw";
  input_audio_transcription?: {
    model: "gpt-4o-mini-transcribe" | "gpt-4o-transcribe";
    prompt?: string;
    language?: string;
  };
  turn_detection?: {
    type: "server_vad";
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  };
  input_audio_noise_reduction?: {
    type: "near_field" | "far_field";
  };
  include_logprobs?: boolean;
}

interface TranscriptionData {
  type: string;
  item_id: string;
  content_index: number;
  transcript: string;
}

const OpenAIRealtimeContext = createContext<
  OpenAIRealtimeContextType | undefined
>(undefined);

interface OpenAIRealtimeProviderProps {
  children: ReactNode;
}

const OpenAIRealtimeProvider: React.FC<OpenAIRealtimeProviderProps> = ({
  children,
}) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.CLOSED,
  );
  const [connection, setConnection] = useState<WebSocket | null>(null);
  const eventListeners = useRef<
    Map<RealtimeEvent, Set<(data: unknown) => void>>
  >(new Map());

  const addListener = useCallback(
    (event: RealtimeEvent, callback: (data: unknown) => void) => {
      console.log("[OpenAI] Adding listener for event:", event);
      if (!eventListeners.current.has(event)) {
        eventListeners.current.set(event, new Set());
      }
      eventListeners.current.get(event)?.add(callback);
      console.log("[OpenAI] Total listeners for", event, ":", eventListeners.current.get(event)?.size);
    },
    [],
  );

  const removeListener = useCallback(
    (event: RealtimeEvent, callback: (data: unknown) => void) => {
      console.log("[OpenAI] Removing listener for event:", event);
      eventListeners.current.get(event)?.delete(callback);
    },
    [],
  );

  const emit = useCallback((event: RealtimeEvent, data: unknown) => {
    const listenerCount = eventListeners.current.get(event)?.size || 0;
    console.log("[OpenAI] Emitting event:", event, "to", listenerCount, "listeners");
    eventListeners.current.get(event)?.forEach((callback) => callback(data));
  }, []);

  const audioChunksSentRef = useRef<number>(0);

  const send = useCallback(
    (data: ArrayBuffer | Blob) => {
      if (connection && connection.readyState === WebSocket.OPEN) {
        if (data instanceof Blob) {
          console.log("[OpenAI] Sending audio data (Blob):", data.size, "bytes");
          data.arrayBuffer().then((buffer) => {
            const base64Audio = btoa(
              String.fromCharCode(...new Uint8Array(buffer)),
            );

            const message = {
              type: "input_audio_buffer.append",
              audio: base64Audio,
            };
            audioChunksSentRef.current++;
            if (audioChunksSentRef.current % 50 === 0) {
              console.log("[OpenAI] Sent", audioChunksSentRef.current, "audio chunks so far. Last chunk:", base64Audio.length, "chars");
            }
            connection.send(JSON.stringify(message));
          });
        } else {
          console.log("[OpenAI] Sending audio data (ArrayBuffer):", data.byteLength, "bytes");
          const base64Audio = btoa(
            String.fromCharCode(...new Uint8Array(data)),
          );

          const message = {
            type: "input_audio_buffer.append",
            audio: base64Audio,
          };
          audioChunksSentRef.current++;
          if (audioChunksSentRef.current % 50 === 0) {
            console.log("[OpenAI] Sent", audioChunksSentRef.current, "audio chunks so far. Last chunk:", base64Audio.length, "chars");
          }
          connection.send(JSON.stringify(message));
        }
      } else {
        console.warn("[OpenAI] Cannot send audio: connection not open. State:", connection?.readyState);
      }
    },
    [connection],
  );

  const connectToOpenAI = useCallback(
    async (config: SessionConfig) => {
      try {
        console.log("[OpenAI] Starting connection to OpenAI Realtime API");
        console.log("[OpenAI] Config:", JSON.stringify(config, null, 2));
        setConnectionState(ConnectionState.CONNECTING);

        console.log("[OpenAI] Fetching session token from /api/openai/session");
        const response = await fetch("/api/openai/session");
        const { token } = await response.json();
        console.log("[OpenAI] Received token, length:", token?.length);

        const model = "gpt-4o-mini-transcribe";
        const wsUrl = `wss://api.openai.com/v1/realtime?intent=transcription`;
        console.log("[OpenAI] Creating WebSocket connection to:", wsUrl);
        const ws = new WebSocket(
          wsUrl,
          ["realtime", `openai-insecure-api-key.${token}`],
        );

        ws.onopen = () => {
          console.log("[OpenAI] WebSocket connection opened");
          setConnectionState(ConnectionState.OPEN);

          const sessionUpdate: Record<string, unknown> = {
            type: "session.update",
            session: {
              type: "transcription",
              audio: {
                input: {
                  format: {
                    type: "audio/pcm",
                    rate: 24000,
                  },
                  transcription: {
                    model: "gpt-4o-mini-transcribe",
                  },
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500,
                  },
                },
              },
            },
          };

          console.log("[OpenAI] Sending session.update:", JSON.stringify(sessionUpdate, null, 2));
          ws.send(JSON.stringify(sessionUpdate));

          console.log("[OpenAI] Connected to OpenAI Realtime API");
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log("[OpenAI] Received message:", message.type);
            console.log("[OpenAI] Full message:", JSON.stringify(message, null, 2));

            if (message.type === RealtimeEvent.Transcript) {
              console.log("[OpenAI] 🎤 TRANSCRIPT RECEIVED:", message.transcript);
              emit(RealtimeEvent.Transcript, message as TranscriptionData);
            } else if (message.type === RealtimeEvent.SessionCreated) {
              console.log("[OpenAI] Session created event");
              emit(RealtimeEvent.SessionCreated, message);
            } else if (message.type === RealtimeEvent.SessionUpdated) {
              console.log("[OpenAI] Session updated event");
              emit(RealtimeEvent.SessionUpdated, message);
            } else if (message.type === RealtimeEvent.InputAudioBufferCommitted) {
              console.log("[OpenAI] ✅ Audio buffer committed - item_id:", message.item_id);
              emit(RealtimeEvent.InputAudioBufferCommitted, message);
            } else if (message.type === RealtimeEvent.InputAudioBufferSpeechStarted) {
              console.log("[OpenAI] 🎙️ Speech detected starting - item_id:", message.item_id);
              emit(RealtimeEvent.InputAudioBufferSpeechStarted, message);
            } else if (message.type === RealtimeEvent.InputAudioBufferSpeechStopped) {
              console.log("[OpenAI] 🔇 Speech detected stopping - item_id:", message.item_id);
              emit(RealtimeEvent.InputAudioBufferSpeechStopped, message);
            } else if (message.type === RealtimeEvent.Error) {
              console.error("[OpenAI] Error event received:", message);
              emit(RealtimeEvent.Error, message);
            } else {
              console.log("[OpenAI] Unhandled message type:", message.type);
            }
          } catch (error) {
            console.error("[OpenAI] Error parsing message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("[OpenAI] WebSocket error:", error);
          setConnectionState(ConnectionState.ERROR);
          emit(RealtimeEvent.Error, error);
        };

        ws.onclose = (event) => {
          console.log("[OpenAI] WebSocket closed. Code:", event.code, "Reason:", event.reason);
          setConnectionState(ConnectionState.CLOSED);
        };

        setConnection(ws);
      } catch (error) {
        console.error("[OpenAI] Error connecting to OpenAI:", error);
        setConnectionState(ConnectionState.ERROR);
      }
    },
    [emit],
  );

  const commitAudioBuffer = useCallback(() => {
    if (connection && connection.readyState === WebSocket.OPEN) {
      console.log("[OpenAI] Committing audio buffer to trigger transcription");
      console.log("[OpenAI] Total audio chunks sent:", audioChunksSentRef.current);
      const commitMessage = {
        type: "input_audio_buffer.commit",
      };
      connection.send(JSON.stringify(commitMessage));
      console.log("[OpenAI] Audio buffer commit sent");
      // Reset counter for next session
      audioChunksSentRef.current = 0;
    } else {
      console.warn("[OpenAI] Cannot commit audio buffer: connection not open");
    }
  }, [connection]);

  const disconnect = useCallback(() => {
    if (connection) {
      console.log("[OpenAI] Disconnecting from OpenAI Realtime API");
      connection.close();
      setConnection(null);
      setConnectionState(ConnectionState.CLOSED);
    }
  }, [connection]);

  return (
    <OpenAIRealtimeContext.Provider
      value={{
        connection,
        connectToOpenAI,
        disconnect,
        connectionState,
        addListener,
        removeListener,
        send,
        commitAudioBuffer,
      }}
    >
      {children}
    </OpenAIRealtimeContext.Provider>
  );
};

function useOpenAIRealtime(): OpenAIRealtimeContextType {
  const context = useContext(OpenAIRealtimeContext);

  if (context === undefined) {
    throw new Error(
      "useOpenAIRealtime must be used within an OpenAIRealtimeProvider",
    );
  }

  return context;
}

export { OpenAIRealtimeProvider, useOpenAIRealtime };
export type { TranscriptionData, SessionConfig };
