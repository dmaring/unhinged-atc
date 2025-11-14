// WebGL shader renderer for CRT post-processing effects

import vertexShaderSource from '../shaders/crt.vert?raw';
import fragmentShaderSource from '../shaders/crt.frag?raw';

export interface ShaderSettings {
  scanlineIntensity: number;
  barrelDistortion: number;
  chromaticAberration: number;
  glowIntensity: number;
  vignetteStrength: number;
}

export class ShaderRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private frameBuffer: WebGLFramebuffer | null = null;

  // Uniform locations
  private uniforms: {
    texture?: WebGLUniformLocation | null;
    resolution?: WebGLUniformLocation | null;
    time?: WebGLUniformLocation | null;
    scanlineIntensity?: WebGLUniformLocation | null;
    barrelDistortion?: WebGLUniformLocation | null;
    chromaticAberration?: WebGLUniformLocation | null;
    glowIntensity?: WebGLUniformLocation | null;
    vignetteStrength?: WebGLUniformLocation | null;
  } = {};

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      alpha: false,
      premultipliedAlpha: false,
    });

    if (!gl) {
      throw new Error('WebGL not supported');
    }

    this.gl = gl;
    this.initialize();
  }

  private initialize(): void {
    // Create and compile shaders
    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to compile shaders');
    }

    // Create and link program
    this.program = this.createProgram(vertexShader, fragmentShader);

    if (!this.program) {
      throw new Error('Failed to create shader program');
    }

    // Get uniform locations
    this.uniforms.texture = this.gl.getUniformLocation(this.program, 'u_texture');
    this.uniforms.resolution = this.gl.getUniformLocation(this.program, 'u_resolution');
    this.uniforms.time = this.gl.getUniformLocation(this.program, 'u_time');
    this.uniforms.scanlineIntensity = this.gl.getUniformLocation(this.program, 'u_scanlineIntensity');
    this.uniforms.barrelDistortion = this.gl.getUniformLocation(this.program, 'u_barrelDistortion');
    this.uniforms.chromaticAberration = this.gl.getUniformLocation(this.program, 'u_chromaticAberration');
    this.uniforms.glowIntensity = this.gl.getUniformLocation(this.program, 'u_glowIntensity');
    this.uniforms.vignetteStrength = this.gl.getUniformLocation(this.program, 'u_vignetteStrength');

    // Create full-screen quad
    // Note: Texture coordinates are flipped vertically because Canvas 2D has Y=0 at top,
    // but WebGL textures have Y=0 at bottom
    const positions = new Float32Array([
      -1, -1,  0, 1,  // Bottom-left (flip Y: 0 -> 1)
       1, -1,  1, 1,  // Bottom-right (flip Y: 0 -> 1)
      -1,  1,  0, 0,  // Top-left (flip Y: 1 -> 0)
       1,  1,  1, 0,  // Top-right (flip Y: 1 -> 0)
    ]);

    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    // Set up attributes
    const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
    const texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');

    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 16, 0);

    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 16, 8);

    // Create texture with NEAREST filtering for crisp text
    this.texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    // Use NEAREST filtering instead of LINEAR for sharper text
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
    const program = this.gl.createProgram();
    if (!program) return null;

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program linking error:', this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  /**
   * Render the source canvas with CRT shader effects
   */
  render(
    sourceCanvas: HTMLCanvasElement,
    settings: ShaderSettings,
    time: number = performance.now() / 1000
  ): void {
    if (!this.program || !this.texture) return;

    const { width, height } = this.gl.canvas as HTMLCanvasElement;

    // Update texture from source canvas
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      sourceCanvas
    );

    // Set viewport and clear
    this.gl.viewport(0, 0, width, height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Use shader program
    this.gl.useProgram(this.program);

    // Set uniforms
    this.gl.uniform1i(this.uniforms.texture!, 0);
    this.gl.uniform2f(this.uniforms.resolution!, width, height);
    this.gl.uniform1f(this.uniforms.time!, time);
    this.gl.uniform1f(this.uniforms.scanlineIntensity!, settings.scanlineIntensity);
    this.gl.uniform1f(this.uniforms.barrelDistortion!, settings.barrelDistortion);
    this.gl.uniform1f(this.uniforms.chromaticAberration!, settings.chromaticAberration);
    this.gl.uniform1f(this.uniforms.glowIntensity!, settings.glowIntensity);
    this.gl.uniform1f(this.uniforms.vignetteStrength!, settings.vignetteStrength);

    // Draw quad
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Resize the WebGL canvas
   */
  resize(width: number, height: number): void {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    canvas.width = width;
    canvas.height = height;
  }

  /**
   * Clean up WebGL resources
   */
  dispose(): void {
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
    }
    if (this.program) {
      this.gl.deleteProgram(this.program);
    }
  }
}
