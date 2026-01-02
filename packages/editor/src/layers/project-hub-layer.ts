/**
 * ProjectHubLayer - Project selection and creation UI
 *
 * Displays when no project is loaded, providing a Unity Hub-style interface
 * for managing VoidScript projects with a card grid layout.
 */

import { ImGui, ImVec2Helpers } from '@voidscript/imgui';
import { EditorApplicationLayer } from './editor-application-layer.js';
import { EditorLayout } from '../editor-layout.js';
import { ThemeManager } from '../theme/theme-manager.js';
import {
  type DetectedProject,
  getRecentProjects,
  addRecentProject,
  removeRecentProject,
  toggleProjectPinned,
} from '../project/project-detector.js';
import {
  createDefaultTemplateRegistry,
  type ProjectTemplateRegistry,
} from '../project/project-templates.js';
import { ProjectCreator } from '../project/project-creator.js';
import { EditorFileSystem } from '../editor-file-system.js';
import { ProjectFolders } from '../project/project-config.js';
import { saveCurrentProject } from '../project/current-project-store.js';
import { createTauriProjectStorage } from '../project/project-detector.js';

// ============================================================================
// Constants
// ============================================================================

const CARD_WIDTH = 280;
const CARD_HEIGHT = 120;
const CARD_SPACING = 16;

// ============================================================================
// Project Hub Layer
// ============================================================================

/**
 * Project Hub Layer - Main hub UI for project management.
 */
export class ProjectHubLayer extends EditorApplicationLayer {
  // Project list
  private recentProjects: DetectedProject[] = [];
  private isLoading = false;

  // Search/filter
  private searchFilter = '';

  // Create project modal state
  private showCreateModal = false;
  private newProjectName = '';
  private newProjectPath = '';
  private selectedTemplateId = 'empty';
  private createError = '';

  // Template system
  private templateRegistry: ProjectTemplateRegistry;
  private projectCreator: ProjectCreator;

  constructor(app: import('../editor-application.js').EditorApplication) {
    super(app);
    this.templateRegistry = createDefaultTemplateRegistry();
    this.projectCreator = new ProjectCreator(this.templateRegistry);
  }

  override async onAttach(): Promise<void> {
    await this.loadRecentProjects();
  }

  /**
   * Open the "Create New Project" modal.
   * Call this after the layer is attached to show the modal immediately.
   */
  openCreateModal(): void {
    this.showCreateModal = true;
    this.newProjectName = '';
    this.newProjectPath = '';
    this.selectedTemplateId = this.templateRegistry.getDefault()?.id ?? 'empty';
    this.createError = '';
  }

  override async onDetach(): Promise<void> {
    // Cleanup if needed
  }

  override onRender(): void {
    // Get viewport size
    const viewportPos = ImVec2Helpers.GetMainViewportPos();
    const viewportSize = ImVec2Helpers.GetMainViewportSize();

    // Create fullscreen window
    ImGui.SetNextWindowPos(viewportPos, ImGui.Cond.Always);
    ImGui.SetNextWindowSize(viewportSize, ImGui.Cond.Always);

    const windowFlags =
      ImGui.WindowFlags.NoTitleBar |
      ImGui.WindowFlags.NoResize |
      ImGui.WindowFlags.NoMove |
      ImGui.WindowFlags.NoCollapse |
      ImGui.WindowFlags.NoBringToFrontOnFocus;

    ImGui.PushStyleVarImVec2(ImGui.StyleVar.WindowPadding, { x: 32, y: 32 });
    ImGui.PushStyleVar(ImGui.StyleVar.WindowRounding, 0);

    if (ImGui.Begin('##ProjectHub', null, windowFlags)) {
      this.renderHeader();
      EditorLayout.divider({ marginTop: 16, marginBottom: 24 });
      this.renderProjectGrid();
    }
    ImGui.End();

    ImGui.PopStyleVar(2);

    // Render create project modal
    if (this.showCreateModal) {
      this.renderCreateProjectModal();
    }
  }

  // ============================================================================
  // Header
  // ============================================================================

