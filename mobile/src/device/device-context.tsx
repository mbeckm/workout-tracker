import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { track } from '@/analytics/analytics';
import {
  TRACKED_SHEETS,
  actionForCommand,
  deviceMode,
  deviceReducer,
  initialDeviceState,
  type DeviceCommand,
  type DeviceMode,
  type DeviceState,
  type JustFinished,
  type LogIntent,
  type SheetKind,
  type SheetParams,
  type UiMode,
} from '@/device/device-state';

type DeviceContextValue = {
  state: DeviceState;
  /** The mode on screen (PLAN §4.2). Home until Phase 4 feeds the log session's mode. */
  mode: DeviceMode;
  /** `{mode: 'log', planId, dayId, exerciseId?}` or `{sheet, params}`. */
  open: (command: DeviceCommand) => void;
  openSheet: (kind: SheetKind, params?: SheetParams) => void;
  /** Replaces the open sheet's content in place (‹ back, a row that opens its detail). */
  swapSheet: (kind: SheetKind, params?: SheetParams) => void;
  closeSheet: () => void;
  setUiMode: (mode: UiMode | null) => void;
  /** The log session calls this once it has opened `logIntent`. */
  consumeLogIntent: (intent: LogIntent) => void;
  /** After the receipt (Phase 5): Home stamps this day in and flickers its lamp. */
  markJustFinished: (dayId: string) => void;
  /** Home calls this once it has started the stamp. */
  clearJustFinished: (finished: JustFinished) => void;
  /** Leaves device edit (`open({mode: 'edit', …})`) and puts the editor sheet back. */
  leaveEdit: () => void;
};

const DeviceContext = createContext<DeviceContextValue | null>(null);

function trackSheet(kind: SheetKind) {
  if (TRACKED_SHEETS.includes(kind)) {
    track('sheet_opened', { sheet: kind });
  }
}

/** The device's UI state for everything under the root (the device, SheetHost, routes that command it). */
export function DeviceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(deviceReducer, initialDeviceState);

  const openSheet = useCallback((kind: SheetKind, params?: SheetParams) => {
    trackSheet(kind);
    dispatch({ type: 'openSheet', kind, params });
  }, []);
  const swapSheet = useCallback((kind: SheetKind, params?: SheetParams) => {
    trackSheet(kind);
    dispatch({ type: 'swapSheet', kind, params });
  }, []);
  const closeSheet = useCallback(() => dispatch({ type: 'closeSheet' }), []);
  const setUiMode = useCallback((mode: UiMode | null) => dispatch({ type: 'setUiMode', mode }), []);
  const consumeLogIntent = useCallback(
    (intent: LogIntent) => dispatch({ type: 'consumeLogIntent', id: intent.id }),
    [],
  );
  const markJustFinished = useCallback(
    (dayId: string) => dispatch({ type: 'markJustFinished', dayId }),
    [],
  );
  const clearJustFinished = useCallback(
    (finished: JustFinished) => dispatch({ type: 'clearJustFinished', id: finished.id }),
    [],
  );
  const leaveEdit = useCallback(() => dispatch({ type: 'leaveEdit' }), []);
  const open = useCallback((command: DeviceCommand) => {
    if ('sheet' in command) {
      trackSheet(command.sheet);
    }
    dispatch(actionForCommand(command));
  }, []);

  const value = useMemo<DeviceContextValue>(
    () => ({
      state,
      mode: deviceMode(state),
      open,
      openSheet,
      swapSheet,
      closeSheet,
      setUiMode,
      consumeLogIntent,
      markJustFinished,
      clearJustFinished,
      leaveEdit,
    }),
    [
      state,
      open,
      openSheet,
      swapSheet,
      closeSheet,
      setUiMode,
      consumeLogIntent,
      markJustFinished,
      clearJustFinished,
      leaveEdit,
    ],
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice(): DeviceContextValue {
  const value = useContext(DeviceContext);
  if (!value) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return value;
}
