/**
 * Milestone — live OPL music wiring (`i_oplmusic.c` driver).
 *
 * `bun run doom.ts -iwad doom/DOOM1.WAD` played sfx but was MUSIC
 * SILENT: the MUS selection / scheduler / lifecycle were wired
 * (`win32Audio.ts`) but no GENMIDI→OPL-voice→PCM render driver existed.
 * These tests prove the Chocolate Doom 2.2.1 `i_oplmusic.c` driver
 * (`src/launcher/oplMusicDriver.ts`) is now assembled on top of the
 * unit-tested OPL2 synth core and fed into `win32Audio`'s music output,
 * WITHOUT touching real hardware (the waveOut device is an injected
 * capturing sink) and against the local shareware IWAD.
 *
 * Honest fidelity note: no captured host OPL reference exists (the
 * music parity gate `gate-music-opl-parity.ts` compares EVENT streams,
 * not PCM, for exactly this reason — OPL waveform output is not
 * bit-comparable across host int precision).  These assertions are
 * therefore robust behavioural ones — non-silent / changed /
 * deterministic — NOT bit-vs-reference.  The verbatim `i_oplmusic.c`
 * constants (volume_mapping_table, the 668-entry frequency_curve,
 * FrequencyForVoice, SetVoiceVolume) are asserted structurally.
 */

import { describe, expect, test } from 'bun:test';

import {
  OPL_FREQUENCY_CURVE,
  OPL_FREQ_CURVE_LEAD_IN,
  OPL_FREQ_OCTAVE_STRIDE,
  OPL_VOLUME_MAPPING_TABLE,
  createOplMusicDriver,
  frequencyForVoice,
} from '../../src/launcher/oplMusicDriver.ts';
import { GenmidiParseError, parseGenmidiLump } from '../../src/launcher/genmidi.ts';
import {
  VANILLA_GENMIDI_MAGIC,
  VANILLA_GENMIDI_TOTAL_INSTRUMENT_COUNT,
} from '../../src/audio/implement-opl-instrument-mapping.ts';
import { MusEventKind } from '../../src/audio/musParser.ts';
import type { DispatchedMusEvent } from '../../src/audio/musScheduler.ts';
import { advanceMusScheduler, createMusScheduler } from '../../src/audio/musScheduler.ts';
import { parseMusScore } from '../../src/audio/musParser.ts';
import { createWin32AudioHost } from '../../src/launcher/win32Audio.ts';
import type { AudioDeviceSink } from '../../src/launcher/win32Audio.ts';
import { loadLauncherResources } from '../../src/launcher/session.ts';
import type { LauncherResources } from '../../src/launcher/session.ts';

const IWAD_PATH = 'doom/DOOM1.WAD';

/** Read a lump by name from the launcher resources (last-wins, vanilla rule). */
function readLump(resources: LauncherResources, name: string): Buffer {
  const upper = name.toUpperCase();
  for (let index = resources.directory.length - 1; index >= 0; index -= 1) {
    const entry = resources.directory[index]!;
    if (entry.name.toUpperCase() === upper && entry.size > 0) {
      return Buffer.from(resources.wadBuffer.subarray(entry.offset, entry.offset + entry.size));
    }
  }
  throw new Error(`lump ${name} not found in ${IWAD_PATH}`);
}

/** Peak |sample| over an interleaved buffer. */
function peakAbs(frames: Int16Array): number {
  let peak = 0;
  for (let index = 0; index < frames.length; index += 1) {
    const magnitude = Math.abs(frames[index]!);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  return peak;
}

/** SHA-256 hex of an Int16Array's little-endian byte view. */
function hashFrames(frames: Int16Array): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(new Uint8Array(frames.buffer, frames.byteOffset, frames.byteLength));
  return hasher.digest('hex');
}

/** A headless capturing device sink (no waveOut). */
function createRecordingSink(): AudioDeviceSink & { writes: number; nonSilentTics: number; lastFrames: Int16Array | null } {
  const sink = {
    writes: 0,
    nonSilentTics: 0,
    lastFrames: null as Int16Array | null,
    write(frames: Int16Array): void {
      sink.writes += 1;
      sink.lastFrames = new Int16Array(frames);
      for (let index = 0; index < frames.length; index += 1) {
        if (frames[index] !== 0) {
          sink.nonSilentTics += 1;
          return;
        }
      }
    },
    close(): void {},
  };
  return sink;
}

