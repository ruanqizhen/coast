// simulation.worker.ts — Complete game simulation
// Runs in Web Worker: visitor AI (FSM + utility), staff AI, economy, weather, satisfaction, star rating
import type {
  Visitor, Staff, VomitPoint, TrashPoint, PlacedFacility,
  VisitorAgeGroup, WeatherType
} from '../types';
import { CONSTANTS, STAR_REQUIREMENTS } from '../config/constants';
import { FACILITIES, DEFAULT_TICKET_PRICES } from '../config/facilities';
import { findPath, buildWeightGrid } from '../engine/PathfindingSystem';
import { calcAcceptanceRate, calcMonthlySettlement, calcDemolishRefund, createDefaultLoan } from '../engine/EconomySystem';
import type { LoanState } from '../types';

// ═══════════════════════════════════
// Worker State
// ═══════════════════════════════════
let dayInterval: number | null = null;
let simInterval: number | null = null;
let currentSpeed = 1;
const SIM_FPS = 10;

let visitors: Record<string, Visitor> = {};
let staff: Record<string, Staff> = {};
let vomitPoints: Record<string, VomitPoint> = {};
let trashPoints: Record<string, TrashPoint> = {};
let facilities: PlacedFacility[] = [];
let roadGrid: (string | null)[][] = [];
let weightGrid: (number | null)[][] = [];

let rating = 50;
let weather: WeatherType = 'sunny';
let nextWeather: WeatherType = 'cloudy';
let stars = 0;
let currentDay = 1;
let currentMonth = 1;
let ticketMode: 'free' | 'paid' = 'free';
let ticketPrice = 0;
let loan: LoanState = createDefaultLoan();
let monthRevenue = 0;
let visitorPeak = 0;
let unlockedTechs: string[] = [];

// Satisfaction components
let satExperience = 50;
let satCleanliness = 80;
let satValue = 60;
let satService = 50;
let satEnvironment = 50;

// Scenery maintenance state
let sceneryMaintenance: Record<string, number> = {}; // instanceId -> maintenance level (0-100)

