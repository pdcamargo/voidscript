/**
 * Project Templates
 *
 * Extensible template system for creating new VoidScript projects.
 * Templates define the folder structure and files to create when
 * initializing a new project.
 */

import { ProjectFolders } from './project-config.js';

// ============================================================================
// Types
// ============================================================================

/**
 * A file to be created by a template.
 * Content can be static or dynamic (generated based on project name).
 */
export interface TemplateFile {
  /** Relative path from project root (e.g., "src/main.ts") */
  path: string;
  /**
   * File content - either a static string or a function that generates
   * content based on the project name.
   */
  content: string | ((projectName: string) => string);
}

/**
 * A folder to be created by a template.
 */
export interface TemplateFolder {
  /** Relative path from project root (e.g., "src/scenes") */
  path: string;
}

/**
 * Project template definition.
 * Defines what files and folders to create when initializing a new project.
 */
export interface ProjectTemplate {
  /** Unique template identifier */
  id: string;
  /** Display name shown in the UI */
  name: string;
  /** Short description of what this template includes */
  description: string;
  /** Font icon code for display (optional) */
  icon?: string;
  /** Folders to create */
  folders: TemplateFolder[];
  /** Files to create */
  files: TemplateFile[];
}

// ============================================================================
// Template Registry
// ============================================================================

/**
 * Registry of available project templates.
 * Allows registering custom templates beyond the built-in ones.
 */
export class ProjectTemplateRegistry {
  private templates = new Map<string, ProjectTemplate>();

  /**
   * Register a new template.
   *
   * @param template - The template to register
   * @throws Error if a template with the same ID already exists
   */
  register(template: ProjectTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error(`Template with ID "${template.id}" already exists`);
    }
    this.templates.set(template.id, template);
  }

  /**
   * Get a template by ID.
   *
   * @param id - Template ID
   * @returns The template, or undefined if not found
   */
  get(id: string): ProjectTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all registered templates.
   *
   * @returns Array of all templates
   */
  getAll(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get the default template (Empty Project).
   *
   * @returns The default template
   */
  getDefault(): ProjectTemplate {
    return this.templates.get('empty') ?? EMPTY_PROJECT_TEMPLATE;
  }

  /**
   * Check if a template exists.
   *
   * @param id - Template ID
   * @returns true if the template exists
   */
  has(id: string): boolean {
    return this.templates.has(id);
  }
}

// ============================================================================
// Content Generators
// ============================================================================

/**
 * Generate the project.voidscript.yaml content.
 */
function generateProjectYaml(projectName: string): string {
  return `# VoidScript Project Configuration
name: "${projectName}"
version: "0.1.0"
engineVersion: "0.1.0"

# Default scene to load
defaultScene: "src/scenes/main.vscn"

metadata:
  author: ""
  description: ""

build:
  outputDir: "dist"
  targets:
    - web
    - desktop
`;
}

/**
 * Generate the package.json content.
 * Creates a strong foundation for loading user TypeScript code.
 */
function generatePackageJson(projectName: string): string {
  // Convert project name to valid npm package name
  const packageName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');

  return JSON.stringify(
    {
      name: packageName,
      version: '0.1.0',
      type: 'module',
      private: true,
      scripts: {
        build: 'tsc',
        typecheck: 'tsc --noEmit',
      },
      dependencies: {
        '@voidscript/engine': '^0.1.0',
      },
      devDependencies: {
        typescript: '^5.3.0',
      },
    },
    null,
    2,
  );
}

/**
 * Generate the tsconfig.json content.
 * Creates a strict TypeScript configuration.
 */
function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        outDir: 'dist',
        rootDir: 'src',
        resolveJsonModule: true,
        isolatedModules: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        allowImportingTsExtensions: true,
        noEmit: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    },
    null,
    2,
  );
}

/**
 * Generate a default empty scene file.
 * Creates a valid scene file with no entities.
 */
function generateEmptyScene(): string {
  const now = new Date().toISOString();
  const sceneData = {
    version: '1.0.0',
    componentRegistry: [],
    entities: [],
    metadata: {
      createdAt: now,
      modifiedAt: now,
      entityCount: 0,
      archetypeCount: 0,
      description: 'Default empty scene',
    },
    resourceRegistry: [],
    resources: [],
  };
  return JSON.stringify(sceneData, null, 2);
}

/**
 * Generate a sample main.ts entry file.
 */
function generateMainTs(projectName: string): string {
  return `/**
 * ${projectName} - Main Entry Point
 *
 * This is the main entry file for your VoidScript game.
 * Register your systems, components, and resources here.
 */

// Import engine types (uncomment when ready to use)
// import { system, component } from '@voidscript/engine';

/**
 * Example: Define a custom component
 */
// export const MyComponent = component<{ value: number }>('MyComponent', {
//   value: { serializable: true, type: 'number' },
// });

/**
 * Example: Define a custom system
 */
// export const mySystem = system(({ commands }) => {
//   commands.query().all(MyComponent).each((entity, data) => {
//     // Your game logic here
//   });
// });

console.log('${projectName} initialized');
`;
}

// ============================================================================
// Built-in Templates
// ============================================================================

/**
 * Empty Project Template
 *
 * Creates a minimal VoidScript project with:
 * - Standard folder structure (src/, settings/)
 * - project.voidscript.yaml configuration
 * - package.json with @voidscript/engine dependency
 * - tsconfig.json with strict TypeScript settings
 * - Sample main.ts entry file
 */
export const EMPTY_PROJECT_TEMPLATE: ProjectTemplate = {
  id: 'empty',
  name: 'Empty Project',
  description: 'A minimal VoidScript project with standard folder structure',
  icon: '\uf07b', // folder icon
  folders: [
    { path: ProjectFolders.Src },
    { path: ProjectFolders.Scenes },
    { path: ProjectFolders.EngineSettings },
    { path: ProjectFolders.EditorSettings },
  ],
  files: [
    {
      path: ProjectFolders.ProjectFile,
      content: generateProjectYaml,
    },
    {
      path: ProjectFolders.PackageJson,
      content: generatePackageJson,
    },
    {
      path: ProjectFolders.TsConfig,
      content: generateTsConfig,
    },
    {
      path: 'src/main.ts',
      content: generateMainTs,
    },
    {
      path: 'src/scenes/main.vscn',
      content: generateEmptyScene,
    },
  ],
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new template registry with built-in templates.
 *
 * @returns A registry pre-populated with built-in templates
 */
export function createDefaultTemplateRegistry(): ProjectTemplateRegistry {
  const registry = new ProjectTemplateRegistry();
  registry.register(EMPTY_PROJECT_TEMPLATE);
  return registry;
}
