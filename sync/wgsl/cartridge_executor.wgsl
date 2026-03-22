// cartridge_executor.wgsl
// GPU-native execution of Glyph VM opcodes - OPTIMIZED
// "Pixels move pixels" - the shader reads opcode pixels and executes them

// Opcode definitions (must match SyntheticGlyphVM exactly)
const OP_NOP: u32 = 140u;
const OP_DATA: u32 = 128u;
const OP_LOAD: u32 = 129u;
const OP_STORE: u32 = 130u;
const OP_MOV: u32 = 206u;
const OP_LD: u32 = 204u;
const OP_ST: u32 = 205u;
const OP_ADD: u32 = 142u;
const OP_SUB: u32 = 143u;
const OP_JZ: u32 = 209u;
const OP_JMP: u32 = 208u;
const OP_DRAW: u32 = 215u;
const OP_HALT: u32 = 141u;
const OP_ADD_MEM: u32 = 216u;
const OP_SUB_MEM: u32 = 217u;
const OP_INT_DISPATCH: u32 = 218u;
const OP_AND: u32 = 220u;
const OP_OR: u32 = 221u;
const OP_XOR: u32 = 222u;
const OP_NOT: u32 = 223u;
const OP_SHL: u32 = 224u;
const OP_SHR: u32 = 225u;
const OP_SAR: u32 = 226u;
const OP_AND_MEM: u32 = 227u;
const OP_OR_MEM: u32 = 228u;
const OP_XOR_MEM: u32 = 229u;
const OP_SHL_MEM: u32 = 230u;
const OP_SHR_MEM: u32 = 231u;
const OP_SPATIAL_SPAWN: u32 = 232u;

// UI opcodes (for cartridge clicks)
const OP_TOGGLE: u32 = 3u;
const OP_SET: u32 = 6u;
const OP_CLEAR: u32 = 7u;
const OP_INC: u32 = 8u;
const OP_DEC: u32 = 9u;

// Execution modes
const MODE_CLICK: u32 = 0u;
const MODE_FRAME: u32 = 1u;

// Bindings
@group(0) @binding(0) var sit_texture: texture_2d<u32>;
@group(0) @binding(1) var state_texture: texture_storage_2d<rgba8uint, read_write>;
@group(0) @binding(2) var<uniform> exec_params: ExecParams;

struct ExecParams {
    click_x: u32,
    click_y: u32,
    exec_mode: u32,
    grid_width: u32,
    grid_height: u32,
    state_count: u32,
    _padding: u32,
}

// State helpers - inlined for performance
fn loadState(slot: u32) -> u32 {
    return textureLoad(state_texture, vec2<i32>(i32(slot), 0)).r;
}

fn storeState(slot: u32, value: u32) {
    textureStore(state_texture, vec2<i32>(i32(slot), 0), vec4<u32>(value, 0u, 0u, 0u));
}

// Clamp to byte range - inlined
fn clampByte(v: u32) -> u32 {
    return min(v, 255u);
}

// OPTIMIZED: 8x8 workgroups for better cache utilization
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;

    // Early bounds check
    let in_bounds = x < exec_params.grid_width && y < exec_params.grid_height;
    if (!in_bounds) { return; }

    // Click mode: early out for non-clicked cells
    let is_click_mode = exec_params.exec_mode == MODE_CLICK;
    let is_click_target = x == exec_params.click_x && y == exec_params.click_y;
    if (is_click_mode && !is_click_target) { return; }

    // Load SIT pixel
    let sit_pixel = textureLoad(sit_texture, vec2<i32>(i32(x), i32(y)));
    let opcode = sit_pixel.r;
    let target = sit_pixel.g;
    let flags = sit_pixel.b;

    // Fast path for NOP (most common in sparse grids)
    if (opcode == OP_NOP) { return; }

    // Execute opcode - optimized switch
    switch (opcode) {
        case OP_TOGGLE: {
            let cur = loadState(target);
            storeState(target, select(255u, 0u, cur > 0u));
        }
        case OP_SET: {
            storeState(target, 255u);
        }
        case OP_CLEAR: {
            storeState(target, 0u);
        }
        case OP_INC: {
            let cur = loadState(target);
            storeState(target, clampByte(cur + 1u));
        }
        case OP_DEC: {
            let cur = loadState(target);
            storeState(target, select(0u, cur - 1u, cur > 0u));
        }
        case OP_LD: {
            storeState(target, flags);
        }
        case OP_DATA: {
            storeState(target, flags);
        }
        case OP_ADD: {
            let cur = loadState(target);
            storeState(target, clampByte(cur + flags));
        }
        case OP_SUB: {
            let cur = loadState(target);
            storeState(target, select(0u, cur - flags, cur >= flags));
        }
        case OP_AND: {
            let cur = loadState(target);
            storeState(target, cur & flags);
        }
        case OP_OR: {
            let cur = loadState(target);
            storeState(target, cur | flags);
        }
        case OP_XOR: {
            let cur = loadState(target);
            storeState(target, cur ^ flags);
        }
        case OP_NOT: {
            let cur = loadState(target);
            storeState(target, (~cur) & 255u);
        }
        case OP_MOV: {
            let val = loadState(target);
            storeState(flags, val);
        }
        default: {
            // Unknown opcode - skip
        }
    }
}
