// OpenMind Shimmer Shader - Neural Saccade Visualization
// Visualizes actual neural attention paths with comet effects and semantic heat tints.

struct SaccadeUniforms {
    time: f32,
    viewport_width: f32,
    viewport_height: f32,
    effort_scale: f32,
};

struct SaccadePath {
    start_pos: vec2<f32>,
    control_pos: vec2<f32>,
    end_pos: vec2<f32>,
    intensity: f32,
    similarity: f32,
    layer: f32,
};

@group(0) @binding(0) var<uniform> uniforms: SaccadeUniforms;
@group(0) @binding(1) var<storage, read> paths: array<SaccadePath>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) path_idx: f32,
    @location(2) t_offset: f32,
};

@vertex
fn vs_main(
    @builtin(vertex_index) vertex_idx: u32,
    @builtin(instance_index) instance_idx: u32
) -> VertexOutput {
    var out: VertexOutput;
    
    // Each instance is a saccade "comet"
    let path = paths[instance_idx];
    
    // t is the animation parameter (0.0 to 1.0 along the path)
    // Offset by instance to desynchronize comets
    let t = fract(uniforms.time * 0.5 + f32(instance_idx) * 0.1);
    
    // Bezier calculation
    let p0 = path.start_pos;
    let p1 = path.control_pos;
    let p2 = path.end_pos;
    
    // B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
    let pos_2d = (1.0 - t) * (1.0 - t) * p0 + 2.0 * (1.0 - t) * t * p1 + t * t * p2;
    
    // Billboard quad around the comet head
    let quad_size = 10.0 * path.intensity * (0.5 + path.similarity);
    let offsets = array<vec2<f32>, 4>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(1.0, -1.0),
        vec2<f32>(-1.0, 1.0),
        vec2<f32>(1.0, 1.0)
    );
    
    let quad_offset = offsets[vertex_idx] * quad_size;
    let final_pos = pos_2d + quad_offset;
    
    // Convert to NDC
    let ndc_x = (final_pos.x / uniforms.viewport_width) * 2.0 - 1.0;
    let ndc_y = (final_pos.y / uniforms.viewport_height) * -2.0 + 1.0; // Flip Y
    
    out.position = vec4<f32>(ndc_x, ndc_y, 0.0, 1.0);
    out.uv = offsets[vertex_idx] * 0.5 + 0.5;
    out.path_idx = f32(instance_idx);
    out.t_offset = t;
    
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let path = paths[u32(in.path_idx)];
    
    // Circular comet head
    let dist = length(in.uv - vec2<f32>(0.5, 0.5));
    if (dist > 0.5) { discard; }
    
    // Color based on ratification level (from similarity score)
    // similarity ≥ 0.8: Green (auto-approved)
    // similarity 0.5-0.8: Yellow (pending)
    // similarity < 0.5: Red (human review)
    var ratification_color: vec3<f32>;
    if (path.similarity >= 0.8) {
        ratification_color = vec3<f32>(0.0, 1.0, 0.0);  // Green: Auto-approved
    } else if (path.similarity >= 0.5) {
        ratification_color = vec3<f32>(1.0, 1.0, 0.0);  // Yellow: Pending
    } else {
        ratification_color = vec3<f32>(1.0, 0.0, 0.0);  // Red: Human review
    }
    
    // Layer-based secondary tint (adds depth)
    let layer_tint = vec3<f32>(
        path.layer * 0.1,
        1.0 - path.layer * 0.1,
        0.5
    );
    var base_color = ratification_color * 0.7 + layer_tint * 0.3;
    
    // High similarity adds "heat" (white core)
    let heat = pow(path.similarity, 2.0) * (1.0 - dist * 2.0);
    let final_rgb = mix(base_color, vec3<f32>(1.0, 1.0, 1.0), heat);
    
    // Fade based on distance from center
    let alpha = (1.0 - dist * 2.0) * path.intensity;
    
    // Shimmer effect
    let shimmer = sin(uniforms.time * 10.0 + in.path_idx) * 0.2 + 0.8;
    
    return vec4<f32>(final_rgb * shimmer, alpha);
}
