import { describe, expect, test } from 'bun:test';

import {
  ASSET_CACHE_LIFETIME_AUDIT,
  ASSET_CACHE_LIFETIME_DERIVED_INVARIANTS,
  ASSET_LIFETIME_POLICY,
  PURGE_TAG_TO_LIFETIME_CATEGORY,
  VANILLA_LIFETIME_CATEGORIES,
  VANILLA_PURGE_TAGS,
  assetsFreedAtLevelExit,
  classifyLifetimeCategory,
  crossCheckAssetCacheLifetimeRuntime,
  getLifetimeTagForAsset,
  isFreedAtLevelExit,
  isPurgableTag,
} from '../../../src/assets/build-asset-cache-lifetime-policy.ts';
import type { AssetCacheLifetimeAuditEntry, AssetCacheLifetimeRuntimeSnapshot, AssetLifetimeCategory, AssetPurgeTag } from '../../../src/assets/build-asset-cache-lifetime-policy.ts';

const ALLOWED_AXIS_IDS = new Set<AssetCacheLifetimeAuditEntry['id']>([
  'playpal-cached-pu-cache',
  'colormap-cached-pu-static',
  'colormap-zmalloc-pu-static-after-alignment',
  'texture1-cached-pu-static',
  'texture2-cached-pu-static-when-present',
  'pnames-cached-pu-static',
  'patchlookup-zmalloc-pu-static',
  'flattranslation-zmalloc-pu-static',
  'flat-content-cached-pu-static-by-num',
  'sprite-width-zmalloc-pu-static',
  'sprite-offset-zmalloc-pu-static',
  'sprite-topoffset-zmalloc-pu-static',
  'sprite-frame-cached-pu-cache-by-num-at-draw-time',
  'stbar-cached-pu-static',
  'starms-cached-pu-static',
  'endoom-cached-pu-static',
  'genmidi-cached-pu-static',
  'titlepic-cached-pu-cache',
  'credit-cached-pu-cache',
  'help1-cached-pu-cache',
  'help2-cached-pu-cache',
  'bossback-cached-pu-cache',
  'victory2-cached-pu-cache',
  'endpic-cached-pu-cache',
  'pfub1-cached-pu-level',
  'pfub2-cached-pu-level',
  'blockmap-cached-pu-level',
  'reject-cached-pu-level',
  'map-data-cached-pu-static-then-freed',
  'demo-lump-cached-pu-static',
  'level-exit-z-freetags-half-open-interval',
]);

const ALLOWED_TAGS = new Set<AssetPurgeTag>(['PU_STATIC', 'PU_SOUND', 'PU_MUSIC', 'PU_LEVEL', 'PU_LEVSPEC', 'PU_PURGELEVEL', 'PU_CACHE']);
const ALLOWED_CATEGORIES = new Set<AssetLifetimeCategory>(['static', 'sound-playing', 'music-playing', 'level', 'level-special', 'purgable']);
const ALLOWED_REFERENCE_FILES = new Set<AssetCacheLifetimeAuditEntry['referenceSourceFile']>([
  'src/doom/r_data.c',
  'src/doom/d_main.c',
  'src/doom/p_setup.c',
  'src/doom/f_finale.c',
  'src/doom/st_stuff.c',
  'src/doom/m_menu.c',
  'src/doom/wi_stuff.c',
  'src/doom/g_game.c',
  'src/z_zone.c',
]);

function isSorted(values: readonly string[]): boolean {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i - 1]! >= values[i]!) {
      return false;
    }
  }
  return true;
}

