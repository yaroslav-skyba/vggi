export class Model {
  constructor(gl, options = {}) {
    this.gl = gl;

    this.L = options.L ?? 4.0;
    this.T = options.T ?? 2.0;
    this.B = options.B ?? 0.5;

    this.uMin = 0.0;
    this.uMax = 1.0;
    this.vMin = -0.3;
    this.vMax = 1.0;

    this.uCurveCount = options.uCurveCount ?? 18;
    this.vCurveCount = options.vCurveCount ?? 16;
    this.uSamples = options.uSamples ?? 100;
    this.vSamples = options.vSamples ?? 110;

    this.uVertices = [];
    this.vVertices = [];
    this.uRanges = [];
    this.vRanges = [];

    this.buildUCurves();
    this.buildVCurves();

    this.uVertexData = new Float32Array(this.uVertices);
    this.vVertexData = new Float32Array(this.vVertices);

    this.uBuffer = this.createBuffer(this.uVertexData);
    this.vBuffer = this.createBuffer(this.vVertexData);
  }

  directrixPoint(v, side) {
    const denominator = 1 / 3 + v;
    const root = Math.sqrt((1 - v) / denominator);

    const y = side * 2.5426 * this.B * v * root;
    const z = this.T * v;

    return [0, y, z];
  }

  surfacePoint(u, v, side) {
    const [dx, dy, dz] = this.directrixPoint(v, side);

    const ax = this.L;
    const ay = 0;
    const az = this.T / Math.sqrt(3);

    const x = u * ax + (1 - u) * dx;
    const y = u * ay + (1 - u) * dy;
    const z = u * az + (1 - u) * dz;

    return [x, y, z];
  }

  buildUCurves() {
    for (const side of [-1, 1]) {
      for (let line = 0; line < this.uCurveCount; line++) {
        const v = this.vMin +
          (this.vMax - this.vMin) * line / (this.uCurveCount - 1);

        const first = this.uVertices.length / 3;

        for (let sample = 0; sample <= this.uSamples; sample++) {
          const u = this.uMin +
            (this.uMax - this.uMin) * sample / this.uSamples;

          const [x, y, z] = this.surfacePoint(u, v, side);
          this.uVertices.push(x, y, z);
        }

        this.uRanges.push({
          first,
          count: this.uSamples + 1,
        });
      }
    }
  }

  buildVCurves() {
    for (let line = 0; line < this.vCurveCount; line++) {
      const u = this.uMin +
        (this.uMax - this.uMin) * line / this.vCurveCount;

      const first = this.vVertices.length / 3;

      // Positive branch of the Cartesian folium.
      for (let sample = 0; sample <= this.vSamples; sample++) {
        const v = this.vMin +
          (this.vMax - this.vMin) * sample / this.vSamples;

        const [x, y, z] = this.surfacePoint(u, v, 1);
        this.vVertices.push(x, y, z);
      }

      // Return along the negative branch. Both branches meet at v = 1.
      for (let sample = this.vSamples - 1; sample >= 0; sample--) {
        const v = this.vMin +
          (this.vMax - this.vMin) * sample / this.vSamples;

        const [x, y, z] = this.surfacePoint(u, v, -1);
        this.vVertices.push(x, y, z);
      }

      this.vRanges.push({
        first,
        count: 2 * this.vSamples + 1,
      });
    }
  }

  createBuffer(data) {
    const gl = this.gl;
    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    return buffer;
  }

  draw(programInfo, mvpMatrix) {
    const gl = this.gl;

    gl.uniformMatrix4fv(
      programInfo.uniformLocations.mvp,
      false,
      mvpMatrix
    );

    gl.enableVertexAttribArray(
      programInfo.attribLocations.position
    );

    this.drawCurveFamily(
      this.uBuffer,
      this.uRanges,
      programInfo,
      [0.15, 0.78, 0.96, 1.0]
    );

    this.drawCurveFamily(
      this.vBuffer,
      this.vRanges,
      programInfo,
      [1.0, 0.48, 0.16, 1.0]
    );
  }

  drawCurveFamily(buffer, ranges, programInfo, color) {
    const gl = this.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    gl.vertexAttribPointer(
      programInfo.attribLocations.position,
      3,
      gl.FLOAT,
      false,
      0,
      0
    );

    gl.uniform4fv(
      programInfo.uniformLocations.color,
      color
    );

    for (const range of ranges) {
      gl.drawArrays(
        gl.LINE_STRIP,
        range.first,
        range.count
      );
    }
  }
}
