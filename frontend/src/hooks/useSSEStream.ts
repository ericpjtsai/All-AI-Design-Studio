import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import type { ConfirmationPayload } from '../types';

/**
 * Opens a Server-Sent Events connection for the given session and wires all
 * incoming events to the Zustand store.
 *
 * Pass `sessionId = null` to keep the hook idle (no connection opened).
 */
export function useSSEStream(sessionId: string | null): void {
  const esRef = useRef<EventSource | null>(null);

  const {
    _updateAgent,
    _addActivity,
    _setPhase,
    _setPendingConfirmation,
    _setComplete,
    _setSessionError,
    _handleDesignOutput,
  } = useStore();

  useEffect(() => {
    if (!sessionId) return;

    const url = `/api/sessions/${sessionId}/events`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('agent_update', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      _updateAgent(payload);
    });

    es.addEventListener('activity', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      _addActivity(payload);
    });

    es.addEventListener('phase_change', (e: MessageEvent) => {
      const { phase } = JSON.parse(e.data);
      _setPhase(phase);
    });

    es.addEventListener('confirmation_prompt', (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as ConfirmationPayload;
      _setPendingConfirmation(payload);
    });

    es.addEventListener('design_output', (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      _handleDesignOutput(payload);
    });

    es.addEventListener('session_complete', () => {
      _setComplete();
      es.close();
    });

    es.addEventListener('session_error', (e: MessageEvent) => {
      const { message } = JSON.parse(e.data);
      _setSessionError(message);
      es.close();
    });

    es.onerror = () => {
      _setSessionError('Lost connection to backend. Is it running on port 8001?');
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [sessionId]);
}
