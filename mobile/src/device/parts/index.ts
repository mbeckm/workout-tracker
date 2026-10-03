/** Device primitives (PLAN Phase 1, SPEC §4). Layout is the caller's; these draw and press. */
export { BigKey, type BigKeyVariant } from './big-key';
export { DeviceBody } from './device-body';
export { Display } from './display';
export { Drum, type DrumNudge } from './drum';
export { EngravedLabel } from './engraved-label';
export { HistoryGlyph, ListGlyph, MenuGlyph } from './glyphs';
export { HoldRing } from './hold-ring';
export { Lamp, type LampState, type LampSurface } from './lamp';
export { RoundKey, TallKey, type KeyText, type RaisedKeyProps } from './raised-key';
export { LampPlate, Rocker, type RockerProps } from './rocker';
export { Well } from './well';
export { Wheel, type NotchResult } from './wheel';
