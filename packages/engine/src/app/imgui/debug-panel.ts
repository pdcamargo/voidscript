/**
 * Debug Panel - ImGui UI for debugging and performance monitoring
 *
 * Provides two tabs:
 * - Console: Real-time console log viewer with filtering
 * - Performance: Large FPS display
 */

import { ImGui } from '@mori2003/jsimgui';
import type { Application } from '../application.js';
import {
  ConsoleLogger,
  type ConsoleLogEntry,
  type ConsoleLogLevel,
} from '../console-logger.js';
import { writeTextToClipboard } from '../clipboard.js';

// Module-level UI state (no persistence needed)
let autoScroll = true;
let logFilter: 'all' | ConsoleLogLevel = 'all';
let searchQuery = '';
let focusSearchInput = false;

/**
 * Render the Debug panel with Console and Performance tabs
 */
export function renderDebugPanel(app: Application): void {
  ImGui.SetNextWindowPos({ x: 10, y: 550 }, ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSize({ x: 800, y: 300 }, ImGui.Cond.FirstUseEver);

  if (ImGui.Begin('Debug')) {
    if (ImGui.BeginTabBar('DebugTabs')) {
      if (ImGui.BeginTabItem('Console')) {
        renderConsoleTab(app);
        ImGui.EndTabItem();
      }

      if (ImGui.BeginTabItem('Performance')) {
        renderPerformanceTab(app);
        ImGui.EndTabItem();
      }

      ImGui.EndTabBar();
    }
  }
  ImGui.End();
}

/**
 * Render the Console tab
 */
function renderConsoleTab(app: Application): void {
  const consoleLogger = app.getResource(ConsoleLogger);

  if (!consoleLogger) {
    ImGui.Text('ConsoleLogger not available');
    return;
  }

  // Filter buttons
  renderFilterButtons();

  ImGui.SameLine();

  // Clear button
  if (ImGui.Button('Clear')) {
    consoleLogger.clear();
  }

  ImGui.SameLine();

  // Auto-scroll checkbox
  const autoScrollArr: [boolean] = [autoScroll];
  if (ImGui.Checkbox('Auto-scroll', autoScrollArr)) {
    autoScroll = autoScrollArr[0];
  }

  ImGui.SameLine();

  // Search input - positioned on the far right
  const windowWidth = ImGui.GetWindowWidth();
  const searchBarWidth = Math.min(300, 200); // Fixed width for search bar
  const padding = 10;

  // Position search bar on the right side
  ImGui.SameLine(windowWidth - searchBarWidth - padding);
  ImGui.PushItemWidth(searchBarWidth);

  // Handle keyboard shortcut to focus search (CMD/CTRL+F)
  const io = ImGui.GetIO();

  // Check for Ctrl+F (Windows/Linux) or Cmd+F (Mac)
  // Only trigger if we're not already in a text input (to avoid interfering)
  const modifierPressed = io.KeyCtrl || io.KeySuper;
  const shouldFocusSearch =
    modifierPressed && ImGui.IsKeyPressed(ImGui.Key._F, false);

  if (shouldFocusSearch) {
    focusSearchInput = true;
  }

  // Focus the input if requested
  if (focusSearchInput) {
    ImGui.SetKeyboardFocusHere();
    focusSearchInput = false;
  }

  const searchBuffer: [string] = [searchQuery];
  // Detect platform for hint text
  const isMac =
    typeof navigator !== 'undefined' &&
    navigator.platform?.toUpperCase().indexOf('MAC') >= 0;
  const searchHint = isMac
    ? 'Search logs (Cmd+F)...'
    : 'Search logs (Ctrl+F)...';
  ImGui.InputTextWithHint('##search', searchHint, searchBuffer, 256);
  searchQuery = searchBuffer[0];

  ImGui.PopItemWidth();

  ImGui.Separator();

  // Scrollable log area (use 0 for auto-height to fill remaining space)
  ImGui.BeginChild('ConsoleLogArea', { x: 0, y: 0 });

  const entries = consoleLogger.getEntries();

  if (entries.length === 0) {
    ImGui.TextColored({ x: 0.5, y: 0.5, z: 0.5, w: 1.0 }, 'No logs captured');
  } else {
    let logIndex = 0;
    for (const entry of entries) {
      if (!matchesFilter(entry, logFilter)) {
        continue;
      }

      // Apply search filter
      if (!matchesSearchQuery(entry, searchQuery)) {
        continue;
      }

      const color = getColorForLevel(entry.level);
      const timeStr = formatTimestamp(entry.timestamp);
      const levelStr = entry.level.toUpperCase().padEnd(5);
      const prefix = entry.prefix ? `[${entry.prefix}] ` : '';
      const sourceStr = entry.source ? `[${entry.source}] ` : '';

      // Build full log text for selectable display
      const fullText = `${timeStr} ${sourceStr}[${levelStr}] ${prefix}${entry.message}`;

      // Push unique ID for each log entry to avoid ImGui ID conflicts
      ImGui.PushIDInt(logIndex++);

      // Use Selectable for double-click to copy
      ImGui.PushStyleColorImVec4(ImGui.Col.Text, color);

      const selectableFlags = ImGui.SelectableFlags.AllowDoubleClick;
      const isClicked = ImGui.Selectable(fullText, false, selectableFlags);

      // If double-clicked, copy to clipboard using Tauri
      if (isClicked && ImGui.IsMouseDoubleClicked(0)) {
        writeTextToClipboard(fullText);
      }

      // Show tooltip on hover
      if (ImGui.IsItemHovered()) {
        ImGui.SetTooltip('Double-click to copy to clipboard');
      }

      ImGui.PopStyleColor(1);
      ImGui.PopID();
    }

    // Auto-scroll to bottom if enabled and user is at bottom
    if (autoScroll && ImGui.GetScrollY() >= ImGui.GetScrollMaxY()) {
      ImGui.SetScrollHereY(1.0);
    }
  }

  ImGui.EndChild();
}

/**
 * Render the Performance tab
 */
function renderPerformanceTab(app: Application): void {
  const fps = app.getCurrentFPS();

  // Get window dimensions for centering
  const windowWidth = ImGui.GetWindowWidth();

  // Create centered FPS display
  const fpsText = `FPS: ${Math.round(fps)}`;

  // Approximate text width (rough estimation)
  const approxTextWidth = fpsText.length * 10;

  // Add some vertical spacing, then center horizontally
  ImGui.Dummy({ x: 0, y: 50 }); // Add spacing from top
  ImGui.SetCursorPosX((windowWidth - approxTextWidth) / 2);

  // Large text with green color
  ImGui.PushStyleColorImVec4(ImGui.Col.Text, {
    x: 0.3,
    y: 1.0,
    z: 0.3,
    w: 1.0,
  });
  ImGui.Text(fpsText);
  ImGui.PopStyleColor();
}

/**
 * Render filter buttons
 */
function renderFilterButtons(): void {
  const filters: Array<'all' | ConsoleLogLevel> = [
    'all',
    'error',
    'warn',
    'info',
    'log',
  ];

  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i]!;
    const isActive = logFilter === filter;

    if (isActive) {
      ImGui.PushStyleColorImVec4(ImGui.Col.Button, {
        x: 0.2,
        y: 0.5,
        z: 0.8,
        w: 1.0,
      });
    }

    if (ImGui.Button(filter.toUpperCase())) {
      logFilter = filter;
    }

    if (isActive) {
      ImGui.PopStyleColor();
    }

    if (i < filters.length - 1) {
      ImGui.SameLine();
    }
  }
}

