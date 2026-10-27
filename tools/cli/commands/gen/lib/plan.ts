import { buildControllerFile } from './build-controller';
import { buildDbFile, buildDbIndexFile } from './build-db';
import { buildCreateDtoFile, buildListQueryFile, buildUpdateDtoFile } from './build-dto';
import { buildEntityFile } from './build-entity';
import { buildModuleFile } from './build-module';
import { buildRelationsFile } from './build-relations';
import { buildRepositoryFile } from './build-repository';
import { buildRepositorySpecFile } from './build-repospec';
import { buildServiceFile } from './build-service';
import { buildSpecFile } from './build-spec';
import { buildTableFile } from './build-table';
import { DEFAULT_CONFIG, type ResolvedConfig } from './config';
import { createContexts } from './context';
import { entityNames } from './names';
import type { EntityDefinition } from './types';

export interface FilePlan {
  /** Path relative to the repository root, e.g. `src/posts/posts.service.ts`. */
  path: string;
  content: string;
}

export interface EntityPlan {
  entity: EntityDefinition;
  files: FilePlan[];
}

/** The full file set the generator emits for one entity. */
export const buildEntityFiles = (
  entity: EntityDefinition,
  all: EntityDefinition[] = [entity],
  settings: ResolvedConfig = DEFAULT_CONFIG,
): FilePlan[] => {
  const context = createContexts(all, settings).find((candidate) => candidate.entity === entity) ?? createContexts([entity], settings)[0];
  const relationsFile = buildRelationsFile(context);
  return [
    buildEntityFile(context),
    buildCreateDtoFile(context),
    buildUpdateDtoFile(context),
    buildListQueryFile(context),
    buildDbFile(context),
    buildDbIndexFile(context),
    buildTableFile(context),
    ...(relationsFile ? [relationsFile] : []),
    buildRepositoryFile(context),
    buildRepositorySpecFile(context),
    buildServiceFile(context),
    buildControllerFile(context),
    buildModuleFile(context),
    buildSpecFile(context),
  ];
};

export const buildPlan = (
  selected: EntityDefinition[],
  all: EntityDefinition[] = selected,
  settings: ResolvedConfig = DEFAULT_CONFIG,
): EntityPlan[] => selected.map((entity) => ({ entity, files: buildEntityFiles(entity, all, settings) }));

/** Name, dir and declared fields for reports. */
export const describeEntity = (
  entity: EntityDefinition,
  settings: ResolvedConfig = DEFAULT_CONFIG,
): { name: string; dir: string; fields: number } => {
  const names = entityNames(entity);
  return { name: names.name, dir: `${settings.modulesDir}/${names.dir}`, fields: (entity.fields ?? []).length };
};