// ═══════════════════════════════════
// Message Handler
// ═══════════════════════════════════
self.onmessage = (e) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'START':
      startLoops(); break;
    case 'STOP':
      stopLoops(); break;
    case 'SET_SPEED':
      currentSpeed = payload.speed;
      stopLoops();
      if (currentSpeed > 0) startLoops();
      break;
    case 'LOAD_STATE':
      visitors = payload.visitors ? payload.visitors.reduce((acc: any, v: any) => ({ ...acc, [v.id]: v }), {}) : {};
      staff = payload.staff ? payload.staff.reduce((acc: any, s: any) => ({ ...acc, [s.id]: s }), {}) : {};
      weather = payload.weather || 'sunny';
      nextWeather = payload.nextWeather || 'cloudy';
      rating = payload.park?.rating || 50;
      stars = payload.park?.stars || 0;
      currentDay = payload.park?.date?.day || 1;
      currentMonth = payload.park?.date?.month || 1;
      unlockedTechs = payload.research?.unlocked || [];
      loan = payload.economy?.loan || createDefaultLoan();
      ticketMode = payload.park?.settings?.ticketMode || 'free';
      ticketPrice = payload.park?.settings?.ticketPrice || 0;
      break;
    case 'SYNC_FACILITIES':
      facilities = payload; break;
    case 'SYNC_ROADS':
      roadGrid = payload;
      weightGrid = buildWeightGrid(roadGrid, false);
      break;
    case 'SYNC_SETTINGS':
      if (payload.ticketMode !== undefined) ticketMode = payload.ticketMode;
      if (payload.ticketPrice !== undefined) ticketPrice = payload.ticketPrice;
      if (payload.day !== undefined) currentDay = payload.day;
      if (payload.month !== undefined) currentMonth = payload.month;
      if (payload.unlockedTechs !== undefined) unlockedTechs = payload.unlockedTechs;
      break;
    case 'SPAWN_STAFF': {
      const sId = `staff_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      staff[sId] = {
        id: sId,
        type: payload.type,
        pos: { x: payload.x * CONSTANTS.CELL_SIZE, z: payload.z * CONSTANTS.CELL_SIZE },
        targetPos: null,
        targetInstanceId: null,
        patrolZone: payload.zone || {
          x: Math.max(0, payload.x - 4),
          z: Math.max(0, payload.z - 4),
          w: CONSTANTS.DEFAULT_PATROL_SIZE,
          h: CONSTANTS.DEFAULT_PATROL_SIZE,
        },
        energy: 100,
        restingUntil: 0,
        lastInspectionTime: Date.now(),
      };
      break;
    }
    case 'REMOVE_FACILITY': {
      const refund = calcDemolishRefund(
        facilities.find(f => f.instanceId === payload.id)!,
        currentDay
      );
      facilities = facilities.filter(f => f.instanceId !== payload.id);
      self.postMessage({ type: 'ECONOMY_UPDATE', payload: { type: 'INCOME', amount: refund, reason: 'demolish' } });
      break;
    }
    case 'TAKE_LOAN':
      if (loan.principal + payload.amount <= loan.maxLoan) {
        loan.principal += payload.amount;
        self.postMessage({ type: 'ECONOMY_UPDATE', payload: { type: 'INCOME', amount: payload.amount, reason: 'loan' } });
        self.postMessage({ type: 'LOAN_UPDATE', payload: loan });
      }
      break;
    case 'REPAY_LOAN': {
      const repay = Math.min(payload.amount, loan.principal);
      loan.principal -= repay;
      self.postMessage({ type: 'ECONOMY_UPDATE', payload: { type: 'SPEND', amount: -repay, reason: 'loan_repay' } });
      self.postMessage({ type: 'LOAN_UPDATE', payload: loan });
      break;
    }
  }
};

// ═══════════════════════════════════
// Loops
// ═══════════════════════════════════
function startLoops() {
  if (dayInterval === null) {
    dayInterval = self.setInterval(() => {
      self.postMessage({ type: 'DAY_TICK' });
      simulateDayTick();
    }, 1000 / currentSpeed);
  }
  if (simInterval === null) {
    simInterval = self.setInterval(() => {
      simulateFrame();
      self.postMessage({
        type: 'SIM_UPDATE',
        payload: { visitors, staff, vomitPoints, trashPoints }
      });
    }, (1000 / SIM_FPS) / currentSpeed);
  }
}

function stopLoops() {
  if (dayInterval !== null) self.clearInterval(dayInterval);
  if (simInterval !== null) self.clearInterval(simInterval);
  dayInterval = null;
  simInterval = null;
}

// ═══════════════════════════════════
// Day Tick
// ═══════════════════════════════════
function simulateDayTick() {
  currentDay++;
  spawnVisitors();
  updateWeather();
  updateFacilityAging();
  checkBreakdowns();
  updateSatisfaction();
  updateStarRating();
  generateTrash();
  updateSceneryDecay();

  // Monthly settlement
  if (currentDay % CONSTANTS.DAYS_PER_MONTH === 0) {
    doMonthlySettlement();
    currentMonth++;
    if (unlockedTechs.includes('ops_2')) {
        applyIntelligentPricing();
    }
  }

  // Track peak
  const vCount = Object.keys(visitors).length;
  if (vCount > visitorPeak) visitorPeak = vCount;
}

// ═══════════════════════════════════
// Visitor Spawning (PRD §5.2.6)
// ═══════════════════════════════════
function spawnVisitors() {
  const vCount = Object.keys(visitors).length;
  if (vCount >= CONSTANTS.VISITOR_HARD_CAP) return;

  // Base rate = satisfaction × 0.5 per game minute
  let spawnRate = (rating / 100) * 5;

  // Weather modifier
  spawnRate *= (CONSTANTS.WEATHER_VISITOR_MULT[weather] || 1.0);

  // Ticket price modifier
  if (ticketMode === 'paid') {
    spawnRate *= Math.max(0.2, 1 - (ticketPrice / 10) * 0.08);
  }

  // Soft cap reduction
  if (vCount >= CONSTANTS.VISITOR_SOFT_CAP) {
    spawnRate *= 0.5;
  }

  const count = Math.floor(spawnRate);
  for (let i = 0; i < count; i++) {
    if (Object.keys(visitors).length >= CONSTANTS.VISITOR_HARD_CAP) break;
    createVisitor();
  }
}

function createVisitor() {
  const vId = `vis_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const ageGroups: VisitorAgeGroup[] = ['child', 'teen', 'adult', 'family'];
  const ageGroup = ageGroups[Math.floor(Math.random() * ageGroups.length)];

  // Park entrance is at the bottom center of the grid
  const gridCenter = (CONSTANTS.GRID_SIZE / 2) * CONSTANTS.CELL_SIZE;
  // Add slight random spread so visitors don't stack exactly
  const entranceX = gridCenter + (Math.random() - 0.5) * CONSTANTS.CELL_SIZE * 4;
  const entranceZ = 2 + Math.random() * CONSTANTS.CELL_SIZE;

  // Deduct ticket
  if (ticketMode === 'paid' && ticketPrice > 0) {
    monthRevenue += ticketPrice;
    self.postMessage({ type: 'ECONOMY_UPDATE', payload: { type: 'INCOME', amount: ticketPrice, reason: 'ticket' } });
  }

  visitors[vId] = {
    id: vId,
    pos: { x: entranceX, z: entranceZ },
    targetPos: null,
    targetFacilityId: null,
    state: 'entering',
    needs: { hunger: 80, thirst: 80, toilet: 10, fatigue: 10, nausea: 0, fun: 70 },
    money: CONSTANTS.VISITOR_MIN_MONEY + Math.random() * (CONSTANTS.VISITOR_MAX_MONEY - CONSTANTS.VISITOR_MIN_MONEY),
    satisfaction: 60,
    ageGroup,
    excitementPref: 1 + Math.floor(Math.random() * 10),
    nauseaTolerance: 1 + Math.floor(Math.random() * 10),
    patience: CONSTANTS.VISITOR_DEFAULT_PATIENCE_MIN + Math.random() * (CONSTANTS.VISITOR_DEFAULT_PATIENCE_MAX - CONSTANTS.VISITOR_DEFAULT_PATIENCE_MIN),
    spendingWillingness: 0.5 + Math.random(),
    path: [],
    pathIndex: 0,
    queueStartTime: 0,
    lastHighNauseaRide: false,
    ridesCount: 0,
    enteredOnDay: currentDay,
    lastDecisionTime: Date.now(),
  };
}

// ═══════════════════════════════════
// Weather (PRD §5.6)
// ═══════════════════════════════════
function updateWeather() {
  // Change weather every ~5 days
  if (currentDay % 5 === 0) {
    weather = nextWeather;
    nextWeather = rollWeather();
    self.postMessage({ type: 'WEATHER_UPDATE', payload: { current: weather, next: nextWeather } });

    // Heavy rain → pause outdoor facilities
    if (weather === 'heavy_rain') {
      self.postMessage({ type: 'MESSAGE', payload: {
        id: `msg_${Date.now()}`, text: '暴雨来袭！户外设施已暂停运营',
        priority: 'warning', timestamp: Date.now()
      }});
    }
    if (weather === 'holiday') {
      self.postMessage({ type: 'MESSAGE', payload: {
        id: `msg_${Date.now()}`, text: '🎉 节假日！游客量和消费意愿大增',
        priority: 'milestone', timestamp: Date.now()
      }});
    }
  }
}

