/**
 * SAIL Approval Dashboard
 *
 * Table view for manual review of tasks and pipelines.
 * Shows risk levels, agent details, and approval/rejection controls.
 */

import { useState } from 'react';
import {
  Shield, CheckCircle, XCircle, Clock, AlertTriangle,
  Bot, Bug, Layout, Server, Brain, DollarSign, Eye,
  ChevronDown, ChevronUp, RefreshCw, Filter,
} from 'lucide-react';

interface SAILTask {
  id: string;
  type: string;
  priority: string;
  status: string;
  agent: string | null;
  risk_level: string;
  title: string;
  description: string;
  context: Record<string, unknown>;
  created_by: string;
  created_at: string;
  review_notes: string | null;
  retry_count: number;
}

interface SAILApprovalDashboardProps {
  tasks: SAILTask[];
  onApprove: (taskId: string, notes?: string) => Promise<boolean>;
  onReject: (taskId: string, reason: string) => Promise<boolean>;
  onRetry: (taskId: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  isLoading?: boolean;
}

const AGENT_ICONS: Record<string, typeof Bot> = {
  debug: Bug,
  frontend: Layout,
  backend: Server,
  learning: Brain,
  monetization: DollarSign,
  reviewer: Eye,
};

const RISK_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-red-100 text-red-800 border-red-200',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-blue-500 text-white',
  low: 'bg-gray-400 text-white',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-700',
  deploying: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-200 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  failed: 'bg-red-200 text-red-800',
};

export function SAILApprovalDashboard({
  tasks,
  onApprove,
  onReject,
  onRetry,
  onRefresh,
  isLoading,
}: SAILApprovalDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [filter, setFilter] = useState<'all' | 'review' | 'pending' | 'failed'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filteredTasks = tasks.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'review') return t.status === 'review';
    if (filter === 'pending') return t.status === 'pending' || t.status === 'assigned';
    if (filter === 'failed') return t.status === 'failed' || t.status === 'rejected';
    return true;
  });

  const handleApprove = async (taskId: string) => {
    setProcessingId(taskId);
    await onApprove(taskId, approveNotes || undefined);
    setProcessingId(null);
    setApproveNotes('');
    setExpandedId(null);
  };

  const handleReject = async (taskId: string) => {
    if (!rejectReason.trim()) return;
    setProcessingId(taskId);
    await onReject(taskId, rejectReason);
    setProcessingId(null);
    setRejectReason('');
    setExpandedId(null);
  };

  const handleRetry = async (taskId: string) => {
    setProcessingId(taskId);
    await onRetry(taskId);
    setProcessingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">SAIL Approval Dashboard</h2>
          {tasks.filter(t => t.status === 'review').length > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
              {tasks.filter(t => t.status === 'review').length}
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'review', 'pending', 'failed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              filter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-muted border-border'
            }`}
          >
            {f === 'all' ? 'All' : f === 'review' ? 'Needs Review' : f === 'pending' ? 'Queued' : 'Failed'}
            {f === 'review' && (
              <span className="ml-1">({tasks.filter(t => t.status === 'review').length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Task Table */}
      {filteredTasks.length === 0 ? (
        <div className="p-8 text-center rounded-lg border border-dashed border-border">
          <Shield className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {filter === 'review'
              ? 'No tasks awaiting review'
              : filter === 'failed'
              ? 'No failed tasks'
              : 'No tasks in queue'}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[auto,1fr,auto,auto,auto,auto] gap-3 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
            <div className="w-8">Agent</div>
            <div>Task</div>
            <div className="w-16 text-center">Priority</div>
            <div className="w-16 text-center">Risk</div>
            <div className="w-20 text-center">Status</div>
            <div className="w-20 text-center">Actions</div>
          </div>

          {/* Task Rows */}
          {filteredTasks.map((task) => {
            const AgentIcon = AGENT_ICONS[task.agent || 'debug'] || Bot;
            const isExpanded = expandedId === task.id;
            const isProcessing = processingId === task.id;

            return (
              <div key={task.id} className="border-b last:border-b-0">
                {/* Main Row */}
                <div
                  className="grid grid-cols-[auto,1fr,auto,auto,auto,auto] gap-3 p-3 items-center cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : task.id)}
                >
                  <div className="w-8">
                    <AgentIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{task.type} · {task.created_by}</p>
                  </div>
                  <div className="w-16 text-center">
                    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${PRIORITY_COLORS[task.priority] || ''}`}>
                      {task.priority.toUpperCase()}
                    </span>
                  </div>
                  <div className="w-16 text-center">
                    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${RISK_COLORS[task.risk_level] || ''}`}>
                      {task.risk_level === 'high' ? (
                        <span className="flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" />
                          HIGH
                        </span>
                      ) : task.risk_level.toUpperCase()}
                    </span>
                  </div>
                  <div className="w-20 text-center">
                    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded ${STATUS_COLORS[task.status] || ''}`}>
                      {task.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="w-20 text-center">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 mx-auto text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mx-auto text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 bg-muted/10">
                    <div className="p-3 rounded-lg bg-card border">
                      <p className="text-sm text-foreground">{task.description}</p>
                      {task.review_notes && (
                        <p className="text-xs text-muted-foreground mt-2">
                          <strong>Review Notes:</strong> {task.review_notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Created: {new Date(task.created_at).toLocaleString()} · Retries: {task.retry_count}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    {(task.status === 'review' || task.status === 'pending') && (
                      <div className="space-y-2">
                        {/* Approve */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Approval notes (optional)"
                            value={approveNotes}
                            onChange={(e) => setApproveNotes(e.target.value)}
                            className="flex-1 px-2 py-1.5 text-xs border rounded-md"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleApprove(task.id); }}
                            disabled={isProcessing}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        </div>

                        {/* Reject */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Rejection reason (required)"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="flex-1 px-2 py-1.5 text-xs border rounded-md"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleReject(task.id); }}
                            disabled={isProcessing || !rejectReason.trim()}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Retry for failed tasks */}
                    {(task.status === 'failed' || task.status === 'rejected') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRetry(task.id); }}
                        disabled={isProcessing}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-muted disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                        Retry Task
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
