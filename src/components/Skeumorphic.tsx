'use client';

import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface SkeuCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function SkeuCard({ children, className, onClick, hover = true }: SkeuCardProps) {
  return (
    <motion.div
      whileHover={hover ? { scale: 1.02, translateY: -2 } : {}}
      whileTap={hover ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={cn(
        'bg-[#1a1a1a] rounded-2xl p-4 transition-all duration-200',
        'border border-[#333] shadow-[8px_8px_16px_#0a0a0a,-8px_-8px_16px_#2a2a2a]',
        hover &&
          'cursor-pointer active:shadow-[inset_4px_4px_8px_#0a0a0a,inset_-4px_-4px_8px_#2a2a2a]',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

export function SkeuInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'bg-[#151515] text-white rounded-xl px-4 py-3 outline-none w-full',
        'shadow-[inset_4px_4px_8px_#0a0a0a,inset_-4px_-4px_8px_#252525]',
        'border border-[#333] focus:border-[#444] transition-all',
        props.className
      )}
    />
  );
}

export function SkeuButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'bg-[#222] text-[#4ea8de] font-bold py-3 px-6 rounded-xl transition-all',
        'border border-[#333] shadow-[4px_4px_8px_#0a0a0a,-2px_-2px_6px_#333]',
        'hover:shadow-[6px_6px_12px_#050505,-4px_-4px_10px_#3a3a3a]',
        'active:shadow-[inset_4px_4px_8px_#0a0a0a,inset_-4px_-4px_8px_#252525]',
        'active:translate-y-[1px]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  );
}