function rollWeather(): WeatherType {
  const r = Math.random();
  let cumulative = 0;
  for (const [w, p] of Object.entries(CONSTANTS.WEATHER_PROBS)) {
    cumulative += p;
    if (r < cumulative) return w as WeatherType;
  }
  return 'sunny';
}

// ═══════════════════════════════════
// Facility Aging & Breakdowns (PRD §5.4.3)
// ═══════════════════════════════════
function updateFacilityAging() {
  for (const fac of facilities) {
    fac.age++;
  }
}

function checkBreakdowns() {
  for (const fac of facilities) {
    if (fac.breakdown) continue;
    const def = FACILITIES[fac.typeId];
    if (!def || def.category === 'scenery' || def.category === 'facility') continue;

    // Breakdown formula from PRD
    let breakdownChance = fac.age * 0.001 + fac.totalRides * 0.0005;

    // Track complexity bonus for coasters
    if (fac.trackPieces) {
      for (const piece of fac.trackPieces) {
        const stats = { straight: 0, climb: 0.001, dive: 0.003, loop: 0.008, super_loop: 0.015 };
        breakdownChance += stats[piece.type] || 0;
      }
    }

    // Security nearby reduces chance
    for (const s of Object.values(staff)) {
      if (s.type === 'security') {
        const dx = s.pos.x - fac.x * CONSTANTS.CELL_SIZE;
        const dz = s.pos.z - fac.z * CONSTANTS.CELL_SIZE;
        if (dx * dx + dz * dz < 400) breakdownChance *= 0.2;
      }
    }

    if (Math.random() < breakdownChance * 0.1) { // Scale down for per-day check
      fac.breakdown = true;
      self.postMessage({ type: 'FACILITY_BREAKDOWN', payload: fac.instanceId });
      self.postMessage({ type: 'MESSAGE', payload: {
        id: `msg_${Date.now()}`, text: `⚠️ ${def.name} 发生故障！`,
        priority: 'critical', timestamp: Date.now(),
        targetId: fac.instanceId,
        targetPos: { x: fac.x * CONSTANTS.CELL_SIZE, z: fac.z * CONSTANTS.CELL_SIZE }
      }});
    }
  }
}

