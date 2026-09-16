import { RAD } from '../geometry';
import { REGION } from '../world';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders';
import { RenderFailure, type DrawInputs, type StyleTextures, type TextureRenderer } from './renderer';

const UNIFORMS = ['uSize', 'uProjection', 'uScale', 'uOrigin', 'uRotate', 'uMaxLat', 'uViewPx', 'uDay', 'uRegion', 'uRegionBox', 'uRegionMix', 'uNight', 'uNightOn', 'uSun', 'uLimb', 'uGlow', 'uDebug'] as const;
type Uniform = (typeof UNIFORMS)[number];

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new RenderFailure('shader', 'createShader failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader) ?? 'compile failed';
    gl.deleteShader(shader);
    throw new RenderFailure('shader', log);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new RenderFailure('shader', 'createProgram failed');
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) throw new RenderFailure('shader', gl.getProgramInfoLog(program) ?? 'link failed');
  return program;
}

function checkError(gl: WebGL2RenderingContext, what: string): void {
  const err = gl.getError();
  if (err === gl.NO_ERROR || gl.isContextLost()) return;
  if (err === gl.OUT_OF_MEMORY) throw new RenderFailure('oom', `out of GPU memory: ${what}`);
  throw new RenderFailure('render', `WebGL error ${err}: ${what}`);
}

/**
 * The WebGL 2 texture renderer. `forced` is the `?test&gl=` switch: 'off' (no WebGL), 'shader-fail',
 * 'small-textures' (MAX_TEXTURE_SIZE reported as 2048), 'render-fail' (the first draw throws).
 */
export function createWebGLRenderer(canvas: HTMLCanvasElement, forced: string | null): TextureRenderer {
  if (forced === 'off') throw new RenderFailure('no-webgl', 'WebGL switched off for a test');
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) throw new RenderFailure('no-webgl', 'WebGL 2 is not available');
  const high = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  if (!high || high.precision < 16) throw new RenderFailure('no-webgl', 'no high-precision floats in fragment shaders');
  const program = link(gl, forced === 'shader-fail' ? FRAGMENT_SHADER.replace('void main()', 'void main(int broken)') : FRAGMENT_SHADER);
  const u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(program, n)])) as Record<Uniform, WebGLUniformLocation | null>;

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const maxTextureSize = forced === 'small-textures' ? 2048 : (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
  let textures: { day: WebGLTexture; region: WebGLTexture; night: WebGLTexture | null } | null = null;
  let failNextDraw = forced === 'render-fail';

  const upload = (bmp: ImageBitmap, repeat: boolean): WebGLTexture => {
    const tex = gl.createTexture();
    if (!tex) throw new RenderFailure('render', 'createTexture failed');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    checkError(gl, 'texImage2D');
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    checkError(gl, 'mipmaps');
    return tex;
  };
  const freeTextures = () => {
    if (!textures) return;
    gl.deleteTexture(textures.day); gl.deleteTexture(textures.region);
    if (textures.night) gl.deleteTexture(textures.night);
    textures = null;
  };

  return {
    tier: 'webgl',
    maxTextureSize,
    resize(cssWidth, cssHeight, dpr) {
      const k = Math.min(2, Math.max(1, dpr));
      const w = Math.max(1, Math.round(cssWidth * k)), h = Math.max(1, Math.round(cssHeight * k));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    },
    setTextures(t: StyleTextures) {
      if (Math.max(t.day.width, t.day.height) > maxTextureSize) throw new RenderFailure('texture-size', `texture ${t.day.width} px > MAX_TEXTURE_SIZE ${maxTextureSize}`);
      freeTextures();
      textures = { day: upload(t.day, true), region: upload(t.region, false), night: t.night ? upload(t.night, true) : null };
    },
    draw(input: DrawInputs) {
      if (gl.isContextLost() || !textures) return;
      if (failNextDraw) { failNextDraw = false; throw new RenderFailure('render', 'draw failure forced for a test'); }
      const v = input.view;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(u.uSize, v.width, v.height);
      gl.uniform1i(u.uProjection, v.projection);
      gl.uniform1f(u.uScale, v.scale);
      gl.uniform2f(u.uOrigin, v.origin[0], v.origin[1]);
      gl.uniform2f(u.uRotate, v.rotate[0], v.rotate[1]);
      gl.uniform1f(u.uMaxLat, v.maxLat);
      gl.uniform1f(u.uViewPx, canvas.width / v.width);
      gl.uniform4f(u.uRegionBox, REGION.west * RAD, REGION.south * RAD, REGION.east * RAD, REGION.north * RAD);
      gl.uniform1f(u.uRegionMix, input.regionMix);
      const night = input.night && textures.night ? input.night : null;
      gl.uniform1i(u.uNightOn, night ? 1 : 0);
      gl.uniform3f(u.uSun, night?.x ?? 0, night?.y ?? 0, night?.z ?? 1);
      gl.uniform1i(u.uLimb, input.limb ? 1 : 0);
      gl.uniform1i(u.uGlow, input.glow ? 1 : 0);
      gl.uniform1i(u.uDebug, input.debug);
      const bind = (unit: number, tex: WebGLTexture, name: Uniform) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u[name], unit); };
      bind(0, textures.day, 'uDay');
      bind(1, textures.region, 'uRegion');
      bind(2, textures.night ?? textures.day, 'uNight');
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      checkError(gl, 'draw');
    },
    readPixels(x, y, w, h) {
      const flipped = new Uint8Array(w * h * 4);
      gl.readPixels(x, canvas.height - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, flipped);
      const out = new Uint8Array(w * h * 4);
      for (let row = 0; row < h; row++) out.set(flipped.subarray((h - 1 - row) * w * 4, (h - row) * w * 4), row * w * 4);
      return out;
    },
    bufferSize: () => ({ width: canvas.width, height: canvas.height }),
    loseContext(restoreAfterMs) {
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
      if (ext && restoreAfterMs !== null) setTimeout(() => ext.restoreContext(), restoreAfterMs);
    },
    dispose() {
      if (!gl.isContextLost()) { freeTextures(); gl.deleteBuffer(quad); gl.deleteVertexArray(vao); gl.deleteProgram(program); }
    },
  };
}
