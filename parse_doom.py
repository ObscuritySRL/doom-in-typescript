import re
import sys

# Read info.h
with open('/tmp/info.h', 'r') as f:
    info_h = f.read()

# Read info.c
with open('/tmp/info.c', 'r') as f:
    info_c = f.read()

# ========================================
# Parse spritenum_t enum
# ========================================
sprite_enum_match = re.search(r'typedef enum\s*\{([^}]*)\}\s*spritenum_t', info_h, re.DOTALL)
sprite_names = []
if sprite_enum_match:
    body = sprite_enum_match.group(1)
    for line in body.split('\n'):
        line = line.strip().rstrip(',')
        if line and not line.startswith('//') and line != 'NUMSPRITES':
            sprite_names.append(line)

sprite_map = {name: i for i, name in enumerate(sprite_names)}
print(f"Found {len(sprite_names)} sprites", file=sys.stderr)

# ========================================
# Parse statenum_t enum
# ========================================
state_enum_match = re.search(r'typedef enum\s*\{([^}]*)\}\s*statenum_t', info_h, re.DOTALL)
state_names = []
if state_enum_match:
    body = state_enum_match.group(1)
    for line in body.split('\n'):
        line = line.strip().rstrip(',')
        if line and not line.startswith('//') and line != 'NUMSTATES':
            state_names.append(line)

state_map = {name: i for i, name in enumerate(state_names)}
print(f"Found {len(state_names)} states", file=sys.stderr)

# ========================================
# Parse sfxenum_t enum
# ========================================
sfx_names_str = "sfx_None,sfx_pistol,sfx_shotgn,sfx_sgcock,sfx_dshtgn,sfx_dbopn,sfx_dbcls,sfx_dbload,sfx_plasma,sfx_bfg,sfx_sawup,sfx_sawidl,sfx_sawful,sfx_sawhit,sfx_rlaunc,sfx_rxplod,sfx_firsht,sfx_firxpl,sfx_pstart,sfx_pstop,sfx_doropn,sfx_dorcls,sfx_stnmov,sfx_swtchn,sfx_swtchx,sfx_plpain,sfx_dmpain,sfx_popain,sfx_vipain,sfx_mnpain,sfx_pepain,sfx_slop,sfx_itemup,sfx_wpnup,sfx_oof,sfx_telept,sfx_posit1,sfx_posit2,sfx_posit3,sfx_bgsit1,sfx_bgsit2,sfx_sgtsit,sfx_cacsit,sfx_brssit,sfx_cybsit,sfx_spisit,sfx_bspsit,sfx_kntsit,sfx_vilsit,sfx_mansit,sfx_pesit,sfx_sklatk,sfx_sgtatk,sfx_skepch,sfx_vilatk,sfx_claw,sfx_skeswg,sfx_pldeth,sfx_pdiehi,sfx_podth1,sfx_podth2,sfx_podth3,sfx_bgdth1,sfx_bgdth2,sfx_sgtdth,sfx_cacdth,sfx_skldth,sfx_brsdth,sfx_cybdth,sfx_spidth,sfx_bspdth,sfx_vildth,sfx_kntdth,sfx_pedth,sfx_skedth,sfx_posact,sfx_bgact,sfx_dmact,sfx_bspact,sfx_bspwlk,sfx_vilact,sfx_noway,sfx_barexp,sfx_punch,sfx_hoof,sfx_metal,sfx_chgun,sfx_tink,sfx_bdopn,sfx_bdcls,sfx_itmbk,sfx_flame,sfx_flamst,sfx_getpow,sfx_bospit,sfx_boscub,sfx_bossit,sfx_bospn,sfx_bosdth,sfx_manatk,sfx_mandth,sfx_sssit,sfx_ssdth,sfx_keenpn,sfx_keendt,sfx_skeact,sfx_skesit,sfx_skeatk,sfx_radio"

sfx_names = [s.strip() for s in sfx_names_str.split(',')]
sfx_map = {name: i for i, name in enumerate(sfx_names)}
print(f"Found {len(sfx_names)} sfx", file=sys.stderr)

