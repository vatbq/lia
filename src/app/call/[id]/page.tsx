"use client";
import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCalls, CallData } from "@/lib/storage";
import { CheckCircle2, Circle, Lightbulb, AlertTriangle, CheckCircle, Clock, Info } from "lucide-react";

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


  const getInsightIcon = (type: string) => {
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

  const getInsightColor = (type: string) => {
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

  const getActionItemPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
      case 'medium':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400';
    }
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
    <div className="min-h-screen w-full bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{call.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>Created {formatDate(call.createdAt)}</span>
              </div>
              {call.endedAt && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span>Ended {formatDate(call.endedAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* First Screen - Objectives and Action Items Side by Side */}
        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          {/* Objectives */}
          {call.parsedObjectives.length > 0 && (
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Objectives</CardTitle>
                  {call.completedObjectives && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
                      <span className="text-sm font-medium">
                        {call.completedObjectives.length}/{call.parsedObjectives.length}
                      </span>
                      <span className="text-xs text-muted-foreground">completed</span>
                    </div>
                  )}
                </div>
                <CardDescription>Prioritized goals for this call</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {call.parsedObjectives
                    .sort((a, b) => a.priority - b.priority)
                    .map((obj) => {
                      const isCompleted = call.completedObjectives?.includes(obj.id) || false;

                      return (
                        <div
                          key={obj.id}
                          className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                            isCompleted
                              ? "bg-green-50/50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                              : getPriorityColor(obj.priority)
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5">
                              {isCompleted ? (
                                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className={`font-semibold text-base ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                                  {obj.title}
                                </h4>
                                <span className="text-xs font-medium px-2 py-0.5 rounded bg-background/80 border flex-shrink-0">
                                  P{obj.priority}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">{obj.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Items */}
          {call.actionItems && call.actionItems.length > 0 && (
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <CardTitle className="text-xl">Action Items</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
                    <span className="text-sm font-medium">
                      {call.actionItems.filter(item => item.completed).length}/{call.actionItems.length}
                    </span>
                    <span className="text-xs text-muted-foreground">completed</span>
                  </div>
                </div>
                <CardDescription>Tasks and follow-ups from the call</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {call.actionItems.map((item, index) => (
                    <div
                      key={item.id || index}
                      className={`p-3 rounded-lg border-2 transition-all hover:shadow-sm ${
                        item.completed
                          ? "bg-green-50/50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                          : "bg-background border-border"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">
                          {item.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={`font-semibold text-base ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                              {item.title}
                            </h4>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${getActionItemPriorityColor(item.priority)}`}>
                              {item.priority}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed mb-2">{item.description}</p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>
                              {new Date(item.timestamp).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Second Screen - Context, Original Objectives, and Insights */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Context Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Context</CardTitle>
                <CardDescription>Background information</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{call.context}</p>
              </CardContent>
            </Card>

            {/* Original Objectives Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Original Objectives</CardTitle>
                <CardDescription>Initial goals</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{call.objectives}</p>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar - Insights */}
          <div className="lg:col-span-1 space-y-6">
            {/* Insights Section */}
            {call.insights && call.insights.length > 0 && (
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                      <CardTitle className="text-lg">Insights</CardTitle>
                    </div>
                    <span className="text-sm text-muted-foreground">{call.insights.length} items</span>
                  </div>
                  <CardDescription>Key observations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {call.insights.map((insight, index) => (
                      <div
                        key={insight.id || index}
                        className={`p-3 rounded-lg border-2 transition-all hover:shadow-sm ${getInsightColor(insight.type)}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex-shrink-0">
                            {getInsightIcon(insight.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm mb-1">{insight.title}</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed mb-2">{insight.description}</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(insight.timestamp).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
