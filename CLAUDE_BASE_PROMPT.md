We’re moving toward Phase 1 of @ROADMAP.md , and we’ve already accomplished a lot.

We’re now fully shifting direction to redo / deprecate the editor code inside packages/engine/editor, with the goal of focusing entirely on the new packages/editor and achieving a 100% clean separation between the two.

From this point on, when I ask about editor-related topics, packages/engine/editor may be used only as a reference, but all decisions and designs must align with the new editor architecture.

Current state:

Project creation is implemented

Project loader exists

Default scene / last opened scene path is stored

Scenes are successfully loading

Editor Panels are implemented

Editor Dialogs are implemented

An abstract EditorWindow class exists to simplify editor creation

OS-native menus can be registered

Menu actions can register callbacks that can:

Trigger logic

Open dialogs

Open panels

Serialize scene and scene properties with SerializedObject and SerializedProperty

Undo and Redo support with UndoRedoManager

…all with very low friction

Assume all of the above is in place when reasoning about the next steps.