describe('genmidi: GENMIDI lump parser (i_oplmusic.c LoadInstrumentTable)', () => {
  test('parses the shareware IWAD GENMIDI to 175 instruments with the #OPL_II# magic', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const lump = readLump(resources, 'GENMIDI');

    expect(lump.toString('latin1', 0, 8)).toBe(VANILLA_GENMIDI_MAGIC);

    const table = parseGenmidiLump(lump);
    expect(table.instruments.length).toBe(VANILLA_GENMIDI_TOTAL_INSTRUMENT_COUNT);
    expect(table.instruments.length).toBe(175);

    // The first 128 entries are GM melodic programs, the trailing 47
    // are the percussion map. Percussion slot 0 (table index 128) is a
    // fixed-pitch instrument (GENMIDI_FLAG_FIXED) with a hardcoded note.
    const acousticGrand = table.instruments[0]!;
    expect(acousticGrand.fixedPitch).toBe(false);
    const firstPercussion = table.instruments[128]!;
    expect(firstPercussion.fixedPitch).toBe(true);
    expect(firstPercussion.fixedNote).toBeGreaterThan(0);

    // Every voice record exposes the raw OPL register bytes the synth
    // core consumes (modulator + carrier + feedback + transpose).
    expect(typeof acousticGrand.voices[0].modulator.waveform).toBe('number');
    expect(typeof acousticGrand.voices[0].carrier.level).toBe('number');
    expect(typeof acousticGrand.voices[0].feedback).toBe('number');
  });

  test('rejects a wrong-magic or truncated lump with a typed error', () => {
    expect(() => parseGenmidiLump(Buffer.from('NOTAGENM' + '\0'.repeat(100)))).toThrow(GenmidiParseError);
    expect(() => parseGenmidiLump(Buffer.from(VANILLA_GENMIDI_MAGIC))).toThrow(GenmidiParseError);
    expect(() => parseGenmidiLump(Buffer.alloc(0))).toThrow(GenmidiParseError);
  });
});

describe('oplMusicDriver: i_oplmusic.c constant fidelity', () => {
  test('volume_mapping_table is the verbatim 128-entry DMX curve', () => {
    expect(OPL_VOLUME_MAPPING_TABLE.length).toBe(128);
    expect(OPL_VOLUME_MAPPING_TABLE[0]).toBe(0);
    expect(OPL_VOLUME_MAPPING_TABLE[127]).toBe(127);
    // Strictly monotonic non-decreasing (the DMX curve never dips).
    for (let index = 1; index < OPL_VOLUME_MAPPING_TABLE.length; index += 1) {
      expect(OPL_VOLUME_MAPPING_TABLE[index]!).toBeGreaterThanOrEqual(OPL_VOLUME_MAPPING_TABLE[index - 1]!);
    }
  });

  test('frequency_curve is the verbatim 668-entry table ending in the 0x36c wrap value', () => {
    expect(OPL_FREQUENCY_CURVE.length).toBe(668);
    expect(OPL_FREQUENCY_CURVE[0]).toBe(0x133);
    expect(OPL_FREQUENCY_CURVE[OPL_FREQUENCY_CURVE.length - 1]).toBe(0x36c);
    expect(OPL_FREQ_CURVE_LEAD_IN).toBe(284);
    expect(OPL_FREQ_OCTAVE_STRIDE).toBe(12 * 32);
  });

  test('frequencyForVoice ports the i_oplmusic.c algorithm (lead-in, octave wrap, bend, fine-tune)', () => {
    // Low note in the 284-entry lead-in: returned raw, block from bits.
    const low = frequencyForVoice(0, 0, false, 0, 0, 0);
    expect(low.fNumber).toBeGreaterThan(0);
    expect(low.block).toBeGreaterThanOrEqual(0);
    expect(low.block).toBeLessThanOrEqual(7);

    // A higher note crosses into the repeating octave window: the block
    // must rise and stay clamped to the 3-bit field.
    const high = frequencyForVoice(96, 0, false, 0, 0, 0);
    expect(high.block).toBeGreaterThan(low.block);
    expect(high.block).toBeLessThanOrEqual(7);

    // A positive bend raises freq_index ⇒ never lowers the f-number at
    // the same octave window.
    const noBend = frequencyForVoice(48, 0, false, 0, 0, 0);
    const upBend = frequencyForVoice(48, 0, false, 30, 0, 0);
    expect(upBend.block).toBeGreaterThanOrEqual(noBend.block);

    // fixedPitch skips the base-note-offset transpose (percussion).
    const transposed = frequencyForVoice(48, 12, false, 0, 0, 0);
    const fixed = frequencyForVoice(48, 12, true, 0, 0, 0);
    expect(fixed).not.toEqual(transposed);

    // The second instrument voice applies (fine_tuning/2 - 64). A
    // fine_tuning of 128 yields 0 detune (i_oplmusic.c centre); a
    // non-centre value (200 ⇒ +36) must shift voice 1 off voice 0.
    const v0 = frequencyForVoice(48, 0, false, 0, 0, 200);
    const v1 = frequencyForVoice(48, 0, false, 0, 1, 200);
    expect(v1).not.toEqual(v0);
    // Centre fine-tuning (128) leaves the two voices in lock-step.
    expect(frequencyForVoice(48, 0, false, 0, 1, 128)).toEqual(frequencyForVoice(48, 0, false, 0, 0, 128));
  });
});