// ═══════════════════════════════════
// Trash Generation
// ═══════════════════════════════════
function generateTrash() {
  const vCount = Object.keys(visitors).length;
  const trashCount = Math.floor(vCount * 0.02);
  for (let i = 0; i < trashCount; i++) {
    const vs = Object.values(visitors);
    if (vs.length === 0) break;
    const v = vs[Math.floor(Math.random() * vs.length)];
    const tId = `trash_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    trashPoints[tId] = { id: tId, pos: { ...v.pos }, amount: 1 };
  }
}

// ═══════════════════════════════════
// Satisfaction (PRD §5.3.3)
// ═══════════════════════════════════
function updateSatisfaction() {
  const vs = Object.values(visitors);
  if (vs.length === 0) { rating = 50; return; }

  // 1. Experience score (avg fun / rides)
  let totalFun = 0;
  for (const v of vs) totalFun += v.needs.fun;
  satExperience = Math.min(100, (totalFun / vs.length));

  // 2. Cleanliness (inverse of vomit + trash density)
  const dirtyCount = Object.keys(vomitPoints).length + Object.keys(trashPoints).length;
  satCleanliness = Math.max(0, 100 - dirtyCount * 3);

  // 3. Environment (Scenery boost)
  let totalEnvBoost = 0;
  let sceneryCount = 0;
  for (const fac of facilities) {
    const def = FACILITIES[fac.typeId];
    if (def?.category === 'scenery') {
      sceneryCount++;
      const maintenance = sceneryMaintenance[fac.instanceId] ?? 100;
      totalEnvBoost += (def.envBoost || 0) * (maintenance / 100);
    }
  }
  // Environment score based on scenery density and maintenance
  satEnvironment = Math.min(100, (sceneryCount * 5) + (totalEnvBoost / Math.max(1, sceneryCount / 2)));

  // 4. Value for money
  satValue = ticketPrice > 0 ? Math.max(20, 80 - ticketPrice * 2) : 70;

  // 5. Staff service
  const staffCount = Object.keys(staff).length;
  const cleanerCount = Object.values(staff).filter(s => s.type === 'cleaner').length;
  const entertainerCount = Object.values(staff).filter(s => s.type === 'entertainer').length;
  satService = Math.min(100, (cleanerCount * 15) + (entertainerCount * 20) + (staffCount * 5));

  // Balanced PRD weights with environment included
  rating = Math.floor(
    0.35 * satExperience +
    0.25 * satCleanliness +
    0.15 * satEnvironment +
    0.15 * satValue +
    0.10 * satService
  );
  rating = Math.max(0, Math.min(100, rating));

  self.postMessage({ type: 'RATING_UPDATE', payload: rating });
}

function updateSceneryDecay() {
  for (const fac of facilities) {
    if (FACILITIES[fac.typeId]?.category === 'scenery') {
      const current = sceneryMaintenance[fac.instanceId] ?? 100;
      sceneryMaintenance[fac.instanceId] = Math.max(0, current - 2); // 2% decay per day
    }
  }
}

// ═══════════════════════════════════
// Star Rating (PRD §4.4)
// ═══════════════════════════════════
function updateStarRating() {
  const vCount = Object.keys(visitors).length;
  let newStars = 0;
  for (const req of STAR_REQUIREMENTS) {
    if (rating >= req.satisfactionMin && vCount >= req.visitorMin) {
      newStars = req.stars;
    }
  }
  if (newStars > stars) {
    stars = newStars;
    self.postMessage({ type: 'STAR_UPDATE', payload: stars });
    self.postMessage({ type: 'MESSAGE', payload: {
      id: `msg_${Date.now()}`, text: `🌟 恭喜！公园已达到 ${'★'.repeat(stars)} 评级！`,
      priority: 'milestone', timestamp: Date.now()
    }});
  }
}

// ═══════════════════════════════════
// Monthly Settlement
// ═══════════════════════════════════
function doMonthlySettlement() {
  const staffCounts: Record<string, number> = {};
  for (const s of Object.values(staff)) {
    staffCounts[s.type] = (staffCounts[s.type] || 0) + 1;
  }

  const settlement = calcMonthlySettlement(
    facilities, staffCounts, loan, 0, monthRevenue
  );

  self.postMessage({ type: 'MONTH_SETTLEMENT', payload: {
    ...settlement,
    monthIndex: currentMonth,
    visitorPeak,
    satisfaction: rating,
  }});

  // Deduct expenses
  self.postMessage({ type: 'ECONOMY_UPDATE', payload: {
    type: 'SPEND', amount: -settlement.totalExpenses, reason: 'monthly'
  }});

  // Loan interest accrues
  loan.principal += loan.principal * loan.monthlyRate;

  monthRevenue = 0;
  visitorPeak = 0;

  self.postMessage({ type: 'MESSAGE', payload: {
    id: `msg_${Date.now()}`,
    text: `📊 月度结算: 收入 $${settlement.totalRevenue.toLocaleString()} | 支出 $${settlement.totalExpenses.toLocaleString()}`,
    priority: 'info', timestamp: Date.now()
  }});
}

/**
 * PRD §5.5.2: Intelligent Pricing System (ops_2)
 * Auto-adjusts ticket prices monthly based on park rating and demand.
 */
function applyIntelligentPricing() {
    for (const fac of facilities) {
        if (!FACILITIES[fac.typeId]) continue;
        const def = FACILITIES[fac.typeId];
        if (def.category === 'thrill' || def.category === 'gentle') {
            // If rating is high, we can push price up slightly
            if (rating > 80 && fac.ticketPrice < 15) {
                fac.ticketPrice += 1;
            } else if (rating < 50 && fac.ticketPrice > 3) {
                fac.ticketPrice -= 1;
            }
        }
    }
    self.postMessage({ type: 'MESSAGE', payload: {
        id: `msg_pricing_${Date.now()}`,
        text: '📈 智能调价系统已根据公园评级自动优化了设施价格',
        priority: 'info', timestamp: Date.now()
    }});
}

// ═══════════════════════════════════
// Frame Simulation (10 FPS)
// ═══════════════════════════════════
function simulateFrame() {
  const dt = 0.1 / currentSpeed; // seconds per sim frame
  simulateVisitors(dt);
  simulateStaff(dt);
}

// ═══════════════════════════════════
// Visitor Simulation (PRD §5.2)
// ═══════════════════════════════════
function simulateVisitors(dt: number) {
  const speed = 2.0;
  const now = Date.now();

  for (const vId in visitors) {
    const v = visitors[vId];

    // ── Needs decay ──
    v.needs.hunger = Math.max(0, v.needs.hunger - CONSTANTS.NEEDS.HUNGER_DECAY * dt);
    v.needs.thirst = Math.max(0, v.needs.thirst - CONSTANTS.NEEDS.THIRST_DECAY * dt);
    v.needs.toilet = Math.min(100, v.needs.toilet + CONSTANTS.NEEDS.TOILET_DECAY * dt);
    v.needs.fatigue = Math.min(100, v.needs.fatigue + CONSTANTS.NEEDS.FATIGUE_DECAY * dt);
    v.needs.fun = Math.max(0, v.needs.fun - CONSTANTS.NEEDS.FUN_DECAY * dt);

    // ── Entertainer buff ──
    for (const s of Object.values(staff)) {
      if (s.type === 'entertainer' && s.energy > 10) {
        const dx = s.pos.x - v.pos.x;
        const dz = s.pos.z - v.pos.z;
        if (dx * dx + dz * dz < (CONSTANTS.ENTERTAINER_RADIUS * CONSTANTS.CELL_SIZE) ** 2) {
          v.needs.fun = Math.min(100, v.needs.fun + 0.5 * dt);
          v.needs.fatigue = Math.max(0, v.needs.fatigue - 0.2 * dt);
        }
      }
    }

    // ── Weather effects ──
    if (weather === 'light_rain') {
      // Check if under weather tent
      const underTent = facilities.some(f =>
        f.typeId === 'weather_tent' &&
        Math.abs(v.pos.x - f.x * CONSTANTS.CELL_SIZE) < 6 &&
        Math.abs(v.pos.z - f.z * CONSTANTS.CELL_SIZE) < 6
      );
      if (!underTent) {
        v.satisfaction = Math.max(0, v.satisfaction - 0.3 * dt);
      }
    }

    // ── Scenery proximity boost (PRD §5.1.3) ──
    for (const fac of facilities) {
      const def = FACILITIES[fac.typeId];
      if (def?.category === 'scenery') {
        const dx = fac.x * CONSTANTS.CELL_SIZE - v.pos.x;
        const dz = fac.z * CONSTANTS.CELL_SIZE - v.pos.z;
        const radius = (def.envRadius || 3) * CONSTANTS.CELL_SIZE;
        if (dx * dx + dz * dz < radius * radius) {
          const maintenance = sceneryMaintenance[fac.instanceId] ?? 100;
          if (maintenance > 50) {
            v.satisfaction = Math.min(100, v.satisfaction + 0.1 * dt);
            v.needs.fun = Math.min(100, v.needs.fun + 0.05 * dt);
          }
        }
      }
    }

    // ── Vomiting ──
    if (v.needs.nausea > CONSTANTS.NEEDS.NAUSEA_VOMIT_THRESHOLD && v.state !== 'vomiting') {
      if (Math.random() < 0.02) {
        v.state = 'vomiting';
        const pId = `vomit_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        vomitPoints[pId] = { id: pId, pos: { ...v.pos } };
        v.needs.nausea = Math.max(0, v.needs.nausea - 30);
        v.satisfaction -= 10;
        setTimeout(() => { if (visitors[vId]) visitors[vId].state = 'idle'; }, 3000);
        continue;
      }
    }

    // ── Leave conditions ──
    if (v.satisfaction < 20 || v.money <= 0 ||
        (v.needs.hunger <= 0 && v.needs.thirst <= 0)) {
      v.state = 'leaving';
    }

    // ── State Machine ──
    switch (v.state) {
      case 'entering':
        v.state = 'idle';
        break;

      case 'idle':
        if (now - (v.lastDecisionTime || 0) > getDecisionFrequency()) {
            handleVisitorDecision(v);
            v.lastDecisionTime = now;
        }
        break;

      case 'walking':
        moveAlongPath(v, speed);
        break;

      case 'queuing': {
        // Check patience
        const waitTime = (now - v.queueStartTime) / 1000;
        if (waitTime > v.patience) {
          v.state = 'idle';
          v.satisfaction -= 5;
          v.targetFacilityId = null;
          v.targetPos = null;
        }
        // Facility processes them — handled elsewhere in ride tick
        break;
      }

      case 'riding':
        // Handled by timeout set when ride starts
        break;

      case 'eating':
        // Handled by timeout
        break;

      case 'resting':
        v.needs.fatigue = Math.max(0, v.needs.fatigue - 2 * dt);
        v.needs.nausea = Math.max(0, v.needs.nausea - 1 * dt);
        if (v.needs.fatigue < 20 && v.needs.nausea < 20) {
          v.state = 'idle';
        }
        break;

      case 'first_aid':
        v.needs.nausea = Math.max(0, v.needs.nausea - 5 * dt);
        if (v.needs.nausea < 10) {
          v.state = 'idle';
        }
        break;

      case 'vomiting':
        // Handled by timeout set above  
        break;

      case 'leaving': {
        const gridSize = roadGrid.length || CONSTANTS.GRID_SIZE;
        const entrance = { x: (gridSize / 2) * CONSTANTS.CELL_SIZE, z: 2 };
        const dx = entrance.x - v.pos.x;
        const dz = entrance.z - v.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < speed) {
          delete visitors[vId];
        } else {
          v.pos.x += (dx / dist) * speed;
          v.pos.z += (dz / dist) * speed;
        }
        break;
      }
    }
  }
}

