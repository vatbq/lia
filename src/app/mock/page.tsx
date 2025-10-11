"use client";

import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Send } from "lucide-react";

interface Objective {
  id: string;
  name: string;
}

export default function MockPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const objectives: Objective[] = [
    { id: "1", name: "Introduce yourself" },
    { id: "2", name: "Discuss project timeline" },
    { id: "3", name: "Address budget concerns" },
  ];

  useEffect(() => {
    const newSocket: Socket = io("http://localhost:3000");

    newSocket.on("connect", () => {
      console.log("Mock page connected:", newSocket.id);
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

  const completeObjective = (id: string) => {
    if (socket) {
      console.log("Emitting complete_objective for id:", id);
      socket.emit("complete_objective", { id });
      setCompletedIds((prev) => new Set(prev).add(id));
    }
  };

  const resetAll = () => {
    setCompletedIds(new Set());
  };

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
        </Card>

        {/* Instructions */}
        <Card className="p-6 mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <h2 className="font-semibold mb-2">How to use:</h2>
          <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
            <li>Open the call page in another browser tab or window</li>
            <li>Click the buttons below to complete objectives</li>
            <li>Watch the objectives update in real-time on the call page</li>
            <li>Use "Reset All" to clear completed status (local only)</li>
          </ol>
        </Card>

        {/* Objective triggers */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Trigger Completions</h2>
          <div className="space-y-3">
            {objectives.map((objective) => {
              const isCompleted = completedIds.has(objective.id);
              return (
                <div
                  key={objective.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-background"
                >
                  <div className="flex items-center gap-3">
                    {isCompleted && (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    )}
                    <div>
                      <p className="font-medium">{objective.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ID: {objective.id}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => completeObjective(objective.id)}
                    disabled={!connected || isCompleted}
                    className="gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Complete
                  </Button>
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

        {/* Event log */}
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
          <div className="space-y-2">
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
