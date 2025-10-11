"use client";
import * as React from "react";
import { useState } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { saveCall } from "@/lib/storage";

type Objective = {
  name: string;
  description: string;
  priority: number;
};

const FormSchema = z.object({
  name: z.string().min(1),
  context: z.string().min(10, "Please add more context (min 10 chars)").max(2000),
  objectives: z.string().min(10, "Please detail the objectives (min 10 chars)").max(2000),
});

export default function Home() {
  const router = useRouter();
  const [context, setContext] = useState(
    "Team meeting to discuss Q4 strategy. Participants: Product Manager, Engineering Lead, and Design Lead. Current state: We're behind on our roadmap and need to prioritize features for the upcoming quarter."
  );
  const [objectives, setObjectives] = useState("1. Review current progress on Q3 goals 2. Identify top 3 features for Q4 3. Assign ownership and timelines 4. Discuss resource allocation 5. Set success metrics");
  const [name, setName] = useState("Q4 Strategy Planning");
  const [loading, setLoading] = useState(false);
  const [parsedObjectives, setParsedObjectives] = useState<Objective[]>([]);
  const [error, setError] = useState<string | null>(null);

  // For editing objectives
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Objective>({ name: "", description: "", priority: 1 });

  // For adding new objectives
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newObjective, setNewObjective] = useState<Objective>({ name: "", description: "", priority: 1 });

  // Helper to clamp priority between 1 and 5
  function clampPriority(value: string | number): number {
    const num = typeof value === "string" ? parseInt(value) : value;
    if (isNaN(num)) return 1;
    return Math.max(1, Math.min(5, num));
  }

  // Mock objectives for default values
  const mockObjectives: Objective[] = [
    {
      name: "Review Q3 Progress",
      description: "Assess current progress against Q3 goals and identify gaps",
      priority: 1
    },
    {
      name: "Identify Q4 Features",
      description: "Select top 3 features to prioritize for Q4 development",
      priority: 1
    },
    {
      name: "Assign Ownership",
      description: "Assign clear ownership and responsibilities for each Q4 feature",
      priority: 2
    },
    {
      name: "Set Timelines",
      description: "Establish realistic timelines and milestones for Q4 deliverables",
      priority: 2
    },
    {
      name: "Resource Allocation",
      description: "Discuss and allocate team resources for Q4 initiatives",
      priority: 3
    },
    {
      name: "Success Metrics",
      description: "Define clear success metrics and KPIs for Q4 goals",
      priority: 3
    }
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
    const isDefaultContext = context === "Team meeting to discuss Q4 strategy. Participants: Product Manager, Engineering Lead, and Design Lead. Current state: We're behind on our roadmap and need to prioritize features for the upcoming quarter.";
    const isDefaultObjectives = objectives === "1. Review current progress on Q3 goals 2. Identify top 3 features for Q4 3. Assign ownership and timelines 4. Discuss resource allocation 5. Set success metrics";
    
    if (isDefaultContext && isDefaultObjectives) {
      // Use mock data for default values
      setParsedObjectives(mockObjectives);
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
      setParsedObjectives(data.data.objectives || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleAddObjective() {
    if (!newObjective.name.trim() || !newObjective.description.trim()) {
      setError("Name and description are required");
      return;
    }
    const clampedObjective = { ...newObjective, priority: clampPriority(newObjective.priority) };
    setParsedObjectives([...parsedObjectives, clampedObjective]);
    setNewObjective({ name: "", description: "", priority: 1 });
    setIsAddingNew(false);
    setError(null);
  }

  function handleStartEdit(index: number) {
    setEditingId(index);
    setEditForm({ ...parsedObjectives[index] });
  }

  function handleSaveEdit() {
    if (editingId === null) return;
    if (!editForm.name.trim() || !editForm.description.trim()) {
      setError("Name and description are required");
      return;
    }
    const updated = [...parsedObjectives];
    updated[editingId] = { ...editForm, priority: clampPriority(editForm.priority) };
    setParsedObjectives(updated);
    setEditingId(null);
    setError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditForm({ name: "", description: "", priority: 1 });
  }

  function handleDeleteObjective(index: number) {
    setParsedObjectives(parsedObjectives.filter((_, i) => i !== index));
  }

  return (
    <div className="min-h-screen w-full px-6 py-10 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-between mb-4">
            <div></div>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              View Dashboard
            </Button>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">LIA</h1>
          <p className="mt-2 text-lg text-muted-foreground">Listen, Insight, Act</p>
          <p className="mt-1 text-sm text-muted-foreground">Pre setup call</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Prepare your call</CardTitle>
            <CardDescription>Share context and objectives. We'll clarify them before starting the call.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="name">Call title (optional)</Label>
                <Input id="name" placeholder="Quarterly strategy sync" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="context">Context</Label>
                <Textarea id="context" placeholder="Background, who is involved, current state..." value={context} onChange={(e) => setContext(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="objectives">Objectives</Label>
                <Textarea id="objectives" placeholder="What you want to achieve in this call..." value={objectives} onChange={(e) => setObjectives(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={loading}>
                  {loading ? "Clarifying..." : "Clarify objectives"}
                </Button>
              </div>
            </form>

            {error && <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</div>}

            {isAddingNew && parsedObjectives.length === 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3">Add Objective</h4>
                <div className="rounded-md border border-primary p-3 space-y-2">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input value={newObjective.name} onChange={(e) => setNewObjective({ ...newObjective, name: e.target.value })} placeholder="Objective name" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Textarea value={newObjective.description} onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })} placeholder="Objective description" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Priority (1-5)</Label>
                    <Input type="number" min="1" max="5" value={newObjective.priority} onChange={(e) => setNewObjective({ ...newObjective, priority: clampPriority(e.target.value) })} className="mt-1" />
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
                        setNewObjective({ name: "", description: "", priority: 1 });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {parsedObjectives.length > 0 && (
              <div className="mt-6 grid gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Objectives</h4>
                    <Button size="sm" variant="outline" onClick={() => setIsAddingNew(true)}>
                      + Add Objective
                    </Button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {parsedObjectives.map((obj, i) => (
                      <div key={i} className="rounded-md border p-3">
                        {editingId === i ? (
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs">Name</Label>
                              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs">Description</Label>
                              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs">Priority (1-5)</Label>
                              <Input type="number" min="1" max="5" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: clampPriority(e.target.value) })} className="mt-1" />
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
                                <div className="font-medium text-sm">{obj.name}</div>
                                <div className="text-sm text-muted-foreground mt-1">{obj.description}</div>
                                <div className="text-xs text-muted-foreground mt-1">Priority: {obj.priority}</div>
                              </div>
                              <div className="flex gap-1 ml-2">
                                <Button size="sm" variant="ghost" onClick={() => handleStartEdit(i)}>
                                  Edit
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteObjective(i)} className="text-destructive hover:text-destructive">
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {isAddingNew && (
                      <div className="rounded-md border border-primary p-3 space-y-2">
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input value={newObjective.name} onChange={(e) => setNewObjective({ ...newObjective, name: e.target.value })} placeholder="Objective name" className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Description</Label>
                          <Textarea value={newObjective.description} onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })} placeholder="Objective description" className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Priority (1-5)</Label>
                          <Input type="number" min="1" max="5" value={newObjective.priority} onChange={(e) => setNewObjective({ ...newObjective, priority: clampPriority(e.target.value) })} className="mt-1" />
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
                              setNewObjective({ name: "", description: "", priority: 1 });
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            {parsedObjectives.length === 0 && (
              <Button variant="outline" onClick={() => setIsAddingNew(true)}>
                Manually add objectives
              </Button>
            )}
            <Button variant="secondary" disabled={parsedObjectives.length === 0} onClick={() => {
              // Save call data before starting
              saveCall({
                name: name || "Call",
                context,
                objectives,
                parsedObjectives,
              });
              router.push(`/call?title=${encodeURIComponent(name || "Call")}`);
            }}>
              Start call
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
