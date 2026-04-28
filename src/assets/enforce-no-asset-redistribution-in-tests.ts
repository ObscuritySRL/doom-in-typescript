/**
 * Audit ledger plus runtime contract for enforcing the
 * no-asset-redistribution-in-tests rule against the vanilla DOOM 1.9
 * proprietary asset boundary.
 *
 * The proprietary asset non-redistribution boundary pinned by
 * `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md`
 * (and reinforced by `plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.md`
 * and `plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md`)
 * forbids this repository, its tests, and any artifact derived from
 * either, from bundling, regenerating, fabricating, substituting,
 * staging for commit, embedding, or republishing under an alternate
 * name the bytes of any of the following proprietary id Software
 * artifacts:
 *
 *   - `DOOM.EXE`     (mixed shareware DOS + GPL Chocolate Doom Windows polyglot — forbidden)
 *   - `DOOM.WAD`     (user-supplied registered/Ultimate IWAD — forbidden)
 *   - `DOOM1.WAD`    (id Software shareware IWAD — forbidden)
 *   - `DOOMD.EXE`    (id Software shareware DOS executable — forbidden)
 *   - `DOOMDUPX.EXE` (UPX-packed id Software shareware DOS executable — forbidden)
 *
 * The user-supplied Ultimate alternate basename `doomu.wad` is also
 * forbidden because it carries the same Ultimate IWAD bytes under a
 * different name.
 *
 * The drop locations `doom/` and `iwad/` are user-supplied only and
 * are gitignored: tests must never stage anything inside them for
 * commit, even though the runtime may load the user's own copy from
 * those paths.
 *
 * Four GPL or utility files share the gitignored `doom/` directory
 * with the proprietary assets and are pinned by the same boundary
 * document as `permitted-with-notice` (`DOOMWUPX.exe`,
 * `chocolate-doom.cfg`, `default.cfg`, `smash.py`); these files may
 * be redistributed when accompanied by their original license notices
 * but are still not staged for commit by this repository because the
 * `doom/` directory itself is gitignored.
 *
 * Tests that exercise behavior tied to a proprietary asset MUST skip
 * cleanly when the asset is absent at one of the documented drop
 * locations, rather than regenerate, fabricate, or substitute the
 * proprietary bytes in any way.
 *
 * This module pins that boundary:
 *
 * 1. The audit ledger pins every forbidden filename, every forbidden
 *    SHA-256 hash, every permitted-with-notice filename, every
 *    user-supplied drop location, every license category that drives
 *    redistribution policy, every test-suite redistribution rule, and
 *    a single ledger-completeness gate.
 * 2. The derived invariants ledger converts each axis into an
 *    observable runtime fact (e.g. `isProprietaryFilename("DOOM.EXE")`
 *    must return `true` regardless of casing).
 * 3. The runtime helpers `isProprietaryFilename`,
 *    `isProprietarySha256`, `isPermittedWithNoticeFilename`,
 *    `isInsideUserSuppliedDropLocation`, `classifyAssetForRedistribution`,
 *    `assertTestArtifactPathIsNotProprietary`,
 *    `assertTestPayloadHashIsNotProprietary`, and
 *    `shouldSkipTestWhenAssetAbsent` enforce the boundary at the
 *    test-suite shape level. The runtime errors
 *    `ProprietaryAssetRedistributionError` carry the structured fields
 *    required to surface a clear actionable message.
 * 4. The cross-check helper `crossCheckNoAssetRedistributionRuntime`
 *    consumes a runtime snapshot and reports the list of derived
 *    invariants that fail, by stable identifier. The focused test
 *    exercises both the live runtime snapshot (zero failures) and a
 *    deliberately tampered snapshot per axis (every axis fails
 *    closed).
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE` (presence-only authority — never read for content),
 *   2. local IWAD `doom/DOOM1.WAD` (presence-only authority — never read for content),
 *   3. local Windows oracle `doom/DOOM.EXE` (presence-only authority — never read for content),
 *   4. id Software `linuxdoom-1.10` source (`w_wad.c`, `r_data.c`,
 *      `p_setup.c`) — the upstream source that the proprietary IWAD
 *      bytes were originally produced for; cited by reference only,
 *      never copied here,
 *   5. Chocolate Doom 2.2.1 source (`src/d_iwad.c`) — the user-supplied
 *      IWAD discovery contract that pins the relative drop locations,
 *   6. `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md`,
 *      `plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.md`,
 *      and `plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md`
 *      — the project-level pins of the boundary,
 *   7. `src/reference/policy.ts` (`ASSET_BOUNDARIES`,
 *      `LicenseCategory`, `RedistributionPolicy`,
 *      `REFERENCE_BUNDLE_PATH`) — the runtime constants that already
 *      classify each bundle file by license and redistribution
 *      policy,
 *   8. `reference/manifests/file-hashes.json` — the SHA-256 hash
 *      manifest pinned for the four shareware/mixed proprietary
 *      binaries plus the four permitted-with-notice files (cited by
 *      reference; the proprietary hashes are recopied here so the
 *      runtime check is self-contained).
 *
 * This module does NOT itself read any IWAD or proprietary file: it
 * is a pure contract that consumers (the test harness, the build
 * tooling, the future bootstrap IWAD discovery) can call into to
 * surface a uniform redistribution-rejection error.
 */

/**
 * Asciibetically sorted, frozen list of basename strings the
 * repository must never bundle, regenerate, stage for commit, embed,
 * or republish under any alternate name.
 *
 * Five proprietary id Software basenames pinned by
 * `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md`
 * plus the user-supplied Ultimate alternate basename `doomu.wad`
 * pinned by
 * `plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md`
 * (which permits the Ultimate IWAD to be dropped as either
 * `DOOM.WAD` or `doomu.wad`).
 */
export const PROHIBITED_PROPRIETARY_FILENAMES: readonly string[] = Object.freeze(['DOOM.EXE', 'DOOM.WAD', 'DOOM1.WAD', 'DOOMD.EXE', 'DOOMDUPX.EXE', 'doomu.wad']);

/**
 * Asciibetically sorted, frozen list of uppercase hex SHA-256 hashes
 * for the four shareware/mixed proprietary binaries pinned in
 * `reference/manifests/file-hashes.json`.
 *
 * Test fixtures and oracle captures must never embed any of these
 * hashes as the SHA-256 of an artifact that the test produces; if a
 * test produces an artifact whose SHA-256 matches one of these
 * values, the test is regenerating the proprietary bytes and must be
 * rejected. (No SHA-256 is pinned for the user-supplied registered
 * or Ultimate `DOOM.WAD` because no canonical hash is bundled
 * locally and the user-supplied IWAD may be one of several
 * historical version fingerprints.)
 */
export const PROHIBITED_PROPRIETARY_SHA256_HASHES: readonly string[] = Object.freeze([
  '051868114DF076FD0BAE8632D0D565B11EF85BB714B12D453F84F2E2E45E4764',
  '1D7D43BE501E67D927E415E0B8F3E29C3BF33075E859721816F652A526CAC771',
  '5CA97717FD79F833B248AE5985FFFADBEE39533F5E0529BC9D7B439E08B8F1D2',
  '9D3216605417888D5A699FA3794E46638EB4CB8634501AE748D74F9C2CFAE37B',
]);

/**
 * Asciibetically sorted, frozen list of basename strings for the four
 * GPL or utility files that share the gitignored `doom/` directory
 * with the proprietary id Software assets.
 *
 * These files may be redistributed when accompanied by their original
 * license notices, but the repository still does not stage them for
 * commit because the `doom/` directory is gitignored as a unit.
 */
