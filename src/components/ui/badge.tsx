'use client';

import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const variantStyles = {
  green: 'bg-accent-green/15 text-accent-green border-accent-green/30',
  red: 'bg-accent-red/15 text-accent-red border-accent-red/30',
  amber: 'bg-accent-amber/15 text-accent-amber border-accent-amber/30',
  gray: 'bg-dark-700/50 text-dark-400 border-dark-700',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variantStyles;
}

function Badge({ className, variant = 'gray', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge, type BadgeProps };
