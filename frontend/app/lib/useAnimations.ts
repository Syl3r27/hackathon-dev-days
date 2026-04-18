'use client';
import { useEffect, RefObject } from 'react';

/**
 * General purpose hook to smoothly fade in a single element.
 */
export function useFadeIn(ref: RefObject<HTMLElement | null>, params?: { duration?: number, y?: number }) {
  useEffect(() => {
    if (!ref.current) return;
    let ctx: any;
    import('gsap').then(({ gsap }) => {
      ctx = gsap.context(() => {
        gsap.fromTo(ref.current, 
          { opacity: 0, y: params?.y || 0 }, 
          { opacity: 1, y: 0, duration: params?.duration || 1.0, ease: 'power2.out' }
        );
      }, ref);
    });
    return () => ctx?.revert();
  }, [ref, params?.duration, params?.y]);
}

/**
 * Hook to fade in a container, followed by a staggered entrance of listed sub-elements.
 */
export function useStaggerFadeIn(
  containerRef: RefObject<HTMLElement | null>, 
  elementsConfigs: { selector: string, x?: number, y?: number, stagger?: number }[], 
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    let ctx: any;

    import('gsap').then(({ gsap }) => {
      ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power4.out', duration: 1.0 } });
        tl.fromTo(containerRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0 });
        
        elementsConfigs.forEach(conf => {
           tl.fromTo(
             conf.selector, 
             { x: conf.x || 0, y: conf.y || 0, opacity: 0 }, 
             { x: 0, y: 0, opacity: 1, stagger: conf.stagger || 0 }, 
             '-=0.8'
           );
        });
      }, containerRef);
    });
    
    return () => ctx?.revert();
  }, [containerRef, enabled, JSON.stringify(elementsConfigs)]);
}
