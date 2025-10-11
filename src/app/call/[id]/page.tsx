"use client";
import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCalls, CallData } from "@/lib/storage";

export default function CallDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [call, setCall] = useState<CallData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calls = getCalls();
    const foundCall = calls.find(c => c.id === params.id);
    setCall(foundCall || null);
    setLoading(false);
  }, [params.id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority: number) => {
    if (priority <= 2) return 'text-red-600 bg-red-50 border-red-200';
    if (priority <= 3) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority <= 2) return 'High Priority';
    if (priority <= 3) return 'Medium Priority';
    return 'Low Priority';
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full px-6 py-10 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="min-h-screen w-full px-6 py-10 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Call Not Found</h1>
            <p className="text-muted-foreground mb-4">
              The call you're looking for doesn't exist or has been deleted.
            </p>
            <Button onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-6 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard')}
              className="mb-4"
            >
              ← Back to Dashboard
            </Button>
            <h1 className="text-4xl font-bold tracking-tight">{call.name}</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Created on {formatDate(call.createdAt)}
            </p>
          </div>
          <Button onClick={() => router.push(`/call?title=${encodeURIComponent(call.name)}`)}>
            Start This Call
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Context Card */}
          <Card>
            <CardHeader>
              <CardTitle>Context</CardTitle>
              <CardDescription>Background information and current state</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="text-muted-foreground whitespace-pre-wrap">{call.context}</p>
              </div>
            </CardContent>
          </Card>

          {/* Raw Objectives Card */}
          <Card>
            <CardHeader>
              <CardTitle>Raw Objectives</CardTitle>
              <CardDescription>Original objectives as entered</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="text-muted-foreground whitespace-pre-wrap">{call.objectives}</p>
              </div>
            </CardContent>
          </Card>

          {/* Parsed Objectives Card */}
          {call.parsedObjectives.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Parsed Objectives</CardTitle>
                <CardDescription>AI-processed and prioritized objectives</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {call.parsedObjectives
                    .sort((a, b) => a.priority - b.priority)
                    .map((obj, index) => (
                      <div 
                        key={index} 
                        className={`p-4 rounded-lg border ${getPriorityColor(obj.priority)}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-base">{obj.name}</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/50">
                              {getPriorityLabel(obj.priority)}
                            </span>
                            <span className="text-xs font-bold">
                              P{obj.priority}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm opacity-90">{obj.description}</p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Constraints Card */}
          {call.constraints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Constraints</CardTitle>
                <CardDescription>Identified limitations and boundaries</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {call.constraints.map((constraint, index) => (
                    <li key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-md">
                      <span className="text-muted-foreground mt-1">⚠️</span>
                      <span className="text-sm">{constraint}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Risks Card */}
          {call.risks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Risks</CardTitle>
                <CardDescription>Potential challenges and concerns</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {call.risks.map((risk, index) => (
                    <li key={index} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <span className="text-red-600 mt-1">🚨</span>
                      <span className="text-sm text-red-800">{risk}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
