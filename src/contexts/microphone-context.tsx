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
  microphone: MediaRecorder | null;
  startMicrophone: () => void;
  stopMicrophone: () => void;
  setupMicrophone: () => Promise<void>;
  microphoneState: MicrophoneState;
}

export enum MicrophoneEvents {
  DataAvailable = "dataavailable",
  Error = "error",
  Pause = "pause",
  Resume = "resume",
  Start = "start",
  Stop = "stop",
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
  const [microphone, setMicrophone] = useState<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const setupMicrophone = useCallback(async () => {
    setMicrophoneState(MicrophoneState.SettingUp);

    try {
      const userMedia = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
        },
      });

      mediaStreamRef.current = userMedia;
      const mediaRecorder = new MediaRecorder(userMedia);

      // Setup event listeners
      mediaRecorder.addEventListener(MicrophoneEvents.Start, () => {
        setMicrophoneState(MicrophoneState.Open);
      });

      mediaRecorder.addEventListener(MicrophoneEvents.Stop, () => {
        setMicrophoneState(MicrophoneState.Ready);
      });

      mediaRecorder.addEventListener(MicrophoneEvents.Pause, () => {
        setMicrophoneState(MicrophoneState.Paused);
      });

      mediaRecorder.addEventListener(MicrophoneEvents.Resume, () => {
        setMicrophoneState(MicrophoneState.Open);
      });

      mediaRecorder.addEventListener(MicrophoneEvents.Error, (event: Event) => {
        console.error("MediaRecorder error:", event);
        setMicrophoneState(MicrophoneState.Error);
      });

      setMicrophone(mediaRecorder);
      setMicrophoneState(MicrophoneState.Ready);
    } catch (error) {
      console.error("Error setting up microphone:", error);
      setMicrophoneState(MicrophoneState.Error);
      throw error;
    }
  }, []);

  const stopMicrophone = useCallback(() => {
    if (!microphone) return;

    setMicrophoneState(MicrophoneState.Pausing);

    if (microphone.state === "recording") {
      microphone.pause();
    }
  }, [microphone]);

  const startMicrophone = useCallback(() => {
    if (!microphone) return;

    setMicrophoneState(MicrophoneState.Opening);

    if (microphone.state === "paused") {
      microphone.resume();
    } else if (microphone.state === "inactive") {
      microphone.start(250);
    }
  }, [microphone]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (microphone && microphone.state !== "inactive") {
        microphone.stop();
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [microphone]);

  return (
    <MicrophoneContext.Provider
      value={{
        microphone,
        startMicrophone,
        stopMicrophone,
        setupMicrophone,
        microphoneState,
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
