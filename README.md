# PA1 — Surface Rendering

## Variant 15

Conical Surface with a Directrix Curve in the Form of Cartesian Folium.

The model is rendered as a WebGL wireframe using two curve families:

- U-curves — straight generatrices from the directrix to the cone vertex;
- V-curves — cross-sections corresponding to constant `u`.

Parameters used for the model:

- `L = 4`
- `T = 2`
- `B = 0.5`
- `0 <= u <= 1`
- `-0.3 <= v <= 1`

Vertex coordinates are stored separately for the U and V curve families in `Float32Array` objects and uploaded to separate WebGL buffers. Every polyline is rendered with `gl.LINE_STRIP`.

## Controls

- Mouse drag — rotate
- Mouse wheel — zoom

## Screenshot

Add the result image to `screenshots/pa1-variant15.png`.