export const PERMITTED_WITH_NOTICE_FILENAMES: readonly string[] = Object.freeze(['DOOMWUPX.exe', 'chocolate-doom.cfg', 'default.cfg', 'smash.py']);

/**
 * Asciibetically sorted, frozen list of relative directory prefixes
 * the user may drop a proprietary IWAD or executable at. Both
 * directories are gitignored as a unit; tests must never stage
 * anything inside them for commit.
 */
export const USER_SUPPLIED_DROP_LOCATIONS: readonly string[] = Object.freeze(['doom', 'iwad']);

/**
 * Asciibetically sorted, frozen list of basename strings the user
 * may legitimately drop into one of the user-supplied drop locations
 * to satisfy the registered or Ultimate IWAD requirement. These
 * basenames remain forbidden for redistribution: the repository must
 * never stage them, even if the user has dropped a copy locally.
 */
export const USER_SUPPLIED_PROPRIETARY_IWAD_BASENAMES: readonly string[] = Object.freeze(['DOOM.WAD', 'doomu.wad']);

/**
 * One audited rule of the no-asset-redistribution-in-tests boundary.
 *
 * Each entry pins one filename, one SHA-256, one drop location, one
 * license category, one redistribution policy, one test-suite rule,
 * or the single ledger-completeness gate.
 */
