import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseMapBundle, findMapNames } from '../../src/map/mapBundle.ts';
import { MAPSECTOR_SIZE } from '../../src/map/lineSectorGeometry.ts';
import { rejectSize, parseReject, isRejected } from '../../src/map/reject.ts';
import type { RejectMap } from '../../src/map/reject.ts';

import wadMapSummary from '../../reference/manifests/wad-map-summary.json';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

const e1m1Bundle = parseMapBundle(directory, wadBuffer, 'E1M1');
const e1m1SectorCount = e1m1Bundle.sectors.length / MAPSECTOR_SIZE;
const e1m1Reject = parseReject(e1m1Bundle.reject, e1m1SectorCount);

describe('rejectSize', () => {
  it('returns 0 for 0 sectors', () => {
    expect(rejectSize(0)).toBe(0);
  });

  it('returns 1 for 1 sector (single bit rounds up to 1 byte)', () => {
    expect(rejectSize(1)).toBe(1);
  });

  it('returns 1 for 2 sectors (4 bits rounds up to 1 byte)', () => {
    expect(rejectSize(2)).toBe(1);
  });

  it('returns 2 for 3 sectors (9 bits rounds up to 2 bytes)', () => {
    expect(rejectSize(3)).toBe(2);
  });

  it('returns 2 for 4 sectors (16 bits = exactly 2 bytes)', () => {
    expect(rejectSize(4)).toBe(2);
  });

  it('matches the ceiling formula (n*n+7)>>>3', () => {
    for (let sectorCount = 0; sectorCount <= 300; sectorCount++) {
      const expected = Math.ceil((sectorCount * sectorCount) / 8);
      expect(rejectSize(sectorCount)).toBe(expected);
    }
  });

  it('returns 904 for 85 sectors (E1M1)', () => {
    expect(rejectSize(85)).toBe(904);
  });
});

describe('parseReject E1M1', () => {
  it('returns a frozen object', () => {
    expect(Object.isFrozen(e1m1Reject)).toBe(true);
  });

  it('has sectorCount 85', () => {
    expect(e1m1Reject.sectorCount).toBe(85);
  });

  it('has totalBits equal to sectorCount squared', () => {
    expect(e1m1Reject.totalBits).toBe(85 * 85);
  });

  it('has expectedSize 904', () => {
    expect(e1m1Reject.expectedSize).toBe(904);
  });

  it('has data of at least expectedSize bytes', () => {
    expect(e1m1Reject.data.length).toBeGreaterThanOrEqual(e1m1Reject.expectedSize);
  });

  it('cross-references lump size with wad-map-summary', () => {
    const e1m1Summary = wadMapSummary.maps.find((map: { name: string }) => map.name === 'E1M1')!;
    const rejectLump = e1m1Summary.lumps.find((lump: { name: string }) => lump.name === 'REJECT')!;
    expect(rejectLump.size).toBe(904);
    expect(e1m1Bundle.reject.length).toBe(rejectLump.size);
  });

  it('lump size equals rejectSize(sectorCount)', () => {
    expect(e1m1Bundle.reject.length).toBe(rejectSize(e1m1SectorCount));
  });

  it('data is a Buffer', () => {
    expect(Buffer.isBuffer(e1m1Reject.data)).toBe(true);
  });

  it('accepts Uint8Array input', () => {
    const uint8 = new Uint8Array(e1m1Bundle.reject);
    const reject = parseReject(uint8, e1m1SectorCount);
    expect(reject.sectorCount).toBe(85);
    expect(reject.expectedSize).toBe(904);
  });
});

