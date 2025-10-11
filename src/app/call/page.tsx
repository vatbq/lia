"use client";

import { use, useState, useEffect, useRef } from "react";
import { CheckCircle2, Circle, Lightbulb, AlertTriangle, CheckCircle, Clock, Info, PhoneOff } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { getLatestCall, updateCall } from "@/lib/storage";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

interface Objective {
  id: string;
  name: string;
  description: string;
  priority: number;
  completed: boolean;
  status?: 'pending' | 'in_progress' | 'completed';
  statusMessage?: string;
}

interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral' | 'warning';
  timestamp: Date;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  timestamp: Date;
}

interface Transcription {
  id: string;
  text: string;
  timestamp: number;
}

export default function CallPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string }>;
}) {
  const params = use(searchParams);
  const router = useRouter();
  const title = params?.title || "Call";
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [completedObjectiveIds, setCompletedObjectiveIds] = useState<Set<string>>(new Set());

  // Audio transcription state
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const hasSetupMicrophoneRef = useRef<boolean>(false);
  const hasMicrophoneStartedRef = useRef<boolean>(false);

  // Audio hooks
  const {
    connection,
    connectToOpenAI,
    connectionState,
    addListener,
    removeListener,
    send,
  } = useOpenAIRealtime();
  const {
    setupMicrophone,
    microphone,
    startMicrophone,
    stopMicrophone,
    microphoneState,
    addAudioDataListener,
    removeAudioDataListener,
  } = useMicrophone();

  // Load objectives from localStorage on mount
  useEffect(() => {
    const latestCall = getLatestCall();
    setCurrentCall(latestCall);
    
    if (latestCall?.parsedObjectives && latestCall.parsedObjectives.length > 0) {
      const objectivesWithCompletion = latestCall.parsedObjectives.map((obj) => ({
        ...obj,
        completed: false,
      }));
      setObjectives(objectivesWithCompletion);
    } else {
      // Fallback to default objectives if none are found
      setObjectives([
        {
          id: uuidv4(),
          name: "Introduce yourself",
          description: "Start the call with a friendly introduction",
          priority: 1,
          completed: false,
        },
        {
          id: uuidv4(),
          name: "Discuss project timeline",
          description: "Review key milestones and deadlines",
          priority: 2,
          completed: false,
        },
        {
          id: uuidv4(),
          name: "Address budget concerns",
          description: "Go over financial constraints and requirements",
          priority: 3,
          completed: false,
        },
      ]);
    }
  }, []);

  useEffect(() => {
    // Connect to Socket.IO server
    const newSocket: Socket = io("http://localhost:3000");

    newSocket.on("connect", () => {
      console.log("Call page Socket.IO connected:", newSocket.id);
      // Test if we can emit and receive events
      console.log("Testing socket communication...");
    });

    newSocket.on("test_event", (data) => {
      console.log("Test event received on call page:", data);
    });

    newSocket.on("objective_updated", (data: { id: string; status: 'pending' | 'in_progress' | 'completed'; message: string }) => {
      console.log("🎯 Objective updated event received:", data);

      setObjectives((prev) => {
        const foundObjective = prev.find(obj => obj.id === data.id);
        if (!foundObjective) {
          console.warn("⚠️ Objective ID not found in current objectives:", data.id);
          console.log("Available objective IDs:", prev.map(obj => obj.id));
        } else {
          console.log("✅ Found objective:", foundObjective.name);
        }

        return prev.map((obj) =>
          obj.id === data.id ? {
            ...obj,
            completed: data.status === 'completed',
            status: data.status,
            statusMessage: data.message
          } : obj
        );
      });

      if (data.status === 'completed') {
        setCompletedObjectiveIds((prev) => new Set(prev).add(data.id));
      }
    });

    newSocket.on("new_insight", (data: any) => {
      console.log("New insight received:", data);
      // Convert timestamp string back to Date object
      const insight: Insight = {
        ...data,
        timestamp: new Date(data.timestamp)
      };
      setInsights((prev) => [insight, ...prev]);
    });

    newSocket.on("new_action_item", (data: any) => {
      console.log("New action item received:", data);
      // Convert timestamp string back to Date object
      const actionItem: ActionItem = {
        ...data,
        timestamp: new Date(data.timestamp)
      };
      setActionItems((prev) => [actionItem, ...prev]);
    });

    newSocket.on("action_item_complete", (data: { id: string }) => {
      console.log("Action item completed:", data);
      setActionItems((prev) =>
        prev.map((item) =>
          item.id === data.id ? { ...item, completed: true } : item
        )
      );
    });

    newSocket.on("disconnect", () => {
      console.log("Socket.IO disconnected");
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error);
    });

    // Set socket immediately after setting up listeners
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Auto-setup microphone on mount
  useEffect(() => {
    if (!hasSetupMicrophoneRef.current) {
      console.log("[CallPage] Setting up microphone on mount");
      setupMicrophone();
      hasSetupMicrophoneRef.current = true;
    }
  }, [setupMicrophone]);

  // Auto-connect to OpenAI when microphone is ready
  useEffect(() => {
    console.log("[CallPage] Microphone state changed:", microphoneState);
    if (microphoneState === MicrophoneState.Ready) {
      console.log("[CallPage] Microphone ready, connecting to OpenAI");
      connectToOpenAI({});
    }
  }, [microphoneState, connectToOpenAI]);

  // Handle audio data and transcriptions
  useEffect(() => {
    console.log("[CallPage] Audio effect triggered. Microphone:", !!microphone, "Connection:", !!connection, "State:", connectionState);
    if (!microphone) {
      console.log("[CallPage] No microphone, returning");
      return;
    }
    if (!connection) {
      console.log("[CallPage] No connection, returning");
      return;
    }

    let audioDataCount = 0;
    const onAudioData = (pcm16Data: Int16Array) => {
      audioDataCount++;
      if (audioDataCount % 50 === 0) {
        console.log("[CallPage] Sending audio data #", audioDataCount, "Size:", pcm16Data.length);
      }
      send(pcm16Data.buffer);
    };

    const onTranscript = (data: unknown) => {
      console.log("[CallPage] 🎤 onTranscript callback triggered");
      console.log("[CallPage] Transcript data:", JSON.stringify(data, null, 2));
      const transcriptData = data as TranscriptionData;
      const transcript = transcriptData.transcript;

      if (transcript && transcript !== "") {
        console.log("[CallPage] Transcript received:", transcript);
        setTranscriptions((prev) => [
          ...prev,
          {
            id: transcriptData.item_id,
            text: transcript,
            timestamp: Date.now(),
          },
        ]);
        console.log("[CallPage] Transcript added to list");
      } else {
        console.log("[CallPage] Transcript was empty or undefined");
      }
    };

    console.log("[CallPage] Connection state:", connectionState);
    if (connectionState === ConnectionState.OPEN) {
      console.log("[CallPage] Connection is OPEN, setting up listeners and starting microphone");
      addListener(RealtimeEvent.Transcript, onTranscript);
      addAudioDataListener(onAudioData);

      if (!hasMicrophoneStartedRef.current) {
        console.log("[CallPage] Starting microphone");
        startMicrophone();
        hasMicrophoneStartedRef.current = true;
      } else {
        console.log("[CallPage] Microphone already started");
      }
    } else {
      console.log("[CallPage] Connection not open, stopping microphone if needed");
      if (hasMicrophoneStartedRef.current) {
        console.log("[CallPage] Stopping microphone");
        stopMicrophone();
        hasMicrophoneStartedRef.current = false;
      }
    }

    return () => {
      console.log("[CallPage] Cleaning up audio listeners");
      removeListener(RealtimeEvent.Transcript, onTranscript);
      removeAudioDataListener(onAudioData);
    };
  }, [
    connectionState,
    connection,
    microphone,
    addListener,
    removeListener,
    send,
    addAudioDataListener,
    removeAudioDataListener,
    startMicrophone,
    stopMicrophone,
  ]);

  const completeActionItem = (id: string) => {
    if (socket) {
      socket.emit("complete_action_item", { id });
      setActionItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, completed: true } : item
        )
      );
    }
  };

  const endCall = async () => {
    if (!currentCall) {
      console.error('No current call found');
      return;
    }

    setIsEndingCall(true);

    try {
      // Convert Date objects to ISO strings for storage
      const insightsForStorage = insights.map(insight => ({
        ...insight,
        timestamp: insight.timestamp.toISOString()
      }));

      const actionItemsForStorage = actionItems.map(item => ({
        ...item,
        timestamp: item.timestamp.toISOString()
      }));

      // Update the call with insights, action items, and completed objectives
      const updatedCall = updateCall(currentCall.id, {
        insights: insightsForStorage,
        actionItems: actionItemsForStorage,
        completedObjectives: Array.from(completedObjectiveIds),
        endedAt: new Date().toISOString()
      });

      if (updatedCall) {
        console.log('Call ended successfully:', updatedCall);
        // Navigate to the call detail page
        router.push(`/call/${currentCall.id}`);
      } else {
        console.error('Failed to update call');
      }
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      setIsEndingCall(false);
    }
  };

  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'positive':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'negative':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getInsightColor = (type: Insight['type']) => {
    switch (type) {
      case 'positive':
        return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800';
      case 'negative':
        return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800';
    }
  };

  const getActionItemPriorityColor = (priority: ActionItem['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
      case 'medium':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400';
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Main insights and action items area */}
      <div className="flex-1 px-6 py-10 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">{title}</h1>
                <p className="mt-2 text-lg text-muted-foreground">
                  Live insights and action items from your call
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connectionState === ConnectionState.OPEN
                        ? "bg-green-500 animate-pulse"
                        : connectionState === ConnectionState.CONNECTING
                        ? "bg-yellow-500 animate-pulse"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {connectionState === ConnectionState.OPEN
                      ? "Transcription active"
                      : connectionState === ConnectionState.CONNECTING
                      ? "Connecting..."
                      : "Disconnected"}
                  </span>
                </div>
              </div>
              <Button
                onClick={endCall}
                disabled={isEndingCall || !currentCall}
                className="gap-2 bg-red-600 hover:bg-red-700 text-white"
              >
                <PhoneOff className="w-4 h-4" />
                {isEndingCall ? "Ending Call..." : "End Call"}
              </Button>
            </div>
          </div>

          {/* Transcription Section */}
          {transcriptions.length > 0 && (
            <div className="mb-6">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
                  Live Transcription
                </h3>
                <div className="prose prose-sm max-w-none">
                  <p className="text-slate-900 dark:text-slate-100 text-base leading-relaxed whitespace-pre-wrap">
                    {transcriptions.map((t) => t.text).join(" ")}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Insights Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-6 h-6" />
                <h2 className="text-xl font-semibold">Live Insights</h2>
                {insights.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ({insights.length})
                  </span>
                )}
              </div>
              
              {insights.length === 0 ? (
                <div className="p-8 border border-dashed rounded-lg text-center text-muted-foreground">
                  <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No insights yet</p>
                  <p className="text-sm">
                    Insights will appear here as the AI analyzes the conversation
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {insights.map((insight) => (
                    <div
                      key={insight.id}
                      className={`p-4 rounded-lg border transition-all duration-300 animate-in slide-in-from-right ${getInsightColor(insight.type)}`}
                    >
                      <div className="flex items-start gap-3">
                        {getInsightIcon(insight.type)}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-medium">{insight.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {insight.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {new Date(insight.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Items Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-6 h-6" />
                <h2 className="text-xl font-semibold">Action Items</h2>
                {actionItems.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ({actionItems.length})
                  </span>
                )}
              </div>
              
              {actionItems.length === 0 ? (
                <div className="p-8 border border-dashed rounded-lg text-center text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No action items yet</p>
                  <p className="text-sm">
                    Action items will appear here as they are identified
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {actionItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border transition-all duration-300 animate-in slide-in-from-right ${
                        item.completed
                          ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 opacity-75"
                          : "bg-background border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {item.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-base font-medium ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                            {item.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getActionItemPriorityColor(item.priority)}`}>
                              {item.priority}
                            </span>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {new Date(item.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          {!item.completed && (
                            <button
                              onClick={() => completeActionItem(item.id)}
                              className="mt-2 text-sm text-primary hover:underline font-medium"
                            >
                              Mark as complete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Objectives sidebar */}
      <div className="w-96 border-l bg-muted/20 p-6 overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold mb-4">Objectives</h2>
          <div className="space-y-3">
            {objectives.map((objective) => (
              <div
                key={objective.id}
                className={`
                  p-4 rounded-lg border transition-all duration-500 ease-out
                  ${
                    objective.completed
                      ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 scale-[0.98] opacity-90"
                      : "bg-background border-border hover:border-primary/50"
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`
                      mt-0.5 transition-all duration-500
                      ${objective.completed ? "scale-110" : ""}
                    `}
                  >
                    {objective.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 animate-in zoom-in duration-300" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`
                        text-sm font-medium transition-all duration-300
                        ${
                          objective.completed
                            ? "line-through text-muted-foreground"
                            : ""
                        }
                      `}
                    >
                      {objective.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {objective.description}
                    </p>
                    {objective.statusMessage && (
                      <div className={`mt-2 p-2 rounded-md text-xs ${
                        objective.status === 'completed'
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : objective.status === 'in_progress'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                      }`}>
                        {objective.statusMessage}
                      </div>
                    )}
                    <span
                      className={`
                        inline-block mt-2 text-xs px-2 py-0.5 rounded-full
                        ${
                          objective.priority === 1
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                            : objective.priority === 2
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                        }
                      `}
                    >
                      P{objective.priority}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Progress summary */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {objectives.filter((o) => o.completed).length} /{" "}
                {objectives.length}
              </span>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500 ease-out"
                style={{
                  width: `${
                    (objectives.filter((o) => o.completed).length /
                      objectives.length) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
