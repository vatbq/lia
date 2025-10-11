"use client";
import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const handleDeleteCall = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this call?")) {
      deleteCall(id);
      setCalls(getCalls());
    }
  };

  const handleRowClick = (id: string) => {
    router.push(`/call/${id}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Calls</h1>
            <p className="text-muted-foreground mt-1">
              Manage and review your call history
            </p>
          </div>
          <Button onClick={() => router.push("/")}>New Call</Button>
        </div>

        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <h3 className="text-lg font-medium mb-2">No calls yet</h3>
            <p className="text-muted-foreground mb-6">
              Start your first call to see it appear here
            </p>
            <Button onClick={() => router.push("/")}>
              Create Your First Call
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border px-4 py-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Objectives</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call) => (
                  <TableRow
                    key={call.id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(call.id)}
                  >
                    <TableCell className="font-medium">{call.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(call.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {call.parsedObjectives.length}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteCall(e, call.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
