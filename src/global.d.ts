// Compile-time flag injected by Vite (`define`). True only in E2E builds so that
// light-DOM test hooks are added; production builds tree-shake these branches out.
declare const __CS_E2E__: boolean;
