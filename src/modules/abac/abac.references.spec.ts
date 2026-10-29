import {
  ABAC_MISSING,
  findInvalidReferences,
  isReferencePath,
  readAbacPath,
  resolveAbacValue,
} from './abac.references';
import type { AbacRequest } from './abac.types';

const request: AbacRequest = {
  subject: {
    id: 'user-1',
    roles: ['editor', 'staff'],
    authenticated: true,
  },
  resource: 'comment',
  action: 'update',
  attributes: {
    ownerId: 'user-1',
    nested: { level: 3 },
    tags: ['a', 'b'],
  },
  environment: { time: '10:00:00' },
};

describe('isReferencePath', () => {
  it('accepts the three bags with a dotted path', () => {
    expect(isReferencePath('subject.id')).toBe(true);
    expect(isReferencePath('resource.owner.id')).toBe(true);
    expect(isReferencePath('environment.time')).toBe(true);
  });

  it('rejects unknown roots and malformed paths', () => {
    expect(isReferencePath('user.id')).toBe(false);
    expect(isReferencePath('subject.')).toBe(false);
    expect(isReferencePath('{{subject.id}}')).toBe(false);
    expect(isReferencePath('subject')).toBe(false);
  });
});

describe('findInvalidReferences', () => {
  it('accepts well-formed references anywhere in a rule value', () => {
    expect(
      findInvalidReferences({
        eq: '{{subject.id}}',
        in: ['literal', '{{resource.ownerId}}'],
        startsWith: 'user-{{subject.id}}',
        nested: { start: '09:00', end: '18:00' },
      }),
    ).toEqual([]);
  });

  it('flags unknown roots, malformed tokens and unbalanced braces', () => {
    expect(findInvalidReferences('{{user.id}}')).toEqual(['user.id']);
    expect(findInvalidReferences('{{subject}}')).toEqual(['subject']);
    expect(findInvalidReferences('{{subject.id')).toEqual(['{{subject.id']);
    expect(findInvalidReferences(['ok-{{resource.id}}', '{{nope}}'])).toEqual([
      'nope',
    ]);
  });
});

describe('readAbacPath', () => {
  it('reads subject, resource and environment roots', () => {
    expect(readAbacPath(request, 'subject.id')).toBe('user-1');
    expect(readAbacPath(request, 'resource.ownerId')).toBe('user-1');
    expect(readAbacPath(request, 'environment.time')).toBe('10:00:00');
  });

  it('descends into nested objects and arrays', () => {
    expect(readAbacPath(request, 'resource.nested.level')).toBe(3);
    expect(readAbacPath(request, 'resource.tags.1')).toBe('b');
  });

  it('returns the missing symbol for unknown attributes', () => {
    expect(readAbacPath(request, 'subject.department')).toBe(ABAC_MISSING);
    expect(readAbacPath(request, 'resource.nested.missing')).toBe(ABAC_MISSING);
    expect(readAbacPath(request, 'resource.tags.9')).toBe(ABAC_MISSING);
  });
});

describe('resolveAbacValue', () => {
  it('keeps the referenced type for a sole reference', () => {
    expect(resolveAbacValue('{{subject.roles}}', request)).toEqual([
      'editor',
      'staff',
    ]);
    expect(resolveAbacValue('{{resource.nested}}', request)).toEqual({
      level: 3,
    });
  });

  it('interpolates embedded references into strings', () => {
    expect(resolveAbacValue('editor-{{subject.id}}', request)).toBe(
      'editor-user-1',
    );
  });

  it('keeps the raw token when an embedded reference does not resolve', () => {
    expect(resolveAbacValue('editor-{{subject.idd}}', request)).toBe(
      'editor-{{subject.idd}}',
    );
  });

  it('resolves arrays and operator objects element-wise', () => {
    expect(
      resolveAbacValue(
        { eq: '{{subject.id}}', in: ['{{resource.ownerId}}'] },
        request,
      ),
    ).toEqual({ eq: 'user-1', in: ['user-1'] });
  });

  it('reports a failed sole reference as missing', () => {
    expect(resolveAbacValue('{{subject.department}}', request)).toBe(
      ABAC_MISSING,
    );
  });
});
