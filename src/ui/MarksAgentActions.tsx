/**
 * MarksAgentActions — serves MnemoMarks' agent actions (doc 149) while this window is open.
 *
 * A CHILD that renders nothing, never a hook in App: App is mounted on the person's board while
 * the app runs, and a hook added to it breaks the order of its hooks under hot reload. The
 * handlers live in `lib/marksAgent.ts`; this only keeps their view of the window fresh (a ref
 * written every render) and subscribes ONCE.
 */
import { useEffect, useRef } from 'react';
import { sdk } from '../lib/host';
import { marksAgentHandlers, searchControl, type MarksAgentContext } from '../lib/marksAgent';

export function MarksAgentActions(props: Omit<MarksAgentContext, 'search' | 'now'>) {
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    // Outside the shell nobody calls (a plain tab, the tests): no subscription.
    if (typeof window === 'undefined' || window.parent === window) return undefined;
    if (typeof sdk.onAgentActions !== 'function') {
      // An iframe served an older SDK build: it must not take the window down.
      console.warn('[mnemo-marks] this SDK build has no onAgentActions; reload the cartridge to serve agent actions');
      return undefined;
    }
    const sub = sdk.onAgentActions(marksAgentHandlers(() => ({ ...latest.current, search: searchControl.current, now: Date.now() })));
    sub.ready.catch((err: unknown) => console.warn('[mnemo-marks] agent actions not served:', err instanceof Error ? err.message : err));
    return () => sub.off();
  }, []);

  return null;
}
