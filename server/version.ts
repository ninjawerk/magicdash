import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
/** MagicDash host version, from package.json. */
export const HOST_VERSION: string = (require('../package.json') as { version: string }).version;
