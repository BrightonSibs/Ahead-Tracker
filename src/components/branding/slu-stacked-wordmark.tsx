import { cn } from '@/lib/utils';
import { SluShield } from './slu-shield';

type SluStackedWordmarkProps = {
  className?: string;
  shieldClassName?: string;
  compact?: boolean;
};

export function SluStackedWordmark({ className, shieldClassName, compact = false }: SluStackedWordmarkProps) {
  return (
    <div className={cn('flex flex-col items-center text-center text-brand-600', className)}>
      <SluShield className={cn(compact ? 'h-16 w-11' : 'h-24 w-16', shieldClassName)} />
      <div className={cn('font-display uppercase leading-none tracking-[0.18em] text-brand-600', compact ? 'mt-2 text-[22px] font-bold sm:text-[28px]' : 'mt-3 text-[28px] font-bold sm:text-[34px]')}>
        Saint Louis
      </div>
      <div className={cn('font-display uppercase leading-none tracking-[0.18em] text-brand-600', compact ? 'mt-1.5 text-[22px] font-bold sm:text-[28px]' : 'mt-2 text-[28px] font-bold sm:text-[34px]')}>
        University
      </div>
      <div className={cn('flex w-full items-center justify-center text-brand-600', compact ? 'mt-2 max-w-[13rem] gap-2' : 'mt-3 max-w-[16rem] gap-3')}>
        <span className={cn(compact ? 'h-1 w-8' : 'h-1 w-10', 'bg-brand-600')} />
        <span className={cn('font-display uppercase tracking-[0.24em]', compact ? 'text-sm font-bold sm:text-base' : 'text-base font-bold sm:text-lg')}>Est. 1818</span>
        <span className={cn(compact ? 'h-1 w-8' : 'h-1 w-10', 'bg-brand-600')} />
      </div>
    </div>
  );
}
