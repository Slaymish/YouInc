// The particle film: one THREE.Points cloud with three position attribute sets
// (chaos field / balanced debit-credit streams / ordered lattice). The vertex
// shader mixes between them with two scroll-driven morph uniforms plus ambient
// time drift; the fragment renders soft additive phosphor points. All uniform
// values are supplied per-frame by the caller (CinematicCanvas + sceneManager).

type ThreeModule = typeof import("./three");

export interface ParticleSceneHandle {
  render(dt: number): void;
  resize(width: number, height: number): void;
  setUniforms(u: { morph1: number; morph2: number; intensity: number; focus: number }): void;
  setPointer(x: number, y: number): void;
  /** Halve the rendered particle count (perf degradation). */
  degrade(): void;
  dispose(): void;
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uMorph1;
  uniform float uMorph2;
  uniform float uFocus;
  uniform float uPixelRatio;
  uniform vec2 uExtent;
  uniform vec2 uPointer;

  attribute vec3 aChaos;
  attribute vec3 aStream;
  attribute vec3 aLattice;
  attribute float aSeed;

  varying float vTone;
  varying float vAlpha;

  void main() {
    vec3 p = mix(mix(aChaos, aStream, uMorph1), aLattice, uMorph2);

    // Ambient drift — strongest in chaos, nearly still in the lattice.
    float order = max(uMorph1, uMorph2);
    float drift = mix(0.08, 0.012, order);
    p.x += sin(uTime * 0.32 + aSeed * 39.0) * drift;
    p.y += cos(uTime * 0.27 + aSeed * 51.0) * drift;
    p.z += sin(uTime * 0.21 + aSeed * 27.0) * drift * 0.6;

    // Stream flow — particles run left→right along their lane while ordered.
    p.x += uMorph1 * (1.0 - uMorph2) * fract(uTime * 0.02 + aSeed) * 0.12;

    // Close act: condense toward the centre.
    p.xy = mix(p.xy, p.xy * 0.38, uFocus);

    // Subtle pointer parallax.
    p.xy += uPointer * 0.18 * (0.3 + aSeed * 0.7);

    vec3 world = vec3(p.xy * uExtent * 0.5, p.z * 2.0);
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;

    float twinkle = 0.72 + 0.28 * sin(uTime * (0.6 + aSeed) + aSeed * 91.0);
    vAlpha = twinkle * smoothstep(-9.0, -3.0, mv.z);
    vTone = aSeed;

    gl_PointSize = (1.1 + aSeed * 2.2) * uPixelRatio * (6.0 / -mv.z);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;

  uniform float uIntensity;
  uniform vec3 uColorDim;
  uniform vec3 uColorBright;

  varying float vTone;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float disc = smoothstep(0.5, 0.08, d);
    vec3 color = mix(uColorDim, uColorBright, smoothstep(0.55, 0.95, vTone));
    float a = disc * vAlpha * uIntensity * 0.85;
    gl_FragColor = vec4(color * a, a);
  }
`;

interface Rand {
  (): number;
}

/** Deterministic PRNG so the field composes identically on every visit. */
function mulberry32(seed: number): Rand {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STREAM_LANES = 7;
const LANE_PAIR_GAP = 0.05;

function buildAttributes(count: number) {
  const rand = mulberry32(20260713);
  const chaos = new Float32Array(count * 3);
  const stream = new Float32Array(count * 3);
  const lattice = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  const cols = Math.ceil(Math.sqrt(count * 1.8));
  const rows = Math.ceil(count / cols);

  for (let i = 0; i < count; i++) {
    const j = i * 3;
    const seed = rand();
    seeds[i] = seed;

    // Chaos: a loose volumetric cloud, clumped by summing two randoms.
    chaos[j] = (rand() + rand() - 1) * 2.2;
    chaos[j + 1] = (rand() + rand() - 1) * 1.6;
    chaos[j + 2] = (rand() - 0.5) * 1.6;

    // Streams: horizontal lanes in balanced debit/credit pairs.
    const lane = Math.floor(rand() * STREAM_LANES);
    const side = rand() > 0.5 ? 1 : -1;
    const laneY = ((lane + 0.5) / STREAM_LANES - 0.5) * 1.7;
    stream[j] = (rand() - 0.5) * 2.4;
    stream[j + 1] = laneY + side * LANE_PAIR_GAP + (rand() - 0.5) * 0.015;
    stream[j + 2] = (rand() - 0.5) * 0.25;

    // Lattice: the ordered grid.
    const col = i % cols;
    const row = Math.floor(i / cols) % rows;
    lattice[j] = ((col + 0.5) / cols - 0.5) * 2.3 + (rand() - 0.5) * 0.01;
    lattice[j + 1] = ((row + 0.5) / rows - 0.5) * 1.75 + (rand() - 0.5) * 0.01;
    lattice[j + 2] = (rand() - 0.5) * 0.08;
  }

  return { chaos, stream, lattice, seeds };
}

export interface ParticleColors {
  /** CSS color strings, resolved from the --mk-accent-dim / --mk-accent tokens. */
  readonly dim: string;
  readonly bright: string;
}

export async function createParticleScene(
  canvas: HTMLCanvasElement,
  particleCount: number,
  colors: ParticleColors,
): Promise<ParticleSceneHandle> {
  const THREE: ThreeModule = await import("./three");

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 40);
  camera.position.z = 6;

  const { chaos, stream, lattice, seeds } = buildAttributes(particleCount);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(chaos, 3));
  geometry.setAttribute("aChaos", new THREE.BufferAttribute(chaos, 3));
  geometry.setAttribute("aStream", new THREE.BufferAttribute(stream, 3));
  geometry.setAttribute("aLattice", new THREE.BufferAttribute(lattice, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const uniforms = {
    uTime: { value: 0 },
    uMorph1: { value: 0 },
    uMorph2: { value: 0 },
    uFocus: { value: 0 },
    uIntensity: { value: 0 },
    uPixelRatio: { value: 1 },
    uExtent: { value: [10, 6] as [number, number] },
    uPointer: { value: [0, 0] as [number, number] },
    uColorDim: { value: new THREE.Color(colors.dim) },
    uColorBright: { value: new THREE.Color(colors.bright) },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  let time = 0;
  let drawCount = particleCount;
  const pointerTarget = { x: 0, y: 0 };
  const pointerCurrent = { x: 0, y: 0 };

  return {
    render(dt: number) {
      time += dt;
      uniforms.uTime.value = time;
      pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.05;
      pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.05;
      uniforms.uPointer.value = [pointerCurrent.x, pointerCurrent.y];
      renderer.render(scene, camera);
    },
    resize(width: number, height: number) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      uniforms.uPixelRatio.value = dpr;
      // World extent of the z=0 plane so normalized attribute space fills view.
      const worldH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
      uniforms.uExtent.value = [worldH * camera.aspect, worldH];
    },
    setUniforms(u) {
      uniforms.uMorph1.value = u.morph1;
      uniforms.uMorph2.value = u.morph2;
      uniforms.uIntensity.value = u.intensity;
      uniforms.uFocus.value = u.focus;
    },
    setPointer(x: number, y: number) {
      pointerTarget.x = x;
      pointerTarget.y = y;
    },
    degrade() {
      drawCount = Math.max(2000, Math.floor(drawCount / 2));
      geometry.setDrawRange(0, drawCount);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
