import defineConfig from './tools/cli/config.ts';
import { config } from './tools/gen.config.ts';
import { entities } from './tools/entities.ts';

export default defineConfig({ gen: { config, entities } });
