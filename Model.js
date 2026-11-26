export class Model {
  constructor(
    gl,
    options = {}
  ) {
    this.gl = gl;

    this.L =
      options.L ?? 4.0;

    this.T =
      options.T ?? 2.0;

    this.B =
      options.B ?? 0.5;

    this.uMin =
      0.0;

    this.uMax =
      1.0;

    this.vMin =
      -0.3;

    this.vMax =
      1.0;

    this.uSegments =
      options.uSegments ?? 32;

    this.vSegments =
      options.vSegments ?? 48;

    this.positions = [];
    this.normals = [];
    this.indices = [];

    this.buildGeometry();

    this.calculateAngleWeightedNormals();


    this.positionData =
      new Float32Array(
        this.positions
      );

    this.normalData =
      new Float32Array(
        this.normals
      );

    this.indexData =
      new Uint16Array(
        this.indices
      );


    this.positionBuffer =
      this.createArrayBuffer(
        this.positionData
      );

    this.normalBuffer =
      this.createArrayBuffer(
        this.normalData
      );

    this.indexBuffer =
      this.createIndexBuffer(
        this.indexData
      );

    this.indexCount =
      this.indexData.length;
  }


  // Cartesian folium directrix
  directrixPoint(
    v,
    side
  ) {
    const denominator =
      1 / 3 + v;

    const root =
      Math.sqrt(
        (1 - v) /
        denominator
      );

    const y =
      side *
      2.5426 *
      this.B *
      v *
      root;

    const z =
      this.T *
      v;

    return [
      0,
      y,
      z
    ];
  }


  // Calculate one point of the conical surface
  surfacePoint(
    u,
    v,
    side
  ) {
    const [
      dx,
      dy,
      dz
    ] =
      this.directrixPoint(
        v,
        side
      );

    const ax =
      this.L;

    const ay =
      0;

    const az =
      this.T /
      Math.sqrt(3);

    const x =
      u * ax +
      (1 - u) * dx;

    const y =
      u * ay +
      (1 - u) * dy;

    const z =
      u * az +
      (1 - u) * dz;

    return [
      x,
      y,
      z
    ];
  }


  // Build both branches of the surface
  buildGeometry() {
    this.buildBranch(1);
    this.buildBranch(-1);
  }


  // Build one branch and its triangle indices
  buildBranch(side) {
    const rowSize =
      this.vSegments + 1;

    const baseIndex =
      this.positions.length / 3;


    for (
      let i = 0;
      i < this.uSegments;
      i++
    ) {
      const u =
        this.uMin +
        (
          this.uMax -
          this.uMin
        ) *
        i /
        this.uSegments;


      for (
        let j = 0;
        j <= this.vSegments;
        j++
      ) {
        const v =
          this.vMin +
          (
            this.vMax -
            this.vMin
          ) *
          j /
          this.vSegments;

        const [
          x,
          y,
          z
        ] =
          this.surfacePoint(
            u,
            v,
            side
          );

        this.positions.push(
          x,
          y,
          z
        );
      }
    }


    // One cone vertex for this branch
    const apexIndex =
      this.positions.length / 3;

    const [
      ax,
      ay,
      az
    ] =
      this.surfacePoint(
        1.0,
        this.vMin,
        side
      );

    this.positions.push(
      ax,
      ay,
      az
    );


    // Triangles between neighbouring rows
    for (
      let i = 0;
      i < this.uSegments - 1;
      i++
    ) {
      for (
        let j = 0;
        j < this.vSegments;
        j++
      ) {
        const a =
          baseIndex +
          i * rowSize +
          j;

        const b =
          baseIndex +
          (i + 1) *
          rowSize +
          j;

        const c =
          baseIndex +
          (i + 1) *
          rowSize +
          j + 1;

        const d =
          baseIndex +
          i *
          rowSize +
          j + 1;


        if (
          side > 0
        ) {
          this.indices.push(
            a,
            c,
            b
          );

          this.indices.push(
            a,
            d,
            c
          );
        } else {
          this.indices.push(
            a,
            b,
            c
          );

          this.indices.push(
            a,
            c,
            d
          );
        }
      }
    }


    // Final triangles to the cone vertex
    const lastRow =
      baseIndex +
      (
        this.uSegments -
        1
      ) *
      rowSize;


    for (
      let j = 0;
      j < this.vSegments;
      j++
    ) {
      const a =
        lastRow +
        j;

      const b =
        lastRow +
        j + 1;


      if (
        side > 0
      ) {
        this.indices.push(
          a,
          b,
          apexIndex
        );
      } else {
        this.indices.push(
          a,
          apexIndex,
          b
        );
      }
    }
  }


  // Facet Angle Weighted Average normals
  calculateAngleWeightedNormals() {
    const vertexCount =
      this.positions.length / 3;

    this.normals =
      new Array(
        vertexCount * 3
      ).fill(0);


    for (
      let i = 0;
      i < this.indices.length;
      i += 3
    ) {
      const ia =
        this.indices[i];

      const ib =
        this.indices[
          i + 1
        ];

      const ic =
        this.indices[
          i + 2
        ];


      const a =
        this.getPosition(
          ia
        );

      const b =
        this.getPosition(
          ib
        );

      const c =
        this.getPosition(
          ic
        );


      const ab =
        this.subtract(
          b,
          a
        );

      const ac =
        this.subtract(
          c,
          a
        );


      let faceNormal =
        this.cross(
          ab,
          ac
        );

      const faceLength =
        this.length(
          faceNormal
        );


      if (
        faceLength < 1e-8
      ) {
        continue;
      }


      faceNormal =
        this.scale(
          faceNormal,
          1 /
          faceLength
        );


      const angleA =
        this.cornerAngle(
          a,
          b,
          c
        );

      const angleB =
        this.cornerAngle(
          b,
          c,
          a
        );

      const angleC =
        this.cornerAngle(
          c,
          a,
          b
        );


      this.addNormal(
        ia,
        faceNormal,
        angleA
      );

      this.addNormal(
        ib,
        faceNormal,
        angleB
      );

      this.addNormal(
        ic,
        faceNormal,
        angleC
      );
    }


    // Normalize final vertex normals
    for (
      let vertex = 0;
      vertex < vertexCount;
      vertex++
    ) {
      const offset =
        vertex * 3;

      const normal = [
        this.normals[
          offset
        ],

        this.normals[
          offset + 1
        ],

        this.normals[
          offset + 2
        ],
      ];


      const len =
        this.length(
          normal
        );


      if (
        len > 1e-8
      ) {
        this.normals[
          offset
        ] /= len;

        this.normals[
          offset + 1
        ] /= len;

        this.normals[
          offset + 2
        ] /= len;
      } else {
        this.normals[
          offset
        ] = 0;

        this.normals[
          offset + 1
        ] = 0;

        this.normals[
          offset + 2
        ] = 1;
      }
    }
  }


  // Angle at one triangle vertex
  cornerAngle(
    center,
    p1,
    p2
  ) {
    const e1 =
      this.subtract(
        p1,
        center
      );

    const e2 =
      this.subtract(
        p2,
        center
      );

    const len1 =
      this.length(
        e1
      );

    const len2 =
      this.length(
        e2
      );


    if (
      len1 < 1e-8 ||
      len2 < 1e-8
    ) {
      return 0;
    }


    let cosine =
      this.dot(
        e1,
        e2
      ) /
      (
        len1 *
        len2
      );

    cosine =
      Math.max(
        -1,
        Math.min(
          1,
          cosine
        )
      );

    return Math.acos(
      cosine
    );
  }


  getPosition(index) {
    const offset =
      index * 3;

    return [
      this.positions[
        offset
      ],

      this.positions[
        offset + 1
      ],

      this.positions[
        offset + 2
      ],
    ];
  }


  addNormal(
    index,
    normal,
    weight
  ) {
    const offset =
      index * 3;

    this.normals[
      offset
    ] +=
      normal[0] *
      weight;

    this.normals[
      offset + 1
    ] +=
      normal[1] *
      weight;

    this.normals[
      offset + 2
    ] +=
      normal[2] *
      weight;
  }


  subtract(a, b) {
    return [
      a[0] - b[0],
      a[1] - b[1],
      a[2] - b[2],
    ];
  }


  cross(a, b) {
    return [
      a[1] * b[2] -
        a[2] * b[1],

      a[2] * b[0] -
        a[0] * b[2],

      a[0] * b[1] -
        a[1] * b[0],
    ];
  }


  dot(a, b) {
    return (
      a[0] * b[0] +
      a[1] * b[1] +
      a[2] * b[2]
    );
  }


  length(vector) {
    return Math.hypot(
      vector[0],
      vector[1],
      vector[2]
    );
  }


  scale(
    vector,
    value
  ) {
    return [
      vector[0] *
        value,

      vector[1] *
        value,

      vector[2] *
        value,
    ];
  }


  // Create VBO
  createArrayBuffer(data) {
    const gl =
      this.gl;

    const buffer =
      gl.createBuffer();

    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      buffer
    );

    gl.bufferData(
      gl.ARRAY_BUFFER,
      data,
      gl.STATIC_DRAW
    );

    return buffer;
  }


  // Create index buffer
  createIndexBuffer(data) {
    const gl =
      this.gl;

    const buffer =
      gl.createBuffer();

    gl.bindBuffer(
      gl.ELEMENT_ARRAY_BUFFER,
      buffer
    );

    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      data,
      gl.STATIC_DRAW
    );

    return buffer;
  }


  // Draw indexed triangles
  draw(programInfo) {
    const gl =
      this.gl;


    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      this.positionBuffer
    );

    gl.enableVertexAttribArray(
      programInfo
        .attribLocations
        .position
    );

    gl.vertexAttribPointer(
      programInfo
        .attribLocations
        .position,
      3,
      gl.FLOAT,
      false,
      0,
      0
    );


    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      this.normalBuffer
    );

    gl.enableVertexAttribArray(
      programInfo
        .attribLocations
        .normal
    );

    gl.vertexAttribPointer(
      programInfo
        .attribLocations
        .normal,
      3,
      gl.FLOAT,
      false,
      0,
      0
    );


    gl.bindBuffer(
      gl.ELEMENT_ARRAY_BUFFER,
      this.indexBuffer
    );


    gl.drawElements(
      gl.TRIANGLES,
      this.indexCount,
      gl.UNSIGNED_SHORT,
      0
    );
  }


  dispose() {
    const gl =
      this.gl;

    if (
      this.positionBuffer
    ) {
      gl.deleteBuffer(
        this.positionBuffer
      );
    }

    if (
      this.normalBuffer
    ) {
      gl.deleteBuffer(
        this.normalBuffer
      );
    }

    if (
      this.indexBuffer
    ) {
      gl.deleteBuffer(
        this.indexBuffer
      );
    }
  }
}