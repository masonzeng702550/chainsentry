import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

// In E2E builds the content script must also run on http://localhost and the
// host-resolver-mapped test domain. Production stays https-only.
const E2E = process.env.CS_E2E === '1';
const CONTENT_MATCHES = E2E ? ['https://*/*', 'http://*/*'] : ['https://*/*'];
const HOST_PERMS = E2E ? ['https://*/*', 'http://*/*'] : ['https://*/*'];

export default defineManifest({
  manifest_version: 3,
  name: 'ChainSentry',
  version: pkg.version,
  description:
    'Detect crypto giveaway scams — link safety, wallet money-flow analysis, and refund verification.',
  default_locale: 'en',
  icons: {
    '16': 'src/assets/icon-16.png',
    '48': 'src/assets/icon-48.png',
    '128': 'src/assets/icon-128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'ChainSentry',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/sw.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: CONTENT_MATCHES,
      js: ['src/content/main.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  permissions: ['storage', 'alarms', 'activeTab', 'scripting'],
  host_permissions: HOST_PERMS,
  web_accessible_resources: [
    {
      resources: ['src/analysis/index.html', 'src/assets/*'],
      matches: ['https://*/*'],
    },
  ],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },
});