function buildLiveRuntimeSnapshot(): AssetCacheLifetimeRuntimeSnapshot {
  const purgeTagMapIsTotal = VANILLA_PURGE_TAGS.every((tag) => Object.prototype.hasOwnProperty.call(PURGE_TAG_TO_LIFETIME_CATEGORY, tag));
  const policyTableHasEntryPerAuditAxis = (() => {
    const auditAxes = ASSET_CACHE_LIFETIME_AUDIT.filter((entry) => entry.id !== 'level-exit-z-freetags-half-open-interval');
    if (ASSET_LIFETIME_POLICY.length !== auditAxes.length) {
      return false;
    }
    const declaredAxes = new Set(ASSET_LIFETIME_POLICY.map((row) => row.auditAxisId));
    return auditAxes.every((entry) => declaredAxes.has(entry.id));
  })();
  const policyTableTagsMatchAuditTags = (() => {
    for (const row of ASSET_LIFETIME_POLICY) {
      const auditEntry = ASSET_CACHE_LIFETIME_AUDIT.find((entry) => entry.id === row.auditAxisId);
      if (!auditEntry) {
        return false;
      }
      if (auditEntry.tag !== row.tag) {
        return false;
      }
    }
    return true;
  })();
  const levelExitAssets = assetsFreedAtLevelExit().map((row) => row.asset);
  return {
    purgeTagCount: VANILLA_PURGE_TAGS.length,
    purgeTagsAreSorted: isSorted([...VANILLA_PURGE_TAGS]),
    purgeTagsAreFrozen: Object.isFrozen(VANILLA_PURGE_TAGS),
    lifetimeCategoryCount: VANILLA_LIFETIME_CATEGORIES.length,
    lifetimeCategoriesAreSorted: isSorted([...VANILLA_LIFETIME_CATEGORIES]),
    lifetimeCategoriesAreFrozen: Object.isFrozen(VANILLA_LIFETIME_CATEGORIES),
    purgeTagMapIsFrozen: Object.isFrozen(PURGE_TAG_TO_LIFETIME_CATEGORY),
    purgeTagMapIsTotal,
    puStaticCategory: PURGE_TAG_TO_LIFETIME_CATEGORY.PU_STATIC,
    puLevelCategory: PURGE_TAG_TO_LIFETIME_CATEGORY.PU_LEVEL,
    puLevSpecCategory: PURGE_TAG_TO_LIFETIME_CATEGORY.PU_LEVSPEC,
    puCacheCategory: PURGE_TAG_TO_LIFETIME_CATEGORY.PU_CACHE,
    puPurgeLevelCategory: PURGE_TAG_TO_LIFETIME_CATEGORY.PU_PURGELEVEL,
    puSoundCategory: PURGE_TAG_TO_LIFETIME_CATEGORY.PU_SOUND,
    puMusicCategory: PURGE_TAG_TO_LIFETIME_CATEGORY.PU_MUSIC,
    policyTableHasEntryPerAuditAxis,
    policyTableTagsMatchAuditTags,
    playpalTag: getLifetimeTagForAsset('PLAYPAL'),
    colormapTag: getLifetimeTagForAsset('COLORMAP'),
    texture1Tag: getLifetimeTagForAsset('TEXTURE1'),
    pnamesTag: getLifetimeTagForAsset('PNAMES'),
    blockmapTag: getLifetimeTagForAsset('BLOCKMAP'),
    rejectTag: getLifetimeTagForAsset('REJECT'),
    pfub1Tag: getLifetimeTagForAsset('PFUB1'),
    pfub2Tag: getLifetimeTagForAsset('PFUB2'),
    titlepicTag: getLifetimeTagForAsset('TITLEPIC'),
    creditTag: getLifetimeTagForAsset('CREDIT'),
    stbarTag: getLifetimeTagForAsset('STBAR'),
    starmsTag: getLifetimeTagForAsset('STARMS'),
    endoomTag: getLifetimeTagForAsset('ENDOOM'),
    genmidiTag: getLifetimeTagForAsset('GENMIDI'),
    unknownAssetTag: getLifetimeTagForAsset('DOES_NOT_EXIST'),
    assetLookupIsCaseInsensitive: getLifetimeTagForAsset('playpal') === 'PU_CACHE' && getLifetimeTagForAsset('BlockMap') === 'PU_LEVEL',
    puLevelIsFreedAtLevelExit: isFreedAtLevelExit('PU_LEVEL'),
    puLevSpecIsFreedAtLevelExit: isFreedAtLevelExit('PU_LEVSPEC'),
    puStaticIsFreedAtLevelExit: isFreedAtLevelExit('PU_STATIC'),
    puCacheIsFreedAtLevelExit: isFreedAtLevelExit('PU_CACHE'),
    puPurgeLevelIsFreedAtLevelExit: isFreedAtLevelExit('PU_PURGELEVEL'),
    puCacheIsPurgable: isPurgableTag('PU_CACHE'),
    puPurgeLevelIsPurgable: isPurgableTag('PU_PURGELEVEL'),
    puStaticIsPurgable: isPurgableTag('PU_STATIC'),
    puLevelIsPurgable: isPurgableTag('PU_LEVEL'),
    levelExitIncludesBlockmapAndReject: levelExitAssets.includes('BLOCKMAP') && levelExitAssets.includes('REJECT'),
    levelExitIncludesPfub1AndPfub2: levelExitAssets.includes('PFUB1') && levelExitAssets.includes('PFUB2'),
    levelExitExcludesPlaypal: !levelExitAssets.includes('PLAYPAL'),
    levelExitExcludesColormap: !levelExitAssets.includes('COLORMAP'),
  };
}

