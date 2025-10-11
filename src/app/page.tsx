"use client";
import * as React from "react";
import { useState } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { saveCall } from "@/lib/storage";

type Objective = {
  id: string;
  title: string;
  description?: string;
  completed?: boolean;
  priority: number;
};

const FormSchema = z.object({
  name: z.string().min(1),
  context: z.string().min(10, "Please add more context (min 10 chars)").max(2000),
  objectives: z.string().min(10, "Please detail the objectives (min 10 chars)").max(2000),
});

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [context, setContext] = useState(
    "Demo call for LIA - an AI-powered meeting assistant that provides real-time insights, action items, and objective tracking. Participants: Sales Rep, Technical Lead, and Potential Client. Current state: Client is interested in AI meeting tools and wants to understand LIA's capabilities."
  );
  const [objectives, setObjectives] = useState(
    "1. Demonstrate LIA's real-time transcription and analysis 2. Show live insights and action item generation 3. Explain integration with Slack and Teams 4. Discuss security and compliance features 5. Address pricing and next steps"
  );
  const [name, setName] = useState("LIA Product Demo");
  const [loading, setLoading] = useState(false);
  const [parsedObjectives, setParsedObjectives] = useState<Objective[]>([]);
  const [error, setError] = useState<string | null>(null);

  // For editing objectives
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Objective>({
    id: "",
    title: "",
    description: "",
    completed: false,
    priority: 1,
  });

  // For adding new objectives
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newObjective, setNewObjective] = useState<Objective>({
    id: "",
    title: "",
    description: "",
    completed: false,
    priority: 1,
  });

  // Helper to clamp priority between 1 and 5
  function clampPriority(value: string | number): number {
    const num = typeof value === "string" ? parseInt(value) : value;
    if (isNaN(num)) return 1;
    return Math.max(1, Math.min(5, num));
  }

  // Mock objectives for LIA demo default values
  const mockObjectives: Objective[] = [
    {
      id: uuidv4(),
      title: "Show Real-time Transcription",
      description: "Demonstrate LIA's live transcription capabilities with accurate speech-to-text",
      completed: false,
      priority: 1,
    },
    {
      id: uuidv4(),
      title: "Demonstrate Live Insights",
      description: "Show how LIA generates real-time insights and sentiment analysis during meetings",
      completed: false,
      priority: 1,
    },
    {
      id: uuidv4(),
      title: "Show Action Item Generation",
      description: "Demonstrate automatic action item creation when commitments are made",
      completed: false,
      priority: 2,
    },
  ];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parse = FormSchema.safeParse({ name, context, objectives });
    if (!parse.success) {
      setError(parse.error.issues.map((i) => i.message).join("\n"));
      return;
    }

    // Check if using default values
    const isDefaultContext =
      context ===
      "Demo call for LIA - an AI-powered meeting assistant that provides real-time insights, action items, and objective tracking. Participants: Sales Rep, Technical Lead, and Potential Client. Current state: Client is interested in AI meeting tools and wants to understand LIA's capabilities.";
    const isDefaultObjectives =
      objectives ===
      "1. Demonstrate LIA's real-time transcription and analysis 2. Show live insights and action item generation 3. Explain integration with Slack and Teams 4. Discuss security and compliance features 5. Address pricing and next steps";

    if (isDefaultContext && isDefaultObjectives) {
      // Use mock data for default values
      setParsedObjectives(mockObjectives);
      setStep(2);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/parse-objectives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context, objectives }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Request failed");
      // Add UUIDs to objectives from API
      const objectivesWithIds = (data.data.objectives || []).map((obj: Omit<Objective, "id">) => ({
        id: uuidv4(),
        ...obj,
      }));
      setParsedObjectives(objectivesWithIds);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleAddObjective() {
    if (!newObjective.title.trim() || !newObjective.description?.trim()) {
      setError("Name and description are required");
      return;
    }
    const clampedObjective = {
      ...newObjective,
      id: uuidv4(),
      priority: clampPriority(newObjective.priority),
    };
    setParsedObjectives([...parsedObjectives, clampedObjective]);
    setNewObjective({
      id: "",
      title: "",
      description: "",
      completed: false,
      priority: 1,
    });
    setIsAddingNew(false);
    setError(null);
  }

  function handleStartEdit(index: number) {
    setEditingId(index);
    setEditForm({ ...parsedObjectives[index] });
  }

  function handleSaveEdit() {
    if (editingId === null) return;
    if (!editForm.title.trim() || !editForm.description?.trim()) {
      setError("Name and description are required");
      return;
    }
    const updated = [...parsedObjectives];
    updated[editingId] = {
      ...editForm,
      priority: clampPriority(editForm.priority),
    };
    setParsedObjectives(updated);
    setEditingId(null);
    setError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditForm({
      id: "",
      title: "",
      description: "",
      completed: false,
      priority: 1,
    });
  }

  function handleDeleteObjective(index: number) {
    setParsedObjectives(parsedObjectives.filter((_, i) => i !== index));
  }

  return (
    <div className="min-h-screen w-full py-10 px-32">
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="flex items-center justify-center hover:bg-muted rounded-md p-1 transition-all hover:scale-110 active:scale-95">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-semibold">Prepare your call</h1>
              <p className="text-sm text-muted-foreground mt-1">{step === 1 ? "Share context and objectives. We'll clarify them before starting the call." : "Review and edit your objectives before starting the call."}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${step === 1 ? "bg-primary text-primary-foreground scale-110" : "bg-muted text-muted-foreground scale-100"}`}
              >
                1
              </div>
              <span className={`text-sm transition-all duration-300 ${step === 1 ? "font-medium" : "text-muted-foreground"}`}>Input</span>
            </div>
            <div className="h-px w-12 bg-border transition-colors duration-300" />
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${step === 2 ? "bg-primary text-primary-foreground scale-110" : "bg-muted text-muted-foreground scale-100"}`}
              >
                2
              </div>
              <span className={`text-sm transition-all duration-300 ${step === 2 ? "font-medium" : "text-muted-foreground"}`}>Review</span>
            </div>
          </div>
        </div>

        {/* Progress Indicator */}

        <div className="relative">
          {/* Step 1: Input Form */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="grid gap-2">
                  <Label htmlFor="name">Call title (optional)</Label>
                  <Input id="name" placeholder="LIA product demo" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="context">Any previous conversations for context?</Label>
                    <Textarea id="context" placeholder="Background, who is involved, current state..." value={context} onChange={(e) => setContext(e.target.value)} rows={12} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="objectives">What's the goal of the call?</Label>
                    <Textarea id="objectives" placeholder="What you want to achieve in this call..." value={objectives} onChange={(e) => setObjectives(e.target.value)} rows={12} />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Clarifying..." : "Next: Review objectives"}
                  </Button>
                </div>
              </form>

              {error && <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm animate-in fade-in slide-in-from-top-2 duration-300">{error}</div>}
            </div>
          )}

          {/* Step 2: Review Objectives */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid gap-4">
                <div>
                  <div className="space-y-3">
                    {parsedObjectives.map((obj, i) => (
                      <div key={obj.id} className="rounded-md border p-3 transition-all duration-200 hover:shadow-md hover:border-primary/50">
                        {editingId === i ? (
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs">Name</Label>
                              <Input
                                value={editForm.title}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    title: e.target.value,
                                  })
                                }
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Description</Label>
                              <Textarea
                                value={editForm.description}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    description: e.target.value,
                                  })
                                }
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Priority (1-5)</Label>
                              <Input
                                type="number"
                                min="1"
                                max="5"
                                value={editForm.priority}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    priority: clampPriority(e.target.value),
                                  })
                                }
                                className="mt-1"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveEdit}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{obj.title}</div>
                                <div className="text-sm text-muted-foreground mt-1">{obj.description}</div>
                                <div className="text-xs text-muted-foreground mt-1">Priority: {obj.priority}</div>
                              </div>
                              <div className="flex gap-1 ml-2">
                                <Button size="icon" variant="ghost" onClick={() => handleStartEdit(i)} className="transition-all hover:scale-110 active:scale-95">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteObjective(i)} className="text-destructive hover:text-destructive transition-all hover:scale-110 active:scale-95">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {isAddingNew && (
                      <div className="rounded-md border border-primary p-3 space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={newObjective.title}
                              onChange={(e) =>
                                setNewObjective({
                                  ...newObjective,
                                  title: e.target.value,
                                })
                              }
                              placeholder="Objective title"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Priority</Label>
                            <div className="flex gap-0 mt-1 bg-muted rounded-md p-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setNewObjective({
                                    ...newObjective,
                                    priority: 1,
                                  })
                                }
                                className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${newObjective.priority === 1 ? "text-green-600" : "text-muted-foreground hover:text-green-500"}`}
                              >
                                Low
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setNewObjective({
                                    ...newObjective,
                                    priority: 2,
                                  })
                                }
                                className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${newObjective.priority === 2 ? "text-yellow-600" : "text-muted-foreground hover:text-yellow-500"}`}
                              >
                                Medium
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setNewObjective({
                                    ...newObjective,
                                    priority: 3,
                                  })
                                }
                                className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${newObjective.priority === 3 ? "text-red-600" : "text-muted-foreground hover:text-red-500"}`}
                              >
                                High
                              </button>
                            </div>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Description</Label>
                          <Textarea
                            value={newObjective.description}
                            onChange={(e) =>
                              setNewObjective({
                                ...newObjective,
                                description: e.target.value,
                              })
                            }
                            placeholder="Objective description"
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleAddObjective}>
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsAddingNew(false);
                              setNewObjective({
                                id: "",
                                title: "",
                                description: "",
                                completed: false,
                                priority: 1,
                              });
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center mt-4 justify-end gap-4">
                      <Button variant="outline" onClick={() => setIsAddingNew(true)}>
                        + Add Objective
                      </Button>
                      <Button
                        onClick={() => {
                          saveCall({
                            name: name || "Call",
                            context,
                            objectives,
                            parsedObjectives,
                          });
                          router.push(`/call?title=${encodeURIComponent(name || "Call")}`);
                        }}
                      >
                        Start call
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {error && <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm animate-in fade-in slide-in-from-top-2 duration-300">{error}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
