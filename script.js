// --- Global Variables ---
let gl = null;             // WebGL context
let overlayCanvas = null;  // 2D canvas for overlays
let overlayCtx = null;    // 2D context for overlays
let canvas = null;         // WebGL canvas (renamed from original)
let surfaceCanvas = null;  // Canvas for rendering smooth water surface
let surfaceCtx = null;     // 2D context for surface rendering

// --- WebGL Specific Globals ---
let particleShaderProgram = null;
let particlePositionBuffer = null;
let particlePositionAttributeLocation = -1;
let particleColorUniformLocation = null;
let resolutionUniformLocation = null;
let particleSizeUniformLocation = null;

let foamShaderProgram = null; // Could potentially reuse particle shader with different uniforms
let foamPositionBuffer = null;
let foamPositionAttributeLocation = -1;
let foamColorUniformLocation = null; // Will be replaced by an attribute for foam
let foamColorAttributeLocation = -1; // New attribute for per-particle foam color
let foamResolutionUniformLocation = null;
let foamSizeUniformLocation = null;
let foamColorBuffer = null; // New buffer for foam colors

// --- UI Control Elements ---
let taitBSlider = null;
let taitBValueSpan = null;
let substepsSlider = null;
let substepsValueSpan = null;
let viscositySlider = null;
let viscosityValueSpan = null;

// --- Toggle State Indicators ---
let metaballsToggle = null;
let velocityToggle = null;
let foamToggle = null;
let lightingToggle = null;
let depthToggle = null;
let wavesToggle = null;

// --- Utility Function for Checking Invalid Numbers ---
function isInvalid(val) {
    return val === null || val === undefined || isNaN(val) || !isFinite(val);
}

// --- Configuration (Constants & Tunable Variables) ---
const MIN_PARTICLES = 100; // Minimum number of particles
const MAX_PARTICLES = 5000; // Maximum number of particles for buffer allocation
const DEFAULT_PARTICLES = 1000; // Default particle count
let NUM_PARTICLES = DEFAULT_PARTICLES; // This will be controlled by the slider

const PARTICLE_RADIUS = 22;
const MIN_PARTICLE_DISTANCE = PARTICLE_RADIUS; // Minimum separation
const MIN_PARTICLE_DISTANCE_SQ = MIN_PARTICLE_DISTANCE * MIN_PARTICLE_DISTANCE;
// --- Visual Adjustments --- (Near other constants)
const PARTICLE_DRAW_SIZE = 25 * window.devicePixelRatio; // Example size (TUNABLE)
const FOAM_PARTICLE_DRAW_SIZE = 5.0 * window.devicePixelRatio; // Example size (TUNABLE)
const INITIAL_SPACING = PARTICLE_RADIUS * 1.8; // Base H on this spacing
const H = INITIAL_SPACING * 2.0; // Slightly larger H relative to spacing might help stability
const H_SQ = H * H;

let PARTICLE_MASS = 1.0; // Will be calculated
// Using area-based mass calculation.
// TARGET_REST_DENSITY might need tuning (e.g., 1.0, 1.5, 2.0)
const TARGET_REST_DENSITY = 0.8; // TUNABLE
const REST_DENSITY = TARGET_REST_DENSITY;
let POLY6_FACTOR = 0;
let SPIKY_GRAD_FACTOR = 0;

// Add these near your other global variables like 'gl', 'canvas', etc.
let tankX = 0;      // Tank's left edge X position
let tankY = 0;      // Tank's top edge Y position
let tankWidth = 0;  // Tank's width in pixels
let tankHeight = 0; // Tank's height in pixels
// --- Virtual Tank Area --- (Near other constants)
const TANK_WIDTH_RATIO = 0.7; // Example: 70% of canvas width (TUNABLE)
const TANK_HEIGHT_RATIO = 0.8; // Example: 80% of canvas height (TUNABLE)

// Equation of State (Tait's Equation)
const TAIT_GAMMA = 7.0;

// --- TUNABLE PARAMETERS (Recommended Starting Values for 'david.li/fluid' style) ---
// Sliders control these:
let TAIT_B = 50000; // START MUCH LOWER (Stiffness, e.g., 500-1500) - Use Slider
let NUM_SUBSTEPS = 20; // START LOW (e.g., 8-15), increase ONLY if unstable - Use Slider
let VISCOSITY_COEFFICIENT = 0.05; // Standard Viscosity (e.g., 0.05 - 0.2) - Use Slider
// --- Constants below are tuned directly in code ---
// Gravity - Adjust multiplier for desired weight/settling speed
const GRAVITY = 9.8 * 100; // TUNABLE (e.g., 50 - 100)

// Boundary Parameters - Make them softer
const BOUNDARY_FORCE = 500000000; // TUNABLE: Lower repulsive force (e.g., 200 - 600)
const BOUNDARY_DISTANCE = PARTICLE_RADIUS * 1;
const FRICTION = 0.2; // TUNABLE: Higher friction (e.g., 0.5 - 0.9)
const RESTITUTION = 0.02; // TUNABLE: Very low bounce (e.g., 0.0 - 0.1)

// --- Simulation Parameters (Tunable in 'integrate' function) ---
// DAMPING_FACTOR: Global velocity damping (helps settling) - Tune in integrate()
// XSPH_C: XSPH Viscosity coefficient (reduces jitter) - Tune in integrate()

// --- Safety Values ---
const MIN_DENSITY = 0.01;
const MIN_DENSITY_SQ = MIN_DENSITY * MIN_DENSITY;
const MAX_DENSITY_RATIO_FOR_POW = 50;

// --- Surface Rendering Constants ---
const METABALL_THRESHOLD = 0.8; // TUNABLE: Slightly higher threshold for a clearer surface
const METABALL_RADIUS = H * 1; // TUNABLE: Adjust influence radius if needed
const GRID_CELL_SIZE = 15; // Increased from 10 for better performance with metaballs
const SURFACE_DETAIL = 1;
const SURFACE_LINE_WIDTH = 1.5; // TUNABLE: Width of the rendered surface lines

// --- Lighting Constants ---
let LIGHTING_ENABLED = true; // Toggle for lighting effect
const LIGHT_DIRECTION = { x: 0.2, y: -0.9 }; // More top-down light direction for natural lighting
const AMBIENT_LIGHT = 0.5; // Balanced ambient light
const DIFFUSE_STRENGTH = 0.4; // Moderate diffuse for natural water appearance
const SPECULAR_STRENGTH = 0.3; // Slightly increased specular for water shininess
const SPECULAR_SHININESS = 12; // Lower value for wider specular highlights on water
const NORMAL_STRENGTH = 1.8; // Slightly increased for better visibility

// --- Water Colors ---
const VELOCITY_COLOR = { // TUNABLE
    slow: 'rgba(20, 50, 120, 0.95)',    // Darkish blue for slow
    medium: 'rgba(100, 150, 220, 0.9)', // Medium blue
    fast: 'rgba(230, 240, 255, 0.85)'   // Near white for fast
};
const MAX_VELOCITY_COLOR = 500; // TUNABLE: Adjust based on observed velocities

// --- Depth Colors ---
let DEPTH_COLORING = true; // Toggle for depth-based coloring
const WATER_DEPTH_COLORS = {
    shallow: 'rgba(120, 190, 235, 0.9)',  // Light blue for shallow water
    medium: 'rgba(60, 140, 200, 0.92)',   // Medium blue 
    deep: 'rgba(15, 75, 165, 0.95)'       // Deeper blue for deep water
};

// --- Interaction (Constants) ---
const MOUSE_RADIUS = 200; // TUNABLE: Make mouse smaller for finer control?
const MOUSE_STRENGTH = 5000000000; // TUNABLE: Adjust strength (Increased again)

// --- Feature Toggles ---
let enableFoam = true; // *** ENABLE FOAM ***
let enableMetaballs = true;
let enableVelocityColor = false; // Start with velocity coloring off by default
let enableSurfaceRipples = true; // Toggle for surface ripple effect

// Add color mode enum to track which coloring is active
const COLOR_MODE = {
    NONE: 0,
    VELOCITY: 1,
    DEPTH: 2
};
let currentColorMode = COLOR_MODE.DEPTH; // Default to depth coloring

// --- Foam Constants ---
const FOAM_LIFESPAN = 1.8; // TUNABLE: How long foam particles last (seconds)
const FOAM_SPAWN_VELOCITY_THRESHOLD = 500; // TUNABLE: Minimum particle velocity to spawn foam
const FOAM_PARTICLE_MULTIPLIER = 3; // Number of foam particles per water particle
let MAX_FOAM_PARTICLES = NUM_PARTICLES * FOAM_PARTICLE_MULTIPLIER; // Dynamic max foam particles

// --- Surface Ripple Constants ---
const RIPPLE_AMPLITUDE = 2.5; // Balanced ripple height
const RIPPLE_FREQUENCY = 1.0; // Balanced frequency for natural water
const RIPPLE_SPEED = 0.8; // Slightly slower for more natural motion
const RIPPLE_DETAIL = 1.3; // Increased detail for more complex ripples

// --- Simulation State ---
let particles = [];
let particlePositions = null;
let foamParticles = []; // Stores foam particle objects {x, y, vx, vy, life}
let foamPositions = null; // Stores flat [x1,y1, x2,y2,...] for WebGL buffer
let foamColors = null; // Stores flat [r1,g1,b1,a1, r2,g2,b2,a2,...] for WebGL buffer
let activeFoamCount = 0; // Number of active foam particles
let grid = {};
let gridCellSize = H; // Grid cell size based on H
let mouse = { x: -1000, y: -1000, leftDown: false, rightDown: false };
let lastTime = 0; // For dt calculation
let totalTime = 0; // For time-based animations like ripples

// --- Stats Display Variables ---
let displayedFps = 0;
let frameCountForFps = 0;
let timeAccumulatorForFps = 0;

// --- Calculate Physics Constants (Using 2D Kernels, Area-Based Mass) ---
function calculatePhysicsConstants() {
    if (H < 1e-9) {
        console.error("Smoothing radius H is too small!");
        POLY6_FACTOR = 0;
        SPIKY_GRAD_FACTOR = 0;
        PARTICLE_MASS = 1.0; // Fallback
        gridCellSize = Math.max(1, H);
        return;
    }

    // Calculate 2D kernel factors
    POLY6_FACTOR = 4.0 / (Math.PI * Math.pow(H, 8));
    SPIKY_GRAD_FACTOR = -30.0 / (Math.PI * Math.pow(H, 5)); // Gradient for pressure

    console.log(`Using 2D Kernels: H=${H.toFixed(2)}`);
    console.log(`POLY6_FACTOR_2D = ${POLY6_FACTOR.toExponential(3)}`);
    console.log(`SPIKY_GRAD_FACTOR_2D = ${SPIKY_GRAD_FACTOR.toExponential(3)}`);

    // --- Area-Based Mass Calculation ---
    const particleArea = INITIAL_SPACING * INITIAL_SPACING;

    if (TARGET_REST_DENSITY <= 0 || particleArea <= 0) {
         console.error("Cannot calculate mass: Invalid TARGET_REST_DENSITY or particleArea.");
         PARTICLE_MASS = 1.0; // Fallback
    } else {
        PARTICLE_MASS = TARGET_REST_DENSITY * particleArea;
    }
    // --- End Area-Based Mass Calculation ---

    console.log(`Target Rest Density: ${TARGET_REST_DENSITY.toFixed(3)}`);
    console.log(`Particle Area Approx: ${particleArea.toFixed(3)}`);
    console.log(`Calculated PARTICLE_MASS: ${PARTICLE_MASS.toFixed(5)}`);

    gridCellSize = Math.max(1, H); // Ensure grid cell size is positive
}

// --- Particle Creation ---
function createParticle(x, y) {
    return {
        x: x, y: y,       // Current position
        ax: 0, ay: 0,     // Acceleration
        vx: 0, vy: 0,     // Velocity
        density: REST_DENSITY, // Initialize density
        pressure: 0,      // Pressure term
        compression: 0,   // Density ratio - 1
        neighbors: []     // Stores neighbor info { particle, distSq, dx, dy, dist }
    };
}

// --- Foam Particle Creation ---
function createFoamParticle(x, y, vx, vy) {
    return {
        x: x, y: y, vx: vx, vy: vy,
        life: FOAM_LIFESPAN * (0.8 + Math.random() * 0.4) // Add some randomness to life
    };
}

// --- WebGL Initialization ---
const particleVertexShaderSource = `
    attribute vec2 a_position;
    uniform vec2 u_resolution;
    uniform float u_pointSize;

    void main() {
      vec2 zeroToOne = a_position / u_resolution;
      vec2 zeroToTwo = zeroToOne * 2.0;
      vec2 clipSpace = zeroToTwo - 1.0;
      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
      gl_PointSize = u_pointSize;
    }
`;

const particleFragmentShaderSource = `
    precision mediump float;
    uniform vec4 u_color;

    void main() {
       // Make particles circular
       vec2 coord = gl_PointCoord - vec2(0.5);
       if(length(coord) > 0.5) {
           discard;
       }
       gl_FragColor = u_color;
    }
`;

const foamVertexShaderSource = `
    attribute vec2 a_position;
    attribute vec4 a_color; // Color attribute for foam (RGBA)
    uniform vec2 u_resolution;
    uniform float u_pointSize;
    varying vec4 v_color;

    void main() {
      vec2 zeroToOne = a_position / u_resolution;
      vec2 zeroToTwo = zeroToOne * 2.0;
      vec2 clipSpace = zeroToTwo - 1.0;
      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
      gl_PointSize = u_pointSize;
      v_color = a_color;
    }
`;

