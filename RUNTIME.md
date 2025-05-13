# Runtime
#### A 2D SPH Water Simulation using WebGL

## Runtime Overview

Below is a runtime analysis of the major functions and algorithms used in this SPH water simulation. The primary variable influencing runtime is **N**, the number of particles. Other factors include the number of simulation substeps **S** per frame, and the resolution of the rendering grid **G** (proportional to canvas width * height) used for metaball surface rendering.

1.  **`updateGrid()`**: Runtime is **O(N)**. This function iterates through all `N` particles once to place them into the spatial grid structure. The cost of hashing coordinates is constant time per particle.

2.  **`getNeighbors()`**: Average runtime is **O(N)**. While technically O(N * k) where k is the number of neighbors checked per particle, the spatial grid optimization ensures that k is roughly constant on average (related to the fluid density and smoothing radius H), assuming particles are reasonably distributed. Each particle checks a constant number of adjacent grid cells.

3.  **`calculateDensityPressure()`**: Average runtime is **O(N)**. This function iterates through all `N` particles. For each particle, it iterates through its neighbors (k). As `k` is constant on average due to the grid, the complexity is dominated by the outer loop over `N` particles.

4.  **`applyForces()`**: Average runtime is **O(N)**. Similar to `calculateDensityPressure`, this involves iterating through `N` particles and their respective neighbors (k). Pressure, viscosity, and external forces (gravity, mouse, boundary) are calculated. The neighbor loop makes it O(N * k), which simplifies to O(N) on average.

5.  **`integrate()`**: Average runtime is **O(N)**. This function performs a single pass over all `N` particles to update their velocity and position using Euler integration. The XSPH viscosity calculation involves another neighbor loop (O(N*k)), but the overall average complexity remains O(N).

6.  **`applyConstraints()`**: Average runtime is **O(N)**. This function handles boundary collisions (O(N)) and particle-particle separation checks. The separation check involves iterating through neighbors (O(N*k) -> O(N) average). Foam spawning logic adds minor overhead based on collision events or turbulence checks, but doesn't dominate the particle loops.

7.  **`drawSurface()` (Metaballs)**: Runtime is roughly **O(G + N*k')** where `G` is the number of cells in the surface rendering grid (rows * cols) and `k'` is the number of grid cells affected by a single particle's metaball influence. Calculating the scalar field involves iterating through particles and updating nearby grid cells. Marching Squares then processes each grid cell, taking O(G) time. The complexity depends heavily on the grid resolution `G`.

8.  **`update()` (Overall Frame)**:
    *   **Physics:** The core physics simulation (steps 1-6) runs within `S` substeps. Therefore, the total physics cost per frame is **O(S * N)** on average.
    *   **Rendering:**
        *   If metaballs (`drawSurface`) are enabled: O(G + N*k') + O(N) (for foam) ≈ **O(S*N + G)** assuming G is larger than N*k'.
        *   If rendering particles directly (`drawWebGL`): O(N) + O(Foam) ≈ **O(N)**.
    *   **Total Average Runtime Per Frame:**
        *   With Metaballs: **O(S * N + G)**
        *   Without Metaballs: **O(S * N)**

The dominant factors are the number of particles `N`, the number of substeps `S`, and potentially the grid resolution `G` if metaball rendering is enabled and the grid is very large compared to `N`. 