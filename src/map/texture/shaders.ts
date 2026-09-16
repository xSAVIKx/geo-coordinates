// The texture layer's shaders (Map styles spec §4 "WebGL path"). The inverse projections must stay identical to
// src/map/texture/inverse.ts, which the unit tests check against d3; an e2e test reads this shader's longitudes and
// latitudes back (uDebug) and checks them against d3 too.
export const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
uniform vec2 uSize;
out vec2 vView;
void main() {
  // View units with the origin top-left and y down, exactly like the SVG viewBox.
  vView = vec2((aPos.x + 1.0) * 0.5 * uSize.x, (1.0 - aPos.y) * 0.5 * uSize.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
in vec2 vView;
out vec4 outColor;

const float PI = 3.141592653589793;
const float HALF_PI = 1.5707963267948966;
const float DEG = 0.017453292519943295;
const float EPS = 1e-6;
const float A1 = 1.340264;
const float A2 = -0.081106;
const float A3 = 0.000893;
const float A4 = 0.003796;
const float M = 0.8660254037844386;

uniform int uProjection;   // 0 grid, 1 equal earth, 2 mercator, 3 globe
uniform float uScale;      // d3 projection.scale()
uniform vec2 uOrigin;      // flat: projection([0, 0]); globe: projection.translate()
uniform vec2 uRotate;      // globe: rotate()[0..1] in radians
uniform float uMaxLat;     // radians
uniform float uViewPx;     // drawing-buffer pixels per view unit
uniform sampler2D uDay;    // whole-world equirectangular image, north at the top
uniform sampler2D uRegion; // Central Europe detail tile
uniform vec4 uRegionBox;   // west, south, east, north (radians)
uniform float uRegionMix;
uniform sampler2D uNight;  // Black Marble city lights
uniform int uNightOn;
uniform vec3 uSun;         // unit vector towards the point under the Sun
uniform int uLimb;
uniform int uGlow;
uniform int uDebug;

/*
 * Accurate sine, cosine and arcsine. A driver's own sin/cos/asin are only graphics-accurate (headless SwiftShader's
 * carry about 1e-4 of relative error), and Equal Earth divides by cos: that error becomes 0.02° of longitude, twice
 * what the parity test against d3 allows. These Taylor series, folded into [-pi/2, pi/2] first, stay within ~1e-7,
 * so the shader tracks src/map/texture/inverse.ts (tests/e2e/texture-webgl.spec.ts checks both against d3).
 */
float sinT(float x) {
  float t = x - 2.0 * PI * floor((x + PI) / (2.0 * PI)); // [-pi, pi)
  if (t > HALF_PI) t = PI - t;
  else if (t < -HALF_PI) t = -PI - t;
  float t2 = t * t;
  return t * (1.0 + t2 * (-1.0 / 6.0 + t2 * (1.0 / 120.0 + t2 * (-1.0 / 5040.0 + t2 * (1.0 / 362880.0 - t2 / 39916800.0)))));
}

float cosT(float x) {
  return sinT(x + HALF_PI);
}

/** asin, refined by one Newton step from the driver's own (a hundred times closer, quadratic convergence). */
float asinT(float s) {
  float c = clamp(s, -1.0, 1.0);
  float p = asin(c);
  float d = cosT(p);
  return abs(d) > 1e-3 ? p + (c - sinT(p)) / d : p;
}

vec2 inverseProject(vec2 view, out bool ok, out float rho) {
  ok = true;
  rho = 0.0;
  float X = (view.x - uOrigin.x) / uScale;
  float Y = (uOrigin.y - view.y) / uScale;
  if (uProjection == 3) {
    float r2 = X * X + Y * Y;
    rho = sqrt(r2);
    if (r2 > 1.0) { ok = false; return vec2(0.0); }
    float xr = sqrt(1.0 - r2);
    float cp = cosT(uRotate.y);
    float sp = sinT(uRotate.y);
    float cx = xr * cp + Y * sp;
    float cy = X;
    float cz = Y * cp - xr * sp;
    float lambda = mod(atan(cy, cx) - uRotate.x + PI, 2.0 * PI) - PI;
    return vec2(lambda, asinT(cz));
  }
  vec2 ll;
  if (uProjection == 0) {
    ll = vec2(X, Y);
  } else if (uProjection == 2) {
    ll = vec2(X, 2.0 * atan(exp(Y)) - HALF_PI);
  } else {
    float l = Y;
    for (int i = 0; i < 12; i++) {
      float l2 = l * l;
      float l6 = l2 * l2 * l2;
      l -= (l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)) - Y) / (A1 + 3.0 * A2 * l2 + l6 * (7.0 * A3 + 9.0 * A4 * l2));
    }
    float l2 = l * l;
    float l6 = l2 * l2 * l2;
    float s = sinT(l) / M;
    if (abs(s) > 1.0) { ok = false; return vec2(0.0); }
    ll = vec2(M * X * (A1 + 3.0 * A2 * l2 + l6 * (7.0 * A3 + 9.0 * A4 * l2)) / cosT(l), asinT(s));
  }
  if (abs(ll.x) > PI + EPS || abs(ll.y) > uMaxLat + EPS) ok = false;
  return ll;
}

