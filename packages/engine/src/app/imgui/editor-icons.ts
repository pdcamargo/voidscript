/**
 * Editor Icons - Material Symbols icon definitions for ImGui
 *
 * Uses Material Symbols font (Unicode Private Use Area: 0xE000-0xF8FF)
 */

// Material Symbols Unicode range
export const ICON_MIN = 0xe000;
export const ICON_MAX = 0xf8ff;

// Glyph range for ImGui (array format: [start, end, 0])
export const ICON_RANGES: number[] = [ICON_MIN, ICON_MAX, 0];

// Common editor icons mapped to Unicode strings
export const EDITOR_ICONS = {
  // Playback controls
  PLAY: '\uE037', // play_arrow
  PAUSE: '\uE034', // pause
  STOP: '\uE047', // stop
  SKIP_NEXT: '\uE044', // skip_next
  SKIP_PREVIOUS: '\uE045', // skip_previous
  FIRST_PAGE: '\uE5DC', // first_page (go to start)
  LAST_PAGE: '\uE5DD', // last_page (go to end)
  NAVIGATE_BEFORE: '\uE408', // navigate_before (previous keyframe)
  NAVIGATE_NEXT: '\uE409', // navigate_next (next keyframe)

  // File operations
  SAVE: '\uE161', // save
  FOLDER: '\uE2C7', // folder
  FOLDER_OPEN: '\uE2C8', // folder_open
  FILE: '\uE24D', // insert_drive_file

  // Common actions
  ADD: '\uE145', // add
  REMOVE: '\uE15B', // remove
  DELETE: '\uE872', // delete
  EDIT: '\uE3C9', // edit
  COPY: '\uE14D', // content_copy
  PASTE: '\uE14F', // content_paste

  // View controls
  VISIBILITY: '\uE8F4', // visibility
  VISIBILITY_OFF: '\uE8F5', // visibility_off
  ZOOM_IN: '\uE8FF', // zoom_in
  ZOOM_OUT: '\uE900', // zoom_out

  // UI/Settings
  SETTINGS: '\uE8B8', // settings
  SEARCH: '\uE8B6', // search
  REFRESH: '\uE5D5', // refresh
  CLOSE: '\uE5CD', // close
  CHECK: '\uE5CA', // check

  // Hierarchy/Structure
  EXPAND_MORE: '\uE5CF', // expand_more
  EXPAND_LESS: '\uE5CE', // expand_less
  CHEVRON_RIGHT: '\uE5CC', // chevron_right
  CHEVRON_LEFT: '\uE5CB', // chevron_left

  // Object types
  CUBE: '\uEA17', // view_in_ar (3D)
  IMAGE: '\uE3F4', // image
  LIGHT: '\uE90F', // light_mode
  CAMERA: '\uE3B0', // photo_camera
  AUDIO: '\uE050', // volume_up

  // Transform
  MOVE: '\uF393', // arrows_output
  ROTATE: '\uF053', // restart_alt
  SCALE: '\uF830', // expand_content
} as const;

export type EditorIconName = keyof typeof EDITOR_ICONS;
