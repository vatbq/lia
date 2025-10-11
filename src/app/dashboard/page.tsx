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

  if (calls.length === 0) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: 'calc(100vh - 100px)' }}>
        <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-1000">
          <h1 className="text-6xl font-bold tracking-tight text-center animate-in fade-in-50 slide-in-from-bottom-3 duration-700" style={{ fontFamily: 'var(--font-archivo-black)' }}>
            LIA
          </h1>
          <p className="text-2xl text-muted-foreground text-center animate-in fade-in-50 slide-in-from-bottom-4 duration-1000 delay-200">
            Your next sale, one click away
          </p>
          <div className="pt-4 flex justify-center animate-in fade-in-50 slide-in-from-bottom-5 duration-1000 delay-500">
            <Button
              size="lg"
              onClick={() => router.push("/")}
              className="text-lg px-8 py-6"
            >
              Get Started
            </Button>
          </div>
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
      </div>
    </div>
  );
}
