export interface CallData {
  id: string;
  name: string;
  context: string;
  objectives: string;
  parsedObjectives: Array<{
    id: string;
    name: string;
    description: string;
    priority: number;
  }>;
  completedObjectives?: string[];
  createdAt: string;
  insights?: Array<{
    id: string;
    title: string;
    description: string;
    type: 'positive' | 'negative' | 'neutral' | 'warning';
    timestamp: string;
  }>;
  actionItems?: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    completed: boolean;
    timestamp: string;
  }>;
  endedAt?: string;
}

const STORAGE_KEY = 'lia-calls';

export function saveCall(callData: Omit<CallData, 'id' | 'createdAt'>): CallData {
  const id = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const createdAt = new Date().toISOString();
  
  const fullCallData: CallData = {
    ...callData,
    id,
    createdAt,
  };

  const existingCalls = getCalls();
  const updatedCalls = [fullCallData, ...existingCalls];
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCalls));
  
  return fullCallData;
}

export function getCalls(): CallData[] {
  if (typeof window === 'undefined') {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading calls from localStorage:', error);
    return [];
  }
}

export function deleteCall(id: string): void {
  const calls = getCalls();
  const updatedCalls = calls.filter(call => call.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCalls));
}

export function clearAllCalls(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getLatestCall(): CallData | null {
  const calls = getCalls();
  return calls.length > 0 ? calls[0] : null;
}

export function updateCall(id: string, updates: Partial<CallData>): CallData | null {
  const calls = getCalls();
  const callIndex = calls.findIndex(call => call.id === id);
  
  if (callIndex === -1) {
    console.error('Call not found:', id);
    return null;
  }
  
  const updatedCall = { ...calls[callIndex], ...updates };
  calls[callIndex] = updatedCall;
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
  
  return updatedCall;
}