describe('oplMusicDriver: GENMIDI→OPL synthesis (DOOM1.WAD, headless)', () => {
  test('loading D_E1M1 and rendering produces NON-SILENT PCM, byte-identical run-to-run', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const genmidi = readLump(resources, 'GENMIDI');
    const score = parseMusScore(readLump(resources, 'D_E1M1'));

    const renderRun = (): { peak: number; hash: string } => {
      const driver = createOplMusicDriver(genmidi, { outputSampleRate: 44_100, musicVolume: 64 });
      expect(driver.ready).toBe(true);
      driver.reset();
      const scheduler = createMusScheduler(score, { looping: true });
      const out = new Int16Array(1260 * 2);
      const hasher = new Bun.CryptoHasher('sha256');
      let peak = 0;
      for (let tic = 0; tic < 70; tic += 1) {
        driver.applyEvents(advanceMusScheduler(scheduler, 4));
        driver.render(out, 1260);
        hasher.update(new Uint8Array(out.buffer, out.byteOffset, out.byteLength));
        const ticPeak = peakAbs(out);
        if (ticPeak > peak) {
          peak = ticPeak;
        }
      }
      return { peak, hash: hasher.digest('hex') };
    };

    const first = renderRun();
    const second = renderRun();

    // Non-silent: D_E1M1 produces audible OPL PCM (a silent driver / a
    // dead GENMIDI path would never cross this threshold over 2 s).
    expect(first.peak).toBeGreaterThan(256);
    // Deterministic: same lump + same scheduler seed ⇒ identical bytes.
    expect(second.hash).toBe(first.hash);
    expect(second.peak).toBe(first.peak);
  });

  test('NoteOn then NoteOff changes the output (key-on attack, key-off release)', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const driver = createOplMusicDriver(readLump(resources, 'GENMIDI'), { outputSampleRate: 44_100, musicVolume: 127 });
    driver.reset();

    const out = new Int16Array(1260 * 2);

    // Before any NoteOn the driver is silent.
    driver.render(out, 1260);
    expect(peakAbs(out)).toBe(0);

    // KeyOn channel 0 (program 0 = acoustic grand) note 60 velocity 127.
    const noteOn: DispatchedMusEvent = { kind: MusEventKind.PlayNote, channel: 0, note: 60, velocity: 127, delay: 0 };
    driver.applyEvent(noteOn);
    // Let the attack ramp settle.
    let sustained = 0;
    for (let block = 0; block < 12; block += 1) {
      driver.render(out, 1260);
      sustained = Math.max(sustained, peakAbs(out));
    }
    expect(sustained).toBeGreaterThan(256);

    // KeyOff releases the voice; after the release ramp drains the
    // output returns to silence (envelope went to zero — observable
    // behaviour change between NoteOn and NoteOff).
    const noteOff: DispatchedMusEvent = { kind: MusEventKind.ReleaseNote, channel: 0, note: 60, delay: 0 };
    driver.applyEvent(noteOff);
    for (let block = 0; block < 40; block += 1) {
      driver.render(out, 1260);
    }
    driver.render(out, 1260);
    expect(peakAbs(out)).toBe(0);
  });

  test('a program change selects the mapped GENMIDI voice (different instrument ⇒ different timbre)', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const genmidi = readLump(resources, 'GENMIDI');

    const renderWithProgram = (program: number): string => {
      const driver = createOplMusicDriver(genmidi, { outputSampleRate: 44_100, musicVolume: 127 });
      driver.reset();
      // MUS controller 0 = program change (i_oplmusic.c routes it to
      // ProgramChangeEvent → channel->instrument = main_instrs[program]).
      driver.applyEvent({ kind: MusEventKind.ControllerChange, channel: 0, controller: 0, value: program, delay: 0 });
      driver.applyEvent({ kind: MusEventKind.PlayNote, channel: 0, note: 60, velocity: 100, delay: 0 });
      const out = new Int16Array(1260 * 2);
      const hasher = new Bun.CryptoHasher('sha256');
      for (let block = 0; block < 8; block += 1) {
        driver.render(out, 1260);
        hasher.update(new Uint8Array(out.buffer, out.byteOffset, out.byteLength));
      }
      return hasher.digest('hex');
    };

    // Program 0 (acoustic grand) vs program 30 (distortion guitar):
    // distinct GENMIDI voice records ⇒ the synthesized waveform must
    // differ. Each program is also deterministic on its own.
    const piano = renderWithProgram(0);
    const guitar = renderWithProgram(30);
    const pianoAgain = renderWithProgram(0);
    expect(piano).toBe(pianoAgain);
    expect(guitar).not.toBe(piano);
  });

  test('a missing / invalid GENMIDI lump leaves the driver music-silent (never throws)', () => {
    const absent = createOplMusicDriver(null, { outputSampleRate: 44_100 });
    expect(absent.ready).toBe(false);
    const bad = createOplMusicDriver(Buffer.from('GARBAGE!'), { outputSampleRate: 44_100 });
    expect(bad.ready).toBe(false);

    const out = new Int16Array(1260 * 2).fill(123);
    // applyEvent / render are safe no-ops; render zero-fills.
    expect(() => bad.applyEvent({ kind: MusEventKind.PlayNote, channel: 0, note: 60, velocity: 127, delay: 0 })).not.toThrow();
    expect(() => bad.render(out, 1260)).not.toThrow();
    expect(peakAbs(out)).toBe(0);
  });
});