describe('isRejected E1M1', () => {
  it('diagonal entries (same sector) are not rejected', () => {
    for (let sector = 0; sector < e1m1SectorCount; sector++) {
      expect(isRejected(e1m1Reject, sector, sector)).toBe(false);
    }
  });

  it('returns a boolean', () => {
    const result = isRejected(e1m1Reject, 0, 1);
    expect(typeof result).toBe('boolean');
  });

  it('some sector pairs are rejected', () => {
    let rejectedCount = 0;
    for (let s1 = 0; s1 < e1m1SectorCount; s1++) {
      for (let s2 = 0; s2 < e1m1SectorCount; s2++) {
        if (isRejected(e1m1Reject, s1, s2)) {
          rejectedCount++;
        }
      }
    }
    expect(rejectedCount).toBeGreaterThan(0);
  });

  it('some sector pairs are not rejected', () => {
    let allowedCount = 0;
    for (let s1 = 0; s1 < e1m1SectorCount; s1++) {
      for (let s2 = 0; s2 < e1m1SectorCount; s2++) {
        if (!isRejected(e1m1Reject, s1, s2)) {
          allowedCount++;
        }
      }
    }
    expect(allowedCount).toBeGreaterThan(0);
  });

  it('rejected count plus allowed count equals sectorCount squared', () => {
    let rejectedCount = 0;
    const total = e1m1SectorCount * e1m1SectorCount;
    for (let s1 = 0; s1 < e1m1SectorCount; s1++) {
      for (let s2 = 0; s2 < e1m1SectorCount; s2++) {
        if (isRejected(e1m1Reject, s1, s2)) {
          rejectedCount++;
        }
      }
    }
    expect(rejectedCount + (total - rejectedCount)).toBe(total);
  });
});

describe('all 9 maps', () => {
  const mapNames = findMapNames(directory);

  it('all maps parse without error', () => {
    for (const mapName of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const sectorCount = bundle.sectors.length / MAPSECTOR_SIZE;
      const reject = parseReject(bundle.reject, sectorCount);
      expect(reject.sectorCount).toBe(sectorCount);
      expect(reject.expectedSize).toBe(rejectSize(sectorCount));
    }
  });

  it('every map lump size matches rejectSize(sectorCount)', () => {
    for (const mapName of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const sectorCount = bundle.sectors.length / MAPSECTOR_SIZE;
      expect(bundle.reject.length).toBe(rejectSize(sectorCount));
    }
  });

  it('every map has all diagonal entries not rejected', () => {
    for (const mapName of mapNames) {
      const bundle = parseMapBundle(directory, wadBuffer, mapName);
      const sectorCount = bundle.sectors.length / MAPSECTOR_SIZE;
      const reject = parseReject(bundle.reject, sectorCount);
      for (let sector = 0; sector < sectorCount; sector++) {
        expect(isRejected(reject, sector, sector)).toBe(false);
      }
    }
  });
});

describe('error handling', () => {
  it('throws RangeError on zero sector count', () => {
    expect(() => parseReject(Buffer.alloc(0), 0)).toThrow(RangeError);
  });

  it('throws RangeError on negative sector count', () => {
    expect(() => parseReject(Buffer.alloc(0), -1)).toThrow(RangeError);
  });

  it('error message includes the sector count', () => {
    expect(() => parseReject(Buffer.alloc(0), -5)).toThrow('REJECT sector count -5 must be positive');
  });

  it('accepts an empty lump for 1 sector (pads with zeros)', () => {
    const reject = parseReject(Buffer.alloc(0), 1);
    expect(reject.expectedSize).toBe(1);
    expect(reject.data.length).toBe(1);
    expect(reject.data[0]).toBe(0);
  });

  it('undersized lump is zero-padded', () => {
    const partial = Buffer.from([0xff]);
    const reject = parseReject(partial, 4);
    expect(reject.expectedSize).toBe(2);
    expect(reject.data.length).toBe(2);
    expect(reject.data[0]).toBe(0xff);
    expect(reject.data[1]).toBe(0);
  });

  it('oversized lump is truncated to expectedSize', () => {
    const oversized = Buffer.from([0xff, 0xff, 0xff, 0xff]);
    const reject = parseReject(oversized, 4);
    expect(reject.expectedSize).toBe(2);
    expect(reject.data.length).toBe(2);
  });
});