// ═══════════════════════════════════
// Visitor Decision (PRD §5.2.4)
// ═══════════════════════════════════
function handleVisitorDecision(v: Visitor) {
  // Check urgent needs first
  if (v.needs.nausea > CONSTANTS.NEEDS.NAUSEA_FIRSTAID_THRESHOLD) {
    seekFacilityOfType(v, 'first_aid');
    return;
  }
  if (v.needs.toilet > CONSTANTS.NEEDS.TOILET_THRESHOLD) {
    seekFacilityOfType(v, 'restroom');
    return;
  }
  if (v.needs.fatigue > CONSTANTS.NEEDS.FATIGUE_THRESHOLD) {
    seekFacilityOfType(v, 'bench');
    if (v.state === 'walking') { v.state = 'walking'; return; }
    // No bench found; rest in place
    v.state = 'resting';
    return;
  }
  if (v.needs.hunger < CONSTANTS.NEEDS.HUNGER_THRESHOLD) {
    seekFacilityOfType(v, 'burger_stall') || seekFacilityOfType(v, 'restaurant');
    return;
  }
  if (v.needs.thirst < CONSTANTS.NEEDS.THIRST_THRESHOLD) {
    seekFacilityOfType(v, 'drink_stall');
    return;
  }

  // Fun seeking — utility scoring
  if (v.needs.fun < CONSTANTS.NEEDS.FUN_THRESHOLD || Math.random() < 0.15) {
    seekBestRide(v);
    return;
  }

  // Wander
  randomWander(v);
}

/**
 * PRD §5.5.2: Pathfinding/Decision efficiency optimization (ops_1)
 * If unlocked, the decision interval for visitors is slightly reduced globally.
 */
function getDecisionFrequency(): number {
    return unlockedTechs.includes('ops_1') ? 2000 : 3000;
}

function seekFacilityOfType(v: Visitor, typeId: string): boolean {
  const candidates = facilities.filter(f => {
    if (f.typeId !== typeId) return false;
    if (f.breakdown) return false;
    if (weather === 'heavy_rain' && FACILITIES[f.typeId]?.isOutdoor) return false;
    return true;
  });

  if (candidates.length === 0) return false;

  // Find nearest
  let nearest = candidates[0];
  let nearestDist = Infinity;
  for (const c of candidates) {
    const dx = c.x * CONSTANTS.CELL_SIZE - v.pos.x;
    const dz = c.z * CONSTANTS.CELL_SIZE - v.pos.z;
    const dist = dx * dx + dz * dz;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = c;
    }
  }

  setVisitorTarget(v, nearest);
  return true;
}

