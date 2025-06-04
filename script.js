const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const loadYSlider = document.getElementById('loadY');
const loadYValSpan = document.getElementById('loadYVal');
const resetBtn = document.getElementById('resetBtn');
const angleDisplay = document.getElementById('angleDisplay');
const capsizedDisplay = document.getElementById('capsizedDisplay');
const toggleWaveBtn = document.getElementById('toggleWaveBtn');
let waveOn = true; 

// Boat parameters (all in cm and kg)
const boatWidthInputElem = document.getElementById('boatWidthInput');
const boatHeightInputElem = document.getElementById('boatHeightInput');
const boatMassInputElem = document.getElementById('boatMassInput');     // mass of boat hull
const loadMassInputElem = document.getElementById('loadMassInput');     // mass of movable load
let boatWidth  = parseFloat(boatWidthInputElem.value);
let boatHeight = parseFloat(boatHeightInputElem.value);
let boatMass = parseFloat( boatMassInputElem.value );
let loadMass = parseFloat( loadMassInputElem.value );

// Whenever either input changes, update the variables:
boatMassInputElem.addEventListener('input', () => {
  boatMass = parseFloat(boatMassInputElem.value) || 0;
});
loadMassInputElem.addEventListener('input', () => {
  loadMass = parseFloat(loadMassInputElem.value) || 0;
});
boatWidthInputElem.addEventListener('input', () => {
  boatWidth = parseFloat(boatWidthInputElem.value) || 0;
});
boatHeightInputElem.addEventListener('input', () => {
  boatHeight = parseFloat(boatHeightInputElem.value) || 0;
});


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

// I = moment of inertia for (boatMass+loadMass):
function momentOfInertia() {
  const totalM = boatMass + loadMass;
  // approximate rectangular hull + load (all at same x-axis):
  return (1/12) * totalM * ( boatWidth**2 + (boatHeight * 3)**2 );
}

// Compute the static “draft” (submerged depth) so that displaced mass of water = boatMass + loadMass.
// Since we treat waterDensity as kg/cm², the submerged area = boatWidth * submergedDepth.
function computeSubmergedDepth() {
  const totalMass       = boatMass + loadMass; // kg
  const submergedDepth  = totalMass / (boatWidth * waterDensity);
  // (boatWidth * submergedDepth * waterDensity) = totalMass
  return Math.min(submergedDepth, boatHeight); 
  // clamp so it never goes beyond full hull height
}


