# Control Task — Variant 15

## Source project
This project extends PA2 (variant 15): **Conical Surface with Cartesian Folium Directrix**.

Original settings retained:
- `L = 4`, `T = 2`, `B = 0.5`
- `u ∈ [0, 1]`, `v ∈ [-0.3, 1]`
- Facet Angle Weighted Average vertex normals
- Per-fragment Phong lighting, indexed triangles, perspective camera
- Mouse rotation and zoom, U/V granularity sliders, moving point light.

## Three texture maps
- `textures/diffuse.png` modulates diffuse lighting (and ambient base color).
- `textures/specular.png` modulates specular highlights.
- `textures/normal.png` provides per-fragment tangent-space normals.

They share the same UV layout and periodic relief pattern. Each can be toggled separately.

## Correct TBN construction

A tangent derived only from a parametric derivative is not necessarily a **texture tangent**.
For each mesh triangle, `Model.js` calculates tangent and bitangent from position edges and UV edges:

```
e1 = p1 - p0, e2 = p2 - p0
f = 1 / (du1*dv2 - du2*dv1)
T = f*(e1*dv2 - e2*dv1)
B = f*(e2*du1 - e1*du2)
```

Triangular contributions are accumulated at vertices with corner-angle weighting. Tangents preserve the UV layout. A handedness sign is computed for consistent bitangent direction.

For variant **15**, Gram–Schmidt gives **tangent priority**: preserve `T` and orthogonalize `N` against it.

```
T = normalize(vTangentView)
N = normalize(N0 - dot(N0,T)*T)
B = cross(N,T)*handedness
TBN = mat3(T,B,N)
```

The `UV rotation` slider rotates the texture coordinates and rebuilds the mesh tangents, demonstrating that the TBN frame follows UV orientation. The conical apex uses per-segment UV vertices to avoid one shared, ambiguous tangent.