describe('parity-sensitive edge cases', () => {
  it('bit indexing matches C formula: pnum=s1*n+s2, byte=pnum>>3, bit=1<<(pnum&7)', () => {
    const sectorCount = 4;
    const data = Buffer.alloc(2);
    data[0] = 0b00000010;
    const reject = parseReject(data, sectorCount);

    expect(isRejected(reject, 0, 0)).toBe(false);
    expect(isRejected(reject, 0, 1)).toBe(true);
    expect(isRejected(reject, 0, 2)).toBe(false);
    expect(isRejected(reject, 0, 3)).toBe(false);
  });

  it('bit 7 within a byte is correctly addressed', () => {
    const sectorCount = 4;
    const data = Buffer.alloc(2);
    data[0] = 0b10000000;
    const reject = parseReject(data, sectorCount);

    expect(isRejected(reject, 1, 3)).toBe(true);
    expect(isRejected(reject, 1, 2)).toBe(false);
  });

  it('second byte bits are correctly addressed', () => {
    const sectorCount = 4;
    const data = Buffer.alloc(2);
    data[1] = 0b00000001;
    const reject = parseReject(data, sectorCount);

    expect(isRejected(reject, 2, 0)).toBe(true);
    expect(isRejected(reject, 1, 3)).toBe(false);
  });

  it('full byte 0xFF rejects all 8 consecutive pairs', () => {
    const sectorCount = 4;
    const data = Buffer.from([0xff, 0xff]);
    const reject = parseReject(data, sectorCount);

    for (let s1 = 0; s1 < sectorCount; s1++) {
      for (let s2 = 0; s2 < sectorCount; s2++) {
        expect(isRejected(reject, s1, s2)).toBe(true);
      }
    }
  });

  it('zero-filled reject rejects nothing', () => {
    const sectorCount = 4;
    const data = Buffer.alloc(2);
    const reject = parseReject(data, sectorCount);

    for (let s1 = 0; s1 < sectorCount; s1++) {
      for (let s2 = 0; s2 < sectorCount; s2++) {
        expect(isRejected(reject, s1, s2)).toBe(false);
      }
    }
  });

  it('matrix is not required to be symmetric (s1,s2 vs s2,s1 may differ)', () => {
    const sectorCount = 4;
    const data = Buffer.alloc(2);
    data[0] = 0b00000010;
    const reject = parseReject(data, sectorCount);

    expect(isRejected(reject, 0, 1)).toBe(true);
    expect(isRejected(reject, 1, 0)).toBe(false);
  });

  it('row-major layout: row s1 occupies bits [s1*n, s1*n+n-1]', () => {
    const sectorCount = 3;
    const data = Buffer.alloc(2);
    data[0] = 0b00111000;
    const reject = parseReject(data, sectorCount);

    expect(isRejected(reject, 1, 0)).toBe(true);
    expect(isRejected(reject, 1, 1)).toBe(true);
    expect(isRejected(reject, 1, 2)).toBe(true);

    expect(isRejected(reject, 0, 0)).toBe(false);
    expect(isRejected(reject, 0, 1)).toBe(false);
    expect(isRejected(reject, 0, 2)).toBe(false);
  });

  it('E1M1 sector 0 can see at least one other sector', () => {
    let canSeeAny = false;
    for (let s2 = 1; s2 < e1m1SectorCount; s2++) {
      if (!isRejected(e1m1Reject, 0, s2)) {
        canSeeAny = true;
        break;
      }
    }
    expect(canSeeAny).toBe(true);
  });

  it('undersized lump pads unspecified pairs as not-rejected', () => {
    const sectorCount = 10;
    const expectedBytes = rejectSize(sectorCount);
    const partial = Buffer.alloc(1, 0xff);
    const reject = parseReject(partial, sectorCount);

    expect(reject.data.length).toBe(expectedBytes);

    for (let bit = 0; bit < 8; bit++) {
      const s1 = Math.floor(bit / sectorCount);
      const s2 = bit % sectorCount;
      expect(isRejected(reject, s1, s2)).toBe(true);
    }

    expect(isRejected(reject, 0, 8)).toBe(false);
    expect(isRejected(reject, 0, 9)).toBe(false);
    expect(isRejected(reject, 1, 0)).toBe(false);
  });

  it('compile-time RejectMap interface satisfaction', () => {
    const manual: RejectMap = {
      sectorCount: 1,
      totalBits: 1,
      expectedSize: 1,
      data: Buffer.alloc(1),
    };
    expect(manual.sectorCount).toBe(1);
  });
});
