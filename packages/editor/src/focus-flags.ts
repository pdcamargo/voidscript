/**
 * Focus detection flags for EditorPanel
 */
export enum EditorPanelFocusFlags {
  /** Only this window (default) */
  Window = 0,
  /** This window and all child windows */
  RootAndChildWindows = 1,
  /** Any window in the hierarchy */
  AnyWindow = 2,
}
