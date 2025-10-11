"use client";

import { use, useState, useEffect, useRef } from "react";
import { CheckCircle2, Circle, Lightbulb, AlertTriangle, CheckCircle, Clock, Info, PhoneOff, Brain } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { getLatestCall, updateCall } from "@/lib/storage";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConnectionState, RealtimeEvent, useOpenAIRealtime, TranscriptionData } from "@/contexts/openai-realtime-context";
import { MicrophoneState, useMicrophone } from "@/contexts/microphone-context";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Objective {
  id: string;
  title: string;
  description?: string;
  completed?: boolean;
  priority: number;
  status?: "pending" | "in_progress" | "completed";
}

interface Insight {
  id: string;
  title: string;
  description: string;
  type: "positive" | "negative" | "neutral" | "warning";
  timestamp: Date;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
  timestamp: Date;
}

interface Transcription {
  id: string;
  text: string;
  timestamp: number;
}

export default function CallPage({ searchParams }: { searchParams: Promise<{ title?: string }> }) {
  const isCallingRef = useRef<boolean>(false);
  const params = use(searchParams);
  const router = useRouter();
  const title = params?.title || "Call";
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [completedObjectiveIds, setCompletedObjectiveIds] = useState<Set<string>>(new Set());

  // Task Analysis state
  const [transcription, setTranscription] = useState("");
  const [taskAnalysisLoading, setTaskAnalysisLoading] = useState(false);
  const [lastAnalysisTranscription, setLastAnalysisTranscription] = useState("");

  // Audio transcription state
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const transcriptionsRef = useRef<Transcription[]>([]);
  const insightsRef = useRef<Insight[]>([]);
  const actionItemsRef = useRef<ActionItem[]>([]);
  const hasSetupMicrophoneRef = useRef<boolean>(false);
  const hasMicrophoneStartedRef = useRef<boolean>(false);
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Audio hooks
  const { connection, connectToOpenAI, connectionState, addListener, removeListener, send } = useOpenAIRealtime();
  const { setupMicrophone, microphone, startMicrophone, stopMicrophone, microphoneState, addAudioDataListener, removeAudioDataListener } = useMicrophone();

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
          title: "Introduce yourself",
          description: "Start the call with a friendly introduction",
          completed: false,
          priority: 1,
        },
        {
          id: uuidv4(),
          title: "Discuss project timeline",
          description: "Review key milestones and deadlines",
          completed: false,
          priority: 2,
        },
        {
          id: uuidv4(),
          title: "Address budget concerns",
          description: "Go over financial constraints and requirements",
          completed: false,
          priority: 3,
        },
      ]);
    }
  }, []);

  // Keep refs in sync with state
  useEffect(() => {
    transcriptionsRef.current = transcriptions;
  }, [transcriptions]);

  useEffect(() => {
    insightsRef.current = insights;
  }, [insights]);

  useEffect(() => {
    actionItemsRef.current = actionItems;
  }, [actionItems]);

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
      // @ts-ignore
      send(pcm16Data.buffer);
    };

    const onTranscript = (data: unknown) => {
      console.log("[CallPage] 🎤 onTranscript callback triggered");
      console.log("[CallPage] Transcript data:", JSON.stringify(data, null, 2));
      const transcriptData = data as TranscriptionData;
      const transcript = transcriptData.transcript;

      if (transcript && transcript !== "") {
        console.log("[CallPage] Transcript received:", transcript);

        const newTranscription = {
          id: transcriptData.item_id,
          text: transcript,
          timestamp: Date.now(),
        };

        setTranscriptions((prev) => [...prev, newTranscription]);
        console.log("[CallPage] Transcript added to list");

        // Auto-trigger debounced task analysis with accumulated transcription
        const accumulatedTranscription = [...transcriptionsRef.current, newTranscription].map((t) => t.text).join(" ");

        console.log("[CallPage] Triggering debounced task analysis with:", accumulatedTranscription);
        debouncedAnalyzeTasks(accumulatedTranscription);
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

      // Clear any pending analysis timeout
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, [connectionState, connection, microphone, addListener, removeListener, send, addAudioDataListener, removeAudioDataListener, startMicrophone, stopMicrophone]);

  const completeActionItem = (id: string) => {
    setActionItems((prev) => prev.map((item) => (item.id === id ? { ...item, completed: true } : item)));
  };

  const analyzeTasks = async (transcriptionText?: string) => {
    if (isCallingRef.current) {
      console.log("Analysis already in progress, skipping");
      return;
    }

    isCallingRef.current = true;
    const textToAnalyze = transcriptionText || transcription;

    if (!textToAnalyze.trim()) {
      console.log("No transcription text to analyze");
      return;
    }

    const incompleteObjectives = objectives.filter((obj) => !obj.completed);
    if (incompleteObjectives.length === 0) {
      console.log("No incomplete objectives available to analyze");
      return;
    }

    // Prevent duplicate analysis of the same transcription
    if (textToAnalyze === lastAnalysisTranscription) {
      console.log("Skipping duplicate analysis for same transcription");
      return;
    }

    // Prevent concurrent analysis
    if (taskAnalysisLoading) {
      console.log("Analysis already in progress, skipping");
      return;
    }

    setTaskAnalysisLoading(true);

    try {
      const response = await fetch("/api/analyze-tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tasks: objectives
            .filter((obj) => !obj.completed)
            .map((obj) => ({
              id: obj.id,
              title: obj.title,
              description: obj.description,
            })),
          transcription: textToAnalyze,
          existingActionItems: actionItemsRef.current.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            priority: item.priority,
            completed: item.completed,
          })),
          existingInsights: insightsRef.current.map((insight) => ({
            id: insight.id,
            title: insight.title,
            description: insight.description,
            type: insight.type,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Task analysis result:", JSON.stringify(result, null, 2));

      // Update the last analyzed transcription
      setLastAnalysisTranscription(textToAnalyze);

      // Update objectives directly from API response
      setObjectives((prev) => {
        return prev.map((obj) => {
          const taskAnalysis = result.tasks.find((t: any) => t.id === obj.id);
          if (taskAnalysis) {
            // Only update if task is not already completed
            // Once completed, tasks stay completed
            if (obj.completed && !taskAnalysis.completed) {
              return obj; // Keep existing completed state
            }

            return {
              ...obj,
              completed: taskAnalysis.completed,
              status: taskAnalysis.completed ? "completed" : "pending",
            };
          }
          return obj;
        });
      });

      // Update completed objective IDs - only add new completions, never remove
      setCompletedObjectiveIds((prev) => {
        const newSet = new Set(prev);
        result.tasks.forEach((task: any) => {
          if (task.completed) {
            newSet.add(task.id);
          }
          // Don't remove from completed set - once completed, stay completed
        });
        return newSet;
      });

      // Replace insights with complete list from API response
      if (result.allInsights && result.allInsights.length > 0) {
        setInsights(
          result.allInsights.map((insight: any) => ({
            ...insight,
            timestamp: new Date(insight.timestamp),
          }))
        );
      }

      // Replace action items with complete list from API response
      if (result.allActionItems && result.allActionItems.length > 0) {
        setActionItems(
          result.allActionItems.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }))
        );
      }

      // Only show alert for manual analysis (when no transcriptionText parameter)
      if (!transcriptionText) {
        alert("Task analysis completed! Check the objectives above for updates.");
      }
    } catch (error) {
      console.error("Error analyzing tasks:", error);
      if (!transcriptionText) {
        alert("Failed to analyze tasks. Check console for details.");
      }
    } finally {
      setTaskAnalysisLoading(false);
      isCallingRef.current = false;
    }
  };

  const debouncedAnalyzeTasks = (transcriptionText: string) => {
    // Clear existing timeout
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }

    // Only analyze if there's significant new content (at least 50 new characters)
    const newContentLength = transcriptionText.length - lastAnalysisTranscription.length;
    if (newContentLength < 50) {
      console.log("[CallPage] Not enough new content for analysis:", newContentLength, "characters");
      return;
    }

    // Set new timeout for 6 seconds (much longer to reduce API calls)
    analysisTimeoutRef.current = setTimeout(() => {
      console.log("[CallPage] Debounced task analysis triggered");
      analyzeTasks(transcriptionText);
    }, 2000);
  };

  const endCall = async () => {
    if (!currentCall) {
      console.error("No current call found");
      return;
    }

    setIsEndingCall(true);

    try {
      // Convert Date objects to ISO strings for storage
      const insightsForStorage = insights.map((insight) => ({
        ...insight,
        timestamp: insight.timestamp.toISOString(),
      }));

      const actionItemsForStorage = actionItems.map((item) => ({
        ...item,
        timestamp: item.timestamp.toISOString(),
      }));

      // Convert objectives to storage format
      const objectivesForStorage = objectives.map((obj) => ({
        ...obj,
        // Ensure status is set correctly based on completion
        status: (obj.completed ? "completed" : "pending") as "pending" | "in_progress" | "completed",
      }));

      // Convert transcriptions to storage format
      const transcriptionsForStorage = transcriptions.map((t) => ({
        ...t,
        timestamp: new Date(t.timestamp).toISOString(),
      }));

      // Update the call with insights, action items, objectives, and transcriptions
      const updatedCall = updateCall(currentCall.id, {
        insights: insightsForStorage,
        actionItems: actionItemsForStorage,
        objectivesArray: objectivesForStorage,
        completedObjectives: Array.from(completedObjectiveIds),
        transcriptions: transcriptionsForStorage,
        endedAt: new Date().toISOString(),
      });

      if (updatedCall) {
        console.log("Call ended successfully:", JSON.stringify(updatedCall, null, 2));
        // Navigate to the call detail page
        router.push(`/call/${currentCall.id}`);
      } else {
        console.error("Failed to update call");
      }
    } catch (error) {
      console.error("Error ending call:", error);
    } finally {
      setIsEndingCall(false);
    }
  };

  const getInsightIcon = (type: Insight["type"]) => {
    switch (type) {
      case "positive":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "negative":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getInsightColor = (type: Insight["type"]) => {
    switch (type) {
      case "positive":
        return "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800";
      case "negative":
        return "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800";
      case "warning":
        return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800";
      default:
        return "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800";
    }
  };

  const getActionItemPriorityColor = (priority: ActionItem["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
      case "medium":
        return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400";
      default:
        return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
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
                <p className="mt-2 text-lg text-muted-foreground">Live insights and action items from your call</p>
                <div className="flex items-center gap-2 mt-2">
                  <div
                    className={`
                      w-2 h-2 rounded-full transition-all duration-500 ease-in-out
                      ${
                        connectionState === ConnectionState.OPEN
                          ? "bg-green-500 animate-pulse scale-110 shadow-lg shadow-green-500/50"
                          : connectionState === ConnectionState.CONNECTING
                          ? "bg-yellow-500 animate-pulse"
                          : "bg-red-500 scale-90 opacity-60"
                      }
                    `}
                  />
                  <span
                    className={`
                      text-xs transition-all duration-300
                      ${
                        connectionState === ConnectionState.OPEN
                          ? "text-green-600 dark:text-green-400 font-medium"
                          : connectionState === ConnectionState.CONNECTING
                          ? "text-yellow-600 dark:text-yellow-400 animate-pulse"
                          : "text-muted-foreground"
                      }
                    `}
                  >
                    {connectionState === ConnectionState.OPEN ? "Transcription active" : connectionState === ConnectionState.CONNECTING ? "Connecting..." : "Disconnected"}
                  </span>
                </div>
              </div>
              <Button onClick={endCall} disabled={isEndingCall || !currentCall} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                <PhoneOff className="w-4 h-4" />
                {isEndingCall ? "Ending Call..." : "End Call"}
              </Button>
            </div>
          </div>

          {/* Transcription Section */}
          {transcriptions.length > 0 && (
            <div className="mb-6 animate-in fade-in slide-in-from-top duration-500">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg border p-4 transition-all duration-300 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700">
                <h3 className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  Live Transcription
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                </h3>
                <div className="prose prose-sm max-w-none">
                  <p className="text-slate-900 dark:text-slate-100 text-base leading-relaxed whitespace-pre-wrap animate-in fade-in duration-700">{transcriptions.map((t) => t.text).join(" ")}</p>
                </div>
              </div>
            </div>
          )}
          {/* Task Analysis Section */}
          {/* <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Task Analysis
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="transcription">Transcription</Label>
                <Textarea id="transcription" placeholder="Enter conversation transcription to analyze tasks..." value={transcription} onChange={(e) => setTranscription(e.target.value)} className="mt-1" rows={4} />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => analyzeTasks()} disabled={taskAnalysisLoading || !transcription.trim() || objectives.filter((obj) => !obj.completed).length === 0} className="gap-2">
                  <Brain className="w-4 h-4" />
                  {taskAnalysisLoading ? "Analyzing..." : "Analyze Tasks"}
                </Button>
                <span className="text-xs text-muted-foreground">Uses incomplete objectives ({objectives.filter((obj) => !obj.completed).length} tasks)</span>
              </div>
            </div>
          </Card> */}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Insights Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-6 h-6" />
                <h2 className="text-xl font-semibold">Live Insights</h2>
                {insights.length > 0 && <span className="text-sm text-muted-foreground">({insights.length})</span>}
              </div>

              {insights.length === 0 ? (
                <div className="p-8 border border-dashed rounded-lg text-center text-muted-foreground">
                  <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No insights yet</p>
                  <p className="text-sm">Insights will appear here as the AI analyzes the conversation</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {insights.map((insight, index) => (
                    <div
                      key={insight.id}
                      className={`
                        p-4 rounded-lg border
                        transition-all duration-500 ease-out
                        hover:scale-[1.02] hover:shadow-lg
                        ${getInsightColor(insight.type)}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div>{getInsightIcon(insight.type)}</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-medium">{insight.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{new Date(insight.timestamp).toLocaleTimeString()}</span>
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
                {actionItems.length > 0 && <span className="text-sm text-muted-foreground">({actionItems.length})</span>}
              </div>

              {actionItems.length === 0 ? (
                <div className="p-8 border border-dashed rounded-lg text-center text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No action items yet</p>
                  <p className="text-sm">Action items will appear here as they are identified</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {actionItems.map((item) => (
                    <div
                      key={item.id}
                      className={`
                        p-4 rounded-lg border
                        transition-all duration-500 ease-out
                        hover:scale-[1.02] hover:shadow-lg
                        ${item.completed ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 opacity-75 scale-[0.98]" : "bg-background border-border hover:border-primary/50"}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 transition-all duration-500 ${item.completed ? "scale-125 rotate-[360deg]" : "hover:scale-110"}`}>
                          {item.completed ? <CheckCircle2 className="w-5 h-5 text-green-600 drop-shadow-lg" /> : <Circle className="w-5 h-5 text-muted-foreground transition-colors duration-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-base font-medium transition-all duration-500 ${item.completed ? "line-through text-muted-foreground opacity-75" : ""}`}>{item.title}</h3>
                          <p className={`text-sm text-muted-foreground mt-1 transition-opacity duration-500 ${item.completed ? "opacity-60" : ""}`}>{item.description || "No description"}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full transition-all duration-300 ${getActionItemPriorityColor(item.priority)} ${item.completed ? "opacity-50 scale-90" : ""}`}>{item.priority}</span>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleTimeString()}</span>
                            </div>
                          </div>
                          {!item.completed && (
                            <button onClick={() => completeActionItem(item.id)} className="mt-2 text-sm text-primary hover:underline font-medium transition-all duration-200 hover:translate-x-1">
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
                  p-4 rounded-lg border transition-all duration-700 ease-out
                  ${
                    objective.completed
                      ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 scale-[0.98] opacity-90 shadow-sm shadow-green-500/20"
                      : "bg-background border-border hover:border-primary/50 hover:shadow-md hover:scale-[1.01]"
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`
                      mt-0.5 transition-all duration-700 ease-out
                      ${objective.completed ? "scale-125 rotate-[360deg]" : "hover:scale-110"}
                    `}
                  >
                    {objective.completed ? <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 drop-shadow-lg" /> : <Circle className="w-5 h-5 text-muted-foreground transition-colors duration-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`
                        text-sm font-medium transition-all duration-500
                        ${objective.completed ? "line-through text-muted-foreground opacity-75" : ""}
                      `}
                    >
                      {objective.title}
                    </h3>
                    <p className={`text-xs text-muted-foreground mt-1 transition-opacity duration-500 ${objective.completed ? "opacity-60" : ""}`}>{objective.description || "No description"}</p>
                    <span
                      className={`
                        inline-block mt-2 text-xs px-2 py-0.5 rounded-full transition-all duration-500
                        ${
                          objective.priority === 1
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                            : objective.priority === 2
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                        }
                        ${objective.completed ? "opacity-50 scale-90" : ""}
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
          <div className="mt-6 pt-6 border-t animate-in fade-in slide-in-from-bottom duration-500">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground font-medium">Progress</span>
              <span className="font-bold text-lg transition-all duration-500 animate-in zoom-in">
                {objectives.filter((o) => o.completed).length} / {objectives.length}
              </span>
            </div>
            <div className="mt-2 h-3 bg-muted rounded-full overflow-hidden shadow-inner">
              <div
                className={`
                  h-full rounded-full
                  transition-all duration-700 ease-out
                  ${objectives.filter((o) => o.completed).length === objectives.length ? "bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/50" : "bg-gradient-to-r from-blue-500 to-green-500"}
                `}
                style={{
                  width: `${(objectives.filter((o) => o.completed).length / objectives.length) * 100}%`,
                }}
              />
            </div>
            {objectives.filter((o) => o.completed).length === objectives.length && (
              <div className="mt-3 text-center animate-in fade-in zoom-in duration-500">
                <span className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  All objectives completed!
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
