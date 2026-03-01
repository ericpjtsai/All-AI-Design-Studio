import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import type { ConfirmationPayload } from '../types';

const MAX_RECONNECTS = 5;
const BASE_DELAY_MS = 1500;

/**
 * Opens a Server-Sent Events connection for the given session and wires all
 * incoming events to the Zustand store.
 *
 * Auto-reconnects on transient errors (e.g. Vite HMR reloads, network blips)
 * up to MAX_RECONNECTS times before giving up and surfacing an error.
 *
 * Pass `sessionId = null` to keep the hook idle (no connection opened).
 */
export function useSSEStream(sessionId: string | null): void {
  const esRef = useRef<EventSource | null>(null);
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable flag so cleanup can prevent scheduled reconnects
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    attemptsRef.current = 0;
    stoppedRef.current = false;

    function connect() {
      if (stoppedRef.current) return;

      const es = new EventSource(`/api/sessions/${sessionId}/events`);
      esRef.current = es;

      // ── Event handlers — use useStore.getState() to avoid stale closures ──

      es.addEventListener('agent_update', (e: MessageEvent) => {
        useStore.getState()._updateAgent(JSON.parse(e.data));
      });

      es.addEventListener('activity', (e: MessageEvent) => {
        useStore.getState()._addActivity(JSON.parse(e.data));
      });

      es.addEventListener('phase_change', (e: MessageEvent) => {
        const { phase } = JSON.parse(e.data);
        useStore.getState()._setPhase(phase);
        // Successful event resets reconnect counter
        attemptsRef.current = 0;
      });

      es.addEventListener('confirmation_prompt', (e: MessageEvent) => {
        const payload = JSON.parse(e.data) as ConfirmationPayload;
        useStore.getState()._setPendingConfirmation(payload);
        attemptsRef.current = 0;
      });

      es.addEventListener('design_output', (e: MessageEvent) => {
        useStore.getState()._handleDesignOutput(JSON.parse(e.data));
        attemptsRef.current = 0;
      });

      es.addEventListener('prototype_stream', (e: MessageEvent) => {
        const { delta } = JSON.parse(e.data) as { delta: string };
        useStore.getState()._appendStreamingPrototype(delta);
        attemptsRef.current = 0;
      });

      // Backend emits this immediately when confirm() is called so the client
      // clears the confirmation UI even if phase_change hasn't arrived yet.
      es.addEventListener('confirmation_cleared', () => {
        useStore.getState()._setPendingConfirmation(null);
        attemptsRef.current = 0;
      });

      es.addEventListener('session_complete', () => {
        stoppedRef.current = true; // no reconnect after clean completion
        useStore.getState()._setComplete();
        es.close();
      });

      es.addEventListener('session_error', (e: MessageEvent) => {
        stoppedRef.current = true; // backend says it's done — don't reconnect
        const { message } = JSON.parse(e.data);
        useStore.getState()._setSessionError(message);
        es.close();
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;

        if (stoppedRef.current) return;

        if (attemptsRef.current < MAX_RECONNECTS) {
          attemptsRef.current += 1;
          const delay = BASE_DELAY_MS * attemptsRef.current;
          timerRef.current = setTimeout(connect, delay);
        } else {
          // Exhausted reconnect budget — try state endpoint for recovery
          recoverFromStateEndpoint(sessionId!);
        }
      };
    }

    connect();

    return () => {
      stoppedRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      esRef.current?.close();
      esRef.current = null;
    };
  }, [sessionId]);
}

/**
 * Last-resort recovery: fetch /state endpoint to sync phase when SSE has
 * permanently failed (backend not running or network unreachable).
 */
async function recoverFromStateEndpoint(sessionId: string): Promise<void> {
  try {
    const res = await fetch(`/api/sessions/${sessionId}/state`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { status, current_phase } = await res.json();

    const store = useStore.getState();

    if (status === 'error') {
      store._setSessionError('Backend session failed. Please start a new session.');
      return;
    }

    if (status === 'complete') {
      store._setComplete();
      return;
    }

    // Sync the phase so the UI un-sticks
    if (current_phase) {
      store._setPhase(current_phase as Parameters<typeof store._setPhase>[0]);
      store._addActivity({
        agentIndex: 0,
        message: 'Connection restored. Synced session state.',
        level: 'info',
      });
    }
  } catch {
    useStore.getState()._setSessionError(
      'Lost connection to backend. Is it running on port 8001?',
    );
  }
}
