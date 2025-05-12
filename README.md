# Water Simulation

This project is a real-time 2D water simulation that demonstrates fluid dynamics using particle-based physics. The simulation creates an interactive water tank where particles behave like real water, responding to gravity, pressure, and collisions.

## Features

- Realistic fluid dynamics simulation using SPH (Smoothed Particle Hydrodynamics)
- Interactive water tank with boundary collisions
- Foam generation at high-velocity impacts
- Adjustable simulation parameters via UI sliders:
  - Particle count
  - Viscosity
  - Stiffness (Tait B)
  - Substeps
- Real-time visualization with WebGL rendering
- Performance monitoring and statistics displayed on screen

## Controls

### Mouse Controls
- Left-click and drag to attract water particles towards the mouse.
- Right-click and drag to repel water particles away from the mouse.

### Keyboard Controls
- `R`: Reset simulation (respawns particles).
- `F`: Toggle foam generation.
- `V`: Cycle through color modes (None -> Velocity -> Depth).
- `D`: Cycle through color modes (None -> Depth -> Velocity).
- `L`: Toggle lighting effects for the metaball surface.
- `M`: Toggle metaballs (smooth surface) rendering.
- `W`: Toggle surface ripples effect on metaballs.

### UI Controls
- **Sliders:**
    - Particle Count: Adjust the number of particles in the simulation.
    - Tait B (Stiffness): Adjust the stiffness of the fluid.
    - Substeps: Adjust the number of physics sub-steps per frame.
    - Viscosity: Adjust the viscosity of the fluid.
- **Performance Statistics Display:** Shows FPS, particle count, average velocity, and average density.

## Technical Details

The simulation uses:
- WebGL for rendering particles, foam, and the metaball surface.
- SPH (Smoothed Particle Hydrodynamics) for fluid simulation.
- Grid-based spatial partitioning for efficient neighbor finding.
- Real-time parameter adjustment via UI controls.
- Substepping for physics integration stability.