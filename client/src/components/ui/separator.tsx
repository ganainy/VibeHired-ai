import React from 'react';
import { cn } from '../../lib/utils';

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
 orientation?: 'horizontal' | 'vertical';
 decorative?: boolean;
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
 ({ className = '', orientation = 'horizontal', decorative = true, ...props }, ref) => {
 const classes = orientation === 'horizontal' 
 ? 'h-[1px] w-full bg-gray-200'
 : 'h-full w-[1px] bg-gray-200';
 
 return (
 <div
 ref={ref}
 className={cn('shrink-0', classes, className)}
 role={decorative ? 'none' : 'separator'}
 {...props}
 />
 );
 }
);

Separator.displayName = 'Separator';

