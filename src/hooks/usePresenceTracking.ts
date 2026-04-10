import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from "@/utils/logger";

interface PresenceState {
  user_id: string;
  full_name: string;
  user_type: 'tutor' | 'learner';
  online_at: string;
  last_seen: string;
}

export const usePresenceTracking = (session: Session | null) => {
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!session?.user) return;

    // Create a presence channel for online status tracking
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: session.user.id,
        },
      },
    });

    channelRef.current = channel;

    // Track user presence state
    const presenceState: PresenceState = {
      user_id: session.user.id,
      full_name: session.user.user_metadata?.full_name || session.user.email || 'User',
      user_type: session.user.user_metadata?.user_type || 'learner',
      online_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };

    // Set up presence tracking
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const users: PresenceState[] = [];
        
        Object.values(newState).forEach((presences: any) => {
          presences.forEach((presence: PresenceState) => {
            users.push(presence);
          });
        });
        
        setOnlineUsers(users);
        logger.info('Presence sync - online users:', users.length);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        logger.info('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        logger.info('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Presence channel subscribed, tracking user:', presenceState);
          
          // Track this user's presence
          const trackStatus = await channel.track(presenceState);
          logger.info('Presence track status:', trackStatus);

          // Update database with online status
          await updateDatabaseOnlineStatus(true);
        }
      });

    // Update presence every 30 seconds to maintain active status
    const heartbeatInterval = setInterval(async () => {
      if (channelRef.current) {
        const updatedState = {
          ...presenceState,
          last_seen: new Date().toISOString(),
        };
        await channelRef.current.track(updatedState);
        logger.info('Presence heartbeat sent');
      }
    }, 30000);

    // Cleanup function
    return () => {
      clearInterval(heartbeatInterval);
      updateDatabaseOnlineStatus(false);
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [session]);

  const updateDatabaseOnlineStatus = async (isOnline: boolean) => {
    if (!session?.user?.id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          online_status: isOnline,
          last_seen: new Date().toISOString()
        })
        .eq('id', session.user.id);

      if (error) {
        logger.error('Error updating database online status:', error);
      } else {
        logger.info('Database online status updated:', isOnline);
      }
    } catch (error) {
      logger.error('Error updating online status:', error);
    }
  };

  const setOnlineStatus = async (isOnline: boolean) => {
    if (!session?.user || !channelRef.current) return;

    try {
      // Update presence state
      const updatedState: PresenceState = {
        user_id: session.user.id,
        full_name: session.user.user_metadata?.full_name || session.user.email || 'User',
        user_type: session.user.user_metadata?.user_type || 'learner',
        online_at: isOnline ? new Date().toISOString() : '',
        last_seen: new Date().toISOString(),
      };

      if (isOnline) {
        await channelRef.current.track(updatedState);
        logger.info('User went online');
      } else {
        await channelRef.current.untrack();
        logger.info('User went offline');
      }

      // Update database
      await updateDatabaseOnlineStatus(isOnline);
    } catch (error) {
      logger.error('Error setting online status:', error);
    }
  };

  const getOnlineTutors = (): PresenceState[] => {
    return onlineUsers.filter(user => user.user_type === 'tutor' && user.online_at);
  };

  const getOnlineLearners = (): PresenceState[] => {
    return onlineUsers.filter(user => user.user_type === 'learner' && user.online_at);
  };

  const isUserOnline = (userId: string): boolean => {
    return onlineUsers.some(user => user.user_id === userId && user.online_at);
  };

  return {
    onlineUsers,
    onlineTutors: getOnlineTutors(),
    onlineLearners: getOnlineLearners(),
    setOnlineStatus,
    isUserOnline,
  };
};