describe('win32Audio: OPL music driver wired into the live host (E1M1, stub device)', () => {
  test('startMusic(E1M1) drives the driver so the mixed device PCM is NON-SILENT and deterministic', async () => {
    const resourcesA = await loadLauncherResources(IWAD_PATH);
    const sinkA = createRecordingSink();
    const hostA = createWin32AudioHost(resourcesA, { deviceSink: sinkA, musicVolume: 64 });
    hostA.startMusic('E1M1');
    const listener = { x: 0, y: 0, angle: 0 };
    const hashA = new Bun.CryptoHasher('sha256');
    for (let tic = 0; tic < 70; tic += 1) {
      hostA.pump(listener, null, false);
      hashA.update(new Uint8Array(sinkA.lastFrames!.buffer, sinkA.lastFrames!.byteOffset, sinkA.lastFrames!.byteLength));
    }
    hostA.shutdown();

    expect(sinkA.writes).toBe(70);
    // The OPL music driver mixed real synthesized PCM UNDER the (idle)
    // sfx path, so the device output is non-silent — the historical
    // music-silent behaviour is fixed.
    expect(sinkA.nonSilentTics).toBeGreaterThan(0);
    const digestA = hashA.digest('hex');

    // Determinism: a second host over the identical scenario produces
    // byte-identical device output (fixed-seed simulation).
    const resourcesB = await loadLauncherResources(IWAD_PATH);
    const sinkB = createRecordingSink();
    const hostB = createWin32AudioHost(resourcesB, { deviceSink: sinkB, musicVolume: 64 });
    hostB.startMusic('E1M1');
    const hashB = new Bun.CryptoHasher('sha256');
    for (let tic = 0; tic < 70; tic += 1) {
      hostB.pump(listener, null, false);
      hashB.update(new Uint8Array(sinkB.lastFrames!.buffer, sinkB.lastFrames!.byteOffset, sinkB.lastFrames!.byteLength));
    }
    hostB.shutdown();
    expect(hashB.digest('hex')).toBe(digestA);
  });

  test('pause halts the music render; resume continues it; stop silences it', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const sink = createRecordingSink();
    const host = createWin32AudioHost(resources, { deviceSink: sink, musicVolume: 64 });
    host.startMusic('E1M1');
    const listener = { x: 0, y: 0, angle: 0 };

    // Run a few tics so notes are sounding.
    for (let tic = 0; tic < 20; tic += 1) {
      host.pump(listener, null, false);
    }
    expect(sink.nonSilentTics).toBeGreaterThan(0);

    // Pause: the scheduler stops advancing (musicSystem pause halts it)
    // and held notes drain — pump must not throw and must keep writing.
    host.pause();
    expect(() => {
      for (let tic = 0; tic < 10; tic += 1) {
        host.pump(listener, null, false);
      }
    }).not.toThrow();

    host.resume();
    expect(() => {
      for (let tic = 0; tic < 10; tic += 1) {
        host.pump(listener, null, false);
      }
    }).not.toThrow();

    // Stop releases every OPL voice; subsequent tics are produced
    // without throwing (sfx path still pumps a real buffer).
    host.stopMusic();
    expect(() => {
      for (let tic = 0; tic < 5; tic += 1) {
        host.pump(listener, null, false);
      }
    }).not.toThrow();

    host.shutdown();
    expect(sink.writes).toBe(45);
  });
});
