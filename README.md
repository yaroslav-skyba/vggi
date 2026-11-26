# PA2 — Filled Surface and Phong Shading

## Variant

15

- Shading: Phong
- Vertex normal: Facet Angle Weighted Average

## Surface

Conical Surface with a Directrix Curve
in the Form of Cartesian Folium.

Parameters:

- L = 4
- T = 2
- B = 0.5
- 0 <= u <= 1
- -0.3 <= v <= 1

The PA2 model is based on the surface
implemented in PA1.

## Geometry

The surface is rendered using filled indexed triangles.

Vertex coordinates are stored in a VBO.

Vertex normals are stored in a separate VBO.

Triangle indices are stored in an
ELEMENT_ARRAY_BUFFER.

Rendering is performed with:

gl.drawElements(gl.TRIANGLES, ...)

## Surface granularity

Two sliders control surface subdivisions:

- U granularity
- V granularity

Changing either slider rebuilds the triangle mesh.

## Vertex normals

Variant 15 uses Facet Angle Weighted Average normals.

For every triangle:

1. The facet normal is calculated.
2. The angles at all three triangle vertices are calculated.
3. The facet normal is multiplied by the corresponding corner angle.
4. Weighted facet normals are accumulated for every vertex.
5. Final vertex normals are normalized.

## Phong shading

Phong shading is calculated in the fragment shader.

The vertex shader passes interpolated:

- vertex position
- vertex normal

to the fragment shader.

The fragment shader calculates:

Irgb = Ambient + Diffuse + Specular

## Point light

One point light source moves in a circular trajectory
around the surface.

The light coordinates are transformed by the ModelView matrix
before being passed to the GPU as a uniform.

The point light is also represented by a small yellow sphere
to make its position visible in the scene.

## Projection

Perspective projection is used.

## Controls

- Mouse drag — rotate
- Mouse wheel — zoom
- U slider — change U granularity
- V slider — change V granularity
- Yellow sphere — point light source