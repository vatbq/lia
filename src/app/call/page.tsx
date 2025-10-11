"use client";

import { use, useState, useEffect } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { io, Socket } from "socket.io-client";

interface Objective {
  id: string;
  name: string;
  description: string;
  priority: number;
  completed: boolean;
}

export default function CallPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string }>;
}) {
  const params = use(searchParams);
  const title = params?.title || "Call";
  const [objectives, setObjectives] = useState<Objective[]>([
    {
      id: "1",
      name: "Introduce yourself",
      description: "Start the call with a friendly introduction",
      priority: 1,
      completed: false,
    },
    {
      id: "2",
      name: "Discuss project timeline",
      description: "Review key milestones and deadlines",
      priority: 2,
      completed: false,
    },
    {
      id: "3",
      name: "Address budget concerns",
      description: "Go over financial constraints and requirements",
      priority: 3,
      completed: false,
    },
  ]);

  useEffect(() => {
    // Connect to Socket.IO server
    const socket: Socket = io("http://localhost:3000");

    socket.on("connect", () => {
      console.log("Socket.IO connected:", socket.id);
    });

    socket.on("objective_complete", (data: { id: string }) => {
      console.log("Objective completed:", data);
      setObjectives((prev) =>
        prev.map((obj) =>
          obj.id === data.id ? { ...obj, completed: true } : obj
        )
      );
    });

    socket.on("disconnect", () => {
      console.log("Socket.IO disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex">
      {/* Main call area */}
      <div className="flex-1 px-6 py-10 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Call in progress. Complete your objectives to track progress.
          </p>

          {/* Placeholder for call content */}
          <div className="mt-8 p-8 border border-dashed rounded-lg text-center text-muted-foreground">
            <p>Call interface goes here</p>
            <p className="text-xs mt-2">
              Video, audio controls, transcription, etc.
            </p>
          </div>
        </div>
      </div>

      {/* Objectives sidebar */}
      <div className="w-80 border-l bg-muted/20 p-6 overflow-y-auto">
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
  );
}
