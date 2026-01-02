/**
 * Project Creator
 *
 * Handles the creation of new VoidScript projects using templates.
 * Creates the folder structure and files defined by the selected template.
 *
 * Uses a transactional approach: if any step fails, the entire project
 * folder is rolled back (deleted) to prevent corrupted project structures.
 */

import { EditorFileSystem } from '../editor-file-system.js';
import type {
  ProjectTemplate,
  ProjectTemplateRegistry,
  TemplateFile,
} from './project-templates.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for creating a new project.
 */
export interface CreateProjectOptions {
  /** Project name (will be used as the folder name) */
  name: string;
  /** Parent directory where the project folder will be created */
  parentPath: string;
  /** Template ID to use for project creation */
  templateId: string;
}

/**
 * Result of project creation.
 */
export interface CreateProjectResult {
  /** Whether the project was created successfully */
  success: boolean;
  /** Full path to the created project (if successful) */
  projectPath?: string;
  /** Error message (if failed) */
  error?: string;
  /** Whether a partial project was cleaned up due to failure */
  rolledBack?: boolean;
}

// ============================================================================
// Project Creator
// ============================================================================

/**
 * Creates new VoidScript projects from templates.
 *
 * Uses a transactional approach - if any operation fails during project
 * creation, the entire project folder is rolled back (deleted) to prevent
 * leaving corrupted project structures on disk.
 *
 * Usage:
 * ```typescript
 * const registry = createDefaultTemplateRegistry();
 * const creator = new ProjectCreator(registry);
 *
 * const result = await creator.create({
 *   name: 'My Game',
 *   parentPath: '/Users/dev/projects',
 *   templateId: 'empty',
 * });
 *
 * if (result.success) {
 *   console.log('Project created at:', result.projectPath);
 * } else if (result.rolledBack) {
 *   console.log('Creation failed, partial project was cleaned up');
 * }
 * ```
 */
export class ProjectCreator {
  constructor(private templateRegistry: ProjectTemplateRegistry) {}

  /**
   * Create a new project from a template.
   *
   * This method uses a transactional approach:
   * 1. Creates the project folder
   * 2. Creates all template folders
   * 3. Creates all template files
   *
   * If any step fails, the entire project folder is deleted (rolled back)
   * to prevent leaving a corrupted project structure.
   *
   * @param options - Project creation options
   * @returns Result indicating success or failure
   */
  async create(options: CreateProjectOptions): Promise<CreateProjectResult> {
    const { name, parentPath, templateId } = options;

    // Validate inputs
    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Project name is required' };
    }

    if (!parentPath || parentPath.trim().length === 0) {
      return { success: false, error: 'Parent path is required' };
    }

    // Get template
    const template = this.templateRegistry.get(templateId);
    if (!template) {
      return { success: false, error: `Template "${templateId}" not found` };
    }

    // Create project folder path
    const projectPath = await EditorFileSystem.joinPath(parentPath, name);

    // Check if folder already exists
    if (await EditorFileSystem.existsAtPath(projectPath)) {
      return {
        success: false,
        error: `Folder "${name}" already exists at this location`,
      };
    }

    // Track if we've started creating the project (for rollback)
    let projectFolderCreated = false;

    try {
      // Create project folder
      const mkdirResult = await EditorFileSystem.mkdir(projectPath);
      if (!mkdirResult.success) {
        return {
          success: false,
          error: `Failed to create project folder: ${mkdirResult.error}`,
        };
      }
      projectFolderCreated = true;

      // Create folders from template
      const folderResult = await this.createTemplateFolders(
        projectPath,
        template,
      );
      if (!folderResult.success) {
        await this.rollback(projectPath);
        return {
          success: false,
          error: folderResult.error,
          rolledBack: true,
        };
      }

      // Create files from template
      const fileResult = await this.createTemplateFiles(
        projectPath,
        template,
        name,
      );
      if (!fileResult.success) {
        await this.rollback(projectPath);
        return {
          success: false,
          error: fileResult.error,
          rolledBack: true,
        };
      }

      return { success: true, projectPath };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Rollback if we created the project folder
      if (projectFolderCreated) {
        await this.rollback(projectPath);
        return { success: false, error: message, rolledBack: true };
      }

      return { success: false, error: message };
    }
  }

  /**
   * Create all folders defined in the template.
   */
  private async createTemplateFolders(
    projectPath: string,
    template: ProjectTemplate,
  ): Promise<{ success: boolean; error?: string }> {
    for (const folder of template.folders) {
      const folderPath = await EditorFileSystem.joinPath(
        projectPath,
        folder.path,
      );

      const result = await EditorFileSystem.mkdir(folderPath);
      if (!result.success) {
        return {
          success: false,
          error: `Failed to create folder "${folder.path}": ${result.error}`,
        };
      }
    }

    return { success: true };
  }

  /**
   * Create all files defined in the template.
   */
  private async createTemplateFiles(
    projectPath: string,
    template: ProjectTemplate,
    projectName: string,
  ): Promise<{ success: boolean; error?: string }> {
    for (const file of template.files) {
      const filePath = await EditorFileSystem.joinPath(projectPath, file.path);

      // Ensure parent directory exists
      const parentDir = await this.getParentDirectory(filePath);
      if (parentDir) {
        const mkdirResult = await EditorFileSystem.mkdir(parentDir);
        if (!mkdirResult.success) {
          return {
            success: false,
            error: `Failed to create directory for "${file.path}": ${mkdirResult.error}`,
          };
        }
      }

      // Generate content
      const content = this.resolveFileContent(file, projectName);

      // Write file
      const result = await EditorFileSystem.writeTextToPath(filePath, content);
      if (!result.success) {
        return {
          success: false,
          error: `Failed to create file "${file.path}": ${result.error}`,
        };
      }
    }

    return { success: true };
  }

  /**
   * Rollback a failed project creation by removing the project folder.
   */
  private async rollback(projectPath: string): Promise<void> {
    try {
      console.warn(
        `Rolling back project creation, removing: ${projectPath}`,
      );
      const result = await EditorFileSystem.removeDir(projectPath);
      if (!result.success) {
        console.error(`Failed to rollback project: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to rollback project:', error);
    }
  }

  /**
   * Resolve file content from a TemplateFile.
   * Handles both static strings and dynamic content generators.
   */
  private resolveFileContent(file: TemplateFile, projectName: string): string {
    if (typeof file.content === 'function') {
      return file.content(projectName);
    }
    return file.content;
  }

  /**
   * Get the parent directory of a file path.
   */
  private async getParentDirectory(filePath: string): Promise<string | null> {
    try {
      const { dirname } = await import('@tauri-apps/api/path');
      return await dirname(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Validate a project name.
   *
   * @param name - Project name to validate
   * @returns Object with valid flag and optional error message
   */
  static validateProjectName(name: string): {
    valid: boolean;
    error?: string;
  } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Project name is required' };
    }

    // Check for invalid characters (basic check)
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(name)) {
      return {
        valid: false,
        error: 'Project name contains invalid characters',
      };
    }

    // Check length
    if (name.length > 255) {
      return { valid: false, error: 'Project name is too long (max 255 chars)' };
    }

    // Check for reserved names on Windows
    const reserved = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
    if (reserved.test(name)) {
      return { valid: false, error: 'Project name is a reserved system name' };
    }

    return { valid: true };
  }
}
