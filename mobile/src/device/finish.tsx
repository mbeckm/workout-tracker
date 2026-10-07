import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  devicePalette,
  screenColors,
  type DevicePalette,
  type ScreenColors,
} from '@/constants/theme';
import { FINISHES, type Finish } from '@/domain/finish';
import { useWorkoutStore } from '@/store/workout-store';

export type { DevicePalette } from '@/constants/theme';

type FinishContextValue = {
  /** The finish on screen: the preview while one is set, otherwise the saved finish. */
  finish: Finish;
  palette: DevicePalette;
  /** The machine's screen (decision 80: a finish is a body and its screen, never mixed). */
  screen: ScreenColors;
  /** The saved finish (the store's). */
  savedFinish: Finish;
  /** A transient finish shown without saving (D3: a locked swatch). `null` reverts. */
  preview: Finish | null;
  setPreview: (finish: Finish | null) => void;
};

const FinishContext = createContext<FinishContextValue | null>(null);

export function paletteFor(finish: Finish): DevicePalette {
  return PALETTES[finish];
}

const PALETTES = Object.fromEntries(FINISHES.map((id) => [id, devicePalette(id)])) as Record<
  Finish,
  DevicePalette
>;

/**
 * Supplies the device palette and screen for the current finish. `override` pins a finish
 * regardless of the store (the dev gallery's side-by-side finishes).
 */
export function FinishProvider({ children, override }: { children: ReactNode; override?: Finish }) {
  const { finish: savedFinish } = useWorkoutStore();
  const [preview, setPreview] = useState<Finish | null>(null);
  const finish = override ?? preview ?? savedFinish;

  const value = useMemo<FinishContextValue>(() => {
    const palette = PALETTES[finish];
    return { finish, palette, screen: screenColors[palette.screen], savedFinish, preview, setPreview };
  }, [finish, savedFinish, preview]);

  return <FinishContext.Provider value={value}>{children}</FinishContext.Provider>;
}

export function useFinish(): FinishContextValue {
  const value = useContext(FinishContext);
  if (!value) {
    throw new Error('useFinish must be used within a FinishProvider');
  }
  return value;
}

/** The display's colours for the machine on screen. */
export function useScreen(): ScreenColors {
  return useFinish().screen;
}