function seekBestRide(v: Visitor) {
  const prefs = CONSTANTS.AGE_PREFERENCES[v.ageGroup];
  let bestFac: PlacedFacility | null = null;
  let bestUtility = -Infinity;

  for (const fac of facilities) {
    const def = FACILITIES[fac.typeId];
    if (!def || fac.breakdown) continue;
    if (def.category !== 'thrill' && def.category !== 'gentle') continue;
    if (weather === 'heavy_rain' && def.isOutdoor) continue;

    const dx = fac.x * CONSTANTS.CELL_SIZE - v.pos.x;
    const dz = fac.z * CONSTANTS.CELL_SIZE - v.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Preference matching
    let prefMultiplier = 1.0;
    if (def.category === 'thrill') {
      prefMultiplier = (prefs?.thrillWeight || 1.0) * (v.excitementPref / 5);
    } else if (def.category === 'gentle') {
      prefMultiplier = (prefs?.gentleWeight || 1.0);
    }

    // Queue estimate (rough)
    const queueLen = countQueueFor(fac.instanceId);
    const queueTimeWeight = 1 + queueLen * 0.2;

    // Needs urgency
    const funUrgency = Math.max(1, (100 - v.needs.fun) / 20);

    // Utility = appeal × preference / (distance × queue) × urgency
    const appeal = def.appeal || 50;
    const utility = (appeal * prefMultiplier) / (Math.max(1, dist / CONSTANTS.CELL_SIZE) * queueTimeWeight) * funUrgency;

    // Price check
    const price = fac.ticketPrice || DEFAULT_TICKET_PRICES[fac.typeId] || 5;
    if (price > v.money) continue;

    // Acceptance rate
    const acceptance = calcAcceptanceRate(fac.typeId, price);
    if (Math.random() > acceptance * v.spendingWillingness) continue;

    if (utility > bestUtility) {
      bestUtility = utility;
      bestFac = fac;
    }
  }

  if (bestFac) {
    setVisitorTarget(v, bestFac);
  } else {
    randomWander(v);
  }
}

function countQueueFor(facilityId: string): number {
  let count = 0;
  for (const v of Object.values(visitors)) {
    if (v.targetFacilityId === facilityId && (v.state === 'queuing' || v.state === 'walking')) {
      count++;
    }
  }
  return count;
}

function setVisitorTarget(v: Visitor, fac: PlacedFacility) {
  const def = FACILITIES[fac.typeId];
  if (!def) return;

  const targetX = fac.x + Math.floor(def.sizeX / 2);
  const targetZ = fac.z + Math.floor(def.sizeZ / 2);

  // A* pathfinding
  const startGrid = {
    x: Math.floor(v.pos.x / CONSTANTS.CELL_SIZE),
    z: Math.floor(v.pos.z / CONSTANTS.CELL_SIZE)
  };

  if (weightGrid.length > 0) {
    const path = findPath(weightGrid, startGrid, { x: targetX, z: targetZ });
    if (path.length > 0) {
      v.path = path.map(p => ({ x: p.x * CONSTANTS.CELL_SIZE + CONSTANTS.CELL_SIZE / 2, z: p.z * CONSTANTS.CELL_SIZE + CONSTANTS.CELL_SIZE / 2 }));
      v.pathIndex = 0;
      v.targetFacilityId = fac.instanceId;
      v.state = 'walking';
      return;
    }
  }

  // Fallback: direct walk
  v.targetPos = {
    x: fac.x * CONSTANTS.CELL_SIZE + (def.sizeX * CONSTANTS.CELL_SIZE) / 2,
    z: fac.z * CONSTANTS.CELL_SIZE + (def.sizeZ * CONSTANTS.CELL_SIZE) / 2,
  };
  v.targetFacilityId = fac.instanceId;
  v.state = 'walking';
}

function randomWander(v: Visitor) {
  const gridSize = roadGrid.length || CONSTANTS.GRID_SIZE;
  v.targetPos = {
    x: Math.max(2, Math.min(gridSize * CONSTANTS.CELL_SIZE - 2, v.pos.x + (Math.random() - 0.5) * 20)),
    z: Math.max(2, Math.min(gridSize * CONSTANTS.CELL_SIZE - 2, v.pos.z + (Math.random() - 0.5) * 20)),
  };
  v.targetFacilityId = null;
  v.path = [];
  v.state = 'walking';
}

function moveAlongPath(v: Visitor, speed: number) {
  // Use A* path if available
  if (v.path.length > 0 && v.pathIndex < v.path.length) {
    const target = v.path[v.pathIndex];
    const dx = target.x - v.pos.x;
    const dz = target.z - v.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < speed) {
      v.pos = { ...target };
      v.pathIndex++;

      if (v.pathIndex >= v.path.length) {
        // Arrived at destination
        arriveAtTarget(v);
      }
    } else {
      v.pos.x += (dx / dist) * speed;
      v.pos.z += (dz / dist) * speed;
    }
    return;
  }

  // Fallback to direct movement
  if (v.targetPos) {
    const dx = v.targetPos.x - v.pos.x;
    const dz = v.targetPos.z - v.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < speed) {
      v.pos = { ...v.targetPos };
      arriveAtTarget(v);
    } else {
      v.pos.x += (dx / dist) * speed;
      v.pos.z += (dz / dist) * speed;
    }
  } else {
    v.state = 'idle';
  }
}