export interface NoAssetRedistributionAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'proprietary-filename-doom-exe-forbidden'
    | 'proprietary-filename-doom-wad-forbidden'
    | 'proprietary-filename-doom1-wad-forbidden'
    | 'proprietary-filename-doomd-exe-forbidden'
    | 'proprietary-filename-doomdupx-exe-forbidden'
    | 'proprietary-filename-doomu-wad-forbidden'
    | 'proprietary-sha256-doom-exe-pinned'
    | 'proprietary-sha256-doom1-wad-pinned'
    | 'proprietary-sha256-doomd-exe-pinned'
    | 'proprietary-sha256-doomdupx-exe-pinned'
    | 'permitted-filename-doomwupx-exe-not-staged'
    | 'permitted-filename-chocolate-doom-cfg-not-staged'
    | 'permitted-filename-default-cfg-not-staged'
    | 'permitted-filename-smash-py-not-staged'
    | 'user-supplied-drop-location-doom-gitignored'
    | 'user-supplied-drop-location-iwad-gitignored'
    | 'license-category-commercial-shareware-forbidden'
    | 'license-category-mixed-polyglot-forbidden'
    | 'license-category-gpl-permitted-with-notice'
    | 'license-category-utility-permitted-with-notice'
    | 'tests-must-skip-when-proprietary-asset-absent'
    | 'tests-must-not-regenerate-proprietary-bytes'
    | 'tests-must-not-fabricate-proprietary-bytes'
    | 'tests-must-not-substitute-proprietary-bytes'
    | 'tests-must-not-stage-proprietary-bytes-for-commit'
    | 'tests-must-not-publish-proprietary-under-alternate-name'
    | 'tests-must-not-embed-proprietary-bytes-in-output'
    | 'tests-must-not-derive-binary-from-proprietary-bytes'
    | 'reference-bundle-path-locks-doom-as-read-only-source';
  /** Which on-disk concept this axis pins. */
  readonly subject: 'proprietary-asset-filename' | 'proprietary-asset-sha256' | 'permitted-with-notice-asset' | 'user-supplied-drop-location' | 'license-category' | 'test-suite-redistribution-rule' | 'reference-bundle-root';
  /** Reference source(s) cited from the upstream tree. */
  readonly referenceSourceFile:
    | 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md'
    | 'plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.md'
    | 'plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md'
    | 'src/reference/policy.ts'
    | 'src/reference/target.ts'
    | 'reference/manifests/file-hashes.json'
    | '.gitignore';
  /** Plain-language description of the redistribution rule the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every redistribution rule the runtime must
 * preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const NO_ASSET_REDISTRIBUTION_AUDIT: readonly NoAssetRedistributionAuditEntry[] = [
  {
    id: 'proprietary-filename-doom-exe-forbidden',
    subject: 'proprietary-asset-filename',
    referenceSourceFile: 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md',
    invariant:
      'The basename `DOOM.EXE` is the local merged polyglot Windows executable (id Software shareware DOS code merged with GPL Chocolate Doom 2.2.1 Windows code). The shareware DOS half collapses the whole binary into the `forbidden` redistribution bucket. `isProprietaryFilename("DOOM.EXE")` returns `true` regardless of casing.',
  },
  {
    id: 'proprietary-filename-doom-wad-forbidden',
    subject: 'proprietary-asset-filename',
    referenceSourceFile: 'plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md',
    invariant:
      'The basename `DOOM.WAD` is the user-supplied registered or Ultimate id Software IWAD. It is proprietary and never redistributed by this repository under any name. `isProprietaryFilename("DOOM.WAD")` returns `true` regardless of casing.',
  },
  {
    id: 'proprietary-filename-doom1-wad-forbidden',
    subject: 'proprietary-asset-filename',
    referenceSourceFile: 'plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.md',
    invariant: 'The basename `DOOM1.WAD` is the shareware id Software IWAD that the primary parity target loads. It is proprietary and never redistributed. `isProprietaryFilename("DOOM1.WAD")` returns `true` regardless of casing.',
  },
  {
    id: 'proprietary-filename-doomd-exe-forbidden',
    subject: 'proprietary-asset-filename',
    referenceSourceFile: 'plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.md',
    invariant: 'The basename `DOOMD.EXE` is the shareware id Software DOS executable. It is proprietary and never redistributed. `isProprietaryFilename("DOOMD.EXE")` returns `true` regardless of casing.',
  },
  {
    id: 'proprietary-filename-doomdupx-exe-forbidden',
    subject: 'proprietary-asset-filename',
    referenceSourceFile: 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md',
    invariant: 'The basename `DOOMDUPX.EXE` is the UPX-packed id Software shareware DOS executable. It is proprietary and never redistributed. `isProprietaryFilename("DOOMDUPX.EXE")` returns `true` regardless of casing.',
  },
  {
    id: 'proprietary-filename-doomu-wad-forbidden',
    subject: 'proprietary-asset-filename',
    referenceSourceFile: 'plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md',
    invariant: 'The basename `doomu.wad` is the user-supplied Ultimate id Software IWAD alternate name. It is proprietary and never redistributed; `isProprietaryFilename("doomu.wad")` returns `true` regardless of casing.',
  },
  {
    id: 'proprietary-sha256-doom-exe-pinned',
    subject: 'proprietary-asset-sha256',
    referenceSourceFile: 'reference/manifests/file-hashes.json',
    invariant:
      'The SHA-256 `5CA97717FD79F833B248AE5985FFFADBEE39533F5E0529BC9D7B439E08B8F1D2` identifies the local merged polyglot `DOOM.EXE`. Any test artifact that hashes to this value would be regenerating the proprietary bytes; `isProprietarySha256` returns `true` for this hash regardless of casing.',
  },
  {
    id: 'proprietary-sha256-doom1-wad-pinned',
    subject: 'proprietary-asset-sha256',
    referenceSourceFile: 'reference/manifests/file-hashes.json',
    invariant:
      'The SHA-256 `1D7D43BE501E67D927E415E0B8F3E29C3BF33075E859721816F652A526CAC771` identifies the shareware `DOOM1.WAD`. Any test artifact that hashes to this value would be regenerating the proprietary IWAD bytes; `isProprietarySha256` returns `true` for this hash regardless of casing.',
  },
  {
    id: 'proprietary-sha256-doomd-exe-pinned',
    subject: 'proprietary-asset-sha256',
    referenceSourceFile: 'reference/manifests/file-hashes.json',
    invariant:
      'The SHA-256 `9D3216605417888D5A699FA3794E46638EB4CB8634501AE748D74F9C2CFAE37B` identifies the shareware DOS `DOOMD.EXE`. Any test artifact that hashes to this value would be regenerating the proprietary DOS executable; `isProprietarySha256` returns `true` for this hash regardless of casing.',
  },
  {
    id: 'proprietary-sha256-doomdupx-exe-pinned',
    subject: 'proprietary-asset-sha256',
    referenceSourceFile: 'reference/manifests/file-hashes.json',
    invariant:
      'The SHA-256 `051868114DF076FD0BAE8632D0D565B11EF85BB714B12D453F84F2E2E45E4764` identifies the UPX-packed shareware DOS `DOOMDUPX.EXE`. Any test artifact that hashes to this value would be regenerating the proprietary DOS executable; `isProprietarySha256` returns `true` for this hash regardless of casing.',
  },
  {
    id: 'permitted-filename-doomwupx-exe-not-staged',
    subject: 'permitted-with-notice-asset',
    referenceSourceFile: 'src/reference/policy.ts',
    invariant:
      'The basename `DOOMWUPX.exe` is the UPX-packed Chocolate Doom Windows binary classified as `gpl` / `permitted-with-notice` in `ASSET_BOUNDARIES`. It may be redistributed with its original GPL v2+ notice intact, but the repository does not stage it for commit because it shares the gitignored `doom/` directory. `isPermittedWithNoticeFilename("DOOMWUPX.exe")` returns `true`.',
  },
  {
    id: 'permitted-filename-chocolate-doom-cfg-not-staged',
    subject: 'permitted-with-notice-asset',
    referenceSourceFile: 'src/reference/policy.ts',
    invariant:
      'The basename `chocolate-doom.cfg` is the Chocolate Doom 2.2.1 host configuration file classified as `gpl` / `permitted-with-notice` in `ASSET_BOUNDARIES`. It may be redistributed with the GPL v2+ notice intact, but the repository does not stage it for commit. `isPermittedWithNoticeFilename("chocolate-doom.cfg")` returns `true`.',
  },
  {
    id: 'permitted-filename-default-cfg-not-staged',
    subject: 'permitted-with-notice-asset',
    referenceSourceFile: 'src/reference/policy.ts',
    invariant:
      'The basename `default.cfg` is the vanilla DOOM defaults file generated by Chocolate Doom; classified as `gpl` / `permitted-with-notice` in `ASSET_BOUNDARIES`. It may be redistributed with the GPL v2+ notice intact, but the repository does not stage it for commit. `isPermittedWithNoticeFilename("default.cfg")` returns `true`.',
  },
  {
    id: 'permitted-filename-smash-py-not-staged',
    subject: 'permitted-with-notice-asset',
    referenceSourceFile: 'src/reference/policy.ts',
    invariant:
      'The basename `smash.py` is the binary merge utility distributed by the bundle author; classified as `utility` / `permitted-with-notice` in `ASSET_BOUNDARIES`. The repository does not stage it for commit. `isPermittedWithNoticeFilename("smash.py")` returns `true`.',
  },
  {
    id: 'user-supplied-drop-location-doom-gitignored',
    subject: 'user-supplied-drop-location',
    referenceSourceFile: '.gitignore',
    invariant:
      'The relative directory `doom/` is gitignored and reserved as the primary user-supplied drop location for the proprietary id Software shareware bundle. The repository must never stage anything inside it for commit. `isInsideUserSuppliedDropLocation("doom/DOOM1.WAD")` returns `true`.',
  },
  {
    id: 'user-supplied-drop-location-iwad-gitignored',
    subject: 'user-supplied-drop-location',
    referenceSourceFile: '.gitignore',
    invariant:
      'The relative directory `iwad/` is gitignored and reserved as the secondary user-supplied drop location for the proprietary id Software shareware IWAD plus user-supplied registered or Ultimate IWADs. The repository must never stage anything inside it for commit. `isInsideUserSuppliedDropLocation("iwad/DOOM.WAD")` returns `true`.',
  },
  {
    id: 'license-category-commercial-shareware-forbidden',
    subject: 'license-category',
    referenceSourceFile: 'src/reference/policy.ts',
    invariant: 'The `LicenseCategory` `commercial-shareware` (covering `DOOM1.WAD`, `DOOMD.EXE`, `DOOMDUPX.EXE`) maps to `RedistributionPolicy === "forbidden"`. `classifyAssetForRedistribution("DOOM1.WAD")` returns `"forbidden"`.',
  },
  {
    id: 'license-category-mixed-polyglot-forbidden',
    subject: 'license-category',
    referenceSourceFile: 'src/reference/policy.ts',
    invariant:
      'The `LicenseCategory` `mixed` (covering the polyglot `DOOM.EXE` whose shareware DOS half collapses the whole binary into the forbidden bucket) maps to `RedistributionPolicy === "forbidden"`. `classifyAssetForRedistribution("DOOM.EXE")` returns `"forbidden"`.',
  },
  {
    id: 'license-category-gpl-permitted-with-notice',
    subject: 'license-category',
    referenceSourceFile: 'src/reference/policy.ts',
    invariant:
      'The `LicenseCategory` `gpl` (covering `DOOMWUPX.exe`, `chocolate-doom.cfg`, `default.cfg`) maps to `RedistributionPolicy === "permitted-with-notice"`. `classifyAssetForRedistribution("DOOMWUPX.exe")` returns `"permitted-with-notice"`.',
  },
  {
    id: 'license-category-utility-permitted-with-notice',
    subject: 'license-category',
    referenceSourceFile: 'src/reference/policy.ts',
    invariant: 'The `LicenseCategory` `utility` (covering `smash.py`) maps to `RedistributionPolicy === "permitted-with-notice"`. `classifyAssetForRedistribution("smash.py")` returns `"permitted-with-notice"`.',
  },
  {
    id: 'tests-must-skip-when-proprietary-asset-absent',
    subject: 'test-suite-redistribution-rule',
    referenceSourceFile: 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md',
    invariant:
      'Tests that exercise behavior tied to a proprietary asset MUST skip cleanly when the asset is absent at one of the documented user-supplied drop locations. `shouldSkipTestWhenAssetAbsent(path, exists)` returns `true` when `exists === false` and the basename is one of the proprietary-asset filenames.',
  },
  {
    id: 'tests-must-not-regenerate-proprietary-bytes',
    subject: 'test-suite-redistribution-rule',
    referenceSourceFile: 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md',
    invariant:
      'Tests must never regenerate the bytes of any proprietary asset (e.g. by emitting a fixture whose SHA-256 matches the pinned shareware IWAD). `assertTestPayloadHashIsNotProprietary(hash)` throws `ProprietaryAssetRedistributionError` when `hash` matches one of the pinned proprietary SHA-256 hashes.',
  },
  {
    id: 'tests-must-not-fabricate-proprietary-bytes',
    subject: 'test-suite-redistribution-rule',
    referenceSourceFile: 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md',
    invariant:
      'Tests must never fabricate the bytes of any proprietary asset by hand-authored substitution; the same `assertTestPayloadHashIsNotProprietary(hash)` runtime check rejects any fabricated payload whose SHA-256 matches the pinned proprietary hashes.',
  },
  {
    id: 'tests-must-not-substitute-proprietary-bytes',
    subject: 'test-suite-redistribution-rule',
    referenceSourceFile: 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md',
    invariant: 'Tests must never substitute one proprietary asset for another (e.g. emit a synthesized IWAD that hash-collides with the proprietary IWAD); the SHA-256 check is the runtime gate.',
  },
  {
    id: 'tests-must-not-stage-proprietary-bytes-for-commit',
    subject: 'test-suite-redistribution-rule',
    referenceSourceFile: 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md',
    invariant:
      'Tests must never stage a fixture whose path is inside one of the user-supplied drop locations or whose basename matches a proprietary filename. `assertTestArtifactPathIsNotProprietary(path)` throws `ProprietaryAssetRedistributionError` for any such path.',
  },
  {
    id: 'tests-must-not-publish-proprietary-under-alternate-name',
    subject: 'test-suite-redistribution-rule',
    referenceSourceFile: 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md',
    invariant: 'Tests must never publish a proprietary asset under an alternate name (e.g. rename DOOM1.WAD → SHAREWARE.WAD). The SHA-256 check rejects any test artifact regardless of basename.',
  },
  {
    id: 'tests-must-not-embed-proprietary-bytes-in-output',
    subject: 'test-suite-redistribution-rule',
    referenceSourceFile: 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md',
    invariant: 'Tests must never embed proprietary bytes (or any prefix sufficient to identify them) in test output, snapshot fixtures, or oracle JSON files. The same `assertTestPayloadHashIsNotProprietary` check is the runtime gate.',
  },
  {
    id: 'tests-must-not-derive-binary-from-proprietary-bytes',
    subject: 'test-suite-redistribution-rule',
    referenceSourceFile: 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md',
    invariant: 'Tests must never produce a derived binary or data file that embeds the bytes of any proprietary asset. The same `assertTestPayloadHashIsNotProprietary` check is the runtime gate.',
  },
  {
    id: 'reference-bundle-path-locks-doom-as-read-only-source',
    subject: 'reference-bundle-root',
    referenceSourceFile: 'src/reference/policy.ts',
    invariant: '`REFERENCE_BUNDLE_PATH` resolves to the absolute `doom/` directory at the project root; this is the read-only reference bundle root. `isInsideUserSuppliedDropLocation("doom/anything.WAD")` returns `true`.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on
 * top of the raw audit entries. Failures point at concrete
 * identities that any vanilla parity rebuild must preserve.
 */
