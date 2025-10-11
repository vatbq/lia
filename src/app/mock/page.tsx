"use client";

import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Send, AlertCircle, Lightbulb, CheckCircle } from "lucide-react";
import { getLatestCall } from "@/lib/storage";

interface Objective {
  id: string;
  name: string;
  description: string;
  priority: number;
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

export default function MockPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<{ [key: string]: 'pending' | 'in_progress' | 'completed' }>({});
  const [statusMessages, setStatusMessages] = useState<{ [key: string]: string }>({});

  // Load objectives from localStorage on mount
  useEffect(() => {
    const latestCall = getLatestCall();
    if (latestCall?.parsedObjectives && latestCall.parsedObjectives.length > 0) {
      setObjectives(latestCall.parsedObjectives);
    } else {
      // Fallback to default objectives
      setObjectives([
        {
          id: uuidv4(),
          name: "Introduce yourself",
          description: "Start the call with a friendly introduction",
          priority: 1,
        },
        {
          id: uuidv4(),
          name: "Discuss project timeline",
          description: "Review key milestones and deadlines",
          priority: 2,
        },
        {
          id: uuidv4(),
          name: "Address budget concerns",
          description: "Go over financial constraints and requirements",
          priority: 3,
        },
      ]);
    }
  }, []);

  useEffect(() => {
    const newSocket: Socket = io("http://localhost:3000");

    newSocket.on("connect", () => {
      console.log("Mock page Socket.IO connected:", newSocket.id);
      setConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("Mock page disconnected");
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const updateObjective = (id: string) => {
    console.log("🔘 updateObjective called with id:", id);
    console.log("   Socket exists:", !!socket);
    console.log("   Socket connected:", socket?.connected);

    if (socket) {
      const status = selectedStatus[id] || 'completed';
      const message = statusMessages[id] || 'Objective has been completed';

      console.log("📤 Emitting update_objective");
      console.log("   ID:", id);
      console.log("   Status:", status);
      console.log("   Message:", message);

      socket.emit("update_objective", { id, status, message });
      console.log("✅ Emit completed");

      if (status === 'completed') {
        setCompletedIds((prev) => new Set(prev).add(id));
      }
    } else {
      console.error("❌ Socket not available!");
    }
  };

  const triggerInsight = (insight: Insight) => {
    if (socket) {
      // Convert Date to ISO string for JSON serialization
      const insightData = {
        ...insight,
        timestamp: insight.timestamp.toISOString()
      };
      console.log("Emitting trigger_insight:", insightData);
      socket.emit("trigger_insight", insightData);
    }
  };

  const triggerActionItem = (actionItem: ActionItem) => {
    if (socket) {
      // Convert Date to ISO string for JSON serialization
      const actionItemData = {
        ...actionItem,
        timestamp: actionItem.timestamp.toISOString()
      };
      console.log("Emitting trigger_action_item:", actionItemData);
      socket.emit("trigger_action_item", actionItemData);
    }
  };

  const resetAll = () => {
    setCompletedIds(new Set());
  };

  // Sample insights and action items for testing
  const sampleInsights: Insight[] = [
    {
      id: "insight-1",
      title: "Positive Energy Detected",
      description: "The conversation shows high engagement and positive sentiment",
      type: "positive",
      timestamp: new Date(),
    },
    {
      id: "insight-2",
      title: "Budget Concern Raised",
      description: "Client mentioned budget constraints that need attention",
      type: "warning",
      timestamp: new Date(),
    },
    {
      id: "insight-3",
      title: "Timeline Discussion",
      description: "Both parties are aligned on project timeline expectations",
      type: "neutral",
      timestamp: new Date(),
    },
    {
      id: "insight-4",
      title: "Technical Complexity",
      description: "The project requirements seem more complex than initially discussed",
      type: "negative",
      timestamp: new Date(),
    },
  ];

  const sampleActionItems: ActionItem[] = [
    {
      id: "action-1",
      title: "Send Proposal",
      description: "Prepare and send detailed project proposal by end of week",
      priority: "high",
      completed: false,
      timestamp: new Date(),
    },
    {
      id: "action-2",
      title: "Schedule Follow-up",
      description: "Book a follow-up meeting to discuss technical details",
      priority: "medium",
      completed: false,
      timestamp: new Date(),
    },
    {
      id: "action-3",
      title: "Research Competitors",
      description: "Gather information about competitor pricing and features",
      priority: "low",
      completed: false,
      timestamp: new Date(),
    },
  ];

  return (
    <div className="min-h-screen w-full px-6 py-10 sm:px-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Mock Testing Page</h1>
          <p className="text-muted-foreground">
            Trigger objective completions to test the call page in real-time
          </p>
        </div>

        {/* Connection status */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                connected ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="font-medium">
              {connected ? "Connected to Socket.IO" : "Disconnected"}
            </span>
          </div>
          <button
            onClick={() => {
              if (socket) {
                console.log("Testing basic socket emit...");
                socket.emit("test_event", { message: "Hello from mock page" });
              }
            }}
            className="mt-2 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
            disabled={!connected}
          >
            Test Basic Socket
          </button>
        </Card>

        {/* Instructions */}
        <Card className="p-6 mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <h2 className="font-semibold mb-2">How to use:</h2>
          <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
            <li>Set up objectives on the home page first</li>
            <li>Open the call page in another browser tab or window</li>
            <li>Click the buttons below to trigger events</li>
            <li>Watch objectives, insights, and action items update in real-time on the call page</li>
            <li>Use "Reset All" to clear completed status (local only)</li>
          </ol>
        </Card>

        {objectives.length === 0 ? (
          <Card className="p-6 mb-6 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">No objectives found</h3>
                <p className="text-sm text-muted-foreground">
                  Please go to the home page and set up your objectives first, then start a call.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          /* Objective triggers */
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Trigger Completions</h2>
            <div className="space-y-3">
              {objectives.map((objective) => {
                const isCompleted = completedIds.has(objective.id);
                return (
                  <div
                    key={objective.id}
                    className="p-4 rounded-lg border bg-background space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      {isCompleted && (
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{objective.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {objective.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            ID: {objective.id}
                          </span>
                          <span
                            className={`
                              text-xs px-2 py-0.5 rounded-full
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

                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Status</label>
                        <select
                          value={selectedStatus[objective.id] || 'completed'}
                          onChange={(e) => setSelectedStatus({ ...selectedStatus, [objective.id]: e.target.value as 'pending' | 'in_progress' | 'completed' })}
                          className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Message</label>
                        <input
                          type="text"
                          value={statusMessages[objective.id] || ''}
                          onChange={(e) => setStatusMessages({ ...statusMessages, [objective.id]: e.target.value })}
                          placeholder="e.g., You mentioned the project timeline clearly"
                          className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                        />
                      </div>

                      <Button
                        onClick={() => updateObjective(objective.id)}
                        disabled={!connected}
                        className="gap-2 w-full"
                      >
                        <Send className="w-4 h-4" />
                        Update Objective
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-6 border-t">
              <Button
                onClick={resetAll}
                variant="outline"
                className="w-full"
                disabled={completedIds.size === 0}
              >
                Reset All (Local Only)
              </Button>
            </div>
          </Card>
        )}

        {/* Insights Triggers */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Trigger Insights
          </h2>
          <div className="space-y-3">
            {sampleInsights.map((insight) => (
              <div
                key={insight.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-background"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{insight.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {insight.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Type: {insight.type}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => triggerInsight(insight)}
                  disabled={!connected}
                  className="gap-2 ml-3"
                  variant="outline"
                >
                  <Lightbulb className="w-4 h-4" />
                  Trigger
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Action Items Triggers */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Trigger Action Items
          </h2>
          <div className="space-y-3">
            {sampleActionItems.map((actionItem) => (
              <div
                key={actionItem.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-background"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{actionItem.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {actionItem.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Priority: {actionItem.priority}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => triggerActionItem(actionItem)}
                  disabled={!connected}
                  className="gap-2 ml-3"
                  variant="outline"
                >
                  <CheckCircle className="w-4 h-4" />
                  Trigger
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Links */}
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
          <div className="space-y-2">
            <a
              href="/"
              className="block p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <p className="font-medium">Go to Home Page</p>
              <p className="text-xs text-muted-foreground">
                Set up new objectives and start a call
              </p>
            </a>
            <a
              href="/call"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <p className="font-medium">Open Call Page</p>
              <p className="text-xs text-muted-foreground">
                Opens in new tab to see live updates
              </p>
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