function updateCG() {
  // Boat CG at center (0, boatHeight/2)
  const boatCG = {x: 0, y: -boatHeight / 2};

  // Load CG at (0, boatHeight/2 - loadY)
  const loadCG = {x: 0, y: (-boatHeight / 2) - loadY};
  
  // Combined CG weighted average
  const totalMass = boatMass + loadMass;
  const combinedCG = {
    x: (boatMass * boatCG.x + loadMass * loadCG.x) / totalMass,
    y: (boatMass * boatCG.y + loadMass * loadCG.y) / totalMass,
  };

  // Return all three
  return { boatCG, loadCG, combinedCG };
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

function drawBoat(displayAngle, boatCG, loadCG, combinedCG, loadY) {
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

  // Compute how deep the hull should be
  const submergedDepth = computeSubmergedDepth(); // in cm
  
  // Draw the boat itself, rotated by displayAngle
  ctx.save();
  ctx.translate(originX, originY + submergedDepth);
  ctx.rotate(displayAngle);

  // Draw Hull rectangle
  ctx.fillStyle = '#654321';
  ctx.fillRect(-boatWidth / 2, 0, boatWidth, -boatHeight);

  // --- Draw BOAT’s own CG (red) ---
  ctx.fillStyle = '#FF0000';
  ctx.beginPath();
  ctx.arc(boatCG.x, boatCG.y, 5, 0, Math.PI * 2);
  ctx.fill();
  
  // --- Draw LOAD’s CG (orange) ---
  ctx.fillStyle = '#FFA500';
  ctx.beginPath();
  ctx.arc(loadCG.x, loadCG.y, 5, 0, Math.PI * 2);
  ctx.fill();

  // --- Draw COMBINED CG (black) ---
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(combinedCG.x, combinedCG.y, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

function rotatePoint(pt, θ) {
    return {
      x: pt.x * Math.cos(θ) - pt.y * Math.sin(θ),
      y: pt.x * Math.sin(θ) + pt.y * Math.cos(θ)
    };
  }

  // Boat-CG world position:
  const boatCG_world = rotatePoint(boatCG, displayAngle);
  boatCG_world.x += originX;
  boatCG_world.y += originY + submergedDepth;

  // Load-CG world position:
  const loadCG_world = rotatePoint(loadCG, displayAngle);
  loadCG_world.x += originX;
  loadCG_world.y += originY + submergedDepth;

  // Combined-CG world position:
  const combinedCG_world = rotatePoint(combinedCG, displayAngle);
  combinedCG_world.x += originX;
  combinedCG_world.y += originY + submergedDepth;

  // DRAW a vertical arrow (straight down) from each world-space CG:
  const arrowLength = 50; // in pixels; adjust if you want longer/shorter arrows

  // Boat CG arrow (red)
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(boatCG_world.x, boatCG_world.y);
  ctx.lineTo(boatCG_world.x, boatCG_world.y + arrowLength);
  ctx.stroke();
  // arrowhead
  ctx.beginPath();
  ctx.moveTo(boatCG_world.x - 5, boatCG_world.y + arrowLength - 10);
  ctx.lineTo(boatCG_world.x, boatCG_world.y + arrowLength);
  ctx.lineTo(boatCG_world.x + 5, boatCG_world.y + arrowLength - 10);
  ctx.stroke();

  // Load CG arrow (orange)
  ctx.strokeStyle = '#FFA500';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(loadCG_world.x, loadCG_world.y);
  ctx.lineTo(loadCG_world.x, loadCG_world.y + arrowLength);
  ctx.stroke();
  // arrowhead
  ctx.beginPath();
  ctx.moveTo(loadCG_world.x - 5, loadCG_world.y + arrowLength - 10);
  ctx.lineTo(loadCG_world.x, loadCG_world.y + arrowLength);
  ctx.lineTo(loadCG_world.x + 5, loadCG_world.y + arrowLength - 10);
  ctx.stroke();

  // Combined CG arrow (black)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(combinedCG_world.x, combinedCG_world.y);
  ctx.lineTo(combinedCG_world.x, combinedCG_world.y + arrowLength);
  ctx.stroke();
  // arrowhead
  ctx.beginPath();
  ctx.moveTo(combinedCG_world.x - 5, combinedCG_world.y + arrowLength - 10);
  ctx.lineTo(combinedCG_world.x, combinedCG_world.y + arrowLength);
  ctx.lineTo(combinedCG_world.x + 5, combinedCG_world.y + arrowLength - 10);
  ctx.stroke();
}

function updatePhysics(dt) {
  if (capsized) return;

  // Update CGs
  const { boatCG, loadCG, combinedCG } = updateCG();
  const CB = calcCB(angle);  // still used in torque calculation

 // CAPSIZING CHECK
  //    Compute world‐x of combined CG:
  const xCG_world = combinedCG.x * Math.cos(angle)
                   - combinedCG.y * Math.sin(angle);
  //    Compute half‐corner x at waterline:
  const halfCornerX =
  (boatWidth  / 2) * Math.cos(angle)
+ (boatHeight / 2) * Math.sin(angle);

  if (Math.abs(xCG_world) > halfCornerX) {
    capsized = true;
    angle = (xCG_world > 0 ? Math.PI/2 : -Math.PI/2);
    angularVelocity = 0;
    return { boatCG, loadCG, combinedCG };
  }
  
  // Calculate lever arm between CB and **combinedCG**
  const leverArm = CB.x - combinedCG.x;

  // Calculate torque: torque = leverArm * weight * g
  const totalMass = boatMass + loadMass;
  const torque = leverArm * totalMass * g;
  
  // I (moment of inertia) at this instant:
  const I = momentOfInertia();
  
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

   return { boatCG, loadCG, combinedCG };
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000; // seconds
  lastTime = timestamp;

 const { boatCG, loadCG, combinedCG } = updatePhysics(dt);

  // Calculate wave offset using total elapsed time in seconds
  const elapsed = timestamp / 1000;
  const rawOffset = waveMaxAngle * Math.sin(2 * Math.PI * waveFrequency * (timestamp/1000));
  const waveOffset = waveOn ? rawOffset : 0;

  // Add waveOffset to physics angle for display only
  const displayAngle = waveOn ? angle + rawOffset : angle;
  
  // Recompute xCG_world and halfCornerX here (same formula as in updatePhysics)
  const xCG_world = combinedCG.x * Math.cos(displayAngle)
                   - combinedCG.y * Math.sin(displayAngle);
  const halfCornerX = 
       (boatWidth  / 2) * Math.cos(displayAngle)
     + (boatHeight / 2) * Math.sin(displayAngle);
  

  // For debugging in console:
  console.log(
    'Timestamp:', timestamp.toFixed(2), 
    'Elapsed (s):', elapsed.toFixed(2), 
    'Wave On?:', waveOn,
    'Wave Offset (rad):', waveOffset.toFixed(4),
    'Angle:', (angle * 180 / Math.PI).toFixed(1),
    'displayAngle (deg):', (displayAngle*180/Math.PI).toFixed(1),
    'xCG_world =', xCG_world.toFixed(2),
    'halfCornerX =', halfCornerX.toFixed(2)
  );
  
  drawBoat(displayAngle, boatCG, loadCG, combinedCG, loadY);

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

// Attach wave on/off button
toggleWaveBtn.addEventListener('click', () => {
  waveOn = !waveOn; // flip the flag

  if (waveOn) {
    toggleWaveBtn.textContent = 'Turn Wave Off';
  } else {
    toggleWaveBtn.textContent = 'Turn Wave On';
  }
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

