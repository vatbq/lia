"use client";

import { use, useState, useEffect } from "react";
import { CheckCircle2, Circle, Lightbulb, AlertTriangle, CheckCircle, Clock, Info } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { getLatestCall } from "@/lib/storage";

interface Objective {
  id: string;
  name: string;
  description: string;
  priority: number;
  completed: boolean;
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

export default function CallPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string }>;
}) {
  const params = use(searchParams);
  const title = params?.title || "Call";
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Load objectives from localStorage on mount
  useEffect(() => {
    const latestCall = getLatestCall();
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

    newSocket.on("objective_complete", (data: { id: string }) => {
      console.log("Objective completed:", data);
      setObjectives((prev) =>
        prev.map((obj) =>
          obj.id === data.id ? { ...obj, completed: true } : obj
        )
      );
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
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Live insights and action items from your call
            </p>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Debug:</strong> Socket connected: {socket ? `Yes (${socket.id})` : 'No'} | 
                Insights: {insights.length} | Action Items: {actionItems.length}
              </p>
              <button
                onClick={() => {
                  if (socket) {
                    const testInsight = {
                      id: `test-${Date.now()}`,
                      title: "Test Insight",
                      description: "This is a test insight from the call page",
                      type: "positive",
                      timestamp: new Date().toISOString()
                    };
                    console.log("Emitting test insight:", testInsight);
                    socket.emit("trigger_insight", testInsight);
                  }
                }}
                className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                disabled={!socket}
              >
                Test Insight (Self)
              </button>
            </div>
          </div>

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
      <div className="w-80 border-l bg-muted/20 p-6 overflow-y-auto">
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
