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
  const boatCG = {x: 0, y: -boatHeight / 2};

  // Load CG at (0, boatHeight/2 - loadY)
  const loadCG = {x: 0, y: (-boatHeight / 2) + loadY};
  
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

  return {x: shiftX, y: -boatHeight / 2};
}

function drawBoat(displayAngle, CG, CB, loadY) {
  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Compute the “origin” for drawing (center‐bottom of screen)
  const originX = canvas.width / 2;
  const originY = canvas.height * 0.75;

  // Draw the waterline HORIZONTALLY (no rotation)
  ctx.save();
  ctx.translate(originX, originY);
  ctx.strokeStyle = '#0000FF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-canvas.width, 0);
  ctx.lineTo(canvas.width, 0);
  ctx.stroke();
  ctx.restore();

  // Draw the boat itself, rotated by displayAngle
  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(displayAngle);

  // Draw Hull rectangle
  ctx.fillStyle = '#654321';
  ctx.fillRect(-boatWidth / 2, 0, boatWidth, -boatHeight);

  // Draw CG marker (small circle) and weight arrow (downward)
  // Assume CG.x, CG.y are in “boat coordinates” (y is negative if above base)
  // red circle for CG
  ctx.fillStyle = '#FF0000';            
  ctx.beginPath();
  ctx.arc(CG.x, CG.y, 5, 0, Math.PI * 2);
  ctx.fill();

  // Draw weight arrow from CG downward
  const weightArrowLength = 50;         // adjust length if needed
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CG.x, CG.y);
  ctx.lineTo(CG.x, CG.y + weightArrowLength);
  ctx.stroke();
  // arrowhead (small V)
  ctx.beginPath();
  ctx.moveTo(CG.x - 5, CG.y + weightArrowLength - 10);
  ctx.lineTo(CG.x,     CG.y + weightArrowLength);
  ctx.lineTo(CG.x + 5, CG.y + weightArrowLength - 10);
  ctx.stroke();
  
  // Draw CB marker (small circle) and buoyant arrow (upward)
  // green circle for CB
  ctx.fillStyle = '#00AA00';            
  ctx.beginPath();
  ctx.arc(CB.x, CB.y, 5, 0, Math.PI * 2);
  ctx.fill();

 // Draw buoyant force arrow from CB upward
  const buoyArrowLength = 50;           // adjust length if needed
  ctx.strokeStyle = '#00AA00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CB.x, CB.y);
  ctx.lineTo(CB.x, CB.y - buoyArrowLength);
  ctx.stroke();
  // arrowhead (small V)
  ctx.beginPath();
  ctx.moveTo(CB.x - 5, CB.y - buoyArrowLength + 10);
  ctx.lineTo(CB.x,     CB.y - buoyArrowLength);
  ctx.lineTo(CB.x + 5, CB.y - buoyArrowLength + 10);
  ctx.stroke();

  // Draw load position if you keep a movable weight
  // small blue circle at (0, loadY):
  ctx.fillStyle = '#0000FF';
  ctx.beginPath();
  ctx.arc(0, loadY, 5, 0, Math.PI * 2);
  ctx.fill();
  
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

  console.log('Timestamp:', timestamp.toFixed(2), 'Elapsed (s):', elapsed.toFixed(2), 'Wave Offset (rad):', waveOffset.toFixed(4));
  
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

