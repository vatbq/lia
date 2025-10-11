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
              {call.endedAt && (
                <span className="ml-2 text-sm text-muted-foreground">
                  • Ended on {formatDate(call.endedAt)}
                </span>
              )}
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
                <CardTitle className="flex items-center gap-2">
                  Objectives
                  {call.completedObjectives && (
                    <span className="text-sm text-muted-foreground">
                      ({call.completedObjectives.length}/{call.parsedObjectives.length} completed)
                    </span>
                  )}
                </CardTitle>
                <CardDescription>AI-processed and prioritized objectives</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {call.parsedObjectives
                    .sort((a, b) => a.priority - b.priority)
                    .map((obj, index) => {
                      const isCompleted = call.completedObjectives?.includes(obj.id) || false;
                      
                      return (
                        <div
                          key={obj.id} 
                          className={`p-4 rounded-lg border transition-all duration-300 ${
                            isCompleted 
                              ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 opacity-90" 
                              : getPriorityColor(obj.priority)
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3 flex-1">
                              {isCompleted && (
                                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                              )}
                              <h4 className={`font-semibold text-base ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                                {obj.name}
                              </h4>
                            </div>
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
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Insights Section */}
          {call.insights && call.insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  Insights ({call.insights.length})
                </CardTitle>
                <CardDescription>Key insights from the call</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {call.insights.map((insight, index) => (
                    <div
                      key={insight.id || index}
                      className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}
                    >
                      <div className="flex items-start gap-3">
                        {getInsightIcon(insight.type)}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-base">{insight.title}</h4>
                          <p className="text-sm opacity-90 mt-1">{insight.description}</p>
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
              </CardContent>
            </Card>
          )}

          {/* Action Items Section */}
          {call.actionItems && call.actionItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Action Items ({call.actionItems.length})
                </CardTitle>
                <CardDescription>Tasks and follow-ups from the call</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {call.actionItems.map((item, index) => (
                    <div
                      key={item.id || index}
                      className={`p-4 rounded-lg border ${
                        item.completed
                          ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 opacity-75"
                          : "bg-background border-border"
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
                          <h4 className={`font-semibold text-base ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                            {item.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
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
  );
}
