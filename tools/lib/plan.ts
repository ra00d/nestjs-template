import { buildControllerFile } from './build-controller.ts';
import { buildDbFile, buildDbIndexFile } from './build-db.ts';
import { buildCreateDtoFile, buildListQueryFile, buildUpdateDtoFile } from './build-dto.ts';
import { buildEntityFile } from './build-entity.ts';
import { buildModuleFile } from './build-module.ts';
import { buildRelationsFile } from './build-relations.ts';
import { buildRepositoryFile } from './build-repository.ts';
import { buildRepositorySpecFile } from './build-repospec.ts';
import { buildServiceFile } from './build-service.ts';
import { buildSpecFile } from './build-spec.ts';
import { buildTableFile } from './build-table.ts';
import { DEFAULT_CONFIG, type ResolvedConfig } from './config.ts';
import { createContexts } from './context.ts';
import { entityNames } from './names.ts';
import type { EntityDefinition } from './types.ts';

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
