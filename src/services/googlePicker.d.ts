/**
 * Ambient Google Picker types. Because the project sets
 * `moduleDetection: "force"`, every file is a module — so these interfaces
 * must be published via `declare global` (with a trailing `export {}` to keep
 * the file an explicit module) to be visible from `googlePicker.ts`.
 *
 * The `Window.gapi` / `Window.google.picker` members are declared in
 * `googleIdentity.d.ts`.
 */

declare global {
  interface GooglePickerDoc {
    id: string;
    name: string;
  }

  interface GooglePickerResponse {
    action: string;
    docs?: GooglePickerDoc[];
  }

  interface GooglePickerDocsView {
    setMimeTypes: (mimeTypes: string) => GooglePickerDocsView;
    setSelectFolderEnabled: (enabled: boolean) => GooglePickerDocsView;
  }

  interface GooglePickerInstance {
    setVisible: (visible: boolean) => void;
  }

  interface GooglePickerBuilder {
    addView: (view: GooglePickerDocsView) => GooglePickerBuilder;
    setOAuthToken: (token: string) => GooglePickerBuilder;
    setDeveloperKey: (key: string) => GooglePickerBuilder;
    /** Google Cloud project number, so drive.file grants persist for picks. */
    setAppId: (appId: string) => GooglePickerBuilder;
    setCallback: (cb: (data: GooglePickerResponse) => void) => GooglePickerBuilder;
    build: () => GooglePickerInstance;
  }

  interface GooglePickerNamespace {
    DocsView: new (viewId: unknown) => GooglePickerDocsView;
    PickerBuilder: new () => GooglePickerBuilder;
    ViewId: { DOCUMENTS: unknown; FOLDERS: unknown };
    Action: { PICKED: string; CANCEL: string };
  }
}

export {};
