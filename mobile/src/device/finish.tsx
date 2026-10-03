import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { deviceColors, finishColors, type FinishColors } from '@/constants/theme';
import type { Finish } from '@/domain/finish';
import { useWorkoutStore } from '@/store/workout-store';

/** Everything a device part paints with: the finish's own colours plus the shared ones. */
export type DevicePalette = FinishColors & typeof deviceColors;

type FinishContextValue = {
  /** The finish on screen: the preview while one is set, otherwise the saved finish. */
  finish: Finish;
  palette: DevicePalette;
  /** The saved finish (the store's). */
  savedFinish: Finish;
  /** A transient finish shown without saving (D3: a locked swatch). `null` reverts. */
  preview: Finish | null;
  setPreview: (finish: Finish | null) => void;
};

const FinishContext = createContext<FinishContextValue | null>(null);

export function paletteFor(finish: Finish): DevicePalette {
  return { ...deviceColors, ...finishColors[finish] };
}

const PALETTES: Record<Finish, DevicePalette> = {
  '212': paletteFor('212'),
  '101': paletteFor('101'),
  '305': paletteFor('305'),
  '408': paletteFor('408'),
};

/**
 * Supplies the device palette for the current finish. `override` pins a finish regardless of
 * the store (the dev gallery's side-by-side finishes).
 */
export function FinishProvider({ children, override }: { children: ReactNode; override?: Finish }) {
  const { finish: savedFinish } = useWorkoutStore();
  const [preview, setPreview] = useState<Finish | null>(null);
  const finish = override ?? preview ?? savedFinish;

  const value = useMemo<FinishContextValue>(
    () => ({ finish, palette: PALETTES[finish], savedFinish, preview, setPreview }),
    [finish, savedFinish, preview],
  );

  return <FinishContext.Provider value={value}>{children}</FinishContext.Provider>;
}

export function useFinish(): FinishContextValue {
  const value = useContext(FinishContext);
  if (!value) {
    throw new Error('useFinish must be used within a FinishProvider');
  }
  return value;
}
