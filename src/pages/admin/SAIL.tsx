import { useState } from "react";
import { useSAILTasks, SAILTask } from "@/hooks/useSAILTasks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Bot, Bug, Palette, Database, GraduationCap, DollarSign,
  ShieldCheck, CheckCircle2, XCircle, Clock, AlertTriangle,
  Activity, Zap, Eye
} from "lucide-react";

const agentIcons: Record<string, React.ElementType> = {
  debug: Bug, frontend: Palette, backend: Database,
  learning: GraduationCap, monetization: DollarSign, reviewer: ShieldCheck,
};

const riskColors: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  high: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/10 text-blue-600",
  review: "bg-amber-500/10 text-amber-600",
  approved: "bg-emerald-500/10 text-emerald-600",
  rejected: "bg-destructive/10 text-destructive",
  deployed: "bg-primary/10 text-primary",
};

const SAILDashboard = () => {
  const { tasks, events, agentLogs, approveTask, rejectTask, triggerAgent } = useSAILTasks();
  const [selectedTask, setSelectedTask] = useState<SAILTask | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const taskList = tasks.data || [];
  const eventList = events.data || [];
  const logList = agentLogs.data || [];

  const pendingApproval = taskList.filter(t => t.status === "review" && t.approval_required);
  const activeAgents = taskList.filter(t => t.status === "in_progress");

  const handleApprove = async (taskId: string) => {
    try {
      await approveTask.mutateAsync(taskId);
      toast({ title: "Task approved", description: "The agent patch has been approved for deployment." });
    } catch {
      toast({ title: "Error", description: "Failed to approve task", variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!selectedTask) return;
    try {
      await rejectTask.mutateAsync({ taskId: selectedTask.id, reason: rejectReason });
      toast({ title: "Task rejected", description: "The patch has been rejected." });
      setShowRejectDialog(false);
      setRejectReason("");
      setSelectedTask(null);
    } catch {
      toast({ title: "Error", description: "Failed to reject task", variant: "destructive" });
    }
  };

  const handleManualTrigger = async (eventType: string) => {
    try {
      await triggerAgent.mutateAsync({
        event_type: eventType,
        source: "manual",
        severity: "low",
        data: { triggered_by: "admin_dashboard" },
      });
      toast({ title: "Agent triggered", description: `${eventType} detection cycle started.` });
    } catch {
      toast({ title: "Error", description: "Failed to trigger agent", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" /> SAIL — Autonomous Intelligence
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor and control the StudySync Autonomous Intelligence Layer
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Awaiting Approval</span>
            </div>
            <p className="text-2xl font-bold mt-1">{pendingApproval.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Active Agents</span>
            </div>
            <p className="text-2xl font-bold mt-1">{activeAgents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Events (24h)</span>
            </div>
            <p className="text-2xl font-bold mt-1">{eventList.filter(e => new Date(e.created_at) > new Date(Date.now() - 86400000)).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Deployed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{taskList.filter(t => t.status === "deployed").length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Manual Triggers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Manual Agent Triggers</CardTitle>
          <CardDescription>Run detection cycles manually</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {["error", "user_behavior", "learning", "revenue"].map(type => (
            <Button key={type} variant="outline" size="sm" onClick={() => handleManualTrigger(type)}
              disabled={triggerAgent.isPending} className="capitalize">
              {type.replace("_", " ")} Scan
            </Button>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Task Queue</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="logs">Agent Logs</TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No tasks yet. Trigger a scan or wait for automatic detection.
                      </TableCell>
                    </TableRow>
                  ) : taskList.map(task => {
                    const AgentIcon = agentIcons[task.agent] || Bot;
                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{task.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{task.type}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <AgentIcon className="h-3.5 w-3.5" />
                            <span className="text-xs capitalize">{task.agent}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={riskColors[task.risk_level]}>
                            {task.risk_level === "high" && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {task.risk_level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusColors[task.status]}>
                            {task.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {task.status === "review" && (
                              <>
                                <Button size="sm" variant="default" className="h-7 text-xs"
                                  onClick={() => handleApprove(task.id)}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" className="h-7 text-xs"
                                  onClick={() => { setSelectedTask(task); setShowRejectDialog(true); }}>
                                  <XCircle className="h-3 w-3 mr-1" /> Reject
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => setSelectedTask(task)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No events captured yet.
                      </TableCell>
                    </TableRow>
                  ) : eventList.map(evt => (
                    <TableRow key={evt.id}>
                      <TableCell className="capitalize text-sm">{evt.event_type}</TableCell>
                      <TableCell className="text-sm">{evt.source}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={riskColors[evt.severity]}>{evt.severity}</Badge>
                      </TableCell>
                      <TableCell>{evt.processed ? "✓" : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(evt.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agent Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No agent logs yet.
                      </TableCell>
                    </TableRow>
                  ) : logList.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="capitalize text-sm">{log.agent}</TableCell>
                      <TableCell className="text-sm">{log.action}</TableCell>
                      <TableCell>
                        {log.success ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">Success</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive">Failed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{log.duration_ms ? `${log.duration_ms}ms` : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Task Detail Dialog */}
      {selectedTask && !showRejectDialog && (
        <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {(() => { const I = agentIcons[selectedTask.agent] || Bot; return <I className="h-4 w-4" />; })()}
                {selectedTask.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <Badge variant="outline" className={riskColors[selectedTask.risk_level]}>{selectedTask.risk_level} risk</Badge>
                <Badge variant="secondary" className={statusColors[selectedTask.status]}>{selectedTask.status}</Badge>
                <Badge variant="outline" className="capitalize">{selectedTask.type}</Badge>
              </div>
              <p className="text-muted-foreground">{selectedTask.description}</p>
              {selectedTask.code_patch && (
                <div>
                  <p className="font-medium mb-1">Code Patch:</p>
                  <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-60">{selectedTask.code_patch}</pre>
                </div>
              )}
              {selectedTask.rejection_reason && (
                <div className="bg-destructive/5 p-3 rounded border border-destructive/20">
                  <p className="font-medium text-destructive text-xs">Rejection Reason:</p>
                  <p className="text-xs mt-1">{selectedTask.rejection_reason}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Task</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Reason for rejection..." value={rejectReason}
            onChange={e => setRejectReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SAILDashboard;