function arriveAtTarget(v: Visitor) {
  if (!v.targetFacilityId) {
    v.state = 'idle';
    return;
  }

  const fac = facilities.find(f => f.instanceId === v.targetFacilityId);
  if (!fac) { v.state = 'idle'; v.targetFacilityId = null; return; }

  const def = FACILITIES[fac.typeId];
  if (!def) { v.state = 'idle'; return; }

  // Check capacity
  const queueLen = countQueueFor(fac.instanceId);
  const capacity = def.capacity || 20;

  if (queueLen > capacity * 2) {
    v.satisfaction -= 3;
    v.state = 'idle';
    v.targetFacilityId = null;
    return;
  }

  // Handle by facility type
  if (def.category === 'thrill' || def.category === 'gentle') {
    // Queuing
    v.state = 'queuing';
    v.queueStartTime = Date.now();

    // Process ride after simulated queue wait
    const waitMs = Math.min(queueLen * 2000, 10000);
    setTimeout(() => {
      if (!visitors[v.id] || visitors[v.id].state !== 'queuing') return;

      const currentFac = facilities.find(f => f.instanceId === v.targetFacilityId);
      if (!currentFac || currentFac.breakdown) {
        v.state = 'idle';
        v.satisfaction -= 5;
        return;
      }

      // Start riding
      v.state = 'riding';
      const price = currentFac.ticketPrice || DEFAULT_TICKET_PRICES[currentFac.typeId] || 5;
      v.money -= price;
      monthRevenue += price;
      self.postMessage({ type: 'ECONOMY_UPDATE', payload: { type: 'INCOME', amount: price, reason: 'ride' } });

      // Apply effects
      const excitement = def.excitement || 0;
      const nauseaVal = def.nausea || 0;
      v.needs.fun = Math.min(100, v.needs.fun + excitement * 8);
      const nauseaIncrease = nauseaVal * (1 - v.nauseaTolerance / 10);
      v.needs.nausea = Math.min(100, v.needs.nausea + nauseaIncrease * 3);

      // Consecutive high nausea
      if (nauseaVal > 5 && v.lastHighNauseaRide) {
        v.needs.nausea = Math.min(100, v.needs.nausea + 20);
      }
      v.lastHighNauseaRide = nauseaVal > 5;

      v.satisfaction += excitement * 2;
      v.ridesCount++;
      currentFac.totalRides++;

      // Ride duration
      const duration = def.rideDuration || 15000;
      setTimeout(() => {
        if (visitors[v.id]) {
          visitors[v.id].state = 'idle';
          visitors[v.id].targetFacilityId = null;
        }
      }, Math.min(duration / currentSpeed, 5000));
    }, waitMs / currentSpeed);

  } else if (def.category === 'shop') {
    // Eating/drinking
    v.state = 'eating';
    const price = fac.ticketPrice || DEFAULT_TICKET_PRICES[fac.typeId] || 4;
    v.money -= price;
    monthRevenue += price;
    self.postMessage({ type: 'ECONOMY_UPDATE', payload: { type: 'INCOME', amount: price, reason: 'shop' } });

    if (fac.typeId === 'burger_stall' || fac.typeId === 'restaurant') {
      v.needs.hunger = Math.min(100, v.needs.hunger + 50);
    }
    if (fac.typeId === 'drink_stall') {
      v.needs.thirst = Math.min(100, v.needs.thirst + 60);
    }
    if (fac.typeId === 'restaurant') {
      v.needs.hunger = Math.min(100, v.needs.hunger + 70);
      v.needs.thirst = Math.min(100, v.needs.thirst + 30);
    }

    setTimeout(() => {
      if (visitors[v.id]) {
        visitors[v.id].state = 'idle';
        visitors[v.id].targetFacilityId = null;
      }
    }, 3000 / currentSpeed);

  } else if (fac.typeId === 'restroom') {
    v.needs.toilet = 0;
    v.state = 'idle';
    v.targetFacilityId = null;

  } else if (fac.typeId === 'bench') {
    v.state = 'resting';
    v.targetFacilityId = null;

  } else if (fac.typeId === 'first_aid') {
    v.state = 'first_aid';
    v.targetFacilityId = null;

  } else {
    v.state = 'idle';
    v.targetFacilityId = null;
  }
}

// ═══════════════════════════════════
// Staff Simulation (PRD §5.4)
// ═══════════════════════════════════
function simulateStaff(dt: number) {
  const speed = 2.5;
  const now = Date.now();

  for (const sId in staff) {
    const s = staff[sId];

    // Entertainer rest cycle
    if (s.type === 'entertainer') {
      if (s.restingUntil > now) continue;
      s.energy = Math.max(0, s.energy - 0.05 * dt);
      if (s.energy <= 0) {
        s.restingUntil = now + CONSTANTS.ENTERTAINER_REST_DURATION;
        s.energy = 100;
        s.targetPos = null;
        continue;
      }
    }

    if (!s.targetPos) {
      findStaffWork(s, now);
    }

    if (s.targetPos) {
      const dx = s.targetPos.x - s.pos.x;
      const dz = s.targetPos.z - s.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const staffSpeed = (CONSTANTS.STAFF_SPEED[s.type] || 1.0) * speed;

      if (dist < staffSpeed) {
        s.pos = { ...s.targetPos };
        handleStaffArrival(s);
        s.targetPos = null;
        s.targetInstanceId = null;
      } else {
        s.pos.x += (dx / dist) * staffSpeed;
        s.pos.z += (dz / dist) * staffSpeed;
      }
    }
  }
}

function isInPatrolZone(s: Staff, x: number, z: number): boolean {
  const gx = x / CONSTANTS.CELL_SIZE;
  const gz = z / CONSTANTS.CELL_SIZE;
  return gx >= s.patrolZone.x && gx < s.patrolZone.x + s.patrolZone.w &&
         gz >= s.patrolZone.z && gz < s.patrolZone.z + s.patrolZone.h;
}

