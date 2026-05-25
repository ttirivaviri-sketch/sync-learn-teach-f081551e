import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Mail, Phone, Calendar, Ban, ShieldCheck, ShieldOff, MoreHorizontal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/utils/logger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const Users = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userType, setUserType] = useState<"all" | "learner" | "tutor">("all");
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Admin Users | StudySync";
    loadUsers();
  }, [userType]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (userType !== 'all') {
        query = query.eq('user_type', userType);
      }

      const { data: profiles, error } = await query;
      if (error) throw error;

      // Fetch roles separately — no FK exists between profiles and user_roles,
      // so PostgREST embedding fails and returns no rows.
      const ids = (profiles ?? []).map((p: any) => p.id);
      let rolesByUser: Record<string, { role: string }[]> = {};
      if (ids.length > 0) {
        const { data: roles, error: rolesErr } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', ids);
        if (rolesErr) {
          logger.warn('Could not load user roles:', rolesErr.message);
        } else {
          for (const r of (roles ?? []) as { user_id: string; role: string }[]) {
            (rolesByUser[r.user_id] ||= []).push({ role: r.role });
          }
        }
      }

      setUsers(
        (profiles ?? []).map((p: any) => ({ ...p, user_roles: rolesByUser[p.id] ?? [] }))
      );
    } catch (error) {
      logger.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSuspend = async (user: any) => {
    const next = !user.is_suspended;
    let reason: string | null = null;
    if (next) {
      reason = window.prompt('Reason for suspension (shown to the user):', 'Violation of terms') || 'Suspended by admin';
    }
    const { error } = await supabase
      .from('profiles')
      .update({
        is_suspended: next,
        suspended_at: next ? new Date().toISOString() : null,
        suspended_reason: next ? reason : null,
      })
      .eq('id', user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: next ? "User suspended" : "User reinstated" });
    loadUsers();
  };

  const grantAdmin = async (user: any) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: user.id, role: 'admin' });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Admin role granted" });
    loadUsers();
  };

  const revokeAdmin = async (user: any) => {
    const { error } = await supabase.from('user_roles').delete().eq('user_id', user.id).eq('role', 'admin');
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Admin role revoked" });
    loadUsers();
  };

  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <p className="text-muted-foreground mt-1">Manage learners and tutors</p>

      <div className="mt-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={loadUsers} variant="outline">Refresh</Button>
      </div>

      <Tabs value={userType} onValueChange={(v) => setUserType(v as "all" | "learner" | "tutor")} className="mt-4">
        <TabsList>
          <TabsTrigger value="all">All Users</TabsTrigger>
          <TabsTrigger value="learner">Learners</TabsTrigger>
          <TabsTrigger value="tutor">Tutors</TabsTrigger>
        </TabsList>

        <TabsContent value={userType} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Phone</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Joined</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No users found</td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const isAdmin = user.user_roles?.some((r: any) => r.role === 'admin');
                        return (
                        <tr key={user.id} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-3 text-sm font-medium">
                            <div className="flex items-center gap-2">
                              {user.full_name || 'N/A'}
                              {isAdmin && <Badge variant="destructive" className="text-[10px]">admin</Badge>}
                              {user.is_suspended && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-destructive text-destructive"
                                  title={user.suspended_reason || 'Suspended'}
                                >
                                  suspended
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {user.email}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {user.phone ? (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {user.phone}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant={user.user_type === 'tutor' ? 'default' : 'secondary'}>
                              {user.user_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant={user.online_status ? 'default' : 'outline'}>
                              {user.online_status ? 'Online' : 'Offline'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => toggleSuspend(user)}>
                                  {user.is_suspended ? (
                                    <><ShieldCheck className="h-4 w-4 mr-2" /> Reinstate</>
                                  ) : (
                                    <><Ban className="h-4 w-4 mr-2" /> Suspend</>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {isAdmin ? (
                                  <DropdownMenuItem onClick={() => revokeAdmin(user)} className="text-destructive">
                                    <ShieldOff className="h-4 w-4 mr-2" /> Revoke admin
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => grantAdmin(user)}>
                                    <ShieldCheck className="h-4 w-4 mr-2" /> Make admin
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default Users;