  private renderHeader(): void {
    // Title - use larger text color
    ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 1, y: 1, z: 1, w: 1 });
    // Note: SetWindowFontScale is not available in jsimgui, just use regular text
    ImGui.Text('VoidScript Editor');
    ImGui.PopStyleColor();

    EditorLayout.sameLine();

    // Push buttons to the right
    const contentWidth = ImGui.GetContentRegionAvail().x;
    const buttonWidth = 140;
    const spacing = 8;
    const totalButtonWidth = buttonWidth * 2 + spacing;

    ImGui.SetCursorPosX(ImGui.GetCursorPosX() + contentWidth - totalButtonWidth);

    // New Project button
    if (EditorLayout.button('New Project', { width: buttonWidth, height: 32 })) {
      this.openCreateProjectModal();
    }

    EditorLayout.sameLine(spacing);

    // Open Project button
    if (EditorLayout.button('Open Project', { width: buttonWidth, height: 32 })) {
      void this.browseForProject();
    }
  }

  // ============================================================================
  // Project Grid
  // ============================================================================

  private renderProjectGrid(): void {
    if (this.isLoading) {
      EditorLayout.text('Loading projects...', { disabled: true });
      return;
    }

    // Filter projects
    const filteredProjects = this.getFilteredProjects();

    if (filteredProjects.length === 0) {
      this.renderEmptyState();
      return;
    }

    // Calculate grid layout
    const availableWidth = ImGui.GetContentRegionAvail().x;
    const columns = Math.max(1, Math.floor(availableWidth / (CARD_WIDTH + CARD_SPACING)));

    // Section header
    EditorLayout.text('Recent Projects', { color: { r: 0.7, g: 0.7, b: 0.7 } });
    EditorLayout.spacing();

    // Render cards in grid
    for (let i = 0; i < filteredProjects.length; i++) {
      if (i > 0 && i % columns !== 0) {
        EditorLayout.sameLine(CARD_SPACING);
      }

      const project = filteredProjects[i];
      if (project) {
        this.renderProjectCard(project, i);
      }
    }
  }

  private renderProjectCard(project: DetectedProject, index: number): void {
    const cardId = `##project_card_${index}`;

    // Card background - use window background from theme
    const bgColor = ThemeManager.getColor('imguiWindowBg');

    ImGui.PushStyleColorImVec4(ImGui.Col.ChildBg, {
      x: bgColor.r,
      y: bgColor.g,
      z: bgColor.b,
      w: bgColor.a ?? 1,
    });
    ImGui.PushStyleVar(ImGui.StyleVar.ChildRounding, 8);

    if (ImGui.BeginChild(cardId, { x: CARD_WIDTH, y: CARD_HEIGHT }, 1)) {
      const isHovered = ImGui.IsWindowHovered();
      let buttonClicked = false;

      // Card content with padding
      ImGui.SetCursorPos({ x: 16, y: 12 });

      // Project name
      ImGui.PushStyleColorImVec4(ImGui.Col.Text, { x: 1, y: 1, z: 1, w: 1 });
      ImGui.Text(project.name);
      ImGui.PopStyleColor();

      // Version
      ImGui.SetCursorPosX(16);
      EditorLayout.text(`v${project.version}`, { disabled: true });

      // Path (truncated)
      ImGui.SetCursorPosX(16);
      const maxPathLen = 35;
      const displayPath =
        project.path.length > maxPathLen
          ? '...' + project.path.slice(-maxPathLen)
          : project.path;
      EditorLayout.text(displayPath, { disabled: true, tooltip: project.path });

      // Bottom row: pin button + last opened
      ImGui.SetCursorPos({ x: 16, y: CARD_HEIGHT - 32 });

      // Pin button
      const pinIcon = project.pinned ? '\uf005' : '\uf006'; // filled/empty star
      if (EditorLayout.iconButton(`${pinIcon}##pin_${index}`, {
        size: 20,
        tooltip: project.pinned ? 'Unpin project' : 'Pin project',
      })) {
        buttonClicked = true;
        void this.togglePin(project.path);
      }

      EditorLayout.sameLine();

      // Last opened
      const lastOpened = this.formatLastOpened(project.lastOpened);
      EditorLayout.text(lastOpened, { disabled: true });

      // Remove button (always visible, but styled differently on hover)
      ImGui.SetCursorPos({ x: CARD_WIDTH - 36, y: 8 });
      const removeButtonColor = isHovered
        ? { r: 0.8, g: 0.2, b: 0.2, a: 1 }
        : { r: 0.5, g: 0.5, b: 0.5, a: 0.3 };
      if (EditorLayout.iconButton(`\uf00d##remove_${index}`, { // X icon
        size: 20,
        tooltip: 'Remove from list',
        iconColor: removeButtonColor,
      })) {
        buttonClicked = true;
        void this.removeProject(project.path);
      }

      // Handle card click (open project) - only if no button was clicked
      // Use IsWindowHovered with AllowWhenBlockedByActiveItem=false to avoid
      // triggering when buttons are active
      const canClickCard = isHovered &&
        !buttonClicked &&
        !ImGui.IsAnyItemHovered() &&
        ImGui.IsMouseClicked(0);

      if (canClickCard) {
        // Check if click was not on a button area
        const mousePos = ImVec2Helpers.GetMousePos();
        const windowPos = ImVec2Helpers.GetWindowPos();
        const relX = mousePos.x - windowPos.x;
        const relY = mousePos.y - windowPos.y;

        // Only open if clicking in the main area (not bottom row or remove button area)
        const notInRemoveArea = relX < CARD_WIDTH - 50 || relY > 40;
        const notInBottomRow = relY < CARD_HEIGHT - 40;

        if (notInRemoveArea && notInBottomRow) {
          void this.openProject(project.path);
        }
      }
    }
    ImGui.EndChild();

    ImGui.PopStyleVar();
    ImGui.PopStyleColor();
  }

  private renderEmptyState(): void {
    const availableWidth = ImGui.GetContentRegionAvail().x;
    const centerX = availableWidth / 2;

    EditorLayout.dummy(0, 60);

    // Center the text
    // NOTE: ImVec2Helpers.CalcTextSize() has WASM binding issues, so we estimate
    // text width based on character count (approx 7 pixels per char)
    const CHAR_WIDTH = 7;

    const text = 'No recent projects';
    const textWidth = text.length * CHAR_WIDTH;
    ImGui.SetCursorPosX(centerX - textWidth / 2);
    EditorLayout.text(text, { disabled: true });

    EditorLayout.spacing();

    const hint = 'Create a new project or open an existing one';
    const hintWidth = hint.length * CHAR_WIDTH;
    ImGui.SetCursorPosX(centerX - hintWidth / 2);
    EditorLayout.hint(hint);
  }

  // ============================================================================
  // Create Project Modal
  // ============================================================================

  private renderCreateProjectModal(): void {
    const modalWidth = 500;
    const modalHeight = 300;

    // Center the modal
    const viewportSize = ImVec2Helpers.GetMainViewportSize();
    const viewportPos = ImVec2Helpers.GetMainViewportPos();
    ImGui.SetNextWindowPos(
      {
        x: viewportPos.x + (viewportSize.x - modalWidth) / 2,
        y: viewportPos.y + (viewportSize.y - modalHeight) / 2,
      },
      ImGui.Cond.Appearing,
    );
    ImGui.SetNextWindowSize({ x: modalWidth, y: modalHeight }, ImGui.Cond.Appearing);

    ImGui.OpenPopup('Create New Project');

    if (ImGui.BeginPopupModal('Create New Project', null, ImGui.WindowFlags.NoResize)) {
      // Project Name
      EditorLayout.text('Project Name');
      ImGui.SetNextItemWidth(-1);
      const nameBuffer: [string] = [this.newProjectName];
      if (ImGui.InputText('##projectName', nameBuffer, 256)) {
        this.newProjectName = nameBuffer[0] ?? '';
        this.createError = '';
      }

      EditorLayout.spacing();

      // Project Location
      EditorLayout.text('Location');
      ImGui.SetNextItemWidth(-80);
      const pathBuffer: [string] = [this.newProjectPath];
      if (ImGui.InputText('##projectPath', pathBuffer, 1024)) {
        this.newProjectPath = pathBuffer[0] ?? '';
        this.createError = '';
      }

      EditorLayout.sameLine();

      if (EditorLayout.button('Browse', { width: 70, height: 24 })) {
        void this.selectProjectLocation();
      }

      EditorLayout.spacing();

      // Template selection
      EditorLayout.text('Template');
      const templates = this.templateRegistry.getAll();
      const templateNames = templates.map((t) => t.name);
      const currentIndex = templates.findIndex((t) => t.id === this.selectedTemplateId);

      ImGui.SetNextItemWidth(-1);
      const selectedIndex: [number] = [currentIndex >= 0 ? currentIndex : 0];
      if (ImGui.Combo('##template', selectedIndex, templateNames.join('\0') + '\0')) {
        const idx = selectedIndex[0] ?? 0;
        const selectedTemplate = templates[idx];
        if (selectedTemplate) {
          this.selectedTemplateId = selectedTemplate.id;
        }
      }

      // Show template description
      const selectedTemplate = this.templateRegistry.get(this.selectedTemplateId);
      if (selectedTemplate) {
        EditorLayout.hint(selectedTemplate.description);
      }

      // Error message
      if (this.createError) {
        EditorLayout.spacing();
        EditorLayout.text(this.createError, { color: { r: 1, g: 0.3, b: 0.3 } });
      }

      // Buttons at bottom
      EditorLayout.dummy(0, 20);

      const buttonWidth = 100;
      const spacing = 8;
      const totalWidth = buttonWidth * 2 + spacing;
      const startX = (modalWidth - totalWidth) / 2 - 8; // Account for window padding

      ImGui.SetCursorPosX(startX);

      if (EditorLayout.button('Create', { width: buttonWidth, height: 28 })) {
        void this.createProject();
      }

      EditorLayout.sameLine(spacing);

      if (EditorLayout.button('Cancel', { width: buttonWidth, height: 28 })) {
        this.closeCreateProjectModal();
      }

      ImGui.EndPopup();
    } else {
      // Modal was closed (e.g., by clicking outside)
      this.showCreateModal = false;
    }
  }

  // ============================================================================
  // Actions
  // ============================================================================

  private async loadRecentProjects(): Promise<void> {
    this.isLoading = true;
    try {
      const storage = createTauriProjectStorage();
      this.recentProjects = await getRecentProjects(storage);
    } catch (error) {
      console.error('Failed to load recent projects:', error);
      this.recentProjects = [];
    } finally {
      this.isLoading = false;
    }
  }

  private getFilteredProjects(): DetectedProject[] {
    if (!this.searchFilter) {
      return this.recentProjects;
    }

    const filter = this.searchFilter.toLowerCase();
    return this.recentProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(filter) ||
        p.path.toLowerCase().includes(filter),
    );
  }

  private async openProject(path: string): Promise<void> {
    try {
      // Load and validate project config
      const configPath = await EditorFileSystem.joinPath(
        path,
        ProjectFolders.ProjectFile,
      );
      const result = await EditorFileSystem.readTextFromPath(configPath);

      if (!result.success || !result.data) {
        console.error('Failed to read project config:', result.error);
        return;
      }

      // Parse YAML (simple parsing for now)
      const config = this.parseProjectYaml(result.data);

      if (!config) {
        console.error('Invalid project configuration');
        return;
      }

      // Update recent projects
      const storage = createTauriProjectStorage();
      await addRecentProject(storage, {
        path,
        name: config.name,
        version: config.version,
        engineVersion: config.engineVersion,
      });

      // Save as current project
      await saveCurrentProject(path);

      // Switch to editor layer
      this.app.switchToEditor(path, config);
    } catch (error) {
      console.error('Failed to open project:', error);
    }
  }

  private async removeProject(path: string): Promise<void> {
    try {
      const storage = createTauriProjectStorage();
      await removeRecentProject(storage, path);
      await this.loadRecentProjects();
    } catch (error) {
      console.error('Failed to remove project:', error);
    }
  }

  private async togglePin(path: string): Promise<void> {
    try {
      const storage = createTauriProjectStorage();
      await toggleProjectPinned(storage, path);
      await this.loadRecentProjects();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  }

  private async browseForProject(): Promise<void> {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        directory: true,
        multiple: false,
        title: 'Select VoidScript Project Folder',
      });

      if (typeof result === 'string') {
        await this.openProject(result);
      }
    } catch (error) {
      console.error('Failed to browse for project:', error);
    }
  }

  private openCreateProjectModal(): void {
    this.showCreateModal = true;
    this.newProjectName = '';
    this.newProjectPath = '';
    this.selectedTemplateId = 'empty';
    this.createError = '';
  }

  private closeCreateProjectModal(): void {
    this.showCreateModal = false;
    ImGui.CloseCurrentPopup();
  }

  private async selectProjectLocation(): Promise<void> {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Location',
      });

      if (typeof result === 'string') {
        this.newProjectPath = result;
      }
    } catch (error) {
      console.error('Failed to select location:', error);
    }
  }

  private async createProject(): Promise<void> {
    // Validate inputs
    const nameValidation = ProjectCreator.validateProjectName(this.newProjectName);
    if (!nameValidation.valid) {
      this.createError = nameValidation.error ?? 'Invalid project name';
      return;
    }

    if (!this.newProjectPath) {
      this.createError = 'Please select a project location';
      return;
    }

    // Create the project
    const result = await this.projectCreator.create({
      name: this.newProjectName,
      parentPath: this.newProjectPath,
      templateId: this.selectedTemplateId,
    });

    if (!result.success) {
      this.createError = result.error ?? 'Failed to create project';
      return;
    }

    // Close modal and open the new project
    this.closeCreateProjectModal();

    if (result.projectPath) {
      await this.openProject(result.projectPath);
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private formatLastOpened(isoDate: string): string {
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch {
      return 'Unknown';
    }
  }

  private parseProjectYaml(
    content: string,
  ): { name: string; version: string; engineVersion: string } | null {
    // Simple YAML parsing for project config
    // In a real implementation, use a proper YAML parser
    try {
      const lines = content.split('\n');
      const data = new Map<string, string>();

      for (const line of lines) {
        const match = line.match(/^(\w+):\s*"?([^"]+)"?\s*$/);
        if (match && match[1] && match[2]) {
          data.set(match[1], match[2]);
        }
      }

      const name = data.get('name');
      const version = data.get('version');
      const engineVersion = data.get('engineVersion');

      if (!name || !version || !engineVersion) {
        return null;
      }

      return { name, version, engineVersion };
    } catch {
      return null;
    }
  }
}