function findStaffWork(s: Staff, now: number) {
  const zone = s.patrolZone;

  switch (s.type) {
    case 'cleaner': {
      // Priority: vomit > full trash > regular trash
      // 1. Vomit in zone
      for (const v of Object.values(vomitPoints)) {
        if (isInPatrolZone(s, v.pos.x, v.pos.z)) {
          s.targetPos = { ...v.pos };
          s.targetInstanceId = v.id;
          return;
        }
      }
      // 2. Trash in zone
      for (const t of Object.values(trashPoints)) {
        if (isInPatrolZone(s, t.pos.x, t.pos.z)) {
          s.targetPos = { ...t.pos };
          s.targetInstanceId = t.id;
          return;
        }
      }
      // 3. Scenery maintenance (PRD §5.4.3: Flower watering)
      for (const fac of facilities) {
        if (FACILITIES[fac.typeId]?.category === 'scenery') {
          const maintenance = sceneryMaintenance[fac.instanceId] ?? 100;
          if (maintenance < 70 && isInPatrolZone(s, fac.x * CONSTANTS.CELL_SIZE, fac.z * CONSTANTS.CELL_SIZE)) {
            s.targetPos = {
              x: fac.x * CONSTANTS.CELL_SIZE + (FACILITIES[fac.typeId].sizeX * CONSTANTS.CELL_SIZE) / 2,
              z: fac.z * CONSTANTS.CELL_SIZE + (FACILITIES[fac.typeId].sizeZ * CONSTANTS.CELL_SIZE) / 2
            };
            s.targetInstanceId = fac.instanceId;
            return;
          }
        }
      }
      break;
    }

    case 'mechanic': {
      // Check if inspection is due
      if (now - s.lastInspectionTime > CONSTANTS.MECHANIC_INSPECT_INTERVAL) {
        // Find broken facilities in zone
        const broken = facilities.filter(f =>
          f.breakdown && isInPatrolZone(s, f.x * CONSTANTS.CELL_SIZE, f.z * CONSTANTS.CELL_SIZE)
        );
        if (broken.length > 0) {
          const target = broken[0];
          const def = FACILITIES[target.typeId];
          if (def) {
            s.targetPos = {
              x: target.x * CONSTANTS.CELL_SIZE + (def.sizeX * CONSTANTS.CELL_SIZE) / 2,
              z: target.z * CONSTANTS.CELL_SIZE + (def.sizeZ * CONSTANTS.CELL_SIZE) / 2,
            };
            s.targetInstanceId = target.instanceId;
            return;
          }
        }
        s.lastInspectionTime = now;
      }
      break;
    }

    case 'security': {
      // Check for vandalism (based on crowding × teen ratio)
      const vInZone = Object.values(visitors).filter(v =>
        isInPatrolZone(s, v.pos.x, v.pos.z)
      );
      const teens = vInZone.filter(v => v.ageGroup === 'teen').length;
      const crowding = vInZone.length / (zone.w * zone.h + 1);
      const vandalChance = crowding * 0.01 * (teens / (vInZone.length || 1));

      if (Math.random() < vandalChance) {
        // Find nearest teen
        if (teens > 0) {
          const teen = vInZone.find(v => v.ageGroup === 'teen')!;
          s.targetPos = { ...teen.pos };
          s.targetInstanceId = teen.id;
          return;
        }
      }
      break;
    }

    case 'entertainer':
      // Already handled: just wander in zone
      break;
  }

  // Wander within patrol zone
  s.targetPos = {
    x: (zone.x + Math.random() * zone.w) * CONSTANTS.CELL_SIZE,
    z: (zone.z + Math.random() * zone.h) * CONSTANTS.CELL_SIZE,
  };
}

function handleStaffArrival(s: Staff) {
  if (!s.targetInstanceId) return;

  switch (s.type) {
    case 'cleaner':
      // Clean vomit
      if (vomitPoints[s.targetInstanceId]) {
        delete vomitPoints[s.targetInstanceId];
      }
      // Clean trash
      if (trashPoints[s.targetInstanceId]) {
        delete trashPoints[s.targetInstanceId];
      }
      // Maintain scenery
      if (sceneryMaintenance[s.targetInstanceId] !== undefined) {
        sceneryMaintenance[s.targetInstanceId] = 100;
      }
      break;

    case 'mechanic':
      // Repair facility
      const fac = facilities.find(f => f.instanceId === s.targetInstanceId);
      if (fac && fac.breakdown) {
        // Repair takes time
        const baseRepairTime = CONSTANTS.MECHANIC_REPAIR_TIME;
        const actualRepairTime = unlockedTechs.includes('service_2') ? 8000 : baseRepairTime; // Medical/Service upgrade helps toolkit
        
        setTimeout(() => {
          const f = facilities.find(ff => ff.instanceId === s.targetInstanceId);
          if (f) {
            f.breakdown = false;
            f.lastRepairDay = currentDay;
            self.postMessage({ type: 'FACILITY_FIXED', payload: f.instanceId });
            self.postMessage({ type: 'MESSAGE', payload: {
              id: `msg_${Date.now()}`,
              text: `🔧 ${FACILITIES[f.typeId]?.name || '设施'} 已修复`,
              priority: 'info', timestamp: Date.now()
            }});
          }
        }, actualRepairTime / currentSpeed);
      }
      break;

    case 'security':
      // Prevent vandalism — deter nearby teens
      const nearby = Object.values(visitors).filter(v => {
        const dx = v.pos.x - s.pos.x;
        const dz = v.pos.z - s.pos.z;
        return dx * dx + dz * dz < 100 && v.ageGroup === 'teen';
      });
      for (const v of nearby) {
        v.satisfaction -= 2; // Deterrent effect
      }
      break;
  }
}
