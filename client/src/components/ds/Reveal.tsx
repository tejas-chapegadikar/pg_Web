import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Fades and slides its content up the first time it scrolls into view (styles: .reveal in index.css) */
export function Reveal({
  delay = 0,
  className,
  children,
}: {
  /** Milliseconds to wait after it comes into view — use small steps to stagger a row */
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Start just before it's fully on screen so the motion is seen, not missed
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn('reveal', visible && 'is-visible', className)}
      style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
