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
  context: z
    .string()
    .min(10, "Please add more context (min 10 chars)")
    .max(2000),
  objectives: z
    .string()
    .min(10, "Please detail the objectives (min 10 chars)")
    .max(2000),
});

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [context, setContext] = useState(
    "Team meeting to discuss Q4 strategy. Participants: Product Manager, Engineering Lead, and Design Lead. Current state: We're behind on our roadmap and need to prioritize features for the upcoming quarter.",
  );
  const [objectives, setObjectives] = useState(
    "1. Review current progress on Q3 goals 2. Identify top 3 features for Q4 3. Assign ownership and timelines 4. Discuss resource allocation 5. Set success metrics",
  );
  const [name, setName] = useState("Q4 Strategy Planning");
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

  // Mock objectives for default values
  const mockObjectives: Objective[] = [
    {
      id: uuidv4(),
      title: "Review Q3 Progress",
      description: "Assess current progress against Q3 goals and identify gaps",
      completed: false,
      priority: 1,
    },
    {
      id: uuidv4(),
      title: "Identify Q4 Features",
      description: "Select top 3 features to prioritize for Q4 development",
      completed: false,
      priority: 1,
    },
    {
      id: uuidv4(),
      title: "Assign Ownership",
      description:
        "Assign clear ownership and responsibilities for each Q4 feature",
      completed: false,
      priority: 2,
    },
    {
      id: uuidv4(),
      title: "Set Timelines",
      description:
        "Establish realistic timelines and milestones for Q4 deliverables",
      completed: false,
      priority: 2,
    },
    {
      id: uuidv4(),
      title: "Resource Allocation",
      description: "Discuss and allocate team resources for Q4 initiatives",
      completed: false,
      priority: 3,
    },
    {
      id: uuidv4(),
      title: "Success Metrics",
      description: "Define clear success metrics and KPIs for Q4 goals",
      completed: false,
      priority: 3,
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
      "Team meeting to discuss Q4 strategy. Participants: Product Manager, Engineering Lead, and Design Lead. Current state: We're behind on our roadmap and need to prioritize features for the upcoming quarter.";
    const isDefaultObjectives =
      objectives ===
      "1. Review current progress on Q3 goals 2. Identify top 3 features for Q4 3. Assign ownership and timelines 4. Discuss resource allocation 5. Set success metrics";

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
      const objectivesWithIds = (data.data.objectives || []).map(
        (obj: Omit<Objective, "id">) => ({
          id: uuidv4(),
          ...obj,
        }),
      );
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
              <button
                onClick={() => setStep(1)}
                className="flex items-center justify-center hover:bg-muted rounded-md p-1 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-semibold">Prepare your call</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {step === 1
                  ? "Share context and objectives. We'll clarify them before starting the call."
                  : "Review and edit your objectives before starting the call."}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step === 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                1
              </div>
              <span
                className={`text-sm ${step === 1 ? "font-medium" : "text-muted-foreground"}`}
              >
                Input
              </span>
            </div>
            <div className="h-px w-12 bg-border" />
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step === 2
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                2
              </div>
              <span
                className={`text-sm ${step === 2 ? "font-medium" : "text-muted-foreground"}`}
              >
                Review
              </span>
            </div>
          </div>
        </div>

        {/* Progress Indicator */}

        <div>
          {/* Step 1: Input Form */}
          {step === 1 && (
            <>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="grid gap-2">
                  <Label htmlFor="name">Call title (optional)</Label>
                  <Input
                    id="name"
                    placeholder="Quarterly strategy sync"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="context">
                      Any previous conversations for context?
                    </Label>
                    <Textarea
                      id="context"
                      placeholder="Background, who is involved, current state..."
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      rows={12}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="objectives">
                      What's the goal of the call?
                    </Label>
                    <Textarea
                      id="objectives"
                      placeholder="What you want to achieve in this call..."
                      value={objectives}
                      onChange={(e) => setObjectives(e.target.value)}
                      rows={12}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Clarifying..." : "Next: Review objectives"}
                  </Button>
                </div>
              </form>

              {error && (
                <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  {error}
                </div>
              )}
            </>
          )}

          {/* Step 2: Review Objectives */}
          {step === 2 && (
            <>
              <div className="grid gap-4">
                <div>
                  <div className="space-y-3">
                    {parsedObjectives.map((obj, i) => (
                      <div key={i} className="rounded-md border p-3">
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
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-sm">
                                  {obj.title}
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {obj.description}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Priority: {obj.priority}
                                </div>
                              </div>
                              <div className="flex gap-1 ml-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleStartEdit(i)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeleteObjective(i)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {isAddingNew && (
                      <div className="rounded-md border border-primary p-3 space-y-2">
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
                                className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                                  newObjective.priority === 1
                                    ? "text-green-600"
                                    : "text-muted-foreground hover:text-green-500"
                                }`}
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
                                className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                                  newObjective.priority === 2
                                    ? "text-yellow-600"
                                    : "text-muted-foreground hover:text-yellow-500"
                                }`}
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
                                className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                                  newObjective.priority === 3
                                    ? "text-red-600"
                                    : "text-muted-foreground hover:text-red-500"
                                }`}
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
                      <Button
                        variant="outline"
                        onClick={() => setIsAddingNew(true)}
                      >
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
                          router.push(
                            `/call?title=${encodeURIComponent(name || "Call")}`,
                          );
                        }}
                      >
                        Start call
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
