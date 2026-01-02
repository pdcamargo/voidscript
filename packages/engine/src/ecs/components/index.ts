// Re-export hierarchy components from @voidscript/core
export { Parent, Children, Name, PrefabInstance } from '@voidscript/core';

// Engine-specific components
export * from './rendering/index.js';
export * from './audio/index.js';
export * from './generators/sprite-area-generator.js';
