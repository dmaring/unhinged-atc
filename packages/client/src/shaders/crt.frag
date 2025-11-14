// Fragment shader for CRT post-processing effects
// Applies scanlines, barrel distortion, chromatic aberration, glow, and vignette

precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_scanlineIntensity;
uniform float u_barrelDistortion;
uniform float u_chromaticAberration;
uniform float u_glowIntensity;
uniform float u_vignetteStrength;

varying vec2 v_texCoord;

// Apply barrel distortion (CRT curvature)
vec2 barrelDistort(vec2 coord, float amount) {
  vec2 cc = coord - 0.5;
  float dist = dot(cc, cc) * amount;
  return coord + cc * (1.0 + dist) * dist;
}

// Apply chromatic aberration (RGB color separation)
vec3 chromaticAberration(sampler2D tex, vec2 uv, float amount) {
  vec2 direction = uv - 0.5;

  float r = texture2D(tex, uv - direction * amount).r;
  float g = texture2D(tex, uv).g;
  float b = texture2D(tex, uv + direction * amount).b;

  return vec3(r, g, b);
}

// Apply scanlines
float scanline(vec2 uv, float intensity) {
  float scanline = sin(uv.y * u_resolution.y * 2.0) * 0.5 + 0.5;
  return mix(1.0, scanline, intensity);
}

// Apply vignette (darkening at edges)
float vignette(vec2 uv, float strength) {
  vec2 position = uv - 0.5;
  float dist = length(position);
  return 1.0 - smoothstep(0.3, 0.8, dist * strength);
}

// Simple phosphor glow effect
vec3 glow(vec3 color, float intensity) {
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  return color + color * luminance * intensity;
}

void main() {
  vec2 uv = v_texCoord;

  // Apply barrel distortion
  uv = barrelDistort(uv, u_barrelDistortion);

  // Discard pixels outside the distorted bounds (creates rounded edges)
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Apply chromatic aberration
  vec3 color;
  if (u_chromaticAberration > 0.0) {
    color = chromaticAberration(u_texture, uv, u_chromaticAberration);
  } else {
    color = texture2D(u_texture, uv).rgb;
  }

  // Apply scanlines
  float scanlineEffect = scanline(uv, u_scanlineIntensity);
  color *= scanlineEffect;

  // Apply phosphor glow
  if (u_glowIntensity > 0.0) {
    color = glow(color, u_glowIntensity);
  }

  // Apply vignette
  float vignetteEffect = vignette(uv, u_vignetteStrength);
  color *= vignetteEffect;

  gl_FragColor = vec4(color, 1.0);
}