# ========================================
# Parse mobjtype_t enum
# ========================================
mobj_enum_match = re.search(r'typedef enum\s*\{([^}]*)\}\s*mobjtype_t', info_h, re.DOTALL)
mobj_names = []
if mobj_enum_match:
    body = mobj_enum_match.group(1)
    for line in body.split('\n'):
        line = line.strip().rstrip(',')
        if line and not line.startswith('//') and line != 'NUMMOBJTYPES':
            mobj_names.append(line)

mobj_map = {name: i for i, name in enumerate(mobj_names)}
print(f"Found {len(mobj_names)} mobj types", file=sys.stderr)

# ========================================
# MF_ flags
# ========================================
MF_FLAGS = {
    'MF_SPECIAL': 1,
    'MF_SOLID': 2,
    'MF_SHOOTABLE': 4,
    'MF_NOSECTOR': 8,
    'MF_NOBLOCKMAP': 16,
    'MF_AMBUSH': 32,
    'MF_JUSTHIT': 64,
    'MF_JUSTATTACKED': 128,
    'MF_SPAWNCEILING': 256,
    'MF_NOGRAVITY': 512,
    'MF_DROPOFF': 0x400,
    'MF_PICKUP': 0x800,
    'MF_NOCLIP': 0x1000,
    'MF_SLIDE': 0x2000,
    'MF_FLOAT': 0x4000,
    'MF_TELEPORT': 0x8000,
    'MF_MISSILE': 0x10000,
    'MF_DROPPED': 0x20000,
    'MF_SHADOW': 0x40000,
    'MF_NOBLOOD': 0x80000,
    'MF_CORPSE': 0x100000,
    'MF_INFLOAT': 0x200000,
    'MF_COUNTKILL': 0x400000,
    'MF_COUNTITEM': 0x800000,
    'MF_SKULLFLY': 0x1000000,
    'MF_NOTDMATCH': 0x2000000,
    'MF_TRANSLATION': 0xc000000,
    'MF_TRANSSHIFT': 26,
}

def resolve_flags(flag_str):
    flag_str = flag_str.strip()
    if flag_str == '0':
        return 0
    parts = flag_str.split('|')
    result = 0
    for p in parts:
        p = p.strip()
        if p in MF_FLAGS:
            result |= MF_FLAGS[p]
        else:
            try:
                result |= int(p, 0)
            except:
                print(f"WARNING: Unknown flag: {p}", file=sys.stderr)
    return result

def resolve_value(val_str, enum_map):
    val_str = val_str.strip()
    if val_str in enum_map:
        return enum_map[val_str]
    try:
        return int(val_str, 0)
    except:
        print(f"WARNING: Could not resolve: {val_str}", file=sys.stderr)
        return 0

# ========================================
# Parse states[] array from info.c
# ========================================
states_match = re.search(r'state_t\s+states\[NUMSTATES\]\s*=\s*\{(.*?)\};', info_c, re.DOTALL)
if not states_match:
    print("ERROR: Could not find states[] array", file=sys.stderr)
    sys.exit(1)

states_body = states_match.group(1)

# Each state entry looks like: {SPR_TROO,0,-1,{NULL},S_NULL,0,0}
state_pattern = re.compile(r'\{(\w+)\s*,\s*(\d+)\s*,\s*(-?\d+)\s*,\s*\{(\w+)\}\s*,\s*(\w+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\}')

states_data = []
for m in state_pattern.finditer(states_body):
    sprite_name = m.group(1)
    frame = int(m.group(2))
    tics = int(m.group(3))
    action_name = m.group(4)
    nextstate_name = m.group(5)
    misc1 = int(m.group(6))
    misc2 = int(m.group(7))

    sprite_val = resolve_value(sprite_name, sprite_map)
    nextstate_val = resolve_value(nextstate_name, state_map)

    if action_name == 'NULL' or action_name == '0':
        action_str = 'null'
    else:
        action_str = '"' + action_name + '"'

    states_data.append((sprite_val, frame, tics, action_str, nextstate_val, misc1, misc2))

print(f"Parsed {len(states_data)} state entries", file=sys.stderr)

# ========================================
# Parse mobjinfo[] array from info.c
# ========================================
mobjinfo_match = re.search(r'mobjinfo_t\s+mobjinfo\[NUMMOBJTYPES\]\s*=\s*\{(.*?)\n\};', info_c, re.DOTALL)
if not mobjinfo_match:
    print("ERROR: Could not find mobjinfo[] array", file=sys.stderr)
    sys.exit(1)

