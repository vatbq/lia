"use client";
import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCalls, deleteCall, CallData } from "@/lib/storage";

export default function DashboardPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<CallData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadedCalls = getCalls();
    setCalls(loadedCalls);
    setLoading(false);
  }, []);

  const handleDeleteCall = (id: string) => {
    if (confirm('Are you sure you want to delete this call?')) {
      deleteCall(id);
      setCalls(getCalls());
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  return (
    <div className="min-h-screen w-full px-6 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Call Dashboard</h1>
            <p className="mt-2 text-lg text-muted-foreground">Your call history and preparation details</p>
          </div>
          <Button onClick={() => router.push('/')}>
            New Call
          </Button>
        </div>

        {calls.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <h3 className="text-lg font-medium mb-2">No calls yet</h3>
              <p className="text-muted-foreground mb-4">
                Start your first call to see it appear here
              </p>
              <Button onClick={() => router.push('/')}>
                Create Your First Call
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {calls.map((call) => (
              <Card key={call.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{call.name}</CardTitle>
                      <CardDescription className="mt-1">
                        Created on {formatDate(call.createdAt)}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/call/${call.id}`)}
                      >
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCall(call.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {call.parsedObjectives.length} objectives prepared
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
