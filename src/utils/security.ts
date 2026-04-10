// Security utilities for production readiness

// Import supabase client — must be at top so all functions below can use it
import { supabase } from '@/integrations/supabase/client';
import { logger } from "@/utils/logger";

export const security = {
  // Validate and sanitize user input
  sanitizeInput: (input: string): string => {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  },

  // Check if request is from a suspicious source
  isRequestSuspicious: (userAgent?: string, _referer?: string): boolean => {
    if (!userAgent) return true;
    
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /scraper/i,
      /spider/i,
      /curl/i,
      /wget/i,
      /python/i,
      /requests/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  },

  // Rate limiting check (client-side)
  checkRateLimit: (key: string, maxRequests: number = 60, windowMs: number = 60000): boolean => {
    const now = Date.now();
    const windowKey = `rate_limit_${key}_${Math.floor(now / windowMs)}`;
    
    try {
      const current = parseInt(localStorage.getItem(windowKey) || '0');
      if (current >= maxRequests) {
        return false; // Rate limit exceeded
      }
      
      localStorage.setItem(windowKey, (current + 1).toString());
      
      // Clean up old entries
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey?.startsWith('rate_limit_') && storageKey !== windowKey) {
          localStorage.removeItem(storageKey);
        }
      }
      
      return true;
    } catch {
      return true; // Allow if localStorage fails
    }
  },

  // Validate session and permissions
  validateSession: async (requiredRole?: 'admin' | 'tutor' | 'learner') => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session?.user) {
        return { valid: false, error: 'Not authenticated' };
      }

      if (requiredRole) {
        const { data: hasRole, error: roleError } = await supabase
          .rpc('has_role', { 
            _user_id: session.user.id, 
            _role: requiredRole as never
          });
        
        if (roleError || !hasRole) {
          return { valid: false, error: 'Insufficient permissions' };
        }
      }

      return { valid: true, session };
    } catch (error) {
      return { valid: false, error: 'Session validation failed' };
    }
  },

  // Log security events
  logSecurityEvent: async (action: string, details: Record<string, unknown> = {}) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.rpc('log_security_event', {
          _user_id: session.user.id,
          _action: action,
          _details: details as any,
          _ip_address: null,
          _user_agent: navigator.userAgent
        });
      }
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  },

  // Validate file uploads
  validateFileUpload: (file: File, allowedTypes: string[], maxSizeMB: number = 5): { valid: boolean; error?: string } => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'File type not allowed' };
    }

    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      return { valid: false, error: `File size must be less than ${maxSizeMB}MB` };
    }

    // Check for suspicious file names
    const suspiciousPatterns = [
      /\.exe$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.scr$/i,
      /\.php$/i,
      /\.jsp$/i,
      /\.asp$/i
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
      return { valid: false, error: 'File type not allowed for security reasons' };
    }

    return { valid: true };
  }
};