const foamFragmentShaderSource = `
    precision mediump float;
    varying vec4 v_color;

    // Simple pseudo-random function
    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
       vec2 coord = gl_PointCoord - vec2(0.5);
       float dist = length(coord);

       // Add a little bit of noise to the edge for a bubbly/textured look
       float noiseFactor = 0.15; // How much noise affects the edge
       float noisyDist = dist + (random(gl_PointCoord * 5.0) - 0.5) * noiseFactor * dist * 2.0;

       // Create a slightly irregular alpha mask
       float alpha = 1.0 - smoothstep(0.4, 0.5, noisyDist);

       if(alpha < 0.01) {
           discard;
       }
       // Modulate output color by v_color (which includes lifespan-based alpha)
       gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) { return shader; }
    console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader); return null;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) { return program; }
    console.error("Program linking error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program); return null;
}

function initWebGL() {
    const particleVS = createShader(gl, gl.VERTEX_SHADER, particleVertexShaderSource);
    const particleFS = createShader(gl, gl.FRAGMENT_SHADER, particleFragmentShaderSource);
    if (!particleVS || !particleFS) return false;

    particleShaderProgram = createProgram(gl, particleVS, particleFS);
    if (!particleShaderProgram) return false;

    particlePositionAttributeLocation = gl.getAttribLocation(particleShaderProgram, "a_position");
    resolutionUniformLocation = gl.getUniformLocation(particleShaderProgram, "u_resolution");
    particleColorUniformLocation = gl.getUniformLocation(particleShaderProgram, "u_color");
    particleSizeUniformLocation = gl.getUniformLocation(particleShaderProgram, "u_pointSize");
    if (particlePositionAttributeLocation < 0 || !resolutionUniformLocation || !particleColorUniformLocation || !particleSizeUniformLocation) {
        console.error("Failed to get particle shader attribute/uniform locations.");
        return false;
    }
    particlePositionBuffer = gl.createBuffer();

    // --- Create Foam Shader Program ---
    const foamVS = createShader(gl, gl.VERTEX_SHADER, foamVertexShaderSource);
    const foamFS = createShader(gl, gl.FRAGMENT_SHADER, foamFragmentShaderSource);
    if (!foamVS || !foamFS) {
        console.error("Failed to create foam shaders.");
        return false;
    }
    foamShaderProgram = createProgram(gl, foamVS, foamFS);
    if (!foamShaderProgram) {
        console.error("Failed to create foam shader program.");
        return false;
    }

    // Get locations for foam shader
    foamPositionAttributeLocation = gl.getAttribLocation(foamShaderProgram, "a_position");
    foamColorAttributeLocation = gl.getAttribLocation(foamShaderProgram, "a_color"); // New attribute for foam
    foamResolutionUniformLocation = gl.getUniformLocation(foamShaderProgram, "u_resolution");
    foamSizeUniformLocation = gl.getUniformLocation(foamShaderProgram, "u_pointSize");

    if (foamPositionAttributeLocation < 0 || foamColorAttributeLocation < 0 ||
        !foamResolutionUniformLocation || !foamSizeUniformLocation) {
        console.error("Failed to get foam shader attribute/uniform locations.");
        return false;
    }

    foamPositionBuffer = gl.createBuffer();
    foamColorBuffer = gl.createBuffer(); // Create buffer for foam colors

    if (!particlePositionBuffer || !foamPositionBuffer || !foamColorBuffer) {
        console.error("Failed to create WebGL buffers.");
        return false;
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // Standard alpha blending
    return true;
}

// --- UI Setup ---
function setupSliders() {
    taitBSlider = document.getElementById('taitBSlider');
    taitBValueSpan = document.getElementById('taitBValue');
    substepsSlider = document.getElementById('substepsSlider');
    substepsValueSpan = document.getElementById('substepsValue');
    viscositySlider = document.getElementById('viscositySlider');
    viscosityValueSpan = document.getElementById('viscosityValue');

    if (!taitBSlider || !taitBValueSpan || !substepsSlider || !substepsValueSpan || !viscositySlider || !viscosityValueSpan) {
        console.error("One or more slider UI elements not found in the HTML.");
        return;
    }

    // Set initial slider positions and values from script variables
    taitBSlider.value = TAIT_B;
    taitBValueSpan.textContent = TAIT_B;
    substepsSlider.value = NUM_SUBSTEPS;
    substepsValueSpan.textContent = NUM_SUBSTEPS;
    viscositySlider.value = VISCOSITY_COEFFICIENT;
    viscosityValueSpan.textContent = VISCOSITY_COEFFICIENT.toFixed(3);

    // Add event listeners
    taitBSlider.addEventListener('input', (e) => {
        TAIT_B = parseInt(e.target.value, 10);
        taitBValueSpan.textContent = TAIT_B;
    });
    substepsSlider.addEventListener('input', (e) => {
        NUM_SUBSTEPS = parseInt(e.target.value, 10);
        substepsValueSpan.textContent = NUM_SUBSTEPS;
    });
    viscositySlider.addEventListener('input', (e) => {
        VISCOSITY_COEFFICIENT = parseFloat(e.target.value);
        viscosityValueSpan.textContent = VISCOSITY_COEFFICIENT.toFixed(3);
    });
    
    // Initialize toggle state indicators
    setupToggleIndicators();
    
    console.log("Slider event listeners attached.");
    
    // Add particle count slider
    setupParticleCountSlider();
}

// Initialize and configure the toggle state indicators
function setupToggleIndicators() {
    // Get references to the toggle elements
    metaballsToggle = document.getElementById('metaballsToggle');
    velocityToggle = document.getElementById('velocityToggle');
    foamToggle = document.getElementById('foamToggle');
    lightingToggle = document.getElementById('lightingToggle');
    depthToggle = document.getElementById('depthToggle');
    wavesToggle = document.getElementById('wavesToggle');
    
    if (!metaballsToggle || !velocityToggle || !foamToggle || 
        !lightingToggle || !depthToggle || !wavesToggle) {
        console.error("One or more toggle state indicators not found in the HTML.");
        return;
    }
    
    // Set initial state
    updateToggleIndicators();
    
    // Add click event listeners to toggle elements
    const toggleElements = document.querySelectorAll('.toggleItem');
    toggleElements.forEach(element => {
        element.addEventListener('click', () => {
            const key = element.getAttribute('data-key');
            if (key) {
                // Simulate a key press for this toggle
                simulateKeyPress(key);
            }
        });
    });
    
    console.log("Toggle state indicators initialized.");
}

// Simulate a key press to trigger the corresponding toggle action
function simulateKeyPress(key) {
    // Create and dispatch a keyboard event
    const event = new KeyboardEvent('keydown', {
        key: key,
        code: `Key${key.toUpperCase()}`,
        bubbles: true,
        cancelable: true
    });
    document.dispatchEvent(event);
}

// Update toggle indicators to match current state
function updateToggleIndicators() {
    updateToggleElement(metaballsToggle, enableMetaballs, "Metaballs");
    // For color mode, update both toggle indicators based on current mode
    updateToggleElement(velocityToggle, currentColorMode === COLOR_MODE.VELOCITY, "Velocity");
    updateToggleElement(depthToggle, currentColorMode === COLOR_MODE.DEPTH, "Depth");
    updateToggleElement(foamToggle, enableFoam, "Foam");
    updateToggleElement(lightingToggle, LIGHTING_ENABLED, "Lighting");
    updateToggleElement(wavesToggle, enableSurfaceRipples, "Waves");
    
    // Update the velocity and depth toggles to show the "color mode" when active
    // Add a special class to display the active color mode
    if (velocityToggle && depthToggle) {
        if (currentColorMode === COLOR_MODE.NONE) {
            velocityToggle.textContent = "Velocity: OFF";
            velocityToggle.className = 'toggleItem toggleOff';
            depthToggle.textContent = "Depth: OFF";
            depthToggle.className = 'toggleItem toggleOff';
        } else if (currentColorMode === COLOR_MODE.VELOCITY) {
            velocityToggle.textContent = "Velocity: ACTIVE";
            velocityToggle.className = 'toggleItem toggleOn colorModeActive';
            depthToggle.textContent = "Depth: OFF";
            depthToggle.className = 'toggleItem toggleOff';
        } else if (currentColorMode === COLOR_MODE.DEPTH) {
            velocityToggle.textContent = "Velocity: OFF";
            velocityToggle.className = 'toggleItem toggleOff';
            depthToggle.textContent = "Depth: ACTIVE";
            depthToggle.className = 'toggleItem toggleOn colorModeActive';
        }
    }
}

// Helper function to update a single toggle element
function updateToggleElement(element, isEnabled, label) {
    if (!element) return;
    
    element.textContent = `${label}: ${isEnabled ? 'ON' : 'OFF'}`;
    element.className = 'toggleItem ' + (isEnabled ? 'toggleOn' : 'toggleOff');
}

// --- Initialization ---
function init() {
    console.log("Init started...");
    canvas = document.getElementById('webglCanvas');
    overlayCanvas = document.getElementById('overlayCanvas');
    if (!canvas || !overlayCanvas) { console.error("Canvas elements not found!"); alert("Error: Canvas elements missing."); return; }

    // Create surface canvas dynamically
    surfaceCanvas = document.createElement('canvas');
    surfaceCanvas.id = 'surfaceCanvas';
    surfaceCanvas.style.position = 'absolute';
    surfaceCanvas.style.top = '0'; surfaceCanvas.style.left = '0';
    surfaceCanvas.style.width = '100%'; surfaceCanvas.style.height = '100%';
    surfaceCanvas.style.pointerEvents = 'none';
    surfaceCanvas.style.zIndex = '2'; // Ensure surface is drawn above WebGL background if visible
    if (document.body) {
        document.body.appendChild(surfaceCanvas);
    } else {
        console.error("document.body not available yet during init."); return;
    }

    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    overlayCtx = overlayCanvas.getContext('2d');
    surfaceCtx = surfaceCanvas.getContext('2d');

    if (!gl) { console.error("Failed to get WebGL context."); alert("Error: WebGL not supported."); return; }
    if (!overlayCtx || !surfaceCtx) { console.error("Failed to get 2D context."); alert("Error: Could not get 2D context."); return; }
    console.log("WebGL and 2D contexts obtained.");

    if (!initWebGL()) { console.error("Failed to initialize WebGL."); alert("Error: WebGL initialization failed."); return; }
    console.log("WebGL initialized.");

    // --- Setup UI Controls ---
    setupSliders(); // Initialize sliders and listeners
    
    // --- CRITICAL ORDER ---
    resizeCanvas(); // 1. Resize first
    console.log("resizeCanvas completed.");
    calculatePhysicsConstants(); // 2. Calculate constants (uses H derived from spacing)
    console.log("calculatePhysicsConstants completed.");

    setupMouseEvents();
    setupKeyboardControls();
    console.log("Event handlers setup completed.");

    // Initialize buffers
    particlePositions = new Float32Array(MAX_PARTICLES * 2); // Use MAX_PARTICLES for buffer capacity
    foamPositions = new Float32Array(MAX_FOAM_PARTICLES * 2); // Ensure foam buffer created
    foamColors = new Float32Array(MAX_FOAM_PARTICLES * 4); // RGBA for each foam particle

    spawnParticles(); // 3. Spawn particles using calculated constants
    console.log("spawnParticles completed.");

    console.log("Initialization complete. Starting animation loop...");
    requestAnimationFrame(update); // Start the loop
}

function spawnParticles() {
    particles = [];
    
    // Use tank dimensions for spawning checks if they are validly calculated
    const useTank = tankWidth > 0 && tankHeight > 0;
    // Define the area where particles will be initially placed
    const spawnAreaWidth = useTank ? tankWidth : (canvas ? canvas.width : 100);
    // Spawn in the top half (e.g., 50%) of the available tank/canvas height
    const spawnAreaHeight = useTank ? tankHeight * 0.5 : (canvas ? canvas.height * 0.5 : 100);
    const spawnOffsetX = useTank ? tankX : 0; // Left edge of spawn area
    const spawnOffsetY = useTank ? tankY : 0; // Top edge of spawn area

    if (spawnAreaWidth <= 0 || spawnAreaHeight <= 0) {
         console.error("Cannot spawn particles, spawn area invalid (width or height is zero). Tank calculated?", tankWidth, tankHeight);
         return;
    }

    // Estimate number of columns/rows needed based on spawn area and particle spacing
    const estCols = Math.max(1, Math.floor(spawnAreaWidth / INITIAL_SPACING));
    const estRows = Math.ceil(NUM_PARTICLES / estCols); // Rows needed to fit all particles

    // Calculate starting position to center the block within the spawn area
    const startX = spawnOffsetX + spawnAreaWidth / 2 - (estCols / 2) * INITIAL_SPACING;
    // Start spawning near the top of the defined spawn area height
    const startY = spawnOffsetY + spawnAreaHeight * 0.2;

    let currentParticleIndex = 0;
    for (let i = 0; i < NUM_PARTICLES; i++) {
        const col = i % estCols;
        const row = Math.floor(i / estCols);

        // Calculate position with jitter
        let x = startX + col * INITIAL_SPACING + (Math.random() - 0.5) * INITIAL_SPACING * 0.1;
        let y = startY + row * INITIAL_SPACING + (Math.random() - 0.5) * INITIAL_SPACING * 0.1;

        // --- Ensure within the VIRTUAL TANK bounds initially ---
        const radiusBuffer = PARTICLE_RADIUS + 1; // Add a small buffer
        // Define min/max bounds based on the virtual tank dimensions
        const minX_bound = spawnOffsetX + radiusBuffer;
        const maxX_bound = spawnOffsetX + tankWidth - radiusBuffer; // Use full tank width for bounds
        const minY_bound = spawnOffsetY + radiusBuffer;
        const maxY_bound = spawnOffsetY + tankHeight - radiusBuffer; // Use full tank height for bounds

        // Clamp initial position to be within the tank
        x = Math.max(minX_bound, Math.min(x, maxX_bound));
        y = Math.max(minY_bound, Math.min(y, maxY_bound));
        // ---

        if (particles.length < NUM_PARTICLES) {
           const p = createParticle(x, y);
           particles.push(p);
           // Populate WebGL buffer data
           if (currentParticleIndex * 2 + 1 < particlePositions.length) {
               particlePositions[currentParticleIndex * 2] = x;
               particlePositions[currentParticleIndex * 2 + 1] = y;
               currentParticleIndex++;
           }
        } else {
            // Stop if we have created the requested number of particles
            break;
        }
    }

    // Initialize particle position buffer data in WebGL
    if (gl && particlePositionBuffer && particles.length > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, particlePositionBuffer);
        // Upload only the data for the particles actually created
        gl.bufferData(gl.ARRAY_BUFFER, particlePositions.subarray(0, particles.length * 2), gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    } else if (particles.length === 0) {
         console.warn("No particles spawned.");
    }

    // Initialize foam system
    if (enableFoam) {
        initFoamParticles(NUM_PARTICLES * FOAM_PARTICLE_MULTIPLIER);
    } else {
        // Clear foam system if foam is disabled
        foamParticles = [];
        activeFoamCount = 0;
    }

    console.log(`Spawned ${particles.length} particles within tank area.`);
}

function resizeCanvas() {
    if (!canvas || !overlayCanvas || !surfaceCanvas) return;

    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const displayWidth = Math.max(1, Math.floor(cssWidth * window.devicePixelRatio));
    const displayHeight = Math.max(1, Math.floor(cssHeight * window.devicePixelRatio));

    let resized = false;
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth; canvas.height = displayHeight;
        overlayCanvas.width = displayWidth; overlayCanvas.height = displayHeight;
        surfaceCanvas.width = displayWidth; surfaceCanvas.height = displayHeight;

        if (gl) { gl.viewport(0, 0, canvas.width, canvas.height); }
        console.log(`Canvas resized to: ${canvas.width} x ${canvas.height}`);
        resized = true;
    }

    // --- Calculate Virtual Tank Dimensions ---
    // Always recalculate tank dimensions, even if canvas size didn't change,
    // as ratios might change or initial calculation is needed.
    tankWidth = displayWidth * TANK_WIDTH_RATIO;
    tankHeight = displayHeight * TANK_HEIGHT_RATIO;
    // Center the tank horizontally
    tankX = (displayWidth - tankWidth) / 2;
    // Place the tank near the top (adjust vertical offset if needed)
    tankY = displayHeight * 0.05; // Small offset from top (e.g., 5% of height)
    
    // Update depth color reference
    WATER_DEPTH_COLORS.max_depth = tankHeight;
    // ---

    // Update surface canvas CSS position to match webglCanvas via getBoundingClientRect
    // Needs to run even if not resized, in case of scrolling or layout shifts
     try {
        const rect = canvas.getBoundingClientRect();
        surfaceCanvas.style.position = 'absolute'; // Ensure positioning context
        // Adjust for scroll position if canvas isn't at top-left of viewport
        surfaceCanvas.style.top = `${rect.top + window.scrollY}px`;
        surfaceCanvas.style.left = `${rect.left + window.scrollX}px`;
        surfaceCanvas.style.width = `${rect.width}px`;
        surfaceCanvas.style.height = `${rect.height}px`;
     } catch (e) {
        console.warn("Could not update surfaceCanvas position:", e);
     }

}

// --- Mouse Events ---
function setupMouseEvents() {
    if (!canvas) { console.error("Cannot setup mouse events: canvas not found."); return; }
    const eventTarget = overlayCanvas; // Interact with overlay to avoid interfering with potential future canvas elements
    console.log("Attaching mouse events to:", eventTarget.id);

   eventTarget.addEventListener('mousemove', (e) => {
       const rect = eventTarget.getBoundingClientRect();
       // Scale client coordinates to canvas coordinates (considering devicePixelRatio)
       mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
       mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
   });
   eventTarget.addEventListener('mousedown', (e) => {
       if (e.button === 0) mouse.leftDown = true; // Left button
       if (e.button === 2) mouse.rightDown = true; // Right button
   });
   eventTarget.addEventListener('mouseup', (e) => {
       if (e.button === 0) mouse.leftDown = false;
       if (e.button === 2) mouse.rightDown = false;
   });
   eventTarget.addEventListener('mouseleave', () => {
       mouse.leftDown = false; mouse.rightDown = false;
       mouse.x = -1000; mouse.y = -1000; // Move mouse off-screen effectively
   });
   // Prevent context menu on right-click
   eventTarget.addEventListener('contextmenu', (e) => e.preventDefault() );
}

// --- Keyboard Controls ---
function setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'm' || e.key === 'M') {
             enableMetaballs = !enableMetaballs;
             console.log(`Metaball rendering: ${enableMetaballs ? 'ON' : 'OFF'}`);
             if(surfaceCanvas) surfaceCanvas.style.display = enableMetaballs ? 'block' : 'none';
             updateToggleElement(metaballsToggle, enableMetaballs, "Metaballs");
        }
        if (e.key === 'v' || e.key === 'V') {
            // Cycle through color modes: NONE -> VELOCITY -> DEPTH -> NONE
            switch (currentColorMode) {
                case COLOR_MODE.NONE:
                    currentColorMode = COLOR_MODE.VELOCITY;
                    break;
                case COLOR_MODE.VELOCITY:
                    currentColorMode = COLOR_MODE.DEPTH;
                    break;
                case COLOR_MODE.DEPTH:
                    currentColorMode = COLOR_MODE.NONE;
                    break;
            }
            
            // Update state variables to match current mode
            enableVelocityColor = (currentColorMode === COLOR_MODE.VELOCITY);
            DEPTH_COLORING = (currentColorMode === COLOR_MODE.DEPTH);
            
            console.log(`Color mode: ${currentColorMode === COLOR_MODE.NONE ? 'NONE' : 
                         currentColorMode === COLOR_MODE.DEPTH ? 'DEPTH' : 'VELOCITY'}`);
            
            // Update UI
            updateToggleIndicators();
            
            // Force re-render
            if (surfaceCanvas) {
                requestAnimationFrame(() => {
                    if (surfaceCtx) surfaceCtx.clearRect(0, 0, surfaceCanvas.width, surfaceCanvas.height);
                });
            }
        }
        if (e.key === 'f' || e.key === 'F') {
            enableFoam = !enableFoam;
            console.log(`Foam: ${enableFoam ? 'ON' : 'OFF'}`);
            updateToggleElement(foamToggle, enableFoam, "Foam");
            
            // Reset foam particles if turning off
            if (!enableFoam) {
                activeFoamCount = 0;
            }
        }
        if (e.key === 'r' || e.key === 'R') {
            console.log("Respawning particles...");
            spawnParticles();
        }
        if (e.key === 'l' || e.key === 'L') {
            LIGHTING_ENABLED = !LIGHTING_ENABLED;
            console.log(`Lighting: ${LIGHTING_ENABLED ? 'ON' : 'OFF'}`);
            updateToggleElement(lightingToggle, LIGHTING_ENABLED, "Lighting");
        }
        if (e.key === 'd' || e.key === 'D') {
            // Cycle through color modes: NONE -> DEPTH -> VELOCITY -> NONE
            switch (currentColorMode) {
                case COLOR_MODE.NONE:
                    currentColorMode = COLOR_MODE.DEPTH;
                    DEPTH_COLORING = true;
                    enableVelocityColor = false;
                    break;
                case COLOR_MODE.DEPTH:
                    currentColorMode = COLOR_MODE.VELOCITY;
                    DEPTH_COLORING = false;
                    enableVelocityColor = true;
                    break;
                case COLOR_MODE.VELOCITY:
                    currentColorMode = COLOR_MODE.NONE;
                    DEPTH_COLORING = false;
                    enableVelocityColor = false;
                    break;
            }
            
            console.log(`Color mode: ${currentColorMode === COLOR_MODE.NONE ? 'NONE' : 
                         currentColorMode === COLOR_MODE.DEPTH ? 'DEPTH' : 'VELOCITY'}`);
            
            updateToggleElement(depthToggle, DEPTH_COLORING, "Depth");
            updateToggleElement(velocityToggle, enableVelocityColor, "Velocity");
            
            // Force re-render on next frame
            if (surfaceCanvas) {
                requestAnimationFrame(() => {
                    if (surfaceCtx) surfaceCtx.clearRect(0, 0, surfaceCanvas.width, surfaceCanvas.height);
                });
            }
        }
        if (e.key === 'w' || e.key === 'W') {
            enableSurfaceRipples = !enableSurfaceRipples;
            console.log(`Surface ripples: ${enableSurfaceRipples ? 'ON' : 'OFF'}`);
            updateToggleElement(wavesToggle, enableSurfaceRipples, "Waves");
        }
    });
    console.log("Keyboard controls setup (M=Metaballs, V/D=CycleColorMode, F=Foam, R=Respawn, L=Lighting, W=Waves).");
}


// --- Spatial Grid ---
function getGridCoords(x, y) { const cellSize = Math.max(1, gridCellSize); return { col: Math.floor(x / cellSize), row: Math.floor(y / cellSize) }; }
function hashCoords(col, row) { return `${Math.max(0, col)},${Math.max(0, row)}`; } // Prevent negative indices

function updateGrid() {
    grid = {}; // Clear grid
    if (!canvas || particles.length === 0) return; // No grid needed if no particles/canvas
    const width = canvas.width; const height = canvas.height;

    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        // Check for invalid particle state before using position
        if (isInvalid(p.x) || isInvalid(p.y)){
             console.warn(`Invalid particle position before grid update (particle ${i}), resetting.`);
             Object.assign(p, createParticle(width / 2, height / 5)); // Reset state
             // Immediately update buffer for reset particle
             if (i * 2 + 1 < particlePositions.length) {
                particlePositions[i * 2] = p.x;
                particlePositions[i * 2 + 1] = p.y;
             }
             continue; // Skip grid insertion for reset particle this frame
        }
        const coords = getGridCoords(p.x, p.y);
        const hash = hashCoords(coords.col, coords.row);
        if (!grid[hash]) grid[hash] = [];
        grid[hash].push(p);
        p.neighbors = []; // Clear old neighbors list for this particle
    }
}

function getNeighbors(particle) {
    const neighbors = [];
    if (!H_SQ || H_SQ <= 0) { particle.neighbors = neighbors; return; } // Need valid smoothing radius

    const centerCoords = getGridCoords(particle.x, particle.y);

    for (let dCol = -1; dCol <= 1; dCol++) {
        for (let dRow = -1; dRow <= 1; dRow++) {
            const hash = hashCoords(centerCoords.col + dCol, centerCoords.row + dRow);
            if (grid[hash]) {
                for (const other of grid[hash]) {
                    if (other === particle) continue; // Don't compare particle to itself

                    const dx = other.x - particle.x;
                    const dy = other.y - particle.y;
                    const distSq = dx * dx + dy * dy;

                    // Check if within smoothing radius and not exactly coincident
                    if (distSq < H_SQ && distSq > 1e-12) {
                        const dist = Math.sqrt(distSq);
                        neighbors.push({ particle: other, distSq: distSq, dx: dx, dy: dy, dist: dist });
                    }
                }
            }
        }
    }
    particle.neighbors = neighbors; // Assign the found neighbors
}


// --- Physics Calculations ---
function calculateDensityPressure() {
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let density_sum = 0;

        // Accumulate density from neighbors using Poly6 Kernel
        for (const N of p.neighbors) {
             // Check neighbor distance squared again for safety
            if (N.distSq < H_SQ) {
                const dSq = H_SQ - N.distSq;
                const poly6_w = POLY6_FACTOR * dSq * dSq * dSq;
                density_sum += PARTICLE_MASS * poly6_w;
            }
        }

        // Add self-contribution using Poly6 kernel at zero distance (W(0))
        // W_poly6(0) = 4 / (pi * H^8) * (H^2)^3 = 4 / (pi * H^2) -- Correct 2D formula
        const W_poly6_at_zero = 4.0 / (Math.PI * H_SQ);
        density_sum += PARTICLE_MASS * W_poly6_at_zero;

        // Clamp calculated density to prevent division by zero or negative densities
        p.density = Math.max(density_sum, MIN_DENSITY);

        if (isInvalid(p.density)) {
            console.error(`Invalid density calculated for particle ${i}: ${density_sum}. Resetting density.`);
            p.density = REST_DENSITY;
            p.pressure = 0; continue;
         }

        // Calculate Pressure using Tait's Equation of State
        const density_ratio = p.density / REST_DENSITY;
        p.compression = Math.max(0, density_ratio - 1.0); // Store compression factor

        let pressure = 0;
        if (density_ratio > 1.0) { // Only apply pressure if compressed
            // Clamp ratio to prevent extreme exponentiation results
            const clamped_ratio = Math.min(density_ratio, MAX_DENSITY_RATIO_FOR_POW);
             pressure = TAIT_B * (Math.pow(clamped_ratio, TAIT_GAMMA) - 1.0);
        }
        // Ensure pressure is not negative
        p.pressure = Math.max(0, pressure);

        if (isInvalid(p.pressure)) {
             console.error(`Invalid pressure calculated for particle ${i}. Density: ${p.density}, Ratio: ${density_ratio}. Resetting pressure.`);
             p.pressure = 0;
         }
    }
}

function applyForces(sub_dt) {
    const gravity_accel = GRAVITY; // Use the constant defined at the top

    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // State check before applying forces
        if(isInvalid(p.x) || isInvalid(p.y) || isInvalid(p.vx) || isInvalid(p.vy) || isInvalid(p.pressure) || isInvalid(p.density)) {
             console.error(`Invalid state at start of applyForces for particle ${i}`, p);
             Object.assign(p, createParticle(canvas ? canvas.width / 2 : 100, canvas ? canvas.height / 5 : 100));
             if (i * 2 + 1 < particlePositions.length) {
                 particlePositions[i * 2] = p.x;
                 particlePositions[i * 2 + 1] = p.y;
             }
             continue;
        }

        // Reset acceleration & Apply Gravity
        p.ax = 0;
        p.ay = gravity_accel;

        // Initialize force accumulators
        let pressureForceX = 0; let pressureForceY = 0;
        let viscosityForceX = 0; let viscosityForceY = 0;

        const p_density_safe = Math.max(p.density, MIN_DENSITY);
        const p_densitySq_safe = p_density_safe * p_density_safe;

        // Accumulate forces from neighbors
        for (const N of p.neighbors) {
            const n = N.particle;
            const r = N.dist;
            const dx = N.dx; const dy = N.dy;

            if(isInvalid(n.pressure) || isInvalid(n.density) || isInvalid(n.vx) || isInvalid(n.vy) || r < 1e-6) {
                 continue;
            }

            // Define n_density_safe HERE
            const n_density_safe = Math.max(n.density, MIN_DENSITY);

            // --- Pressure Force ---
            const h_minus_r = H - r;
            if (h_minus_r > 0) {
                const n_densitySq_safe = n_density_safe * n_density_safe;
                const pressureTerm = (p.pressure / p_densitySq_safe + n.pressure / n_densitySq_safe);
                const gradMagnitude = -SPIKY_GRAD_FACTOR * h_minus_r * h_minus_r;
                const forceMagnitude = PARTICLE_MASS * pressureTerm * gradMagnitude;
                const forceX_contrib = forceMagnitude * (dx / r);
                const forceY_contrib = forceMagnitude * (dy / r);

                if (!isInvalid(forceX_contrib) && !isInvalid(forceY_contrib)) {
                    pressureForceX -= forceX_contrib;
                    pressureForceY -= forceY_contrib;
                } else {
                     console.error(`Invalid pressure force component calculated for P${i} <- N`);
                }
            }

             // --- Viscosity Force ---
             if (VISCOSITY_COEFFICIENT > 0) {
                const rSq = N.distSq;
                if (rSq < H_SQ) {
                     const dvx = n.vx - p.vx;
                     const dvy = n.vy - p.vy;
                     const dSq_visc = H_SQ - rSq;
                     const poly6_w_visc = POLY6_FACTOR * dSq_visc * dSq_visc * dSq_visc;
                     const avg_density = Math.max(0.5 * (p_density_safe + n_density_safe), MIN_DENSITY * 0.5);
                     const viscosityTerm = VISCOSITY_COEFFICIENT * PARTICLE_MASS * poly6_w_visc / avg_density;

                     if(!isInvalid(viscosityTerm) && !isInvalid(dvx) && !isInvalid(dvy)){
                        viscosityForceX += viscosityTerm * dvx;
                        viscosityForceY += viscosityTerm * dvy;
                     }
                }
             }
        } // End neighbor loop

        // --- Mouse Interaction ---
        let mouseForceX = 0; let mouseForceY = 0;
        if ((mouse.leftDown || mouse.rightDown) && MOUSE_RADIUS > 0 && MOUSE_STRENGTH > 0) {
             const mdx = p.x - mouse.x;
             const mdy = p.y - mouse.y;
             const mDistSq = mdx * mdx + mdy * mdy;
             const mouseRadiusSq = MOUSE_RADIUS * MOUSE_RADIUS;

             if (mDistSq < mouseRadiusSq && mDistSq > 1e-6) {
                 const mDist = Math.sqrt(mDistSq);
                 const factor = 1.0 - mDist / MOUSE_RADIUS; // Linear falloff (could be squared)
                 const strength = MOUSE_STRENGTH * factor * factor; // Squared falloff for strength
                 const forceMag = strength / (mDist + 1e-6); // Avoid division by zero near center
                 const dirX = mdx / mDist;
                 const dirY = mdy / mDist;

                 if (mouse.leftDown) { // Attract (Force points from particle TO mouse)
                    mouseForceX = -dirX * forceMag;
                    mouseForceY = -dirY * forceMag;
                 } else { // Repel (Force points from mouse TO particle)
                    mouseForceX = dirX * forceMag * 1.5; // Make repulsion slightly stronger
                    mouseForceY = dirY * forceMag * 1.5;
                 }
             }
        } // --- End Mouse Interaction ---

        // --- Boundary Forces (Based on Virtual Tank) ---
        let boundaryForceX = 0; let boundaryForceY = 0;
        // Check if tank dimensions are valid and boundary interaction is enabled
        if (tankWidth > 0 && BOUNDARY_DISTANCE > 0 && BOUNDARY_FORCE > 0) {
             const force = BOUNDARY_FORCE;
             const dist = BOUNDARY_DISTANCE; // Effective distance for force calculation
             let penetration = 0;

             // Left Wall (tankX)
             if (p.x < tankX + dist) { penetration = (tankX + dist) - p.x; boundaryForceX += force * (penetration / dist); }
             // Right Wall (tankX + tankWidth)
             if (p.x > tankX + tankWidth - dist) { penetration = p.x - (tankX + tankWidth - dist); boundaryForceX -= force * (penetration / dist); }
             // Top Wall (tankY)
             if (p.y < tankY + dist) { penetration = (tankY + dist) - p.y; boundaryForceY += force * (penetration / dist); }
             // Bottom Wall (tankY + tankHeight) - Slightly stronger repulsion maybe?
             if (p.y > tankY + tankHeight - dist) { penetration = p.y - (tankY + tankHeight - dist); boundaryForceY -= force * (penetration / dist) * 1.2; }
        } // --- End boundary forces ---


        // --- Calculate final acceleration (a = F/m) ---
        if (!isInvalid(PARTICLE_MASS) && Math.abs(PARTICLE_MASS) > 1e-9) {
            const invMass = 1.0 / PARTICLE_MASS;
            // Check all force components for validity before summing
             if (!isInvalid(pressureForceX) && !isInvalid(pressureForceY) &&
                 !isInvalid(viscosityForceX) && !isInvalid(viscosityForceY) &&
                 !isInvalid(mouseForceX) && !isInvalid(mouseForceY) && // Check mouse force
                 !isInvalid(boundaryForceX) && !isInvalid(boundaryForceY))
            {
                 // Add all forces (gravity already included in initial ay)
                 p.ax += (pressureForceX + viscosityForceX + mouseForceX + boundaryForceX) * invMass;
                 p.ay += (pressureForceY + viscosityForceY + mouseForceY + boundaryForceY) * invMass;
            } else {
                 console.warn(`Invalid force component before summing accel for particle ${i}.`);
            }
        } else {
             console.warn(`Particle ${i} has invalid or zero mass!`);
        }


        // Final check on calculated acceleration for NaN/Infinity
        if (isInvalid(p.ax) || isInvalid(p.ay)) {
             console.warn(`NaN/Infinity acceleration detected AFTER accumulation for particle ${i}, resetting accel.`);
             p.ax = 0;
             p.ay = gravity_accel;
        }
    } // --- End particle loop ---
} // --- End applyForces function ---

// --- Integration & Constraints ---
function integrate(sub_dt) {
    // Max velocity based on canvas size (can be tuned)
    const MAX_VELOCITY = canvas ? Math.max(canvas.width, canvas.height) * 0.8 : 800; // Increased slightly
    const MAX_VELOCITY_SQ = MAX_VELOCITY * MAX_VELOCITY;

    // --- Define Damping Factor ---
    // TUNABLE: Global velocity damping (0.0001 to 0.005). Helps settling.
    const DAMPING_FACTOR = 0.001; // Keep low to avoid sluggishness
    const dampingMultiplier = 1.0 - DAMPING_FACTOR;
    // ---

    // --- Define XSPH Coefficient ---
    // TUNABLE: XSPH Viscosity (0.005 to 0.05). Reduces jitter.
    const XSPH_C = 0.01;
    // ---

    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Check for invalid acceleration before use
        if (isInvalid(p.ax) || isInvalid(p.ay)) {
             p.ax = 0; p.ay = 0;
        }

        // Optional: Acceleration clamping (can help prevent extreme forces)
        // Increase max acceleration allowed
        const maxAcc = 150.0 * Math.abs(GRAVITY) + 150000;
        const accMagSq = p.ax * p.ax + p.ay * p.ay;
        if (accMagSq > maxAcc * maxAcc) {
            const accMag = Math.sqrt(accMagSq);
             if (!isInvalid(accMag) && accMag > 1e-9) {
                 const scale = maxAcc / accMag;
                  p.ax *= scale; p.ay *= scale;
             } else {
                 p.ax = 0; p.ay = 0;
             }
        }

        // Semi-implicit Euler integration: Update velocity based on acceleration
        p.vx += p.ax * sub_dt;
        p.vy += p.ay * sub_dt;

        // --- Calculate and Apply XSPH Correction ---
        let xsph_vx_correction = 0;
        let xsph_vy_correction = 0;
        if (p.neighbors && H_SQ > 1e-9 && XSPH_C > 0) { // Check if enabled
             for (const N of p.neighbors) {
                 const n = N.particle;
                 if(isInvalid(n.vx) || isInvalid(n.vy)) continue;
                 const rSq = N.distSq;
                 if (rSq < H_SQ && rSq > 1e-12) {
                     const dSq = H_SQ - rSq;
                     const poly6_w = POLY6_FACTOR * dSq * dSq * dSq;
                     xsph_vx_correction += (n.vx - p.vx) * poly6_w;
                     xsph_vy_correction += (n.vy - p.vy) * poly6_w;
                 }
             }
             p.vx += XSPH_C * xsph_vx_correction;
             p.vy += XSPH_C * xsph_vy_correction;
        }
        // --- End XSPH Correction ---


        // --- Apply Global Damping ---
        if (DAMPING_FACTOR > 0) {
            p.vx *= dampingMultiplier;
            p.vy *= dampingMultiplier;
        }
        // --- END GLOBAL DAMPING ---


        // Clamp Velocity (after XSPH and damping)
        const velMagSq = p.vx * p.vx + p.vy * p.vy;
        if (velMagSq > MAX_VELOCITY_SQ) {
            const velMag = Math.sqrt(velMagSq);
            if (!isInvalid(velMag) && velMag > 1e-9) {
                const scale = MAX_VELOCITY / velMag;
                p.vx *= scale; p.vy *= scale;
            } else {
                p.vx = 0; p.vy = 0; // Reset if magnitude calculation failed
            }
        }

        // Final check for invalid velocity before position update
        if(isInvalid(p.vx) || isInvalid(p.vy)) {
             console.warn(`Invalid velocity (${p.vx}, ${p.vy}) before position update for particle ${i}. Resetting.`);
             p.vx = 0; p.vy = 0;
        }

        // Update position based on final velocity
        let nextX = p.x + p.vx * sub_dt;
        let nextY = p.y + p.vy * sub_dt;

        // Check for invalid position calculation
        if(isInvalid(nextX) || isInvalid(nextY)) {
            console.error(`Invalid position calculated (${nextX}, ${nextY}) for particle ${i}. Resetting.`);
            Object.assign(p, createParticle(canvas ? canvas.width / 2 : 100, canvas ? canvas.height / 5 : 100));
            if (i * 2 + 1 < particlePositions.length) {
               particlePositions[i * 2] = p.x;
               particlePositions[i * 2 + 1] = p.y;
            }
            continue;
        }

        // Assign valid new position
        p.x = nextX;
        p.y = nextY;

        // Update position buffer for rendering (always update after position change)
        if (i * 2 + 1 < particlePositions.length) {
             particlePositions[i * 2] = p.x;
             particlePositions[i * 2 + 1] = p.y;
        } else {
             console.error(`Index out of bounds when updating particlePositions buffer for particle ${i} in integrate`);
        }
    } // End particle loop
 }


// --- Apply Constraints (Boundary Collisions & Foam Spawning) ---
function applyConstraints() {
    // Define boundaries using tank dimensions if valid, otherwise fallback (shouldn't be needed if resize/spawn work)
    const useTank = tankWidth > 0 && tankHeight > 0;
    const minX = useTank ? tankX : 0;
    const minY = useTank ? tankY : 0;
    const maxX = useTank ? tankX + tankWidth : (canvas ? canvas.width : 0);
    const maxY = useTank ? tankY + tankHeight : (canvas ? canvas.height : 0);

    // Ensure bounds are logical
    if (maxX <= minX || maxY <= minY) {
        console.warn("applyConstraints: Invalid tank boundaries calculated.");
        return;
    }

    // Get physics constants
    const frictionFactor = 1.0 - Math.max(0, Math.min(1, FRICTION));
    const restitution = Math.max(0, Math.min(1, RESTITUTION)); // Ensure 0 <= restitution <= 1
    const foamSpawnThresholdSq = FOAM_SPAWN_VELOCITY_THRESHOLD * FOAM_SPAWN_VELOCITY_THRESHOLD;
    const minParticleDistSq = MIN_PARTICLE_DISTANCE_SQ; // Local constant for check
    const minParticleDist = MIN_PARTICLE_DISTANCE;     // Local constant for correction
    
    // Enhanced foam spawning: track turbulence areas - only if foam is enabled
    const turbulenceMap = enableFoam ? {} : null;
    const cellSize = H * 1.5; // Slightly larger than the particle interaction radius
    
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        // Check particle state before applying constraints
        if (isInvalid(p.x) || isInvalid(p.y) || isInvalid(p.vx) || isInvalid(p.vy)) {
            console.warn(`Skipping constraints for particle ${i} due to invalid state.`);
            continue;
        }
        
        // Accumulate turbulence in grid cells for foam generation - only if foam is enabled
        if (enableFoam && turbulenceMap) {
            const velMagSq = p.vx * p.vx + p.vy * p.vy;
            if (velMagSq > foamSpawnThresholdSq * 0.5) { // Lower threshold for turbulence tracking
                const cellX = Math.floor(p.x / cellSize);
                const cellY = Math.floor(p.y / cellSize);
                const cellKey = `${cellX},${cellY}`;
                
                if (!turbulenceMap[cellKey]) {
                    turbulenceMap[cellKey] = { 
                        x: p.x, 
                        y: p.y, 
                        count: 0, 
                        totalVelSq: 0,
                        isNearBoundary: false 
                    };
                }
                
                turbulenceMap[cellKey].count++;
                turbulenceMap[cellKey].totalVelSq += velMagSq;
                
                // Check if this cell is near a boundary
                const distToLeftWall = p.x - minX;
                const distToRightWall = maxX - p.x;
                const distToTopWall = p.y - minY;
                const distToBottomWall = maxY - p.y;
                const nearBoundaryDist = H * 2; // Distance to consider "near boundary"
                
                if (distToLeftWall < nearBoundaryDist || 
                    distToRightWall < nearBoundaryDist ||
                    distToTopWall < nearBoundaryDist ||
                    distToBottomWall < nearBoundaryDist) {
                    turbulenceMap[cellKey].isNearBoundary = true;
                }
            }
        }

        let positionCorrected = false; // Flag if position was changed by particle separation
        // --- Particle-Particle Minimum Distance Enforcement ---
        // Iterate through neighbors found in the physics step
        // NOTE: This simple pairwise correction isn't perfectly physically accurate
        // and can introduce some energy/jitter, but prevents overlap.
        if (p.neighbors && minParticleDistSq > 0) {
            for (const N of p.neighbors) {
                const n = N.particle;
                // Check only pairs where p's index is less than n's index to avoid double correction?
                // This is complex with neighbor lists. Let's correct both ways for now, it might average out.
                if (isInvalid(n.x) || isInvalid(n.y)) continue; // Skip invalid neighbors

                const dx = n.x - p.x;
                const dy = n.y - p.y;
                const distSq = dx * dx + dy * dy;

                // Check for overlap (distSq < minRequiredDistSq and distSq is not zero)
                if (distSq < minParticleDistSq && distSq > 1e-12) {
                    const dist = Math.sqrt(distSq);
                    const overlap = minParticleDist - dist;
                    // Calculate normalized direction vector (p to n)
                    const nx = dx / dist;
                    const ny = dy / dist;
                    // Move particles apart by half the overlap distance each
                    const correctionAmount = overlap * 0.5; // Push each particle by half
                    p.x -= nx * correctionAmount;
                    p.y -= ny * correctionAmount;
                    n.x += nx * correctionAmount;
                    n.y += ny * correctionAmount;
                    positionCorrected = true;

                    // Optional: Dampen velocity along the collision normal slightly?
                    // This helps reduce energy introduced by the position correction.
                    // Project velocities onto normal
                    const p_vn = p.vx * nx + p.vy * ny;
                    const n_vn = n.vx * nx + n.vy * ny;
                    // Calculate impulse magnitude (simplified) - just remove relative normal velocity
                    const impulse = (p_vn - n_vn) * 0.5; // Reduce relative normal velocity
                    if (!isInvalid(impulse)) {
                        p.vx -= nx * impulse * 0.1; // Apply small impulse correction
                        p.vy -= ny * impulse * 0.1;
                        n.vx += nx * impulse * 0.1;
                        n.vy += ny * impulse * 0.1;
                    }
                }
            }
        }
        // --- End Particle-Particle Enforcement ---

        let boundaryCollided = false;
        // Use the visual radius for boundary collision to prevent drawing outside tank
        const visualRadius = PARTICLE_DRAW_SIZE / 2;
        let collisionSpeed = 0; // Track speed at collision for foam spawning
        let preCollisionVx = p.vx; // Store velocity before potential modification by boundary collision response
        let preCollisionVy = p.vy;
        let collisionNormal = { x: 0, y: 0 }; // Store collision normal for directional foam

        // --- Boundary checks and response using tank boundaries ---
        // Left Wall
        if (p.x < minX + visualRadius) {
            collisionSpeed = Math.abs(p.vx); // Use absolute velocity for speed check
            p.x = minX + visualRadius; // Correct position to be just inside boundary
            if (p.vx < 0) { // Only apply response if moving into the wall
                 p.vy *= frictionFactor; // Apply friction to perpendicular velocity
                 p.vx *= -restitution; // Apply restitution to normal velocity
                 boundaryCollided = true;
                 collisionNormal = { x: 1, y: 0 }; // Normal pointing right
            }
        }
        // Right Wall
        else if (p.x > maxX - visualRadius) {
            collisionSpeed = Math.abs(p.vx);
            p.x = maxX - visualRadius;
            if (p.vx > 0) {
                p.vy *= frictionFactor;
                p.vx *= -restitution;
                boundaryCollided = true;
                collisionNormal = { x: -1, y: 0 }; // Normal pointing left
            }
        }

        // Top Wall (check AFTER X correction)
        if (p.y < minY + visualRadius) {
            collisionSpeed = Math.max(collisionSpeed, Math.abs(p.vy)); // Use max speed if hitting corner
            p.y = minY + visualRadius;
            if (p.vy < 0) {
                p.vx *= frictionFactor; // Apply friction to perpendicular velocity
                p.vy *= -restitution; // Apply restitution to normal velocity
                boundaryCollided = true;
                collisionNormal = { x: 0, y: 1 }; // Normal pointing down
            }
        }
        // Bottom Wall (check AFTER X correction)
        else if (p.y > maxY - visualRadius) {
            collisionSpeed = Math.max(collisionSpeed, Math.abs(p.vy));
            p.y = maxY - visualRadius;
            if (p.vy > 0) {
                p.vx *= frictionFactor;
                p.vy *= -restitution;
                boundaryCollided = true;
                collisionNormal = { x: 0, y: -1 }; // Normal pointing up
            }
        }
        // --- End boundary checks ---


        // Check velocity is still valid after collision response
        if(isInvalid(p.vx) || isInvalid(p.vy)){
            console.warn(`Invalid velocity after constraint for particle ${i}. Resetting.`);
            p.vx = 0; p.vy = 0;
             // If velocity became invalid, use pre-collision velocity for foam spawn check? Or zero?
             preCollisionVx = 0; preCollisionVy = 0;
        }

        // --- Spawn Foam - only if foam is enabled ---
        if (enableFoam) {
            // Spawn on significant boundary collision (check speed BEFORE bounce)
            if (boundaryCollided && collisionSpeed * collisionSpeed > foamSpawnThresholdSq) {
                // Enhanced: Spawn more foam for higher speed collisions
                const collisionIntensity = Math.min(10, Math.floor(collisionSpeed / FOAM_SPAWN_VELOCITY_THRESHOLD));
                const numFoamParticles = 1 + Math.floor(collisionIntensity * 0.5);
                
                // Spawn foam in the direction of the collision normal
                spawnDirectionalFoam(p.x, p.y, preCollisionVx, preCollisionVy, 
                                    collisionNormal.x, collisionNormal.y, numFoamParticles);
            }
            // Spawn based on general high velocity (turbulence check AFTER bounce)
            else {
                const velSq = p.vx * p.vx + p.vy * p.vy;
                if (velSq > foamSpawnThresholdSq * 1.2) { // Higher threshold for random spawning
                    if (Math.random() < 0.03) { // Reduced random spawn rate (was 0.05)
                        spawnFoam(p.x, p.y, p.vx, p.vy, 1);
                    }
                }
            }
        } // --- End Foam Spawning ---


        // Update position buffer only if collision occurred OR particle separation happened
        if (boundaryCollided || positionCorrected) {
             // Final check on position validity after correction
             if (isInvalid(p.x) || isInvalid(p.y)) {
                 console.error(`Invalid position AFTER constraint correction for particle ${i}. Resetting.`);
                 // Don't reset here, maybe integrate handles it? Or reset to a safe boundary pos.
                 // Fallback position correction: Clamp to bounds forcefully if invalid after corrections.
                 p.x = Math.max(minX + visualRadius, Math.min(p.x, maxX - visualRadius));
                 p.y = Math.max(minY + visualRadius, Math.min(p.y, maxY - visualRadius));
                 // Still check if invalid after clamping
                 if (isInvalid(p.x) || isInvalid(p.y)) {
                    // If still invalid, drastic reset might be needed in integrate or a higher level
                    console.error(`Position still invalid after forceful clamping for particle ${i}.`)
                 }
             }

             // Update this particle's position in the buffer
             if (i * 2 + 1 < particlePositions.length) {
                particlePositions[i * 2] = p.x;
                particlePositions[i * 2 + 1] = p.y;
             }

             // We also need to update the neighbors ('n') that were moved in the GPU buffer.
             // This is tricky as we don't have their index 'j'.
             // The simplest approach is to update the *entire* buffer after the constraints loop,
             // but that's inefficient. A better way is needed if performance becomes an issue.
             // For now, the buffer update happens in the main loop *after* all constraints.
        }
    } // End particle loop

    // Process turbulence map for additional foam spawning - only if foam is enabled
    if (enableFoam && turbulenceMap) {
        const turbulentCells = Object.keys(turbulenceMap);
        for (const cellKey of turbulentCells) {
            const cell = turbulenceMap[cellKey];
            if (cell.count >= 3) { // Require at least 3 particles for significant turbulence
                const avgVelSq = cell.totalVelSq / cell.count;
                if (avgVelSq > foamSpawnThresholdSq * 0.8) { // Slightly lower threshold for turbulence
                    // Higher spawn chance near boundaries
                    const spawnChance = cell.isNearBoundary ? 0.4 : 0.1;
                    if (Math.random() < spawnChance) {
                        // Calculate average position for this turbulent cell
                        const foam_x = cell.x;
                        const foam_y = cell.y;
                        // Generate foam with velocity proportional to turbulence
                        const foamSpeed = Math.sqrt(avgVelSq) * 0.2;
                        const angle = Math.random() * Math.PI * 2;
                        const foam_vx = Math.cos(angle) * foamSpeed;
                        const foam_vy = Math.sin(angle) * foamSpeed - foamSpeed * 0.5; // Bias upward
                        
                        // Spawn more foam in more turbulent areas
                        const numFoam = cell.isNearBoundary ? 
                            Math.floor(1 + Math.min(3, avgVelSq / foamSpawnThresholdSq)) : 1;
                            
                        spawnFoam(foam_x, foam_y, foam_vx, foam_vy, numFoam);
                    }
                }
            }
        }
    }
}


// --- Foam Functions ---
function spawnFoam(x, y, particleVx, particleVy, numToSpawn = 1) {
    if (!enableFoam) return; // Check if foam is enabled globally

    for (let i = 0; i < numToSpawn; i++) {
        if (activeFoamCount < MAX_FOAM_PARTICLES) {
            // Give foam some initial velocity slightly away from the spawn point/surface
            const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.5; // Spread up/down/out
            const spreadSpeed = Math.random() * 50 + 20; // Random speed component
            // Foam velocity is mix of particle velocity and random spread
            const foamVx = particleVx * 0.1 + Math.cos(spreadAngle) * spreadSpeed;
            const foamVy = particleVy * 0.1 + Math.sin(spreadAngle) * spreadSpeed;

            const foamP = createFoamParticle(x, y, foamVx, foamVy);

            // Add to the end of the active list within foamParticles array
            // Resize array if needed (shouldn't happen if MAX_FOAM_PARTICLES is respected)
            if(foamParticles.length <= activeFoamCount) {
                foamParticles.push(foamP);
            } else {
                // Reuse existing slot if available
                foamParticles[activeFoamCount] = foamP;
            }

            // Update position in the WebGL buffer immediately
            if(activeFoamCount * 2 + 1 < foamPositions.length) {
                foamPositions[activeFoamCount * 2] = foamP.x;
                foamPositions[activeFoamCount * 2 + 1] = foamP.y;
            } else {
                 console.warn("Foam buffer too small for active count during spawn!");
            }

            // Update color (RGBA) in the foamColors array
            if(activeFoamCount * 4 + 3 < foamColors.length) {
                const initialAlpha = 0.85; // Initial alpha for new foam
                foamColors[activeFoamCount * 4 + 0] = 1.0; // R
                foamColors[activeFoamCount * 4 + 1] = 1.0; // G
                foamColors[activeFoamCount * 4 + 2] = 1.0; // B
                foamColors[activeFoamCount * 4 + 3] = initialAlpha * (0.8 + Math.random() * 0.2); // A (with some variation)
            } else {
                 console.warn("Foam color buffer too small for active count during spawn!");
            }

            activeFoamCount++; // Increment active count
        } else {
            break; // Stop spawning if max foam count reached
        }
    }
}

// Spawn foam particles in a specific direction (for boundary collisions)
function spawnDirectionalFoam(x, y, particleVx, particleVy, normalX, normalY, numToSpawn = 1) {
    if (!enableFoam) return;
    
    // Normalize the normal vector
    const normalLength = Math.sqrt(normalX * normalX + normalY * normalY);
    if (normalLength < 1e-6) {
        // If normal is invalid, fall back to regular spawn
        spawnFoam(x, y, particleVx, particleVy, numToSpawn);
        return;
    }
    
    const nx = normalX / normalLength;
    const ny = normalY / normalLength;
    
    // Calculate reflection direction
    const dotProduct = -(particleVx * nx + particleVy * ny);
    const reflectVx = particleVx + 2 * dotProduct * nx;
    const reflectVy = particleVy + 2 * dotProduct * ny;
    
    for (let i = 0; i < numToSpawn; i++) {
        if (activeFoamCount < MAX_FOAM_PARTICLES) {
            // Vary the direction slightly
            const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.4; // Narrower spread for directional
            const spreadSpeed = Math.random() * 60 + 40; // Slightly higher speed for boundary foam
            
            // Calculate rotation of the normal by the spread angle
            const cosAngle = Math.cos(spreadAngle);
            const sinAngle = Math.sin(spreadAngle);
            const rotatedNx = nx * cosAngle - ny * sinAngle;
            const rotatedNy = nx * sinAngle + ny * cosAngle;
            
            // Combine reflection direction with spread
            const speedScale = Math.sqrt(particleVx * particleVx + particleVy * particleVy) * 0.2;
            const foamVx = rotatedNx * spreadSpeed + reflectVx * 0.1;
            const foamVy = rotatedNy * spreadSpeed + reflectVy * 0.1;
            
            // Small position offset in the normal direction to avoid spawning inside boundary
            const offsetScale = 2 + Math.random() * 3;
            const offsetX = x + nx * offsetScale;
            const offsetY = y + ny * offsetScale;
            
            const foamP = createFoamParticle(offsetX, offsetY, foamVx, foamVy);
            
            // Make boundary foam live slightly longer
            foamP.life *= 1.2;
            
            // Add foam to array and update buffers (same as in spawnFoam)
            if(foamParticles.length <= activeFoamCount) {
                foamParticles.push(foamP);
            } else {
                foamParticles[activeFoamCount] = foamP;
            }
            
            if(activeFoamCount * 2 + 1 < foamPositions.length) {
                foamPositions[activeFoamCount * 2] = foamP.x;
                foamPositions[activeFoamCount * 2 + 1] = foamP.y;
            }
            
            if(activeFoamCount * 4 + 3 < foamColors.length) {
                const initialAlpha = 0.9; // Slightly higher alpha for boundary foam
                foamColors[activeFoamCount * 4 + 0] = 1.0;
                foamColors[activeFoamCount * 4 + 1] = 1.0;
                foamColors[activeFoamCount * 4 + 2] = 1.0;
                foamColors[activeFoamCount * 4 + 3] = initialAlpha * (0.9 + Math.random() * 0.1);
            }
            
            activeFoamCount++;
        } else {
            break;
        }
    }
}

function updateFoam(dt) {
    if (!enableFoam || activeFoamCount === 0 || dt <= 0) return; // Check prerequisites

    let currentActiveIndex = 0; // Index to write the next live particle to
    for (let i = 0; i < activeFoamCount; i++) {
        const p = foamParticles[i];
        if(!p) continue; // Safety check

        // Basic physics: gravity, drag/damping
        p.vx *= 0.985; // Air drag/damping factor (TUNABLE)
        p.vy *= 0.985;
        // Foam affected less by gravity? More? TUNABLE
        p.vy += GRAVITY * 0.15 * dt;

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt; // Decrease lifespan

        // Simple boundary collision (gentle bounce or disappear)
        // Use tank boundaries for foam particles
        if(tankWidth > 0 && tankHeight > 0){ // Check if tank dimensions are valid
            const visualRadius = FOAM_PARTICLE_DRAW_SIZE / (2 * window.devicePixelRatio);
            const minX = tankX + visualRadius;
            const maxX = tankX + tankWidth - visualRadius;
            const minY = tankY + visualRadius;
            const maxY = tankY + tankHeight - visualRadius;

            if (p.x < minX) { p.x = minX; p.vx *= -0.1; } // Gentle bounce
            if (p.x > maxX) { p.x = maxX; p.vx *= -0.1; }
            if (p.y < minY) { p.y = minY; p.vy *= -0.1; }
            // Let foam disappear if it hits the bottom of the tank or goes beyond it
            if (p.y > maxY) {
                 p.life = -1; // Kill foam hitting tank bottom
            }
        } else if (canvas) { // Fallback to canvas boundaries if tank is not defined
            const radius = FOAM_PARTICLE_DRAW_SIZE / (2 * window.devicePixelRatio); // Approximate radius
            if (p.x < radius) { p.x = radius; p.vx *= -0.1; } // Gentle bounce
            if (p.x > canvas.width - radius) { p.x = canvas.width - radius; p.vx *= -0.1; }
            if (p.y < radius) { p.y = radius; p.vy *= -0.1; }
            // Let foam float off the bottom edge or disappear
             if (p.y > canvas.height - radius) {
                 p.life = -1; // Kill foam hitting bottom edge
            }
        }

        // Keep particle if alive, compact the array
        if (p.life > 0) {
            // Update buffer position for live particles
            if (currentActiveIndex * 2 + 1 < foamPositions.length) {
                foamPositions[currentActiveIndex * 2] = p.x;
                foamPositions[currentActiveIndex * 2 + 1] = p.y;
            }

            // If the current particle is not already in its correct compacted position, move it.
            if (i !== currentActiveIndex) {
                foamParticles[currentActiveIndex] = p;
            }
            currentActiveIndex++; // Increment index for the next live particle
        }
        // If particle is dead (p.life <= 0), it's effectively removed
        // because currentActiveIndex is not incremented, so it will be overwritten
        // by the next live particle or ignored if it's at the end.
    }
    activeFoamCount = currentActiveIndex; // Update the count of active particles
}


// --- Drawing ---
function checkGLError(label) {
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
        let errorStr = "WebGL Error";
        switch (error) {
            case gl.INVALID_ENUM: errorStr = "INVALID_ENUM"; break;
            case gl.INVALID_VALUE: errorStr = "INVALID_VALUE"; break;
            case gl.INVALID_OPERATION: errorStr = "INVALID_OPERATION"; break;
            case gl.OUT_OF_MEMORY: errorStr = "OUT_OF_MEMORY"; break;
            case gl.CONTEXT_LOST_WEBGL: errorStr = "CONTEXT_LOST_WEBGL"; break;
            default: errorStr = `Unknown error code ${error}`; break;
        }
        console.error(`WebGL Error (${label}): ${errorStr}`);
    }
}

function drawWebGL() {
    if (!gl || !particleShaderProgram) return;

    // Set background clear color based on whether metaballs are showing
    const bgColor = enableMetaballs ? [0.0, 0.0, 0.0, 0.0] : [0.05, 0.08, 0.1, 1.0]; // Dark blue-grey if particles visible
    gl.clearColor(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    checkGLError("clear");

    // --- Draw Particles (only if metaballs are off) ---
    if (!enableMetaballs && particles.length > 0) {
        gl.useProgram(particleShaderProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, particlePositionBuffer);
        // Verify buffer has expected data size
         const particleBufferSize = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE);
         if(particleBufferSize >= particles.length * 2 * 4) { // 2 floats/particle, 4 bytes/float
            gl.enableVertexAttribArray(particlePositionAttributeLocation);
            gl.vertexAttribPointer(particlePositionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
            gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
            
            // Define a function to calculate average velocity for color
            function calculateAverageVelocity() {
                if (particles.length === 0) return 0;
                let totalVel = 0;
                let maxVel = 0;
                
                for (const p of particles) {
                    const vel = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                    totalVel += vel;
                    maxVel = Math.max(maxVel, vel);
                }
                
                return {
                    avg: totalVel / particles.length,
                    max: maxVel
                };
            }
            
            // Check if we should use velocity-based coloring for particles
            if (currentColorMode === COLOR_MODE.VELOCITY) {
                // Draw each particle individually with its velocity color
                for (let i = 0; i < particles.length; i++) {
                    const p = particles[i];
                    const vel = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                    // Get max velocity for normalization
                    const velStats = calculateAverageVelocity();
                    const normalizedVel = Math.min(1.0, vel / (velStats.max * 0.7 || 1)); // Use 70% of max vel as cap
                    
                    // Parse the velocity color
                    const color = getVelocityColor(normalizedVel);
                    const colorMatch = color.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/);
                    
                    if (colorMatch) {
                        const r = parseInt(colorMatch[1]) / 255;
                        const g = parseInt(colorMatch[2]) / 255;
                        const b = parseInt(colorMatch[3]) / 255;
                        const a = colorMatch[4] ? parseFloat(colorMatch[4]) : 1.0;
                        
                        // Set uniform color for this particle
                        gl.uniform4f(particleColorUniformLocation, r, g, b, a);
                        gl.uniform1f(particleSizeUniformLocation, PARTICLE_DRAW_SIZE);
                        
                        // Draw just this one particle
                        gl.drawArrays(gl.POINTS, i, 1);
                    }
                }
            } else if (currentColorMode === COLOR_MODE.DEPTH) {
                // Draw each particle with depth-based color
                for (let i = 0; i < particles.length; i++) {
                    const p = particles[i];
                    const normalizedDepth = Math.max(0, Math.min(1, (p.y - tankY) / tankHeight));
                    
                    // Parse the depth color
                    const color = getDepthColor(normalizedDepth);
                    const colorMatch = color.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/);
                    
                    if (colorMatch) {
                        const r = parseInt(colorMatch[1]) / 255;
                        const g = parseInt(colorMatch[2]) / 255;
                        const b = parseInt(colorMatch[3]) / 255;
                        const a = colorMatch[4] ? parseFloat(colorMatch[4]) : 1.0;
                        
                        // Set uniform color for this particle
                        gl.uniform4f(particleColorUniformLocation, r, g, b, a);
                        gl.uniform1f(particleSizeUniformLocation, PARTICLE_DRAW_SIZE);
                        
                        // Draw just this one particle
                        gl.drawArrays(gl.POINTS, i, 1);
                    }
                }
            } else {
                // Use default color for all particles when no special coloring is active
                gl.uniform4f(particleColorUniformLocation, 0.3, 0.5, 0.9, 0.8);
                gl.uniform1f(particleSizeUniformLocation, PARTICLE_DRAW_SIZE);
                gl.drawArrays(gl.POINTS, 0, particles.length); // Use actual particle count
            }

            gl.disableVertexAttribArray(particlePositionAttributeLocation);
            checkGLError("drawParticles");
         } else {
             console.warn("Particle buffer size mismatch or insufficient data.");
         }
    }

    // --- Draw Foam (only if foam is enabled) ---
    if (enableFoam && foamShaderProgram && activeFoamCount > 0) {
        gl.useProgram(foamShaderProgram); // Now using our dedicated foam shader
        
        // Set foam shader uniforms
        gl.uniform2f(foamResolutionUniformLocation, canvas.width, canvas.height);
        gl.uniform1f(foamSizeUniformLocation, FOAM_PARTICLE_DRAW_SIZE);
        
        // Position attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, foamPositionBuffer);
        gl.enableVertexAttribArray(foamPositionAttributeLocation);
        gl.vertexAttribPointer(foamPositionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
        
        // Color attribute (new)
        gl.bindBuffer(gl.ARRAY_BUFFER, foamColorBuffer);
        if (activeFoamCount > 0) {
            // Upload only the active foam colors
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, foamColors.subarray(0, activeFoamCount * 4));
        }
        gl.enableVertexAttribArray(foamColorAttributeLocation);
        gl.vertexAttribPointer(foamColorAttributeLocation, 4, gl.FLOAT, false, 0, 0);

        // Draw active foam particles
        gl.drawArrays(gl.POINTS, 0, activeFoamCount);
        
        // Clean up
        gl.disableVertexAttribArray(foamPositionAttributeLocation);
        gl.disableVertexAttribArray(foamColorAttributeLocation);
        checkGLError("drawFoam");
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind buffer
}

function drawOverlays() {
    if (!overlayCtx || !overlayCanvas) return;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // --- Mouse cursor visualization ---
    if ((mouse.leftDown || mouse.rightDown) && MOUSE_RADIUS > 0) {
        overlayCtx.beginPath();
        const visualMouseRadius = MOUSE_RADIUS; // Use the actual interaction radius
        overlayCtx.arc(mouse.x, mouse.y, visualMouseRadius, 0, Math.PI * 2);
        // Color code: Blue for attract (left), Red for repel (right)
        overlayCtx.fillStyle = mouse.leftDown ? 'rgba(100, 150, 255, 0.1)' : 'rgba(255, 100, 100, 0.1)';
        overlayCtx.fill();
        overlayCtx.strokeStyle = mouse.leftDown ? 'rgba(150, 200, 255, 0.4)' : 'rgba(255, 150, 150, 0.4)';
        overlayCtx.lineWidth = 1.5 * window.devicePixelRatio; // Slightly thicker line
        overlayCtx.stroke();
    }

    // --- Draw Virtual Tank Outline (Optional) ---
    // Helps visualize the simulation boundaries
    if (tankWidth > 0) { // Only draw if tank dimensions are calculated
        overlayCtx.strokeStyle = '#778899'; // Light slate gray color (TUNABLE)
        overlayCtx.lineWidth = 1.5 * window.devicePixelRatio; // Thin line
        overlayCtx.strokeRect(tankX, tankY, tankWidth, tankHeight);
    }
    // ---

    // --- Stats Display ---
    const particleCount = particles.length;
    let totalVelocityMag = 0;
    let totalDensity = 0;
    if (particleCount > 0) {
        for (let i = 0; i < particleCount; i++) {
            const p = particles[i];
            if (p && !isInvalid(p.vx) && !isInvalid(p.vy)) {
                 totalVelocityMag += Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            }
            if (p && !isInvalid(p.density)) {
                totalDensity += p.density;
            }
        }
    }
    const avgVelocity = particleCount > 0 ? (totalVelocityMag / particleCount) : 0;
    const avgDensity = particleCount > 0 ? (totalDensity / particleCount) : 0;

    const fontSize = Math.round(10 * window.devicePixelRatio);
    overlayCtx.font = `${fontSize}px monospace`;
    overlayCtx.fillStyle = 'lime';
    overlayCtx.textAlign = 'right';
    overlayCtx.textBaseline = 'top';
    const margin = 10 * window.devicePixelRatio;
    overlayCtx.fillText(`FPS: ${displayedFps.toFixed(1)}`, overlayCanvas.width - margin, margin);
    overlayCtx.fillText(`Particles: ${particleCount}`, overlayCanvas.width - margin, margin + fontSize * 1.2);
    overlayCtx.fillText(`Avg Vel: ${avgVelocity.toFixed(2)}`, overlayCanvas.width - margin, margin + fontSize * 2.4);
    overlayCtx.fillText(`Avg Density: ${avgDensity.toFixed(2)}`, overlayCanvas.width - margin, margin + fontSize * 3.6);
    // --- End Stats Display ---
}

function drawSurface() {
     if (!surfaceCtx || !canvas || !enableMetaballs) {
         if(surfaceCanvas) surfaceCanvas.style.display = 'none'; // Hide if not drawing
         return; // Exit immediately if metaballs are disabled
     }
    const width = surfaceCanvas.width;
    const height = surfaceCanvas.height;
    surfaceCtx.clearRect(0, 0, width, height);
    if (particles.length < 3) { // Need a few particles to draw a surface
         surfaceCanvas.style.display = 'none'; // Hide if no particles
         return;
    } else {
        surfaceCanvas.style.display = 'block'; // Ensure visible if drawing
    }

    surfaceCtx.save(); // Save context state before clipping

    // --- Apply Clipping Region to Tank Boundaries ---
    if (tankWidth > 0 && tankHeight > 0) {
        surfaceCtx.beginPath();
        surfaceCtx.rect(tankX, tankY, tankWidth, tankHeight);
        surfaceCtx.clip();
    }
    // ---

    // Use a smaller cell size for better detail at boundaries
    const cellSize = GRID_CELL_SIZE * SURFACE_DETAIL * 0.8; // Reduced cell size
    const safeCellSize = Math.max(1, cellSize); // Prevent zero cell size
    const cols = Math.ceil(width / safeCellSize) + 1;
    const rows = Math.ceil(height / safeCellSize) + 1;
    const field = new Float32Array(cols * rows); // No need to .fill(0) since Float32Array initializes to zeros
    
    // Only create field arrays when features are enabled based on color mode
    const velocityField = (currentColorMode === COLOR_MODE.VELOCITY) ? new Float32Array(cols * rows) : null;
    const depthField = (currentColorMode === COLOR_MODE.DEPTH) ? new Float32Array(cols * rows) : null;
    
    // Increase influence radius for better boundary coverage
    const mbRadiusSq = (METABALL_RADIUS * 1.2) * (METABALL_RADIUS * 1.2);

    if (mbRadiusSq <= 0) { console.warn("Metaball radius invalid."); surfaceCtx.restore(); return; }

    // --- Metaball Influence Parameters ---
    const METABALL_STRENGTH = 1.5; // Strength of metaball influence - Increased for stronger effect
    const BOUNDARY_BUFFER = METABALL_RADIUS; // Buffer for boundary particle mirroring

    // Calculate metaball field
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        // Only consider particles inside/near the tank
        if (p.x >= tankX - BOUNDARY_BUFFER && 
            p.x <= tankX + tankWidth + BOUNDARY_BUFFER && 
            p.y >= tankY - BOUNDARY_BUFFER && 
            p.y <= tankY + tankHeight + BOUNDARY_BUFFER) {
            
            // Get particle's grid bounds with larger radius for boundary particles
            const influence = mbRadiusSq;
            const startRow = Math.max(0, Math.floor((p.y - METABALL_RADIUS * 1.2) / safeCellSize));
            const endRow = Math.min(rows - 1, Math.floor((p.y + METABALL_RADIUS * 1.2) / safeCellSize));
            const startCol = Math.max(0, Math.floor((p.x - METABALL_RADIUS * 1.2) / safeCellSize));
            const endCol = Math.min(cols - 1, Math.floor((p.x + METABALL_RADIUS * 1.2) / safeCellSize));
            
            // Add influence from this particle
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    const index = r * cols + c;
                    const gridX = c * safeCellSize + safeCellSize / 2;
                    const gridY = r * safeCellSize + safeCellSize / 2;
                    const dx = gridX - p.x;
                    const dy = gridY - p.y;
                    const distSquared = dx * dx + dy * dy;
                    
                    if (distSquared < influence) {
                        // Metaball function: 1 - (distSquared / influence)^2
                        const falloff = Math.pow(1 - (distSquared / influence), 2);
                        field[index] += falloff * METABALL_STRENGTH;
                        
                        // Only accumulate velocity if that feature is enabled
                        if (currentColorMode === COLOR_MODE.VELOCITY && velocityField) {
                            const vel = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                            velocityField[index] += vel * falloff;
                        }
                        
                        // Only accumulate depth if that feature is enabled
                        if (currentColorMode === COLOR_MODE.DEPTH && depthField) {
                            // Normalized depth calculation for coloring
                            const normalizedDepth = Math.max(0, Math.min(1, (p.y - tankY) / tankHeight));
                            depthField[index] += normalizedDepth * falloff;
                        }
                    }
                }
            }
            
            // Only mirror if needed near boundaries
            if (p.x < tankX + BOUNDARY_BUFFER) {
                // Left boundary
                const mirrorX = tankX + (tankX - p.x);
                mirrorParticleInfluence(mirrorX, p.y, p.vx, p.vy, field, velocityField, depthField, safeCellSize, rows, cols, influence);
            } else if (p.x > tankX + tankWidth - BOUNDARY_BUFFER) {
                // Right boundary
                const mirrorX = tankX + tankWidth + (tankX + tankWidth - p.x);
                mirrorParticleInfluence(mirrorX, p.y, p.vx, p.vy, field, velocityField, depthField, safeCellSize, rows, cols, influence);
            }
            
            if (p.y < tankY + BOUNDARY_BUFFER) {
                // Top boundary
                const mirrorY = tankY + (tankY - p.y);
                mirrorParticleInfluence(p.x, mirrorY, p.vx, p.vy, field, velocityField, depthField, safeCellSize, rows, cols, influence);
            } else if (p.y > tankY + tankHeight - BOUNDARY_BUFFER) {
                // Bottom boundary
                const mirrorY = tankY + tankHeight + (tankY + tankHeight - p.y);
                mirrorParticleInfluence(p.x, mirrorY, p.vx, p.vy, field, velocityField, depthField, safeCellSize, rows, cols, influence);
            }
        }
    }
    
    // Update mirrorParticleInfluence function to handle null arrays
    function mirrorParticleInfluence(x, y, vx, vy, field, velocityField, depthField, cellSize, rows, cols, influence) {
        const startRow = Math.max(0, Math.floor((y - Math.sqrt(influence)) / cellSize));
        const endRow = Math.min(rows - 1, Math.floor((y + Math.sqrt(influence)) / cellSize));
        const startCol = Math.max(0, Math.floor((x - Math.sqrt(influence)) / cellSize));
        const endCol = Math.min(cols - 1, Math.floor((x + Math.sqrt(influence)) / cellSize));
        
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const index = r * cols + c;
                const gridX = c * cellSize + cellSize / 2;
                const gridY = r * cellSize + cellSize / 2;
                const dx = gridX - x;
                const dy = gridY - y;
                const distSquared = dx * dx + dy * dy;
                
                if (distSquared < influence) {
                    const falloff = Math.pow(1 - (distSquared / influence), 2) * 0.6; // Slightly reduce influence of mirrored particles
                    field[index] += falloff * METABALL_STRENGTH;
                    
                    // Only update if velocity coloring is enabled and array exists
                    if (currentColorMode === COLOR_MODE.VELOCITY && velocityField) {
                        const vel = Math.sqrt(vx * vx + vy * vy);
                        velocityField[index] += vel * falloff;
                    }
                    
                    // Only update if depth coloring is enabled and array exists
                    if (currentColorMode === COLOR_MODE.DEPTH && depthField) {
                        // Corrected depth calculation for mirrored particles
                        const normalizedDepth = Math.max(0, Math.min(1, (y - tankY) / tankHeight));
                        depthField[index] += normalizedDepth * falloff;
                    }
                }
            }
        }
    }

    // Add ripple effect to the field
    if (enableSurfaceRipples) {
        // Time-based ripple modifier
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const index = r * cols + c;
                // Apply ripples where there's water but not deep inside (near the surface)
                if (field[index] > 0.01 && field[index] < METABALL_THRESHOLD * 1.8) {
                    const gridX = c * safeCellSize + safeCellSize / 2;
                    const gridY = r * safeCellSize + safeCellSize / 2;
                    
                    // Distance from center and edges for wave patterns
                    const dx = gridX - width/2;
                    const dy = gridY - height/2;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    // Distance from walls for boundary ripples
                    const distFromLeftWall = Math.abs(gridX - tankX);
                    const distFromRightWall = Math.abs(gridX - (tankX + tankWidth));
                    const distFromTopWall = Math.abs(gridY - tankY);
                    const distFromBottomWall = Math.abs(gridY - (tankY + tankHeight));
                    
                    // Main wave patterns - multiple frequencies for more natural look
                    const waveTime = totalTime * RIPPLE_SPEED;
                    
                    // Natural water wave patterns
                    const wave1 = Math.sin(dist * RIPPLE_FREQUENCY * 0.008 + waveTime);
                    const wave2 = Math.sin(dist * RIPPLE_FREQUENCY * 0.015 - waveTime * 0.7);
                    const wave3 = Math.sin((gridX * 0.8 + gridY * 1.2) * RIPPLE_FREQUENCY * 0.004 + waveTime * 0.5);
                    
                    // Boundary interaction waves - stronger near walls
                    const boundaryEffectRange = H * 3; // How far from walls the boundary effect extends
                    let boundaryEffect = 0;
                    
                    // Boundary wave intensity based on distance from walls
                    if (distFromLeftWall < boundaryEffectRange) {
                        boundaryEffect += Math.sin(gridY * 0.1 + waveTime * 1.2) * (1 - distFromLeftWall/boundaryEffectRange);
                    }
                    if (distFromRightWall < boundaryEffectRange) {
                        boundaryEffect += Math.sin(gridY * 0.1 - waveTime * 1.3) * (1 - distFromRightWall/boundaryEffectRange);
                    }
                    if (distFromTopWall < boundaryEffectRange) {
                        boundaryEffect += Math.sin(gridX * 0.1 + waveTime) * (1 - distFromTopWall/boundaryEffectRange);
                    }
                    if (distFromBottomWall < boundaryEffectRange) {
                        boundaryEffect += Math.sin(gridX * 0.1 - waveTime * 0.9) * (1 - distFromBottomWall/boundaryEffectRange);
                    }
                    
                    // Combine all wave effects
                    const mainRipple = (wave1 + wave2 * 0.6 + wave3 * 0.4) * 0.6;
                    const boundaryRipple = boundaryEffect * 0.4;
                    const combinedRipple = (mainRipple + boundaryRipple) * RIPPLE_AMPLITUDE * 0.01;
                    
                    // Apply ripple with distance falloff from threshold
                    const distToThreshold = Math.abs(field[index] - METABALL_THRESHOLD);
                    // Create a smoother falloff curve for better blending
                    const rippleInfluence = Math.max(0, 1 - Math.pow(distToThreshold * 5, 2)); 
                    
                    field[index] += combinedRipple * rippleInfluence * RIPPLE_DETAIL;
                }
            }
        }
    }

    // Normalize velocity and depth fields
    let maxVelocity = 0.001; // Minimum value to prevent division by zero
    let maxDepth = 0.001;
    let maxField = 0.001;
    let totalCells = 0;

    // First pass to calculate statistics
    for (let i = 0; i < field.length; i++) {
        if (field[i] > 0.01) { // Only consider cells with meaningful field values
            totalCells++;
            maxField = Math.max(maxField, field[i]);
            if (currentColorMode === COLOR_MODE.VELOCITY && velocityField) {
                maxVelocity = Math.max(maxVelocity, velocityField[i]);
            }
            if (currentColorMode === COLOR_MODE.DEPTH && depthField) {
                maxDepth = Math.max(maxDepth, depthField[i]);
            }
        }
    }

    // Normalize using improved scaling to ensure better coverage
    const fieldThreshold = maxField * 0.15; // Lower threshold for considering cells as part of the water

    for (let i = 0; i < field.length; i++) {
        if (field[i] > fieldThreshold) {
            // For cells with sufficient field values, normalize properly
            const normalizedField = Math.min(1.0, field[i] / maxField);
            const fieldWeight = Math.pow(normalizedField, 0.8); // Slight curve for better visual distribution
            
            // Normalize velocity with better scaling - only if enabled
            if (currentColorMode === COLOR_MODE.VELOCITY && velocityField && velocityField[i] > 0) {
                velocityField[i] = Math.min(1.0, (velocityField[i] / maxVelocity) * fieldWeight);
            }
            
            // Normalize depth with better scaling - only if enabled
            if (currentColorMode === COLOR_MODE.DEPTH && depthField && depthField[i] > 0) {
                // Apply an enhanced curve to depth field for more pronounced coloring
                depthField[i] = Math.min(1.0, (depthField[i] / maxDepth) * fieldWeight);
                // Enhance depth values near boundaries to improve edge coloring
                const cellR = Math.floor(i / cols);
                const cellC = i % cols;
                const cellX = cellC * safeCellSize + safeCellSize / 2;
                const cellY = cellR * safeCellSize + safeCellSize / 2;
                
                // Boost depth values near tank boundaries to improve edge appearance
                const distFromLeftWall = Math.abs(cellX - tankX);
                const distFromRightWall = Math.abs(cellX - (tankX + tankWidth));
                const distFromTopWall = Math.abs(cellY - tankY);
                const distFromBottomWall = Math.abs(cellY - (tankY + tankHeight));
                
                const boundaryDistance = Math.min(
                    distFromLeftWall, distFromRightWall, 
                    distFromTopWall, distFromBottomWall
                );
                
                // Apply depth boost near boundaries (within 3*H of any wall)
                if (boundaryDistance < H * 3) {
                    const boundaryFactor = 1.0 - (boundaryDistance / (H * 3));
                    depthField[i] = Math.max(depthField[i], Math.min(1.0, depthField[i] * (1.0 + boundaryFactor * 0.5)));
                }
            }
        } else {
            // Reset low-value cells to avoid artifacts
            if (velocityField) velocityField[i] = 0;
            if (depthField) depthField[i] = 0;
        }
    }

    // Iterate through grid cells (not points) for Marching Squares
    for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
            // Get scalar values and velocities at the four corners of the cell
            const idx0 = r * cols + c;          // Top-left
            const idx1 = r * cols + (c + 1);      // Top-right
            const idx2 = (r + 1) * cols + c;      // Bottom-left
            const idx3 = (r + 1) * cols + (c + 1);  // Bottom-right

            const s0 = field[idx0], s1 = field[idx1], s2 = field[idx2], s3 = field[idx3];

            // Safely access velocity field
            let v0 = 0, v1 = 0, v2 = 0, v3 = 0;
            if (velocityField) {
                v0 = velocityField[idx0] || 0;
                v1 = velocityField[idx1] || 0;
                v2 = velocityField[idx2] || 0;
                v3 = velocityField[idx3] || 0;
            }

            // Safely access depth field
            let d0 = 0, d1 = 0, d2 = 0, d3 = 0; 
            if (depthField) {
                d0 = depthField[idx0] || 0;
                d1 = depthField[idx1] || 0;
                d2 = depthField[idx2] || 0;
                d3 = depthField[idx3] || 0;
            }

            let caseIndex = 0;
            if (s0 > METABALL_THRESHOLD) caseIndex |= 1;
            if (s1 > METABALL_THRESHOLD) caseIndex |= 2;
            if (s3 > METABALL_THRESHOLD) caseIndex |= 4; // BR is bit 2
            if (s2 > METABALL_THRESHOLD) caseIndex |= 8; // BL is bit 3

            if (caseIndex === 0) continue; // Skip empty cells

            const p0 = { x: c * safeCellSize, y: r * safeCellSize };         // Top-left point of cell
            const p1 = { x: (c + 1) * safeCellSize, y: r * safeCellSize };   // Top-right
            const p2 = { x: c * safeCellSize, y: (r + 1) * safeCellSize }; // Bottom-left
            const p3 = { x: (c + 1) * safeCellSize, y: (r + 1) * safeCellSize }; // Bottom-right

            // Calculate average values for the cell
            let avgSegmentVelocity = 0;
            let avgSegmentDepth = 0;

            if (currentColorMode === COLOR_MODE.VELOCITY) {
                avgSegmentVelocity = (s0 > METABALL_THRESHOLD ? v0 : 0) +
                                    (s1 > METABALL_THRESHOLD ? v1 : 0) +
                                    (s2 > METABALL_THRESHOLD ? v2 : 0) +
                                    (s3 > METABALL_THRESHOLD ? v3 : 0);
            }

            if (currentColorMode === COLOR_MODE.DEPTH) {
                avgSegmentDepth = (s0 > METABALL_THRESHOLD ? d0 : 0) +
                                (s1 > METABALL_THRESHOLD ? d1 : 0) +
                                (s2 > METABALL_THRESHOLD ? d2 : 0) +
                                (s3 > METABALL_THRESHOLD ? d3 : 0);
            }
            
            const numInsideCorners = (s0 > METABALL_THRESHOLD) + (s1 > METABALL_THRESHOLD) + 
                                   (s2 > METABALL_THRESHOLD) + (s3 > METABALL_THRESHOLD);
            
            // Calculate cell center position for normal
            const cellCenterX = (p0.x + p3.x) / 2;
            const cellCenterY = (p0.y + p3.y) / 2;
            
            // Calculate normal and color
            let normal;
            // Only calculate normal if lighting is enabled - skip calculation entirely otherwise
            if (LIGHTING_ENABLED) {
                normal = calculateNormal(field, cols, rows, r, c, safeCellSize);
            } else {
                // Use default normal, don't bother computing
                normal = { x: 0, y: -1, z: 0 }; // Default to straight up
            }
            
            // Determine base color - based on current color mode
            let baseColor;
            if (currentColorMode === COLOR_MODE.DEPTH && depthField) {
                // Use average depth of cell corners
                const cellDepth = numInsideCorners > 0 ? avgSegmentDepth / numInsideCorners : d0;
                baseColor = getDepthColor(cellDepth);
            } else if (currentColorMode === COLOR_MODE.VELOCITY && velocityField) {
                // Use velocity-based coloring
                const finalAvgVel = numInsideCorners > 0 ? avgSegmentVelocity / numInsideCorners : (v0+v1+v2+v3)/4;
                const normalizedVel = Math.min(1.0, finalAvgVel);
                baseColor = getVelocityColor(normalizedVel);
            } else {
                // Use constant color when no special coloring is enabled
                baseColor = VELOCITY_COLOR.slow;
            }
            
            // Apply lighting if enabled
            const finalColor = LIGHTING_ENABLED ? 
                applyLighting(baseColor, normal, cellCenterX, cellCenterY) : baseColor;
            
            surfaceCtx.fillStyle = finalColor;

            surfaceCtx.beginPath();

            // Points on edges, a=top, b=right, c=bottom, d=left from p0 perspective
            let pt_a = null, pt_b = null, pt_c = null, pt_d = null;

            if ((caseIndex & 1) !== (caseIndex & 2)) { // Crosses top edge (s0 vs s1)
                pt_a = interpolatePoint(s0, s1, p0, p1, METABALL_THRESHOLD);
            }
            if ((caseIndex & 2) !== (caseIndex & 4)) { // Crosses right edge (s1 vs s3)
                pt_b = interpolatePoint(s1, s3, p1, p3, METABALL_THRESHOLD);
            }
            if ((caseIndex & 4) !== (caseIndex & 8)) { // Crosses bottom edge (s3 vs s2)
                pt_c = interpolatePoint(s3, s2, p3, p2, METABALL_THRESHOLD);
            }
            if ((caseIndex & 8) !== (caseIndex & 1)) { // Crosses left edge (s2 vs s0)
                pt_d = interpolatePoint(s2, s0, p2, p0, METABALL_THRESHOLD);
            }

            switch (caseIndex) {
                case 1:  // TL
                    surfaceCtx.moveTo(p0.x, p0.y); surfaceCtx.lineTo(pt_a.x, pt_a.y); surfaceCtx.lineTo(pt_d.x, pt_d.y);
                    break;
                case 2:  // TR
                    surfaceCtx.moveTo(p1.x, p1.y); surfaceCtx.lineTo(pt_b.x, pt_b.y); surfaceCtx.lineTo(pt_a.x, pt_a.y);
                    break;
                case 3:  // TL, TR
                    surfaceCtx.moveTo(p0.x, p0.y); surfaceCtx.lineTo(p1.x, p1.y); surfaceCtx.lineTo(pt_b.x, pt_b.y); surfaceCtx.lineTo(pt_d.x, pt_d.y);
                    break;
                case 4:  // BR
                    surfaceCtx.moveTo(p3.x, p3.y); surfaceCtx.lineTo(pt_c.x, pt_c.y); surfaceCtx.lineTo(pt_b.x, pt_b.y);
                    break;
                case 5:  // TL, BR
                    surfaceCtx.moveTo(p0.x, p0.y); surfaceCtx.lineTo(pt_a.x, pt_a.y); surfaceCtx.lineTo(pt_d.x, pt_d.y); // TL triangle
                    surfaceCtx.closePath();
                    surfaceCtx.fill();
                    surfaceCtx.beginPath(); // Start new path for BR triangle
                    surfaceCtx.moveTo(p3.x, p3.y); surfaceCtx.lineTo(pt_c.x, pt_c.y); surfaceCtx.lineTo(pt_b.x, pt_b.y);
                    break;
                case 6:  // TR, BR
                    surfaceCtx.moveTo(p1.x, p1.y); surfaceCtx.lineTo(p3.x, p3.y); surfaceCtx.lineTo(pt_c.x, pt_c.y); surfaceCtx.lineTo(pt_a.x, pt_a.y);
                    break;
                case 7:  // TL, TR, BR
                    surfaceCtx.moveTo(p0.x, p0.y); surfaceCtx.lineTo(p1.x, p1.y); surfaceCtx.lineTo(p3.x, p3.y); surfaceCtx.lineTo(pt_c.x, pt_c.y); surfaceCtx.lineTo(pt_d.x, pt_d.y);
                    break;
                case 8:  // BL
                    surfaceCtx.moveTo(p2.x, p2.y); surfaceCtx.lineTo(pt_d.x, pt_d.y); surfaceCtx.lineTo(pt_c.x, pt_c.y);
                    break;
                case 9:  // TL, BL
                    surfaceCtx.moveTo(p0.x, p0.y); surfaceCtx.lineTo(pt_a.x, pt_a.y); surfaceCtx.lineTo(pt_c.x, pt_c.y); surfaceCtx.lineTo(p2.x, p2.y);
                    break;
                case 10: // TR, BL
                    surfaceCtx.moveTo(p1.x, p1.y); surfaceCtx.lineTo(pt_b.x, pt_b.y); surfaceCtx.lineTo(pt_a.x, pt_a.y); // TR triangle
                    surfaceCtx.closePath();
                    surfaceCtx.fill();
                    surfaceCtx.beginPath(); // Start new path for BL triangle
                    surfaceCtx.moveTo(p2.x, p2.y); surfaceCtx.lineTo(pt_d.x, pt_d.y); surfaceCtx.lineTo(pt_c.x, pt_c.y);
                    break;
                case 11: // TL, TR, BL
                    surfaceCtx.moveTo(p0.x, p0.y); surfaceCtx.lineTo(p1.x, p1.y); surfaceCtx.lineTo(pt_b.x, pt_b.y); surfaceCtx.lineTo(pt_c.x, pt_c.y); surfaceCtx.lineTo(p2.x, p2.y);
                    break;
                case 12: // BR, BL
                    surfaceCtx.moveTo(p3.x, p3.y); surfaceCtx.lineTo(p2.x, p2.y); surfaceCtx.lineTo(pt_d.x, pt_d.y); surfaceCtx.lineTo(pt_b.x, pt_b.y);
                    break;
                case 13: // TL, BR, BL
                    surfaceCtx.moveTo(p0.x, p0.y); surfaceCtx.lineTo(pt_a.x, pt_a.y); surfaceCtx.lineTo(pt_b.x, pt_b.y); surfaceCtx.lineTo(p3.x, p3.y); surfaceCtx.lineTo(p2.x, p2.y);
                    break;
                case 14: // TR, BR, BL
                    surfaceCtx.moveTo(p1.x, p1.y); surfaceCtx.lineTo(p3.x, p3.y); surfaceCtx.lineTo(p2.x, p2.y); surfaceCtx.lineTo(pt_d.x, pt_d.y); surfaceCtx.lineTo(pt_a.x, pt_a.y);
                    break;
                case 15: // All corners inside - fill the whole cell
                    surfaceCtx.moveTo(p0.x, p0.y); surfaceCtx.lineTo(p1.x, p1.y); surfaceCtx.lineTo(p3.x, p3.y); surfaceCtx.lineTo(p2.x, p2.y);
                    break;
            }
            
            surfaceCtx.closePath();
            surfaceCtx.fill();
        }
    }
    surfaceCtx.restore();
}

// Helper function for Marching Squares: Interpolates the position where the
// surface crosses an edge between two points.
function interpolatePoint(p1Val, p2Val, p1Pos, p2Pos, threshold) {
    if (Math.abs(p1Val - p2Val) < 1e-6) {
        return p1Pos; // Avoid division by zero if values are nearly identical
    }
    const t = (threshold - p1Val) / (p2Val - p1Val);
    return {
        x: p1Pos.x + t * (p2Pos.x - p1Pos.x),
        y: p1Pos.y + t * (p2Pos.y - p1Pos.y)
    };
}

// --- Color Utility Functions ---
function interpolateColor(color1, color2, t) {
    const regex = /rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/;
    const matches1 = color1.match(regex);
    const matches2 = color2.match(regex);
    if (!matches1 || !matches2) return color1; // Fallback
    const r1 = parseInt(matches1[1]), g1 = parseInt(matches1[2]), b1 = parseInt(matches1[3]);
    const a1 = matches1[4] !== undefined ? parseFloat(matches1[4]) : 1.0;
    const r2 = parseInt(matches2[1]), g2 = parseInt(matches2[2]), b2 = parseInt(matches2[3]);
    const a2 = matches2[4] !== undefined ? parseFloat(matches2[4]) : 1.0;
    t = Math.max(0, Math.min(1, t));
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    const a = a1 + (a2 - a1) * t; // Interpolate alpha too
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

// Get color based on depth in the tank
function getDepthColor(normalizedDepth) {
    // Only apply depth coloring when in depth color mode
    if (currentColorMode !== COLOR_MODE.DEPTH) {
        return VELOCITY_COLOR.slow; // Default color when not using depth coloring
    }
    
    // Invert the depth value since our values now represent position down the tank
    // (0 = top of tank, 1 = bottom of tank)
    // But we want deeper water to be darker blue
    const invertedDepth = Math.max(0, Math.min(1, normalizedDepth));
    
    // Create a more natural water depth curve
    const depthCurve = Math.pow(invertedDepth, 1.2); // Higher power = more contrast
    
    // Get colors as RGBA values for interpolation
    const shallowColor = parseRGBAColor(WATER_DEPTH_COLORS.shallow);
    const mediumColor = parseRGBAColor(WATER_DEPTH_COLORS.medium);
    const deepColor = parseRGBAColor(WATER_DEPTH_COLORS.deep);
    
    let r, g, b, a;
    
    // First half of depth range: shallow to medium
    if (depthCurve < 0.4) {
        // Normalize to 0-1 range for this segment
        const t = depthCurve / 0.4;
        
        // Interpolate between shallow and medium
        r = lerp(shallowColor.r, mediumColor.r, t);
        g = lerp(shallowColor.g, mediumColor.g, t);
        b = lerp(shallowColor.b, mediumColor.b, t);
        a = lerp(shallowColor.a, mediumColor.a, t);
    } 
    // Second half of depth range: medium to deep
    else {
        // Normalize to 0-1 range for this segment
        const t = (depthCurve - 0.4) / 0.6;
        
        // Interpolate between medium and deep
        r = lerp(mediumColor.r, deepColor.r, t);
        g = lerp(mediumColor.g, deepColor.g, t);
        b = lerp(mediumColor.b, deepColor.b, t);
        a = lerp(mediumColor.a, deepColor.a, t);
    }
    
    // Return interpolated color
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

// Helper function to parse RGBA color string into components
function parseRGBAColor(rgbaString) {
    const match = rgbaString.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (match) {
        return {
            r: parseInt(match[1]),
            g: parseInt(match[2]),
            b: parseInt(match[3]),
            a: parseFloat(match[4])
        };
    }
    return { r: 0, g: 0, b: 0, a: 0 };
}

// Linear interpolation helper function
function lerp(a, b, t) {
    return a + (b - a) * t;
}

function getVelocityColor(normalizedVelocity) {
    // Ensure velocity coloring is properly applied when enabled
    if (currentColorMode !== COLOR_MODE.VELOCITY) {
        return VELOCITY_COLOR.slow; // Default color when not using velocity coloring
    }
    
    const t = Math.max(0, Math.min(1, normalizedVelocity));
    // Interpolate between slow, medium, and fast colors with more obvious transitions
    if (t < 0.4) {
        return interpolateColor(VELOCITY_COLOR.slow, VELOCITY_COLOR.medium, t / 0.4);
    } else {
        return interpolateColor(VELOCITY_COLOR.medium, VELOCITY_COLOR.fast, (t - 0.4) / 0.6);
    }
}

// --- Simulation Loop ---
function update(currentTime) {
    if (!canvas || !gl) { console.error("Update loop stopped: Canvas or Context missing."); return; }
    currentTime *= 0.001; // Convert ms to seconds
    let dt = currentTime - lastTime;
    if (lastTime === 0) dt = 1.0 / 60.0; // Initial frame dt
    dt = Math.min(dt, 1.0 / 30.0); // Cap max frame time step (e.g., 33ms)

    if (dt <= 0) { // Skip if time hasn't passed
        lastTime = currentTime;
        requestAnimationFrame(update);
        return;
    }
    
    // Track total time for animations
    totalTime += dt;

    // --- FPS Calculation ---
    timeAccumulatorForFps += dt;
    frameCountForFps++;
    if (timeAccumulatorForFps >= 0.5) { // Update FPS display roughly every 0.5 seconds
        displayedFps = frameCountForFps / timeAccumulatorForFps;
        timeAccumulatorForFps = 0;
        frameCountForFps = 0;
    }
    // --- End FPS Calculation ---

    const currentSubsteps = NUM_SUBSTEPS; // Get value from slider/variable
    if (currentSubsteps <= 0) { // Skip if no substeps are requested
         lastTime = currentTime;
         requestAnimationFrame(update);
         return;
    }
    lastTime = currentTime;

    // --- Simulation Steps ---
     try {
        // Update spatial grid for neighbor search
        updateGrid();

        // Check if particles array is valid before proceeding
        if (!Array.isArray(particles)) {
            console.error("Particles array is invalid!");
            particles = []; // Reset particles array
        } else if (particles.length > 0) {
            // Find neighbors for all particles
            for (const p of particles) { getNeighbors(p); }

            // Calculate substep time
            const sub_dt = dt / currentSubsteps;

            // Perform physics integration over substeps
            for (let i = 0; i < currentSubsteps; i++) {
                calculateDensityPressure(); // Step 1: Calc density & pressure
                applyForces(sub_dt);        // Step 2: Calc forces (pressure, viscosity, external)
                integrate(sub_dt);          // Step 3: Integrate motion (incl. XSPH, damping)
                applyConstraints();         // Step 4: Handle collisions & spawn foam
            }
        }

        // Update foam particle physics only if foam is enabled
        if (enableFoam) {
            updateFoam(dt);
        }

     } catch (error) {
         console.error("Error during physics simulation step:", error, error.stack);
         alert("Simulation error occurred. Check console.");
         // Consider stopping the loop on error: return;
     }

    // --- Update WebGL Buffers & Draw ---
    try {
        // Update particle positions in GPU buffer
        if (particles.length > 0 && particlePositions.length >= particles.length * 2) {
            gl.bindBuffer(gl.ARRAY_BUFFER, particlePositionBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, particlePositions.subarray(0, particles.length * 2));
            checkGLError("bufferSubData particles");
        }

        // Update foam positions in GPU buffer - only if foam is enabled
        if (enableFoam && activeFoamCount > 0 && foamPositions.length >= activeFoamCount * 2) {
            gl.bindBuffer(gl.ARRAY_BUFFER, foamPositionBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, foamPositions.subarray(0, activeFoamCount * 2));
            checkGLError("bufferSubData foam positions");
             
            // Update foam colors in GPU buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, foamColorBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, foamColors.subarray(0, activeFoamCount * 4));
            checkGLError("bufferSubData foam colors");
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind

        // --- Drawing ---
        if (enableMetaballs) {
            drawSurface(); // Draw the smooth surface
            if(surfaceCanvas) surfaceCanvas.style.display = 'block'; // Ensure visible
        } else {
            if(surfaceCanvas) surfaceCanvas.style.display = 'none'; // Hide if metaballs off
        }
        
        drawWebGL();    // Draw particles (if metaballs off) and foam
        drawOverlays(); // Draw mouse cursor, border

    } catch (error) {
         console.error("Error during WebGL update/draw:", error, error.stack);
         alert("WebGL drawing error occurred. Check console.");
         // Consider stopping the loop on error: return;
    }

    requestAnimationFrame(update); // Schedule next frame
}


// --- Global Event Listeners ---
window.addEventListener('resize', resizeCanvas);
// Use DOMContentLoaded to ensure HTML (like sliders) is parsed
window.addEventListener('DOMContentLoaded', init);
console.log("DOMContentLoaded event listener attached.");

// Helper function to calculate normal from scalar field
function calculateNormal(field, cols, rows, r, c, cellSize) {
    // Skip calculation entirely if lighting is disabled
    if (!LIGHTING_ENABLED) {
        return { x: 0, y: -1, z: 0 }; // Default normal
    }
    
    // Get indices for adjacent cells, with bounds checking
    const rUp = Math.max(0, r - 1);
    const rDown = Math.min(rows - 1, r + 1);
    const cLeft = Math.max(0, c - 1);
    const cRight = Math.min(cols - 1, c + 1);
    
    // Compute the gradient using Sobel operator for smoother normals
    // Horizontal Sobel
    const hGrad = 
        (field[(rUp) * cols + (cRight)] - field[(rUp) * cols + (cLeft)]) +
        (field[r * cols + (cRight)] - field[r * cols + (cLeft)]) * 2 +
        (field[(rDown) * cols + (cRight)] - field[(rDown) * cols + (cLeft)]);
    
    // Vertical Sobel
    const vGrad = 
        (field[(rDown) * cols + (cLeft)] - field[(rUp) * cols + (cLeft)]) +
        (field[(rDown) * cols + c] - field[(rUp) * cols + c]) * 2 +
        (field[(rDown) * cols + (cRight)] - field[(rUp) * cols + (cRight)]);
    
    // Scale gradients
    const gradX = hGrad / (8.0 * cellSize);
    const gradY = vGrad / (8.0 * cellSize);
    
    // Normalize the gradient (points from water to air, so negate for water normal)
    const length = Math.sqrt(gradX * gradX + gradY * gradY);
    
    if (length < 1e-8) {
        return { x: 0, y: -1, z: 0 }; // Default normal if gradient is near zero
    }
    
    return {
        x: -gradX / length * NORMAL_STRENGTH,
        y: -gradY / length * NORMAL_STRENGTH,
        z: 0 // Add z component for consistency with 3D calculations
    };
}

// Apply lighting calculation to a base color
function applyLighting(color, normal, posX, posY) {
    if (!LIGHTING_ENABLED) return color;
    
    // Normalize light direction
    const lightDirLength = Math.sqrt(LIGHT_DIRECTION.x * LIGHT_DIRECTION.x + 
                                   LIGHT_DIRECTION.y * LIGHT_DIRECTION.y);
    const lightDirNorm = {
        x: LIGHT_DIRECTION.x / lightDirLength,
        y: LIGHT_DIRECTION.y / lightDirLength
    };
    
    // Calculate diffuse component (Lambert's cosine law)
    const dotProduct = normal.x * lightDirNorm.x + normal.y * lightDirNorm.y;
    const diffuseIntensity = Math.max(0, dotProduct) * DIFFUSE_STRENGTH;
    
    // Simple specular calculation (Blinn-Phong)
    // View direction always pointing at camera (0,0,1) in 2D
    const halfwayVector = {
        x: lightDirNorm.x,
        y: lightDirNorm.y,
        z: 1.0
    };
    // Normalize halfway vector
    const hvLength = Math.sqrt(halfwayVector.x * halfwayVector.x + 
                             halfwayVector.y * halfwayVector.y + 
                             halfwayVector.z * halfwayVector.z);
    halfwayVector.x /= hvLength;
    halfwayVector.y /= hvLength;
    halfwayVector.z /= hvLength;
    
    // Calculate specular component with normal and halfway vector
    const specDot = Math.max(0, normal.x * halfwayVector.x + 
                              normal.y * halfwayVector.y + 
                              normal.z * halfwayVector.z); // Include normal.z (0) for completeness
    
    // Use a smoother falloff for more natural specular highlights
    const specularIntensity = Math.pow(specDot, SPECULAR_SHININESS) * SPECULAR_STRENGTH;
    
    // Parse base color
    const colorRegex = /rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/;
    const matches = color.match(colorRegex);
    if (!matches) return color;
    
    const r = parseInt(matches[1]);
    const g = parseInt(matches[2]);
    const b = parseInt(matches[3]);
    const a = matches[4] !== undefined ? parseFloat(matches[4]) : 1.0;
    
    // Apply lighting with ambient, diffuse, and specular components
    // Use a more natural blending algorithm
    const lightR = Math.min(255, Math.round(r * (AMBIENT_LIGHT + diffuseIntensity) + 255 * specularIntensity));
    const lightG = Math.min(255, Math.round(g * (AMBIENT_LIGHT + diffuseIntensity) + 255 * specularIntensity));
    const lightB = Math.min(255, Math.round(b * (AMBIENT_LIGHT + diffuseIntensity) + 255 * specularIntensity));
    
    return `rgba(${lightR}, ${lightG}, ${lightB}, ${a})`;
}

// --- UI Elements (Add particle count slider) ---
function setupParticleCountSlider() {
    // Check if particle slider already exists
    const existingSlider = document.getElementById('particle-count-slider');
    if (existingSlider) {
        console.log("Particle slider already exists, not creating a duplicate");
        return existingSlider;
    }
    
    // Look for a container that might hold the sliders
    let controlsContainer = document.querySelector('.slider-container')?.parentElement;
    
    // If we couldn't find one based on existing sliders, try some common IDs/classes
    if (!controlsContainer) {
        controlsContainer = document.getElementById('simulation-controls') || 
                           document.getElementById('controls') ||
                           document.querySelector('.controls');
    }
    
    // If still no container, append to the body as fallback
    if (!controlsContainer) {
        console.warn("Could not find controls container, adding particle slider to body");
        controlsContainer = document.body;
    }
    
    // Create the particle count slider container
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';
    
    // Create the label
    const label = document.createElement('label');
    label.textContent = 'Particles: ';
    label.htmlFor = 'particle-count-slider';
    
    // Create the value display span
    const valueDisplay = document.createElement('span');
    valueDisplay.id = 'particle-count-value';
    valueDisplay.textContent = DEFAULT_PARTICLES;
    
    // Append label and value display
    label.appendChild(valueDisplay);
    sliderContainer.appendChild(label);
    
    // Create the slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'particle-count-slider';
    slider.min = MIN_PARTICLES;
    slider.max = MAX_PARTICLES;
    slider.step = 100;
    slider.value = DEFAULT_PARTICLES;
    slider.className = 'slider'; // Add slider class to match styling of other sliders
    
    // Add event listener
    slider.addEventListener('input', (e) => {
        updateParticleCount(parseInt(e.target.value, 10));
    });
    
    // Append slider
    sliderContainer.appendChild(slider);
    
    // Add to controls container
    controlsContainer.appendChild(sliderContainer);
    
    // Log for debugging
    console.log("Particle count slider added to", controlsContainer);
    
    return slider;
}

// Add a new function to handle particle count changes
function updateParticleCount(value) {
    const previousCount = NUM_PARTICLES;
    NUM_PARTICLES = Math.max(MIN_PARTICLES, Math.min(MAX_PARTICLES, Math.round(value)));
    
    // Update the display
    document.getElementById('particle-count-value').textContent = NUM_PARTICLES;
    
    // If the count has changed, reinitialize particles
    if (NUM_PARTICLES !== previousCount) {
        // Only reinitialize if simulation is already running
        if (particles.length > 0) {
            // Store tank state for re-use
            const currentTankSettings = {
                width: tankWidth,
                height: tankHeight,
                x: tankX,
                y: tankY
            };
            
            // Clear existing particles
            particles = [];
            foamParticles = [];
            activeFoamCount = 0;
            
            // Reinitialize particles
            spawnParticles();
        }
    }
}

// Function to initialize foam system
function initFoamParticles(count) {
    // Reset foam system
    foamParticles = [];
    activeFoamCount = 0;
    
    // Pre-allocate maximum foam particles buffer
    MAX_FOAM_PARTICLES = count;
    
    // Allocate empty foam particles array
    foamParticles = new Array(MAX_FOAM_PARTICLES).fill(null);
    
    // Initialize WebGL buffers for foam
    if (gl) {
        // Foam position buffer
        if (!foamPositionBuffer) {
            foamPositionBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, foamPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(MAX_FOAM_PARTICLES * 2), gl.DYNAMIC_DRAW);
        
        // Foam color buffer
        if (!foamColorBuffer) {
            foamColorBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, foamColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(MAX_FOAM_PARTICLES * 4), gl.DYNAMIC_DRAW); // RGBA
        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    
    console.log(`Initialized foam system with capacity for ${MAX_FOAM_PARTICLES} particles`);
}

// Function to set up a slider with standardized handling
function setupSlider(sliderId, initialValue, min, max, updateCallback) {
    const slider = document.getElementById(sliderId);
    // If slider element doesn't exist in the DOM yet, it might be our particle count slider
    // that will be added dynamically
    if (!slider) return;
    
    // Find or create the value display element
    let valueDisplay = document.getElementById(`${sliderId}-value`);
    if (!valueDisplay) {
        valueDisplay = document.getElementById(`${sliderId.replace('-slider', '')}-value`);
    }
    
    // Set initial values
    slider.min = min;
    slider.max = max;
    slider.value = initialValue;
    
    // Update display if it exists
    if (valueDisplay) {
        valueDisplay.textContent = initialValue;
    }
    
    // Add event listener
    slider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (valueDisplay) {
            // Format to fixed decimal places for floating point values
            valueDisplay.textContent = Number.isInteger(value) ? value : value.toFixed(2);
        }
        // Call the specific update function for this slider
        if (updateCallback) {
            updateCallback(value);
        }
    });
    
    return slider;
}

// --- UI Setup ---