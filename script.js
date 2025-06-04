const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const loadYSlider = document.getElementById('loadY');
const loadYValSpan = document.getElementById('loadYVal');
const resetBtn = document.getElementById('resetBtn');
const angleDisplay = document.getElementById('angleDisplay');
const capsizedDisplay = document.getElementById('capsizedDisplay');

// Boat parameters (all in cm and kg)
const boatWidth = 160;   // hull width
const boatHeight = 40;   // hull height (draft)
const boatMass = 10;     // mass of boat hull
const loadMass = 5;      // mass of movable load

// Physics constants
const g = 980; // gravity cm/s² (9.8 m/s² = 980 cm/s²)
const waterDensity = 1; // relative units (not used directly here)

// Waves
const waveMaxAngle = 10 * Math.PI / 180; // 10 degrees in radians
const waveFrequency = 0.5; // oscillations per second (adjust speed)

// Simulation state
let startTime = Date.now();
let angle = 0;       // radians, positive = tilt right
let angularVelocity = 0;
let angularAcceleration = 0;

let capsized = false;

// Load position (x relative to boat center, cm)
let loadY = 0;

// Moment of inertia approx (rectangle about center)
const I = (1/12) * (boatMass + loadMass) * (boatWidth ** 2 + (boatHeight*3)**2);

function updateCG() {
  // Boat CG at center (0, boatHeight/2)
  const boatCG = {x: 0, y: boatHeight / 2};

  // Load CG at (0, boatHeight/2 - loadY)
  const loadCG = {x: 0, y: (boatHeight / 2) - loadY};
  
  // Composite CG weighted average
  const totalMass = boatMass + loadMass;
  const CGx = (boatMass * boatCG.x + loadMass * loadCG.x) / totalMass;
  const CGy = (boatMass * boatCG.y + loadMass * loadCG.y) / totalMass;

  return {x: CGx, y: CGy};
}

function calcCB(angle) {
  // For simplicity, approximate CB as centroid of submerged rectangle.

  // When tilted, effective waterline shifts.
  // We'll approximate submerged area and find centroid along x.

  // Calculate how much the boat is submerged:
  // Because boat is floating, buoyant force = weight.
  // So submerged volume is constant.

  // Here, assume draft fixed, CB at (0, draft/2) in upright.
  // When tilted, CB shifts horizontally proportional to angle.

  // Simple approximation:
  const shiftX = (boatHeight / 2) * Math.sin(angle);

  return {x: shiftX, y: boatHeight / 2};
}

function drawBoat(displayAngle, CG, CB, loadY) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  // Move origin to center bottom for drawing
  const originX = canvas.width / 2;
  const originY = canvas.height * 0.75;
  ctx.translate(originX, originY);
  ctx.rotate(angle);

  // Draw hull rectangle
  ctx.fillStyle = '#654321';
  ctx.fillRect(-boatWidth/2, 0, boatWidth, -boatHeight);

  // Draw waterline (horizontal line at y=0)
  ctx.strokeStyle = '#0077ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-boatWidth, 0);
  ctx.lineTo(boatWidth, 0);
  ctx.stroke();

  // Draw load as red circle
  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(0, -boatHeight / 2 - loadY, 8, 0, Math.PI * 2);
  ctx.fill();

  // Draw CG as blue circle
  ctx.fillStyle = 'blue';
  ctx.beginPath();
  ctx.arc(CG.x, -CG.y, 8, 0, Math.PI * 2);
  ctx.fill();

  // Draw CB as green circle
  ctx.fillStyle = 'green';
  ctx.beginPath();
  ctx.arc(CB.x, -CB.y, 8, 0, Math.PI * 2);
  ctx.fill();

  // Draw lines to indicate forces
  // Weight down from CG
  ctx.strokeStyle = 'blue';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CG.x, -CG.y);
  ctx.lineTo(CG.x, 50);
  ctx.stroke();

  // Buoyancy up from CB
  ctx.strokeStyle = 'green';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CB.x, -CB.y);
  ctx.lineTo(CB.x, -boatHeight - 50);
  ctx.stroke();

  ctx.restore();
}

function updatePhysics(dt) {
  if (capsized) return;

  // Update CG and CB
  const CG = updateCG();
  const CB = calcCB(angle);

  // Calculate lever arm (horizontal distance between CG and CB)
  const leverArm = CB.x - CG.x;

  // Calculate torque: torque = leverArm * weight * g
  const totalMass = boatMass + loadMass;
  const torque = leverArm * totalMass * g;

  // Angular acceleration = torque / I
  angularAcceleration = torque / I;

  // Update angular velocity and angle (Euler integration)
  angularVelocity += angularAcceleration * dt;
  angle += angularVelocity * dt;

  // Damping (simulate water resistance)
  angularVelocity *= 0.99;

  // Capsize condition: if angle beyond ±90 degrees (±PI/2)
  if (Math.abs(angle) > Math.PI / 2) {
    capsized = true;
    angle = angle > 0 ? Math.PI / 2 : -Math.PI / 2;
    angularVelocity = 0;
  }

  return {CG, CB};
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000; // seconds
  lastTime = timestamp;

  const {CG, CB} = updatePhysics(dt);

  // Calculate wave offset using total elapsed time in seconds
  const elapsed = timestamp / 1000;
  const waveOffset = waveMaxAngle * Math.sin(2 * Math.PI * waveFrequency * elapsed);

  // Add waveOffset to physics angle for display only
  const displayAngle = angle + waveOffset;
  
  drawBoat(displayAngle, CG, CB, loadY);

  // Update UI info
  angleDisplay.textContent = (angle * 180 / Math.PI).toFixed(1);
  capsizedDisplay.textContent = capsized ? 'Yes' : 'No';

  requestAnimationFrame(loop);
}

let lastTime = null;

loadYSlider.addEventListener('input', (e) => {
  loadY = parseFloat(e.target.value);
  loadYValSpan.textContent = loadY;
});

// Attach reset button handler
resetBtn.addEventListener('click', () => {
  resetSimulation();
});

function resetSimulation() {
  // Reset physics state
  angle = 0;
  angularVelocity = 0;
  angularAcceleration = 0;
  capsized = false;
  lastTime = null; // reset animation timing
  
  // Reset load position and slider UI to initial
  loadY = 0;
  loadYSlider.value = 0;
  loadYValSpan.textContent = "0";
}

resetSimulation();
requestAnimationFrame(loop);

