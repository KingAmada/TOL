# Third-party visual assets

The PBR texture sets in `assets/pbr/` are from [ambientCG](https://ambientcg.com/),
provided under the Creative Commons CC0 1.0 license. They are bundled locally so
the viewer does not depend on texture CDNs at runtime.

- Asphalt010
- Concrete034
- Facade018A
- Grass005
- Metal009
- Plaster001
- Travertine009

Only the 1K JPG albedo, roughness, OpenGL normal, displacement, and available
ambient-occlusion maps required by the real-time renderer are included.

`assets/environment/venice_sunset_1k.hdr` is the Venice Sunset environment from
the Three.js example assets (originally a CC0 HDRI from Poly Haven), bundled
locally to make first-frame reflections deterministic.
