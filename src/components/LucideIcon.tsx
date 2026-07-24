import React from 'react';
import * as Icons from 'lucide-react';

interface LucideIconProps {
  name: string;
  className?: string;
  size?: number;
}

export default function LucideIcon({ name, className = '', size }: LucideIconProps) {
  // Resolve icon by name, fallback to HelpCircle if not found
  const IconComponent = (Icons as any)[name];
  
  if (!IconComponent) {
    // If exact name is not found, map custom values or fallback
    if (name === 'ShieldAlert') {
      const Fallback = Icons.ShieldAlert || Icons.Shield;
      return <Fallback className={className} size={size} />;
    }
    const SafeIcon = Icons.HelpCircle;
    return <SafeIcon className={className} size={size} />;
  }

  return <IconComponent className={className} size={size} />;
}
