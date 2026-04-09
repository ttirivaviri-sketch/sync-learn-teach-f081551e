import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SAILTask {
  id: string;
  type: string;
  priority: string;
  status: string;
  agent: string;
  title: string;
  description: string;
  context: Record<string, unknown>;
  code_patch: string | null;
  risk_level: string;
  approval_required: boolean;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SAILEvent {
  id: string;
  event_type: string;
  source: string;
  severity: string;
  payload: Record<string, unknown>;
  task_id: string | null;
  processed: boolean;
  created_at: string;
}

export interface SAILAgentLog {
  id: string;
  task_id: string;
  agent: string;
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  duration_ms: number | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export const useSAILTasks = () => {
  const queryClient = useQueryClient();

  const tasks = useQuery({
    queryKey: ['sail-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sail_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SAILTask[];
    },
  });

  const events = useQuery({
    queryKey: ['sail-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sail_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as SAILEvent[];
    },
  });

  const agentLogs = useQuery({
    queryKey: ['sail-agent-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sail_agent_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as SAILAgentLog[];
    },
  });

  const approveTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('sail_tasks')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sail-tasks'] }),
  });

  const rejectTask = useMutation({
    mutationFn: async ({ taskId, reason }: { taskId: string; reason: string }) => {
      const { error } = await supabase
        .from('sail_tasks')
        .update({ status: 'rejected', rejection_reason: reason })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sail-tasks'] }),
  });

  const triggerAgent = useMutation({
    mutationFn: async (payload: { event_type: string; source: string; severity: string; data: Record<string, unknown> }) => {
      const { data, error } = await supabase.functions.invoke('sail-agent', {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sail-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['sail-events'] });
    },
  });

  return { tasks, events, agentLogs, approveTask, rejectTask, triggerAgent };
};
