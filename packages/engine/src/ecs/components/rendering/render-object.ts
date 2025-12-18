import { component } from '../../component.js';

export interface RenderObjectData {
  /**
   * Opaque handle to the renderer's mesh object
   * Used to update/remove the mesh from the renderer
   */
  handle: number;
}

// Mark as non-serializable - this is a runtime component
export const RenderObject = component<RenderObjectData>('RenderObject', false);