export interface NoAssetRedistributionDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const NO_ASSET_REDISTRIBUTION_DERIVED_INVARIANTS: readonly NoAssetRedistributionDerivedInvariant[] = [
  {
    id: 'PROHIBITED_FILENAMES_INCLUDE_DOOM_EXE',
    description: '`PROHIBITED_PROPRIETARY_FILENAMES` includes `DOOM.EXE`.',
  },
  {
    id: 'PROHIBITED_FILENAMES_INCLUDE_DOOM_WAD',
    description: '`PROHIBITED_PROPRIETARY_FILENAMES` includes `DOOM.WAD`.',
  },
  {
    id: 'PROHIBITED_FILENAMES_INCLUDE_DOOM1_WAD',
    description: '`PROHIBITED_PROPRIETARY_FILENAMES` includes `DOOM1.WAD`.',
  },
  {
    id: 'PROHIBITED_FILENAMES_INCLUDE_DOOMD_EXE',
    description: '`PROHIBITED_PROPRIETARY_FILENAMES` includes `DOOMD.EXE`.',
  },
  {
    id: 'PROHIBITED_FILENAMES_INCLUDE_DOOMDUPX_EXE',
    description: '`PROHIBITED_PROPRIETARY_FILENAMES` includes `DOOMDUPX.EXE`.',
  },
  {
    id: 'PROHIBITED_FILENAMES_INCLUDE_DOOMU_WAD',
    description: '`PROHIBITED_PROPRIETARY_FILENAMES` includes `doomu.wad`.',
  },
  {
    id: 'IS_PROPRIETARY_FILENAME_IS_CASE_INSENSITIVE',
    description: '`isProprietaryFilename` matches both upper-cased (`DOOM1.WAD`), lower-cased (`doom1.wad`), and mixed-case (`Doom1.Wad`) queries.',
  },
  {
    id: 'IS_PROPRIETARY_FILENAME_REJECTS_UNRELATED_NAMES',
    description: '`isProprietaryFilename` returns `false` for unrelated basenames (e.g. `README.md`, `STBAR.LMP`).',
  },
  {
    id: 'PROHIBITED_SHA256_INCLUDES_DOOM1_WAD_HASH',
    description: '`PROHIBITED_PROPRIETARY_SHA256_HASHES` includes the canonical shareware `DOOM1.WAD` SHA-256 from `reference/manifests/file-hashes.json`.',
  },
  {
    id: 'PROHIBITED_SHA256_INCLUDES_DOOM_EXE_HASH',
    description: '`PROHIBITED_PROPRIETARY_SHA256_HASHES` includes the canonical merged polyglot `DOOM.EXE` SHA-256.',
  },
  {
    id: 'PROHIBITED_SHA256_INCLUDES_DOOMD_EXE_HASH',
    description: '`PROHIBITED_PROPRIETARY_SHA256_HASHES` includes the canonical shareware DOS `DOOMD.EXE` SHA-256.',
  },
  {
    id: 'PROHIBITED_SHA256_INCLUDES_DOOMDUPX_EXE_HASH',
    description: '`PROHIBITED_PROPRIETARY_SHA256_HASHES` includes the canonical UPX-packed shareware DOS `DOOMDUPX.EXE` SHA-256.',
  },
  {
    id: 'IS_PROPRIETARY_SHA256_IS_CASE_INSENSITIVE',
    description: '`isProprietarySha256` matches both upper-cased and lower-cased hex queries.',
  },
  {
    id: 'IS_PROPRIETARY_SHA256_REJECTS_UNRELATED_HASHES',
    description: '`isProprietarySha256` returns `false` for unrelated SHA-256 hashes (including the GPL `DOOMWUPX.exe` hash).',
  },
  {
    id: 'PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_DOOMWUPX_EXE',
    description: '`PERMITTED_WITH_NOTICE_FILENAMES` includes `DOOMWUPX.exe`.',
  },
  {
    id: 'PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_CHOCOLATE_DOOM_CFG',
    description: '`PERMITTED_WITH_NOTICE_FILENAMES` includes `chocolate-doom.cfg`.',
  },
  {
    id: 'PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_DEFAULT_CFG',
    description: '`PERMITTED_WITH_NOTICE_FILENAMES` includes `default.cfg`.',
  },
  {
    id: 'PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_SMASH_PY',
    description: '`PERMITTED_WITH_NOTICE_FILENAMES` includes `smash.py`.',
  },
  {
    id: 'USER_SUPPLIED_DROP_LOCATIONS_INCLUDE_DOOM',
    description: '`USER_SUPPLIED_DROP_LOCATIONS` includes the relative directory `doom`.',
  },
  {
    id: 'USER_SUPPLIED_DROP_LOCATIONS_INCLUDE_IWAD',
    description: '`USER_SUPPLIED_DROP_LOCATIONS` includes the relative directory `iwad`.',
  },
  {
    id: 'USER_SUPPLIED_DROP_LOCATIONS_AND_PROHIBITED_AND_PERMITTED_ARE_DISJOINT',
    description: 'The drop-location, prohibited-filename, and permitted-with-notice sets do not share any string element.',
  },
  {
    id: 'IS_INSIDE_USER_SUPPLIED_DROP_LOCATION_HANDLES_DOOM_PREFIX',
    description: '`isInsideUserSuppliedDropLocation("doom/DOOM1.WAD")` returns `true`; `isInsideUserSuppliedDropLocation("doom\\DOOM1.WAD")` returns `true` (Windows path separator).',
  },
  {
    id: 'IS_INSIDE_USER_SUPPLIED_DROP_LOCATION_HANDLES_IWAD_PREFIX',
    description: '`isInsideUserSuppliedDropLocation("iwad/DOOM.WAD")` returns `true`; `isInsideUserSuppliedDropLocation("iwad\\DOOM.WAD")` returns `true`.',
  },
  {
    id: 'IS_INSIDE_USER_SUPPLIED_DROP_LOCATION_REJECTS_TEST_FIXTURES_PREFIX',
    description: '`isInsideUserSuppliedDropLocation("test/oracles/fixtures/probe.json")` returns `false`; only the two pinned drop directories are inside the boundary.',
  },
  {
    id: 'CLASSIFY_ASSET_RETURNS_FORBIDDEN_FOR_COMMERCIAL_SHAREWARE',
    description: '`classifyAssetForRedistribution("DOOM1.WAD")`, `classifyAssetForRedistribution("DOOMD.EXE")`, and `classifyAssetForRedistribution("DOOMDUPX.EXE")` all return `"forbidden"`.',
  },
  {
    id: 'CLASSIFY_ASSET_RETURNS_FORBIDDEN_FOR_MIXED_POLYGLOT',
    description: '`classifyAssetForRedistribution("DOOM.EXE")` returns `"forbidden"`.',
  },
  {
    id: 'CLASSIFY_ASSET_RETURNS_PERMITTED_WITH_NOTICE_FOR_GPL',
    description: '`classifyAssetForRedistribution("DOOMWUPX.exe")`, `classifyAssetForRedistribution("chocolate-doom.cfg")`, and `classifyAssetForRedistribution("default.cfg")` all return `"permitted-with-notice"`.',
  },
  {
    id: 'CLASSIFY_ASSET_RETURNS_PERMITTED_WITH_NOTICE_FOR_UTILITY',
    description: '`classifyAssetForRedistribution("smash.py")` returns `"permitted-with-notice"`.',
  },
  {
    id: 'CLASSIFY_ASSET_RETURNS_NULL_FOR_UNKNOWN_FILENAME',
    description: '`classifyAssetForRedistribution("README.md")` returns `null` (not a classified bundle file).',
  },
  {
    id: 'ASSERT_TEST_ARTIFACT_PATH_THROWS_ON_PROPRIETARY_FILENAME',
    description: '`assertTestArtifactPathIsNotProprietary("test/oracles/fixtures/DOOM1.WAD")` throws `ProprietaryAssetRedistributionError` because the basename matches a proprietary filename.',
  },
  {
    id: 'ASSERT_TEST_ARTIFACT_PATH_THROWS_ON_DROP_LOCATION_PATH',
    description: '`assertTestArtifactPathIsNotProprietary("doom/anything.bin")` throws `ProprietaryAssetRedistributionError` because the path is inside a user-supplied drop location.',
  },
  {
    id: 'ASSERT_TEST_ARTIFACT_PATH_DOES_NOT_THROW_FOR_REGULAR_FIXTURE',
    description: '`assertTestArtifactPathIsNotProprietary("test/oracles/fixtures/probe.json")` does not throw.',
  },
  {
    id: 'ASSERT_TEST_PAYLOAD_HASH_THROWS_ON_PROPRIETARY_HASH',
    description: '`assertTestPayloadHashIsNotProprietary(<DOOM1.WAD SHA-256>)` throws `ProprietaryAssetRedistributionError`.',
  },
  {
    id: 'ASSERT_TEST_PAYLOAD_HASH_DOES_NOT_THROW_FOR_BENIGN_HASH',
    description: '`assertTestPayloadHashIsNotProprietary("0000000000000000000000000000000000000000000000000000000000000000")` does not throw.',
  },
  {
    id: 'SHOULD_SKIP_TEST_WHEN_ASSET_ABSENT_RETURNS_TRUE_WHEN_PROPRIETARY_ABSENT',
    description: '`shouldSkipTestWhenAssetAbsent("doom/DOOM1.WAD", false)` returns `true`.',
  },
  {
    id: 'SHOULD_SKIP_TEST_WHEN_ASSET_ABSENT_RETURNS_FALSE_WHEN_PROPRIETARY_PRESENT',
    description: '`shouldSkipTestWhenAssetAbsent("doom/DOOM1.WAD", true)` returns `false`.',
  },
  {
    id: 'SHOULD_SKIP_TEST_WHEN_ASSET_ABSENT_RETURNS_FALSE_FOR_NON_PROPRIETARY_PATH',
    description: '`shouldSkipTestWhenAssetAbsent("test/oracles/fixtures/probe.json", false)` returns `false` (non-proprietary fixtures are not gated by the boundary).',
  },
  {
    id: 'PROPRIETARY_ASSET_REDISTRIBUTION_ERROR_CARRIES_REASON_AND_OFFENDING_VALUE',
    description: '`ProprietaryAssetRedistributionError` carries `reason` (`"path"` or `"hash"`) and `offendingValue` (the input that triggered the rejection).',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/**
 * Reason a `ProprietaryAssetRedistributionError` was raised.
 */
export type ProprietaryAssetRedistributionRejectionReason = 'path' | 'hash';

/**
 * Error thrown when a test attempts to embed, regenerate, fabricate,
 * substitute, stage, or publish a proprietary asset (by path or by
 * SHA-256).
 *
 * The runtime carries `reason` (`"path"` for filename / drop-location
 * matches; `"hash"` for SHA-256 matches) and `offendingValue` (the
 * literal input that triggered the rejection) so callers can
 * pattern-match on the reason and build a remediation message.
 */
export class ProprietaryAssetRedistributionError extends Error {
  /** Discriminant: which kind of input triggered the rejection. */
  readonly reason: ProprietaryAssetRedistributionRejectionReason;
  /** The literal input that triggered the rejection. */
  readonly offendingValue: string;

  constructor(reason: ProprietaryAssetRedistributionRejectionReason, offendingValue: string, message: string) {
    super(message);
    this.reason = reason;
    this.offendingValue = offendingValue;
    this.name = 'ProprietaryAssetRedistributionError';
  }
}

/**
 * Test whether a basename matches one of the proprietary id Software
 * filenames pinned by `PROHIBITED_PROPRIETARY_FILENAMES`.
 *
 * The match is case-insensitive: vanilla DOOM 1.9 IWAD discovery is
 * case-insensitive (Chocolate Doom 2.2.1 `D_FindIWAD` matches by
 * lowercase basename), and the drop-location filesystems are
 * typically case-insensitive on Windows.
 *
 * @param basename - Basename to test (no directory prefix).
 * @returns `true` if `basename` (case-insensitively) matches one of the proprietary filenames.
 */
export function isProprietaryFilename(basename: string): boolean {
  const upper = basename.toUpperCase();
  for (const candidate of PROHIBITED_PROPRIETARY_FILENAMES) {
    if (candidate.toUpperCase() === upper) {
      return true;
    }
  }
  return false;
}

/**
 * Test whether a SHA-256 hex string matches one of the pinned
 * proprietary SHA-256 hashes.
 *
 * The match is case-insensitive: SHA-256 digests are conventionally
 * presented in either uppercase or lowercase hex.
 *
 * @param sha256 - SHA-256 hex string (with or without uppercase).
 * @returns `true` if `sha256` (case-insensitively) matches one of the pinned proprietary hashes.
 */
export function isProprietarySha256(sha256: string): boolean {
  const upper = sha256.toUpperCase();
  for (const candidate of PROHIBITED_PROPRIETARY_SHA256_HASHES) {
    if (candidate.toUpperCase() === upper) {
      return true;
    }
  }
  return false;
}

/**
 * Test whether a basename matches one of the four GPL or utility
 * files pinned by `PERMITTED_WITH_NOTICE_FILENAMES`.
 *
 * The match is case-sensitive on the literal recorded basename
 * because the upstream GPL distribution chooses each filename's
 * casing deliberately (`DOOMWUPX.exe` vs `chocolate-doom.cfg` vs
 * `default.cfg` vs `smash.py`).
 *
 * @param basename - Basename to test (no directory prefix).
 * @returns `true` if `basename` exactly matches one of the permitted-with-notice filenames.
 */
export function isPermittedWithNoticeFilename(basename: string): boolean {
  return PERMITTED_WITH_NOTICE_FILENAMES.includes(basename);
}

/**
 * Test whether a relative path is inside one of the user-supplied
 * drop locations (`doom/` or `iwad/`).
 *
 * The match is on the leading directory name only: any path beginning
 * with `doom/`, `doom\`, `iwad/`, or `iwad\` (case-insensitive) is
 * inside the boundary. A bare `doom` or `iwad` prefix without a
 * separator is also accepted to handle the case where the input is
 * just the directory name itself.
 *
 * @param relativePath - Forward- or backward-slashed relative path (project-relative).
 * @returns `true` if `relativePath` is inside one of the user-supplied drop directories.
 */
export function isInsideUserSuppliedDropLocation(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  for (const dir of USER_SUPPLIED_DROP_LOCATIONS) {
    const lowerDir = dir.toLowerCase();
    if (normalized === lowerDir || normalized.startsWith(`${lowerDir}/`)) {
      return true;
    }
  }
  return false;
}

/**
 * Classify a known reference bundle filename by redistribution
 * policy.
 *
 * Mirrors the `ASSET_BOUNDARIES` classification in
 * `src/reference/policy.ts` and is intentionally limited to that
 * list: any filename outside the eight cataloged entries returns
 * `null` rather than guessing.
 *
 * @param filename - Basename to classify (case-sensitive on the
 *   literal recorded casing in `ASSET_BOUNDARIES`).
 * @returns `"forbidden"` for proprietary or polyglot bundle files,
 *   `"permitted-with-notice"` for GPL or utility bundle files,
 *   `null` for any unclassified filename.
 */
export function classifyAssetForRedistribution(filename: string): 'forbidden' | 'permitted-with-notice' | null {
  switch (filename) {
    case 'DOOM.EXE':
    case 'DOOM1.WAD':
    case 'DOOMD.EXE':
    case 'DOOMDUPX.EXE':
      return 'forbidden';
    case 'DOOMWUPX.exe':
    case 'chocolate-doom.cfg':
    case 'default.cfg':
    case 'smash.py':
      return 'permitted-with-notice';
    default:
      return null;
  }
}

/**
 * Assert a test-artifact path does not embed or republish a
 * proprietary asset.
 *
 * Throws `ProprietaryAssetRedistributionError` (with `reason ===
 * "path"`) when:
 *   - the path's basename matches one of the proprietary filenames
 *     pinned by `PROHIBITED_PROPRIETARY_FILENAMES`, OR
 *   - the path is inside one of the user-supplied drop locations
 *     pinned by `USER_SUPPLIED_DROP_LOCATIONS`.
 *
 * @param relativePath - Forward- or backward-slashed relative path.
 * @throws {ProprietaryAssetRedistributionError} If `relativePath` is in the redistribution boundary.
 */
export function assertTestArtifactPathIsNotProprietary(relativePath: string): void {
  const normalized = relativePath.replace(/\\/g, '/');
  const lastSlashIndex = normalized.lastIndexOf('/');
  const basename = lastSlashIndex === -1 ? normalized : normalized.slice(lastSlashIndex + 1);
  if (isProprietaryFilename(basename)) {
    throw new ProprietaryAssetRedistributionError('path', relativePath, `Refusing to stage test artifact "${relativePath}": basename "${basename}" matches a proprietary id Software asset that this repository must not redistribute.`);
  }
  if (isInsideUserSuppliedDropLocation(relativePath)) {
    throw new ProprietaryAssetRedistributionError(
      'path',
      relativePath,
      `Refusing to stage test artifact "${relativePath}": path is inside a user-supplied drop location (${USER_SUPPLIED_DROP_LOCATIONS.join(', ')}) which is gitignored and must never be staged for commit.`,
    );
  }
}

/**
 * Assert a test-artifact SHA-256 does not regenerate the bytes of a
 * proprietary asset.
 *
 * Throws `ProprietaryAssetRedistributionError` (with `reason ===
 * "hash"`) when `sha256` (case-insensitively) matches one of the
 * pinned proprietary hashes.
 *
 * @param sha256 - SHA-256 hex string of the test artifact's bytes.
 * @throws {ProprietaryAssetRedistributionError} If `sha256` matches a proprietary asset's hash.
 */
export function assertTestPayloadHashIsNotProprietary(sha256: string): void {
  if (isProprietarySha256(sha256)) {
    throw new ProprietaryAssetRedistributionError(
      'hash',
      sha256,
      `Refusing to accept test payload with SHA-256 "${sha256}": hash matches a proprietary id Software asset that this repository must not regenerate, fabricate, substitute, or republish.`,
    );
  }
}

/**
 * Decide whether a test that exercises behavior tied to a proprietary
 * asset must skip when the asset is absent.
 *
 * Returns `true` when the asset is absent (`exists === false`) AND
 * the path's basename is one of the proprietary filenames pinned by
 * `PROHIBITED_PROPRIETARY_FILENAMES`, OR when the asset is absent
 * AND the path is inside a user-supplied drop location. Returns
 * `false` when the asset is present, or when the path is not gated
 * by the redistribution boundary.
 *
 * @param relativePath - Forward- or backward-slashed relative path of the asset under test.
 * @param exists - Whether the asset is present at `relativePath`.
 * @returns `true` if the test must skip cleanly because the proprietary asset is absent.
 */
export function shouldSkipTestWhenAssetAbsent(relativePath: string, exists: boolean): boolean {
  if (exists) {
    return false;
  }
  const normalized = relativePath.replace(/\\/g, '/');
  const lastSlashIndex = normalized.lastIndexOf('/');
  const basename = lastSlashIndex === -1 ? normalized : normalized.slice(lastSlashIndex + 1);
  if (isProprietaryFilename(basename)) {
    return true;
  }
  if (isInsideUserSuppliedDropLocation(relativePath)) {
    return true;
  }
  return false;
}

/**
 * Snapshot of the runtime constants and helper behaviors exposed by
 * `src/assets/enforce-no-asset-redistribution-in-tests.ts`. The
 * cross-check helper consumes this shape so the focused test can
 * both verify the live runtime exports and exercise a deliberately
 * tampered snapshot to prove the failure modes are observable.
 */
export interface NoAssetRedistributionRuntimeSnapshot {
  readonly prohibitedFilenamesIncludeDoomExe: boolean;
  readonly prohibitedFilenamesIncludeDoomWad: boolean;
  readonly prohibitedFilenamesIncludeDoom1Wad: boolean;
  readonly prohibitedFilenamesIncludeDoomdExe: boolean;
  readonly prohibitedFilenamesIncludeDoomdupxExe: boolean;
  readonly prohibitedFilenamesIncludeDoomuWad: boolean;
  readonly isProprietaryFilenameIsCaseInsensitive: boolean;
  readonly isProprietaryFilenameRejectsUnrelatedNames: boolean;
  readonly prohibitedSha256IncludesDoom1WadHash: boolean;
  readonly prohibitedSha256IncludesDoomExeHash: boolean;
  readonly prohibitedSha256IncludesDoomdExeHash: boolean;
  readonly prohibitedSha256IncludesDoomdupxExeHash: boolean;
  readonly isProprietarySha256IsCaseInsensitive: boolean;
  readonly isProprietarySha256RejectsUnrelatedHashes: boolean;
  readonly permittedWithNoticeIncludesDoomwupxExe: boolean;
  readonly permittedWithNoticeIncludesChocolateDoomCfg: boolean;
  readonly permittedWithNoticeIncludesDefaultCfg: boolean;
  readonly permittedWithNoticeIncludesSmashPy: boolean;
  readonly userSuppliedDropLocationsIncludeDoom: boolean;
  readonly userSuppliedDropLocationsIncludeIwad: boolean;
  readonly userSuppliedAndProhibitedAndPermittedAreDisjoint: boolean;
  readonly isInsideUserSuppliedDropLocationHandlesDoomPrefix: boolean;
  readonly isInsideUserSuppliedDropLocationHandlesIwadPrefix: boolean;
  readonly isInsideUserSuppliedDropLocationRejectsTestFixturesPrefix: boolean;
  readonly classifyAssetReturnsForbiddenForCommercialShareware: boolean;
  readonly classifyAssetReturnsForbiddenForMixedPolyglot: boolean;
  readonly classifyAssetReturnsPermittedWithNoticeForGpl: boolean;
  readonly classifyAssetReturnsPermittedWithNoticeForUtility: boolean;
  readonly classifyAssetReturnsNullForUnknownFilename: boolean;
  readonly assertTestArtifactPathThrowsOnProprietaryFilename: boolean;
  readonly assertTestArtifactPathThrowsOnDropLocationPath: boolean;
  readonly assertTestArtifactPathDoesNotThrowForRegularFixture: boolean;
  readonly assertTestPayloadHashThrowsOnProprietaryHash: boolean;
  readonly assertTestPayloadHashDoesNotThrowForBenignHash: boolean;
  readonly shouldSkipTestWhenAssetAbsentReturnsTrueWhenProprietaryAbsent: boolean;
  readonly shouldSkipTestWhenAssetAbsentReturnsFalseWhenProprietaryPresent: boolean;
  readonly shouldSkipTestWhenAssetAbsentReturnsFalseForNonProprietaryPath: boolean;
  readonly proprietaryAssetRedistributionErrorCarriesReasonAndOffendingValue: boolean;
}

/**
 * Cross-check a `NoAssetRedistributionRuntimeSnapshot` against
 * `NO_ASSET_REDISTRIBUTION_AUDIT` and
 * `NO_ASSET_REDISTRIBUTION_DERIVED_INVARIANTS`. Returns the list of
 * failures by stable identifier; an empty list means the snapshot is
 * parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the
 *    snapshot.
 */
export function crossCheckNoAssetRedistributionRuntime(snapshot: NoAssetRedistributionRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (!snapshot.prohibitedFilenamesIncludeDoomExe) {
    failures.push('derived:PROHIBITED_FILENAMES_INCLUDE_DOOM_EXE');
    failures.push('audit:proprietary-filename-doom-exe-forbidden:not-observed');
  }
  if (!snapshot.prohibitedFilenamesIncludeDoomWad) {
    failures.push('derived:PROHIBITED_FILENAMES_INCLUDE_DOOM_WAD');
    failures.push('audit:proprietary-filename-doom-wad-forbidden:not-observed');
  }
  if (!snapshot.prohibitedFilenamesIncludeDoom1Wad) {
    failures.push('derived:PROHIBITED_FILENAMES_INCLUDE_DOOM1_WAD');
    failures.push('audit:proprietary-filename-doom1-wad-forbidden:not-observed');
  }
  if (!snapshot.prohibitedFilenamesIncludeDoomdExe) {
    failures.push('derived:PROHIBITED_FILENAMES_INCLUDE_DOOMD_EXE');
    failures.push('audit:proprietary-filename-doomd-exe-forbidden:not-observed');
  }
  if (!snapshot.prohibitedFilenamesIncludeDoomdupxExe) {
    failures.push('derived:PROHIBITED_FILENAMES_INCLUDE_DOOMDUPX_EXE');
    failures.push('audit:proprietary-filename-doomdupx-exe-forbidden:not-observed');
  }
  if (!snapshot.prohibitedFilenamesIncludeDoomuWad) {
    failures.push('derived:PROHIBITED_FILENAMES_INCLUDE_DOOMU_WAD');
    failures.push('audit:proprietary-filename-doomu-wad-forbidden:not-observed');
  }
  if (!snapshot.isProprietaryFilenameIsCaseInsensitive) {
    failures.push('derived:IS_PROPRIETARY_FILENAME_IS_CASE_INSENSITIVE');
  }
  if (!snapshot.isProprietaryFilenameRejectsUnrelatedNames) {
    failures.push('derived:IS_PROPRIETARY_FILENAME_REJECTS_UNRELATED_NAMES');
  }
  if (!snapshot.prohibitedSha256IncludesDoom1WadHash) {
    failures.push('derived:PROHIBITED_SHA256_INCLUDES_DOOM1_WAD_HASH');
    failures.push('audit:proprietary-sha256-doom1-wad-pinned:not-observed');
  }
  if (!snapshot.prohibitedSha256IncludesDoomExeHash) {
    failures.push('derived:PROHIBITED_SHA256_INCLUDES_DOOM_EXE_HASH');
    failures.push('audit:proprietary-sha256-doom-exe-pinned:not-observed');
  }
  if (!snapshot.prohibitedSha256IncludesDoomdExeHash) {
    failures.push('derived:PROHIBITED_SHA256_INCLUDES_DOOMD_EXE_HASH');
    failures.push('audit:proprietary-sha256-doomd-exe-pinned:not-observed');
  }
  if (!snapshot.prohibitedSha256IncludesDoomdupxExeHash) {
    failures.push('derived:PROHIBITED_SHA256_INCLUDES_DOOMDUPX_EXE_HASH');
    failures.push('audit:proprietary-sha256-doomdupx-exe-pinned:not-observed');
  }
  if (!snapshot.isProprietarySha256IsCaseInsensitive) {
    failures.push('derived:IS_PROPRIETARY_SHA256_IS_CASE_INSENSITIVE');
  }
  if (!snapshot.isProprietarySha256RejectsUnrelatedHashes) {
    failures.push('derived:IS_PROPRIETARY_SHA256_REJECTS_UNRELATED_HASHES');
  }
  if (!snapshot.permittedWithNoticeIncludesDoomwupxExe) {
    failures.push('derived:PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_DOOMWUPX_EXE');
    failures.push('audit:permitted-filename-doomwupx-exe-not-staged:not-observed');
  }
  if (!snapshot.permittedWithNoticeIncludesChocolateDoomCfg) {
    failures.push('derived:PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_CHOCOLATE_DOOM_CFG');
    failures.push('audit:permitted-filename-chocolate-doom-cfg-not-staged:not-observed');
  }
  if (!snapshot.permittedWithNoticeIncludesDefaultCfg) {
    failures.push('derived:PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_DEFAULT_CFG');
    failures.push('audit:permitted-filename-default-cfg-not-staged:not-observed');
  }
  if (!snapshot.permittedWithNoticeIncludesSmashPy) {
    failures.push('derived:PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_SMASH_PY');
    failures.push('audit:permitted-filename-smash-py-not-staged:not-observed');
  }
  if (!snapshot.userSuppliedDropLocationsIncludeDoom) {
    failures.push('derived:USER_SUPPLIED_DROP_LOCATIONS_INCLUDE_DOOM');
    failures.push('audit:user-supplied-drop-location-doom-gitignored:not-observed');
  }
  if (!snapshot.userSuppliedDropLocationsIncludeIwad) {
    failures.push('derived:USER_SUPPLIED_DROP_LOCATIONS_INCLUDE_IWAD');
    failures.push('audit:user-supplied-drop-location-iwad-gitignored:not-observed');
  }
  if (!snapshot.userSuppliedAndProhibitedAndPermittedAreDisjoint) {
    failures.push('derived:USER_SUPPLIED_DROP_LOCATIONS_AND_PROHIBITED_AND_PERMITTED_ARE_DISJOINT');
  }
  if (!snapshot.isInsideUserSuppliedDropLocationHandlesDoomPrefix) {
    failures.push('derived:IS_INSIDE_USER_SUPPLIED_DROP_LOCATION_HANDLES_DOOM_PREFIX');
  }
  if (!snapshot.isInsideUserSuppliedDropLocationHandlesIwadPrefix) {
    failures.push('derived:IS_INSIDE_USER_SUPPLIED_DROP_LOCATION_HANDLES_IWAD_PREFIX');
  }
  if (!snapshot.isInsideUserSuppliedDropLocationRejectsTestFixturesPrefix) {
    failures.push('derived:IS_INSIDE_USER_SUPPLIED_DROP_LOCATION_REJECTS_TEST_FIXTURES_PREFIX');
  }
  if (!snapshot.classifyAssetReturnsForbiddenForCommercialShareware) {
    failures.push('derived:CLASSIFY_ASSET_RETURNS_FORBIDDEN_FOR_COMMERCIAL_SHAREWARE');
    failures.push('audit:license-category-commercial-shareware-forbidden:not-observed');
  }
  if (!snapshot.classifyAssetReturnsForbiddenForMixedPolyglot) {
    failures.push('derived:CLASSIFY_ASSET_RETURNS_FORBIDDEN_FOR_MIXED_POLYGLOT');
    failures.push('audit:license-category-mixed-polyglot-forbidden:not-observed');
  }
  if (!snapshot.classifyAssetReturnsPermittedWithNoticeForGpl) {
    failures.push('derived:CLASSIFY_ASSET_RETURNS_PERMITTED_WITH_NOTICE_FOR_GPL');
    failures.push('audit:license-category-gpl-permitted-with-notice:not-observed');
  }
  if (!snapshot.classifyAssetReturnsPermittedWithNoticeForUtility) {
    failures.push('derived:CLASSIFY_ASSET_RETURNS_PERMITTED_WITH_NOTICE_FOR_UTILITY');
    failures.push('audit:license-category-utility-permitted-with-notice:not-observed');
  }
  if (!snapshot.classifyAssetReturnsNullForUnknownFilename) {
    failures.push('derived:CLASSIFY_ASSET_RETURNS_NULL_FOR_UNKNOWN_FILENAME');
  }
  if (!snapshot.assertTestArtifactPathThrowsOnProprietaryFilename) {
    failures.push('derived:ASSERT_TEST_ARTIFACT_PATH_THROWS_ON_PROPRIETARY_FILENAME');
    failures.push('audit:tests-must-not-stage-proprietary-bytes-for-commit:not-observed');
    failures.push('audit:tests-must-not-publish-proprietary-under-alternate-name:not-observed');
  }
  if (!snapshot.assertTestArtifactPathThrowsOnDropLocationPath) {
    failures.push('derived:ASSERT_TEST_ARTIFACT_PATH_THROWS_ON_DROP_LOCATION_PATH');
    failures.push('audit:tests-must-not-stage-proprietary-bytes-for-commit:not-observed');
  }
  if (!snapshot.assertTestArtifactPathDoesNotThrowForRegularFixture) {
    failures.push('derived:ASSERT_TEST_ARTIFACT_PATH_DOES_NOT_THROW_FOR_REGULAR_FIXTURE');
  }
  if (!snapshot.assertTestPayloadHashThrowsOnProprietaryHash) {
    failures.push('derived:ASSERT_TEST_PAYLOAD_HASH_THROWS_ON_PROPRIETARY_HASH');
    failures.push('audit:tests-must-not-regenerate-proprietary-bytes:not-observed');
    failures.push('audit:tests-must-not-fabricate-proprietary-bytes:not-observed');
    failures.push('audit:tests-must-not-substitute-proprietary-bytes:not-observed');
    failures.push('audit:tests-must-not-embed-proprietary-bytes-in-output:not-observed');
    failures.push('audit:tests-must-not-derive-binary-from-proprietary-bytes:not-observed');
  }
  if (!snapshot.assertTestPayloadHashDoesNotThrowForBenignHash) {
    failures.push('derived:ASSERT_TEST_PAYLOAD_HASH_DOES_NOT_THROW_FOR_BENIGN_HASH');
  }
  if (!snapshot.shouldSkipTestWhenAssetAbsentReturnsTrueWhenProprietaryAbsent) {
    failures.push('derived:SHOULD_SKIP_TEST_WHEN_ASSET_ABSENT_RETURNS_TRUE_WHEN_PROPRIETARY_ABSENT');
    failures.push('audit:tests-must-skip-when-proprietary-asset-absent:not-observed');
  }
  if (!snapshot.shouldSkipTestWhenAssetAbsentReturnsFalseWhenProprietaryPresent) {
    failures.push('derived:SHOULD_SKIP_TEST_WHEN_ASSET_ABSENT_RETURNS_FALSE_WHEN_PROPRIETARY_PRESENT');
  }
  if (!snapshot.shouldSkipTestWhenAssetAbsentReturnsFalseForNonProprietaryPath) {
    failures.push('derived:SHOULD_SKIP_TEST_WHEN_ASSET_ABSENT_RETURNS_FALSE_FOR_NON_PROPRIETARY_PATH');
  }
  if (!snapshot.proprietaryAssetRedistributionErrorCarriesReasonAndOffendingValue) {
    failures.push('derived:PROPRIETARY_ASSET_REDISTRIBUTION_ERROR_CARRIES_REASON_AND_OFFENDING_VALUE');
  }

  const declaredAxes = new Set(NO_ASSET_REDISTRIBUTION_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<NoAssetRedistributionAuditEntry['id']> = [
    'proprietary-filename-doom-exe-forbidden',
    'proprietary-filename-doom-wad-forbidden',
    'proprietary-filename-doom1-wad-forbidden',
    'proprietary-filename-doomd-exe-forbidden',
    'proprietary-filename-doomdupx-exe-forbidden',
    'proprietary-filename-doomu-wad-forbidden',
    'proprietary-sha256-doom-exe-pinned',
    'proprietary-sha256-doom1-wad-pinned',
    'proprietary-sha256-doomd-exe-pinned',
    'proprietary-sha256-doomdupx-exe-pinned',
    'permitted-filename-doomwupx-exe-not-staged',
    'permitted-filename-chocolate-doom-cfg-not-staged',
    'permitted-filename-default-cfg-not-staged',
    'permitted-filename-smash-py-not-staged',
    'user-supplied-drop-location-doom-gitignored',
    'user-supplied-drop-location-iwad-gitignored',
    'license-category-commercial-shareware-forbidden',
    'license-category-mixed-polyglot-forbidden',
    'license-category-gpl-permitted-with-notice',
    'license-category-utility-permitted-with-notice',
    'tests-must-skip-when-proprietary-asset-absent',
    'tests-must-not-regenerate-proprietary-bytes',
    'tests-must-not-fabricate-proprietary-bytes',
    'tests-must-not-substitute-proprietary-bytes',
    'tests-must-not-stage-proprietary-bytes-for-commit',
    'tests-must-not-publish-proprietary-under-alternate-name',
    'tests-must-not-embed-proprietary-bytes-in-output',
    'tests-must-not-derive-binary-from-proprietary-bytes',
    'reference-bundle-path-locks-doom-as-read-only-source',
  ];
  for (const axis of requiredAxes) {
    if (!declaredAxes.has(axis)) {
      failures.push('derived:EVERY_AUDIT_AXIS_IS_DECLARED');
      break;
    }
  }

  return failures;
}