mobjinfo_body = mobjinfo_match.group(1)

# Each mobjinfo entry is a block in { ... }
# We need to find each top-level { ... } block
mobjinfo_entries = []
depth = 0
current = ""
for char in mobjinfo_body:
    if char == '{':
        depth += 1
        if depth == 1:
            current = ""
            continue
    elif char == '}':
        depth -= 1
        if depth == 0:
            mobjinfo_entries.append(current.strip())
            current = ""
            continue
    if depth >= 1:
        current += char

print(f"Found {len(mobjinfo_entries)} mobjinfo entries", file=sys.stderr)

mobjinfo_data = []
for idx, entry in enumerate(mobjinfo_entries):
    # Remove comments
    entry = re.sub(r'//.*', '', entry)
    entry = re.sub(r'/\*.*?\*/', '', entry, flags=re.DOTALL)

    # Split by commas
    parts = [p.strip() for p in entry.split(',') if p.strip()]

    if len(parts) != 23:
        print(f"WARNING: mobjinfo entry {idx} has {len(parts)} fields: {parts}", file=sys.stderr)
        continue

    values = []
    for fi, field in enumerate(parts):
        field = field.strip()
        if fi == 0:  # doomednum
            values.append(int(field))
        elif fi in (1, 3, 7, 10, 11, 12, 13, 22):  # state fields
            values.append(resolve_value(field, state_map))
        elif fi in (4, 6, 9, 14, 20):  # sound fields
            values.append(resolve_value(field, sfx_map))
        elif fi in (16, 17):  # radius, height - FRACUNIT expressions
            frac_match = re.match(r'(\d+)\s*\*\s*FRACUNIT', field)
            if frac_match:
                values.append(int(frac_match.group(1)))
            else:
                try:
                    values.append(int(field))
                except:
                    print(f"WARNING: Could not parse radius/height: {field} in entry {idx}", file=sys.stderr)
                    values.append(0)
        elif fi == 21:  # flags
            values.append(resolve_flags(field))
        else:  # numeric fields
            try:
                values.append(int(field))
            except:
                print(f"WARNING: Could not parse field {fi}: {field} in entry {idx}", file=sys.stderr)
                values.append(0)

    mobjinfo_data.append(values)

print(f"Parsed {len(mobjinfo_data)} mobjinfo entries", file=sys.stderr)

# ========================================
# Write states_data.ts
# ========================================
with open('/tmp/states_data.ts', 'w') as f:
    f.write("// Each entry: [sprite, frame, tics, actionName, nextstate, misc1, misc2]\n")
    f.write("// Action names are string keys like \"A_Look\" or null for no action\n")
    f.write("export const STATES_DATA: readonly (readonly [number, number, number, string | null, number, number, number])[] = [\n")

    for i, (sprite, frame, tics, action, nextstate, misc1, misc2) in enumerate(states_data):
        comment = f" // {state_names[i]} ({i})" if i < len(state_names) else ""
        f.write(f"  [{sprite}, {frame}, {tics}, {action}, {nextstate}, {misc1}, {misc2}],{comment}\n")

    f.write("];\n")

# ========================================
# Write mobjinfo_data.ts
# ========================================
with open('/tmp/mobjinfo_data.ts', 'w') as f:
    f.write("// Each entry: [doomednum, spawnstate, spawnhealth, seestate, seesound, reactiontime, attacksound, painstate, painchance, painsound, meleestate, missilestate, deathstate, xdeathstate, deathsound, speed, radius, height, mass, damage, activesound, flags, raisestate]\n")
    f.write("// State fields use numeric statenum_t values. Sound fields use numeric values. Radius/height are in map units (NOT fixed-point \u2014 the conversion to fixed-point happens at spawn time).\n")
    f.write("export const MOBJINFO_DATA: readonly (readonly [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number])[] = [\n")

    for i, values in enumerate(mobjinfo_data):
        comment = f" // {mobj_names[i]} ({i})" if i < len(mobj_names) else ""
        vals_str = ", ".join(str(v) for v in values)
        f.write(f"  [{vals_str}],{comment}\n")

    f.write("];\n")

print("Done! Files written to /tmp/states_data.ts and /tmp/mobjinfo_data.ts", file=sys.stderr)
