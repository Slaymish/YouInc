// Narrow re-export of the three.js pieces the particle film actually uses.
// The film dynamically imports THIS module (never `three` directly), so the
// bundler can tree-shake the rest of three out of the lazy GL chunk.
export {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Points,
  ShaderMaterial,
  BufferGeometry,
  BufferAttribute,
  AdditiveBlending,
  Color,
  MathUtils,
} from "three";
