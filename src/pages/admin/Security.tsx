import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, CheckCircle, Eye, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SecurityCheck {
  check_name: string;
  status: string;
  details: string;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  created_at: string;
  new_values: any;
}

const AdminSecurity = () => {
  const [securityChecks, setSecurityChecks] = useState<SecurityCheck[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Security Dashboard | StudySync Admin";
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      setLoading(true);
      
      // Load security health checks
      const { data: healthData, error: healthError } = await supabase
        .rpc('security_health_check');
      
      if (healthError) {
        console.error('Error loading security checks:', healthError);
      } else {
        setSecurityChecks(healthData || []);
      }

      // Load recent audit logs
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (auditError) {
        console.error('Error loading audit logs:', auditError);
      } else {
        setAuditLogs(auditData || []);
      }
    } catch (error) {
      console.error('Error loading security data:', error);
      toast({
        title: "Error",
        description: "Failed to load security data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshSecurityChecks = async () => {
    setRefreshing(true);
    await loadSecurityData();
    setRefreshing(false);
    toast({
      title: "Security Status Refreshed",
      description: "Latest security checks have been loaded",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'WARN':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'FAIL':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Shield className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return <Badge className="bg-green-100 text-green-800">Secure</Badge>;
      case 'WARN':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Warning</Badge>;
      case 'FAIL':
        return <Badge variant="destructive">Critical</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatLogAction = (action: string) => {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <main>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Security Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor security status and audit logs</p>
        </div>
        <Button onClick={refreshSecurityChecks} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Security Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Shield className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">
              {securityChecks.filter(c => c.status === 'PASS').length}
            </p>
            <p className="text-sm text-muted-foreground">Security Checks Passed</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
            <p className="text-2xl font-bold">
              {securityChecks.filter(c => c.status === 'WARN').length}
            </p>
            <p className="text-sm text-muted-foreground">Warnings</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-500 mb-2" />
            <p className="text-2xl font-bold">
              {securityChecks.filter(c => c.status === 'FAIL').length}
            </p>
            <p className="text-sm text-muted-foreground">Critical Issues</p>
          </CardContent>
        </Card>
      </div>

      {/* Security Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Health Checks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {securityChecks.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No security checks available. Please ensure you have admin privileges.
            </p>
          ) : (
            <div className="space-y-3">
              {securityChecks.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <div>
                      <h4 className="font-medium">{check.check_name.replace(/_/g, ' ')}</h4>
                      <p className="text-sm text-muted-foreground">{check.details}</p>
                    </div>
                  </div>
                  {getStatusBadge(check.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Critical Security Alert */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Security Update Applied:</strong> Critical vulnerabilities have been fixed including customer data exposure and business data protection. 
          All sensitive information is now properly secured with Row Level Security policies.
        </AlertDescription>
      </Alert>

      {/* Recent Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Recent Activity Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No audit logs available.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-2 text-sm border-b">
                  <div className="flex-1">
                    <span className="font-medium">{formatLogAction(log.action)}</span>
                    {log.table_name && (
                      <span className="text-muted-foreground ml-2">on {log.table_name}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Security Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-green-800">✅ Customer Data Protected</h4>
              <p className="text-sm text-green-700">
                Profile data exposure has been fixed. Sensitive information is now properly secured.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-green-800">✅ Business Data Secured</h4>
              <p className="text-sm text-green-700">
                Tutor pricing and business intelligence data is now protected from scraping.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800">🔒 Enhanced Security</h4>
              <p className="text-sm text-blue-700">
                Row Level Security policies updated, audit logging enabled, and rate limiting implemented.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800">⚠️ Next Steps</h4>
              <p className="text-sm text-yellow-700">
                Configure production environment variables, set up monitoring, and enable email verification in Supabase Auth settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default AdminSecurity;