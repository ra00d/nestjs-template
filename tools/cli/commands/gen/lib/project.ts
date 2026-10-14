import { IndentationText, Project, QuoteKind, ScriptTarget, type SourceFile } from 'ts-morph';

/** In-memory ts-morph project matching the repo's Prettier settings. */
export const createProject = (): Project =>
  new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: {
      indentationText: IndentationText.TwoSpaces,
      quoteKind: QuoteKind.Single,
    },
    compilerOptions: { target: ScriptTarget.ES2023 },
  });

/** Builds one source file through ts-morph and returns its text. */
export const buildFile = (path: string, build: (file: SourceFile) => void): string => {
  const file = createProject().createSourceFile(path, '', { overwrite: true });
  build(file);
  return `${file.getFullText().trimEnd()}\n`;
};
