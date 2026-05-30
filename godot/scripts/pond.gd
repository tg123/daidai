extends MeshInstance3D
## Pond floor placeholder.
##
## The Three.js version (src/scene/pond.ts on main) has animated
## water shader, lily pads, ambient particles. This is just a flat
## green plane for now so the rest of the scene can be wired up.
##
## TODO when promoting this branch:
##   - port the water normal-map shader to Godot's StandardMaterial3D
##     or a custom ShaderMaterial
##   - port lily pad placement + bobbing animation
##   - port the worm-eaten ripple effect on bean pickup