void main() {
  bool ok;
  float rho;
  vec2 ll = inverseProject(vView, ok, rho);

  if (uDebug > 0) {
    float v = uDebug == 1 ? (ll.x + PI) / (2.0 * PI) : (ll.y + HALF_PI) / PI;
    float q = floor(clamp(v, 0.0, 1.0) * 65535.0 + 0.5);
    outColor = ok ? vec4(floor(q / 256.0) / 255.0, mod(q, 256.0) / 255.0, 0.0, 1.0) : vec4(0.0);
    return;
  }

  // Texture coordinates and their screen derivatives, computed for every fragment (derivatives need uniform control
  // flow). The longitude derivative ignores the jump at the antimeridian, so mipmaps have no seam there.
  vec2 uv = vec2(ll.x / (2.0 * PI) + 0.5, 0.5 - ll.y / PI);
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  dx.x -= round(dx.x);
  dy.x -= round(dy.x);
  vec2 ruv = vec2((ll.x - uRegionBox.x) / (uRegionBox.z - uRegionBox.x), (uRegionBox.w - ll.y) / (uRegionBox.w - uRegionBox.y));
  vec2 rdx = dFdx(ruv);
  vec2 rdy = dFdy(ruv);

  if (!ok) {
    if (uProjection == 3 && uGlow == 1) {
      float t = 1.0 - (rho - 1.0) * uScale / 6.0; // 6 view units wide
      float a = 0.55 * clamp(t, 0.0, 1.0) * clamp(t, 0.0, 1.0);
      outColor = vec4(vec3(0.45, 0.70, 1.0) * a, a);
    } else {
      outColor = vec4(0.0);
    }
    return;
  }

  vec3 color = textureGrad(uDay, uv, dx, dy).rgb;
  if (uRegionMix > 0.0) {
    float edge = min(min(ll.x - uRegionBox.x, uRegionBox.z - ll.x), min(ll.y - uRegionBox.y, uRegionBox.w - ll.y));
    float w = smoothstep(0.0, 0.25 * DEG, edge) * uRegionMix;
    if (w > 0.0) color = mix(color, textureGrad(uRegion, ruv, rdx, rdy).rgb, w);
  }
  if (uNightOn == 1) {
    vec3 p = vec3(cos(ll.y) * cos(ll.x), cos(ll.y) * sin(ll.x), sin(ll.y));
    float altitude = asin(clamp(dot(p, uSun), -1.0, 1.0));
    float day = smoothstep(-6.0 * DEG, 0.0, altitude);
    vec3 night = min(textureGrad(uNight, uv, dx, dy).rgb * 1.15, vec3(1.0));
    color = mix(night, color, day);
  }
  float alpha = 1.0;
  if (uProjection == 3) {
    if (uLimb == 1) color *= mix(0.78, 1.0, pow(sqrt(max(0.0, 1.0 - rho * rho)), 0.35));
    alpha = clamp((1.0 - rho) * uScale * uViewPx + 0.5, 0.0, 1.0);
  }
  outColor = vec4(color * alpha, alpha);
}`;
