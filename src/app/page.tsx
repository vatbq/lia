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

const FormSchema = z.object({
  name: z.string().min(1).optional(),
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
  const [context, setContext] = useState("Team meeting to discuss Q4 strategy. Participants: Product Manager, Engineering Lead, and Design Lead. Current state: We're behind on our roadmap and need to prioritize features for the upcoming quarter.");
  const [objectives, setObjectives] = useState("1. Review current progress on Q3 goals 2. Identify top 3 features for Q4 3. Assign ownership and timelines 4. Discuss resource allocation 5. Set success metrics");
  const [name, setName] = useState("Q4 Strategy Planning");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const parse = FormSchema.safeParse({ name, context, objectives });
    if (!parse.success) {
      setError(parse.error.issues.map((i) => i.message).join("\n"));
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
      setResult(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full px-6 py-10 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">LIA</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Listen, Insight, Act
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre setup call
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Prepare your call</CardTitle>
            <CardDescription>
              Share context and objectives. We'll clarify them before starting the call.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
              <div className="grid gap-2">
                <Label htmlFor="context">Context</Label>
                <Textarea
                  id="context"
                  placeholder="Background, who is involved, current state..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="objectives">Objectives</Label>
                <Textarea
                  id="objectives"
                  placeholder="What you want to achieve in this call..."
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={loading}>
                  {loading ? "Clarifying..." : "Clarify objectives"}
                </Button>
              </div>
            </form>

            {error && (
              <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                {error}
              </div>
            )}

            {result && (
              <div className="mt-6 grid gap-4">
                <div>
                  <h4 className="text-sm font-medium">Objectives</h4>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {(result.objectives || []).map((o: any, i: number) => (
                      <li key={i}>
                        <strong>{o.name}</strong>: {o.description} (Priority: {o.priority})
                      </li>
                    ))}
                  </ul>
                </div>
                {(result.constraints?.length || 0) > 0 && (
                  <div>
                    <h4 className="text-sm font-medium">Constraints</h4>
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {result.constraints.map((c: string, i: number) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(result.risks?.length || 0) > 0 && (
                  <div>
                    <h4 className="text-sm font-medium">Risks</h4>
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {result.risks.map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              variant="secondary"
              disabled={!result}
              onClick={() => router.push(`/call?title=${encodeURIComponent(name || "Call")}`)}
            >
              Start call
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