/**
 * Get ImGui color for log level
 */
function getColorForLevel(level: ConsoleLogLevel): {
  x: number;
  y: number;
  z: number;
  w: number;
} {
  switch (level) {
    case 'error':
      return { x: 1.0, y: 0.3, z: 0.3, w: 1.0 }; // Red
    case 'warn':
      return { x: 1.0, y: 0.8, z: 0.3, w: 1.0 }; // Yellow
    case 'info':
      return { x: 0.3, y: 0.7, z: 1.0, w: 1.0 }; // Blue
    case 'debug':
      return { x: 0.7, y: 0.7, z: 0.7, w: 1.0 }; // Gray
    case 'log':
    default:
      return { x: 1.0, y: 1.0, z: 1.0, w: 1.0 }; // White
  }
}

/**
 * Format timestamp to HH:MM:SS.mmm
 */
function formatTimestamp(ms: number): string {
  const date = new Date(ms);

  if (isNaN(date.getTime())) {
    return '00:00:00.000';
  }

  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ms3 = String(date.getMilliseconds()).padStart(3, '0');

  return `${h}:${m}:${s}.${ms3}`;
}

/**
 * Check if entry matches current filter
 */
function matchesFilter(
  entry: ConsoleLogEntry,
  filter: 'all' | ConsoleLogLevel,
): boolean {
  if (filter === 'all') {
    return true;
  }
  return entry.level === filter;
}

/**
 * Check if entry matches search query (case-insensitive fuzzy search)
 */
function matchesSearchQuery(entry: ConsoleLogEntry, query: string): boolean {
  if (!query || query.trim() === '') {
    return true;
  }

  const searchText = query.toLowerCase();

  // Build searchable text from all entry fields
  const searchableText = [
    entry.message,
    entry.level,
    entry.prefix || '',
    entry.source || '',
  ]
    .join(' ')
    .toLowerCase();

  // Simple case-insensitive substring match
  // For fuzzy search, we could implement more sophisticated matching,
  // but substring match is fast and works well for most cases
  return searchableText.includes(searchText);
}
