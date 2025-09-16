import React from 'react';
import { Badge } from '@/components/ui/badge';

interface OnlineStatusProps {
  isOnline: boolean;
  lastSeen?: string;
  showDot?: boolean;
  className?: string;
}

export const OnlineStatus: React.FC<OnlineStatusProps> = ({
  isOnline,
  lastSeen,
  showDot = true,
  className = ''
}) => {
  const formatLastSeen = (lastSeenDate?: string): string => {
    if (!lastSeenDate) return 'Last seen recently';
    
    const date = new Date(lastSeenDate);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'Online now';
    if (diffInMinutes < 60) return `Last seen ${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `Last seen ${Math.floor(diffInMinutes / 60)}h ago`;
    
    return 'Last seen recently';
  };

  if (isOnline) {
    return (
      <Badge variant="outline" className={`text-xs ${className}`}>
        {showDot && <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>}
        Online now
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={`text-xs ${className}`}>
      {showDot && <div className="w-2 h-2 bg-gray-400 rounded-full mr-1"></div>}
      {formatLastSeen(lastSeen)}
    </Badge>
  );
};