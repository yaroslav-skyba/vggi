import { Model } from './Model.js';
import {
  mat4LookAt,
  mat4Multiply,
  mat4Perspective,
  mat4RotationX,
  mat4RotationY,
  mat4Translation,
} from './math.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
  throw new Error('WebGL is not supported by this browser.');
}

const vertexShaderSource = `
  attribute vec3 aPosition;
  uniform mat4 uMVP;

  void main() {
    gl_Position = uMVP * vec4(aPosition, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform vec4 uColor;

  void main() {
    gl_FragColor = uColor;
  }
`;

function createShader(type, source) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${message}`);
  }

  return shader;
}

function createProgram(vertexSource, fragmentSource) {
  const vertexShader = createShader(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${message}`);
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

const program = createProgram(
  vertexShaderSource,
  fragmentShaderSource
);

const programInfo = {
  program,
  attribLocations: {
    position: gl.getAttribLocation(program, 'aPosition'),
  },
  uniformLocations: {
    mvp: gl.getUniformLocation(program, 'uMVP'),
    color: gl.getUniformLocation(program, 'uColor'),
  },
};

const model = new Model(gl, {
  L: 4.0,
  T: 2.0,
  B: 0.5,
  uCurveCount: 18,
  vCurveCount: 16,
  uSamples: 100,
  vSamples: 110,
});

let rotationX = -0.55;
let rotationY = -0.75;
let cameraDistance = 8.5;

let dragging = false;
let previousMouseX = 0;
let previousMouseY = 0;

canvas.addEventListener('mousedown', (event) => {
  dragging = true;
  previousMouseX = event.clientX;
  previousMouseY = event.clientY;
});

window.addEventListener('mouseup', () => {
  dragging = false;
});

window.addEventListener('mousemove', (event) => {
  if (!dragging) return;

  const dx = event.clientX - previousMouseX;
  const dy = event.clientY - previousMouseY;

  rotationY += dx * 0.01;
  rotationX += dy * 0.01;

  previousMouseX = event.clientX;
  previousMouseY = event.clientY;
});

canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();

    cameraDistance += event.deltaY * 0.01;
    cameraDistance = Math.max(5.5, Math.min(14.0, cameraDistance));
  },
  { passive: false }
);

function resizeCanvasToDisplaySize() {
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.floor(canvas.clientWidth * pixelRatio);
  const height = Math.floor(canvas.clientHeight * pixelRatio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function render() {
  resizeCanvasToDisplaySize();

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.DEPTH_TEST);

  gl.clearColor(0.025, 0.035, 0.055, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(programInfo.program);

  const aspect = canvas.width / canvas.height;

  const projection = mat4Perspective(
    Math.PI / 4,
    aspect,
    0.1,
    100.0
  );

  const view = mat4LookAt(
    [0, 0, cameraDistance],
    [0, 0, 0],
    [0, 1, 0]
  );

  const centerModel = mat4Translation(-2.0, 0.0, -0.65);
  const rotateX = mat4RotationX(rotationX);
  const rotateY = mat4RotationY(rotationY);

  const rotation = mat4Multiply(rotateY, rotateX);
  const modelMatrix = mat4Multiply(rotation, centerModel);
  const viewModel = mat4Multiply(view, modelMatrix);
  const mvp = mat4Multiply(projection, viewModel);

  model.draw(programInfo, mvp);

  requestAnimationFrame(render);
}

render();