describe('build-asset-cache-lifetime-policy: audit ledger shape', () => {
  test('declares exactly 31 audit axes', () => {
    expect(ASSET_CACHE_LIFETIME_AUDIT.length).toBe(31);
  });

  test('every axis has a stable id from the closed enum', () => {
    for (const entry of ASSET_CACHE_LIFETIME_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = ASSET_CACHE_LIFETIME_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every axis carries a tag from the closed enum', () => {
    for (const entry of ASSET_CACHE_LIFETIME_AUDIT) {
      expect(ALLOWED_TAGS.has(entry.tag)).toBe(true);
    }
  });

  test('every axis carries a reference source file from the closed enum', () => {
    for (const entry of ASSET_CACHE_LIFETIME_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every axis has at least one cSourceLines entry and a non-empty invariant', () => {
    for (const entry of ASSET_CACHE_LIFETIME_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThanOrEqual(1);
      expect(entry.invariant.length).toBeGreaterThan(40);
    }
  });

  test('every cSourceLines entry mentions either Z_Malloc, W_CacheLump, or Z_FreeTags', () => {
    for (const entry of ASSET_CACHE_LIFETIME_AUDIT) {
      const flat = entry.cSourceLines.join('\n');
      const mentionsZmalloc = flat.includes('Z_Malloc');
      const mentionsWCache = flat.includes('W_CacheLump');
      const mentionsZFreeTags = flat.includes('Z_FreeTags') || flat.includes('Z_Free');
      expect(mentionsZmalloc || mentionsWCache || mentionsZFreeTags).toBe(true);
    }
  });
});

describe('build-asset-cache-lifetime-policy: purge tag taxonomy', () => {
  test('VANILLA_PURGE_TAGS declares the seven canonical tags asciibetically sorted', () => {
    expect(VANILLA_PURGE_TAGS).toEqual(['PU_CACHE', 'PU_LEVEL', 'PU_LEVSPEC', 'PU_MUSIC', 'PU_PURGELEVEL', 'PU_SOUND', 'PU_STATIC']);
    expect(Object.isFrozen(VANILLA_PURGE_TAGS)).toBe(true);
  });

  test('VANILLA_LIFETIME_CATEGORIES declares the six canonical categories asciibetically sorted', () => {
    expect(VANILLA_LIFETIME_CATEGORIES).toEqual(['level', 'level-special', 'music-playing', 'purgable', 'sound-playing', 'static']);
    expect(Object.isFrozen(VANILLA_LIFETIME_CATEGORIES)).toBe(true);
  });

  test('PURGE_TAG_TO_LIFETIME_CATEGORY is total over the seven tags', () => {
    expect(Object.keys(PURGE_TAG_TO_LIFETIME_CATEGORY).sort()).toEqual([...VANILLA_PURGE_TAGS].sort());
    expect(Object.isFrozen(PURGE_TAG_TO_LIFETIME_CATEGORY)).toBe(true);
  });

  test('PURGE_TAG_TO_LIFETIME_CATEGORY maps the four canonical tags to their canonical categories', () => {
    expect(PURGE_TAG_TO_LIFETIME_CATEGORY.PU_STATIC).toBe('static');
    expect(PURGE_TAG_TO_LIFETIME_CATEGORY.PU_LEVEL).toBe('level');
    expect(PURGE_TAG_TO_LIFETIME_CATEGORY.PU_LEVSPEC).toBe('level-special');
    expect(PURGE_TAG_TO_LIFETIME_CATEGORY.PU_PURGELEVEL).toBe('purgable');
    expect(PURGE_TAG_TO_LIFETIME_CATEGORY.PU_CACHE).toBe('purgable');
    expect(PURGE_TAG_TO_LIFETIME_CATEGORY.PU_SOUND).toBe('sound-playing');
    expect(PURGE_TAG_TO_LIFETIME_CATEGORY.PU_MUSIC).toBe('music-playing');
  });

  test('every value in PURGE_TAG_TO_LIFETIME_CATEGORY belongs to VANILLA_LIFETIME_CATEGORIES', () => {
    for (const tag of VANILLA_PURGE_TAGS) {
      expect(ALLOWED_CATEGORIES.has(PURGE_TAG_TO_LIFETIME_CATEGORY[tag])).toBe(true);
    }
  });
});

describe('build-asset-cache-lifetime-policy: policy table', () => {
  test('ASSET_LIFETIME_POLICY has one row per audit axis except the lifecycle hook', () => {
    const expectedCount = ASSET_CACHE_LIFETIME_AUDIT.filter((entry) => entry.id !== 'level-exit-z-freetags-half-open-interval').length;
    expect(ASSET_LIFETIME_POLICY.length).toBe(expectedCount);
  });

  test('the lifecycle-hook axis is NOT a row in ASSET_LIFETIME_POLICY', () => {
    const found = ASSET_LIFETIME_POLICY.find((row) => row.auditAxisId === 'level-exit-z-freetags-half-open-interval');
    expect(found).toBeUndefined();
  });

  test('every row is frozen and references a valid audit axis', () => {
    const auditIds = new Set(ASSET_CACHE_LIFETIME_AUDIT.map((entry) => entry.id));
    for (const row of ASSET_LIFETIME_POLICY) {
      expect(Object.isFrozen(row)).toBe(true);
      expect(auditIds.has(row.auditAxisId)).toBe(true);
    }
  });

  test('every row tag matches the corresponding audit axis tag', () => {
    for (const row of ASSET_LIFETIME_POLICY) {
      const auditEntry = ASSET_CACHE_LIFETIME_AUDIT.find((entry) => entry.id === row.auditAxisId);
      expect(auditEntry).toBeDefined();
      expect(row.tag).toBe(auditEntry!.tag);
    }
  });

  test('every row category matches PURGE_TAG_TO_LIFETIME_CATEGORY[row.tag]', () => {
    for (const row of ASSET_LIFETIME_POLICY) {
      expect(row.category).toBe(PURGE_TAG_TO_LIFETIME_CATEGORY[row.tag]);
    }
  });

  test('the policy table includes both COLORMAP rows (cache + zmalloc) for the same asset', () => {
    const colormapRows = ASSET_LIFETIME_POLICY.filter((row) => row.asset === 'COLORMAP');
    expect(colormapRows.length).toBe(2);
    for (const row of colormapRows) {
      expect(row.tag).toBe('PU_STATIC');
    }
  });
});

describe('build-asset-cache-lifetime-policy: getLifetimeTagForAsset', () => {
  test('returns PU_CACHE for PLAYPAL', () => {
    expect(getLifetimeTagForAsset('PLAYPAL')).toBe('PU_CACHE');
  });

  test('returns PU_STATIC for COLORMAP, TEXTURE1, PNAMES, STBAR, STARMS, ENDOOM, GENMIDI', () => {
    for (const name of ['COLORMAP', 'TEXTURE1', 'PNAMES', 'STBAR', 'STARMS', 'ENDOOM', 'GENMIDI']) {
      expect(getLifetimeTagForAsset(name)).toBe('PU_STATIC');
    }
  });

  test('returns PU_LEVEL for BLOCKMAP, REJECT, PFUB1, PFUB2', () => {
    for (const name of ['BLOCKMAP', 'REJECT', 'PFUB1', 'PFUB2']) {
      expect(getLifetimeTagForAsset(name)).toBe('PU_LEVEL');
    }
  });

  test('returns PU_CACHE for TITLEPIC, CREDIT, HELP1, HELP2, BOSSBACK, VICTORY2, ENDPIC', () => {
    for (const name of ['TITLEPIC', 'CREDIT', 'HELP1', 'HELP2', 'BOSSBACK', 'VICTORY2', 'ENDPIC']) {
      expect(getLifetimeTagForAsset(name)).toBe('PU_CACHE');
    }
  });

  test('returns null for unknown assets', () => {
    expect(getLifetimeTagForAsset('DOES_NOT_EXIST')).toBeNull();
    expect(getLifetimeTagForAsset('FAKE_LUMP')).toBeNull();
  });

  test('matches asset names case-insensitively', () => {
    expect(getLifetimeTagForAsset('playpal')).toBe('PU_CACHE');
    expect(getLifetimeTagForAsset('BlockMap')).toBe('PU_LEVEL');
    expect(getLifetimeTagForAsset('texture1')).toBe('PU_STATIC');
  });

  test('returns PU_CACHE for sprite-frame-patch (drawn at PU_CACHE)', () => {
    expect(getLifetimeTagForAsset('sprite-frame-patch')).toBe('PU_CACHE');
  });

  test('returns PU_STATIC for spritewidth, spriteoffset, spritetopoffset', () => {
    for (const name of ['spritewidth', 'spriteoffset', 'spritetopoffset']) {
      expect(getLifetimeTagForAsset(name)).toBe('PU_STATIC');
    }
  });

  test('returns PU_STATIC for patchlookup, flattranslation', () => {
    expect(getLifetimeTagForAsset('patchlookup')).toBe('PU_STATIC');
    expect(getLifetimeTagForAsset('flattranslation')).toBe('PU_STATIC');
  });
});

describe('build-asset-cache-lifetime-policy: classifyLifetimeCategory', () => {
  test('returns the canonical category for every tag', () => {
    expect(classifyLifetimeCategory('PU_STATIC')).toBe('static');
    expect(classifyLifetimeCategory('PU_LEVEL')).toBe('level');
    expect(classifyLifetimeCategory('PU_LEVSPEC')).toBe('level-special');
    expect(classifyLifetimeCategory('PU_PURGELEVEL')).toBe('purgable');
    expect(classifyLifetimeCategory('PU_CACHE')).toBe('purgable');
    expect(classifyLifetimeCategory('PU_SOUND')).toBe('sound-playing');
    expect(classifyLifetimeCategory('PU_MUSIC')).toBe('music-playing');
  });
});

describe('build-asset-cache-lifetime-policy: isFreedAtLevelExit', () => {
  test('returns true ONLY for PU_LEVEL and PU_LEVSPEC', () => {
    expect(isFreedAtLevelExit('PU_LEVEL')).toBe(true);
    expect(isFreedAtLevelExit('PU_LEVSPEC')).toBe(true);
  });

  test('returns false for every other tag', () => {
    expect(isFreedAtLevelExit('PU_STATIC')).toBe(false);
    expect(isFreedAtLevelExit('PU_SOUND')).toBe(false);
    expect(isFreedAtLevelExit('PU_MUSIC')).toBe(false);
    expect(isFreedAtLevelExit('PU_PURGELEVEL')).toBe(false);
    expect(isFreedAtLevelExit('PU_CACHE')).toBe(false);
  });
});

describe('build-asset-cache-lifetime-policy: isPurgableTag', () => {
  test('returns true ONLY for PU_PURGELEVEL and PU_CACHE', () => {
    expect(isPurgableTag('PU_PURGELEVEL')).toBe(true);
    expect(isPurgableTag('PU_CACHE')).toBe(true);
  });

  test('returns false for every other tag', () => {
    expect(isPurgableTag('PU_STATIC')).toBe(false);
    expect(isPurgableTag('PU_SOUND')).toBe(false);
    expect(isPurgableTag('PU_MUSIC')).toBe(false);
    expect(isPurgableTag('PU_LEVEL')).toBe(false);
    expect(isPurgableTag('PU_LEVSPEC')).toBe(false);
  });
});

describe('build-asset-cache-lifetime-policy: assetsFreedAtLevelExit', () => {
  test('includes BLOCKMAP, REJECT, PFUB1, PFUB2', () => {
    const assets = assetsFreedAtLevelExit().map((row) => row.asset);
    expect(assets).toContain('BLOCKMAP');
    expect(assets).toContain('REJECT');
    expect(assets).toContain('PFUB1');
    expect(assets).toContain('PFUB2');
  });

  test('excludes PLAYPAL, COLORMAP, TEXTURE1, PNAMES, STBAR, STARMS, ENDOOM, GENMIDI', () => {
    const assets = assetsFreedAtLevelExit().map((row) => row.asset);
    expect(assets).not.toContain('PLAYPAL');
    expect(assets).not.toContain('COLORMAP');
    expect(assets).not.toContain('TEXTURE1');
    expect(assets).not.toContain('PNAMES');
    expect(assets).not.toContain('STBAR');
    expect(assets).not.toContain('STARMS');
    expect(assets).not.toContain('ENDOOM');
    expect(assets).not.toContain('GENMIDI');
  });

  test('excludes purgable cache lumps (TITLEPIC, CREDIT, HELP1, HELP2, BOSSBACK, VICTORY2, ENDPIC)', () => {
    const assets = assetsFreedAtLevelExit().map((row) => row.asset);
    expect(assets).not.toContain('TITLEPIC');
    expect(assets).not.toContain('CREDIT');
    expect(assets).not.toContain('HELP1');
    expect(assets).not.toContain('HELP2');
    expect(assets).not.toContain('BOSSBACK');
    expect(assets).not.toContain('VICTORY2');
    expect(assets).not.toContain('ENDPIC');
  });

  test('every returned row has tag === PU_LEVEL or PU_LEVSPEC', () => {
    for (const row of assetsFreedAtLevelExit()) {
      expect(row.tag === 'PU_LEVEL' || row.tag === 'PU_LEVSPEC').toBe(true);
    }
  });
});

describe('build-asset-cache-lifetime-policy: derived invariants ledger', () => {
  test('declares the expected number of derived invariants', () => {
    expect(ASSET_CACHE_LIFETIME_DERIVED_INVARIANTS.length).toBeGreaterThanOrEqual(20);
  });

  test('every derived invariant has a stable id and non-empty description', () => {
    for (const invariant of ASSET_CACHE_LIFETIME_DERIVED_INVARIANTS) {
      expect(invariant.id.length).toBeGreaterThan(0);
      expect(invariant.description.length).toBeGreaterThan(20);
    }
  });

  test('derived invariant ids are unique', () => {
    const ids = ASSET_CACHE_LIFETIME_DERIVED_INVARIANTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('build-asset-cache-lifetime-policy: cross-check against live runtime snapshot', () => {
  test('crossCheckAssetCacheLifetimeRuntime returns zero failures for the live snapshot', () => {
    const snapshot = buildLiveRuntimeSnapshot();
    const failures = crossCheckAssetCacheLifetimeRuntime(snapshot);
    expect(failures).toEqual([]);
  });
});

describe('build-asset-cache-lifetime-policy: cross-check tampered snapshots', () => {
  function tampered(overrides: Partial<AssetCacheLifetimeRuntimeSnapshot>): AssetCacheLifetimeRuntimeSnapshot {
    return { ...buildLiveRuntimeSnapshot(), ...overrides };
  }

  test('detects a wrong PLAYPAL tag', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ playpalTag: 'PU_STATIC' }));
    expect(failures).toContain('derived:PLAYPAL_LIFETIME_IS_PURGABLE');
    expect(failures).toContain('audit:playpal-cached-pu-cache:not-observed');
  });

  test('detects a wrong COLORMAP tag', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ colormapTag: 'PU_CACHE' }));
    expect(failures).toContain('derived:COLORMAP_LIFETIME_IS_STATIC');
    expect(failures).toContain('audit:colormap-cached-pu-static:not-observed');
  });

  test('detects a wrong TEXTURE1 tag', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ texture1Tag: 'PU_CACHE' }));
    expect(failures).toContain('derived:TEXTURE1_LIFETIME_IS_STATIC');
    expect(failures).toContain('audit:texture1-cached-pu-static:not-observed');
  });

  test('detects a wrong PNAMES tag', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ pnamesTag: 'PU_CACHE' }));
    expect(failures).toContain('derived:PNAMES_LIFETIME_IS_STATIC');
    expect(failures).toContain('audit:pnames-cached-pu-static:not-observed');
  });

  test('detects a wrong BLOCKMAP tag', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ blockmapTag: 'PU_STATIC' }));
    expect(failures).toContain('derived:BLOCKMAP_LIFETIME_IS_LEVEL');
    expect(failures).toContain('audit:blockmap-cached-pu-level:not-observed');
  });

  test('detects a wrong REJECT tag', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ rejectTag: 'PU_STATIC' }));
    expect(failures).toContain('derived:REJECT_LIFETIME_IS_LEVEL');
    expect(failures).toContain('audit:reject-cached-pu-level:not-observed');
  });

  test('detects a wrong PFUB1 tag', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ pfub1Tag: 'PU_CACHE' }));
    expect(failures).toContain('derived:PFUB1_LIFETIME_IS_LEVEL');
    expect(failures).toContain('audit:pfub1-cached-pu-level:not-observed');
  });

  test('detects a wrong PFUB2 tag', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ pfub2Tag: 'PU_CACHE' }));
    expect(failures).toContain('derived:PFUB2_LIFETIME_IS_LEVEL');
    expect(failures).toContain('audit:pfub2-cached-pu-level:not-observed');
  });

  test('detects a wrong TITLEPIC tag', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ titlepicTag: 'PU_STATIC' }));
    expect(failures).toContain('derived:TITLEPIC_LIFETIME_IS_PURGABLE');
    expect(failures).toContain('audit:titlepic-cached-pu-cache:not-observed');
  });

  test('detects a wrong CREDIT tag', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ creditTag: 'PU_STATIC' }));
    expect(failures).toContain('derived:CREDIT_LIFETIME_IS_PURGABLE');
    expect(failures).toContain('audit:credit-cached-pu-cache:not-observed');
  });

  test('detects a wrong STBAR/STARMS tag', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ stbarTag: 'PU_CACHE' }));
    expect(failures).toContain('derived:STBAR_AND_STARMS_LIFETIMES_ARE_STATIC');
    expect(failures).toContain('audit:stbar-cached-pu-static:not-observed');
  });

  test('detects a wrong ENDOOM/GENMIDI tag', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ genmidiTag: 'PU_CACHE' }));
    expect(failures).toContain('derived:ENDOOM_AND_GENMIDI_LIFETIMES_ARE_STATIC');
    expect(failures).toContain('audit:genmidi-cached-pu-static:not-observed');
  });

  test('detects a non-null tag for an unknown asset', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ unknownAssetTag: 'PU_CACHE' }));
    expect(failures).toContain('derived:GET_LIFETIME_TAG_RETURNS_NULL_FOR_UNKNOWN_ASSET');
  });

  test('detects a case-sensitive lookup', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ assetLookupIsCaseInsensitive: false }));
    expect(failures).toContain('derived:GET_LIFETIME_TAG_IS_CASE_INSENSITIVE');
  });

  test('detects PU_LEVEL or PU_LEVSPEC missing from the level-exit interval', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ puLevelIsFreedAtLevelExit: false }));
    expect(failures).toContain('derived:IS_FREED_AT_LEVEL_EXIT_ACCEPTS_PU_LEVEL_AND_PU_LEVSPEC');
    expect(failures).toContain('audit:level-exit-z-freetags-half-open-interval:not-observed');
  });

  test('detects PU_STATIC erroneously freed at level exit', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ puStaticIsFreedAtLevelExit: true }));
    expect(failures).toContain('derived:IS_FREED_AT_LEVEL_EXIT_REJECTS_PU_STATIC');
  });

  test('detects PU_CACHE or PU_PURGELEVEL erroneously freed at level exit', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ puCacheIsFreedAtLevelExit: true }));
    expect(failures).toContain('derived:IS_FREED_AT_LEVEL_EXIT_REJECTS_PU_CACHE');
  });

  test('detects PU_CACHE or PU_PURGELEVEL not flagged purgable', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ puCacheIsPurgable: false }));
    expect(failures).toContain('derived:IS_PURGABLE_TAG_ACCEPTS_PU_CACHE');
  });

  test('detects PU_STATIC erroneously flagged purgable', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ puStaticIsPurgable: true }));
    expect(failures).toContain('derived:IS_PURGABLE_TAG_REJECTS_PU_STATIC');
  });

  test('detects PU_LEVEL erroneously flagged purgable', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ puLevelIsPurgable: true }));
    expect(failures).toContain('derived:IS_PURGABLE_TAG_REJECTS_PU_LEVEL');
  });

  test('detects level-exit set missing BLOCKMAP/REJECT', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ levelExitIncludesBlockmapAndReject: false }));
    expect(failures).toContain('derived:ASSETS_FREED_AT_LEVEL_EXIT_INCLUDES_BLOCKMAP_AND_REJECT');
  });

  test('detects level-exit set missing PFUB1/PFUB2', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ levelExitIncludesPfub1AndPfub2: false }));
    expect(failures).toContain('derived:ASSETS_FREED_AT_LEVEL_EXIT_INCLUDES_PFUB1_AND_PFUB2');
  });

  test('detects PLAYPAL erroneously included in level-exit set', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ levelExitExcludesPlaypal: false }));
    expect(failures).toContain('derived:ASSETS_FREED_AT_LEVEL_EXIT_EXCLUDES_PLAYPAL');
  });

  test('detects COLORMAP erroneously included in level-exit set', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ levelExitExcludesColormap: false }));
    expect(failures).toContain('derived:ASSETS_FREED_AT_LEVEL_EXIT_EXCLUDES_COLORMAP');
  });

  test('detects PU_STATIC mapped to a wrong category', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ puStaticCategory: 'purgable' }));
    expect(failures).toContain('derived:PU_STATIC_MAPS_TO_STATIC_CATEGORY');
  });

  test('detects PU_LEVEL mapped to a wrong category', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ puLevelCategory: 'static' }));
    expect(failures).toContain('derived:PU_LEVEL_MAPS_TO_LEVEL_CATEGORY');
  });

  test('detects PU_LEVSPEC mapped to a wrong category', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ puLevSpecCategory: 'static' }));
    expect(failures).toContain('derived:PU_LEVSPEC_MAPS_TO_LEVEL_SPECIAL_CATEGORY');
  });

  test('detects PU_CACHE mapped to a wrong category', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ puCacheCategory: 'static' }));
    expect(failures).toContain('derived:PU_CACHE_MAPS_TO_PURGABLE_CATEGORY');
  });

  test('detects PU_PURGELEVEL mapped to a wrong category', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ puPurgeLevelCategory: 'static' }));
    expect(failures).toContain('derived:PU_PURGELEVEL_MAPS_TO_PURGABLE_CATEGORY');
  });

  test('detects PU_SOUND mapped to a wrong category', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ puSoundCategory: 'static' }));
    expect(failures).toContain('derived:PU_SOUND_MAPS_TO_SOUND_PLAYING_CATEGORY');
  });

  test('detects PU_MUSIC mapped to a wrong category', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ puMusicCategory: 'static' }));
    expect(failures).toContain('derived:PU_MUSIC_MAPS_TO_MUSIC_PLAYING_CATEGORY');
  });

  test('detects an unsorted purge tag list', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ purgeTagsAreSorted: false }));
    expect(failures).toContain('derived:PURGE_TAG_LIST_IS_ASCIIBETICALLY_SORTED');
  });

  test('detects an unsorted lifetime category list', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ lifetimeCategoriesAreSorted: false }));
    expect(failures).toContain('derived:LIFETIME_CATEGORY_LIST_IS_ASCIIBETICALLY_SORTED');
  });

  test('detects a non-frozen purge tag map', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ purgeTagMapIsFrozen: false }));
    expect(failures).toContain('derived:PURGE_TAG_TO_LIFETIME_CATEGORY_IS_TOTAL');
  });

  test('detects an incomplete purge tag map', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ purgeTagMapIsTotal: false }));
    expect(failures).toContain('derived:PURGE_TAG_TO_LIFETIME_CATEGORY_IS_TOTAL');
  });

  test('detects policy table missing a row', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ policyTableHasEntryPerAuditAxis: false }));
    expect(failures).toContain('derived:POLICY_TABLE_HAS_ENTRY_PER_AUDIT_AXIS');
  });

  test('detects policy table tags drifting from audit tags', () => {
    const failures = crossCheckAssetCacheLifetimeRuntime(tampered({ policyTableTagsMatchAuditTags: false }));
    expect(failures).toContain('derived:POLICY_TABLE_TAGS_MATCH_AUDIT_TAGS');
  });
});
