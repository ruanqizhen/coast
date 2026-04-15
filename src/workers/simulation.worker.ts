// simulation.worker.ts
import type { Visitor, Staff, VomitPoint, PlacedFacility } from '../types';
import { CONSTANTS } from '../config/constants';
import { FACILITIES } from '../config/facilities';

let dayInterval: number | null = null;
let simInterval: number | null = null;

const DAY_TICK_RATE = 1000;
let currentSpeed = 1;

// Mini-state in worker
let visitors: Record<string, Visitor> = {};
let staff: Record<string, Staff> = {};
let vomitPoints: Record<string, VomitPoint> = {};
let facilities: PlacedFacility[] = [];

// Park settings
let rating = 50;
let weather: 'sunny' | 'cloudy' | 'rain' = 'sunny';

self.onmessage = (e) => {
  const { type, payload } = e.data;
  
  if (type === 'START') {
    startLoops();
  } else if (type === 'STOP') {
    stopLoops();
  } else if (type === 'SET_SPEED') {
    currentSpeed = payload.speed;
    stopLoops();
    if (currentSpeed > 0) startLoops();
  } else if (type === 'SYNC_FACILITIES') {
    facilities = payload;
  } else if (type === 'SPAWN_STAFF') {
    const sId = `staff_${Date.now()}`;
    staff[sId] = {
      id: sId,
      type: payload.type,
      pos: { x: payload.x * CONSTANTS.CELL_SIZE, z: payload.z * CONSTANTS.CELL_SIZE },
      targetPos: null,
      targetInstanceId: null
    };
  }
};

function startLoops() {
  if (dayInterval === null) {
    dayInterval = self.setInterval(() => {
      self.postMessage({ type: 'DAY_TICK' });
      simulateDayTick();
    }, DAY_TICK_RATE / currentSpeed);
  }
  if (simInterval === null) {
    simInterval = self.setInterval(() => {
      simulateFrame();
      // Send batched state
      self.postMessage({ 
        type: 'SIM_UPDATE', 
        payload: { visitors, staff, vomitPoints } 
      });
    }, 100 / currentSpeed); // 10 FPS Simulation
  }
}

function stopLoops() {
  if (dayInterval !== null) self.clearInterval(dayInterval);
  if (simInterval !== null) self.clearInterval(simInterval);
  dayInterval = null;
  simInterval = null;
}

function simulateDayTick() {
  // Visitor spawner
  const vCount = Object.keys(visitors).length;
  const targetVisitors = Math.min(1000, 50 + rating * 8); // simplified logic
  
  if (vCount < targetVisitors && Math.random() > 0.5) {
    const vId = `vis_${Date.now()}_${Math.floor(Math.random()*100)}`;
    visitors[vId] = {
      id: vId,
      pos: { x: CONSTANTS.GRID_SIZE * CONSTANTS.CELL_SIZE / 2, z: 2 }, // Entrance at center bottom
      targetPos: null,
      targetFacilityId: null,
      state: 'idle',
      money: 50 + Math.random() * 50,
      needs: { hunger: 0, thirst: 0, toilet: 0, fatigue: 0, nausea: 0, fun: 0 }
    };
  }

  // Weather cycler
  if (Math.random() < 0.05) {
    const rand = Math.random();
    weather = rand < 0.5 ? 'sunny' : rand < 0.8 ? 'cloudy' : 'rain';
    self.postMessage({ type: 'WEATHER_UPDATE', payload: weather });
  }
  
  // Breakdown mechanics
  facilities.forEach(fac => {
    if (!fac.breakdown && Math.random() < 0.005) {
        self.postMessage({ type: 'FACILITY_BREAKDOWN', payload: fac.instanceId });
    }
  });

  // Calculate Satisfaction
  const totalNausea = Object.values(visitors).reduce((acc, v) => acc + v.needs.nausea, 0);
  const avgNausea = vCount > 0 ? totalNausea / vCount : 0;
  const cleanScore = 100 - (Object.keys(vomitPoints).length * 5);
  
  rating = Math.max(0, Math.min(100, Math.floor((cleanScore + (100 - avgNausea)) / 2)));
  self.postMessage({ type: 'RATING_UPDATE', payload: rating });
}

function simulateFrame() {
  // Constants for movement
  const speed = 2.0;

  // Simulate Visitors
  for (const vId in visitors) {
    const v = visitors[vId];
    
    // Needs decay
    v.needs.hunger += 0.01;
    v.needs.thirst += 0.01;
    v.needs.fatigue += 0.005;
    
    if (v.needs.nausea > 50 && Math.random() < 0.01) {
      const pId = `vomit_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      vomitPoints[pId] = { id: pId, pos: { ...v.pos } };
      v.needs.nausea = 0; // Reset after vomiting
    }

    if (v.needs.hunger > 100 || v.needs.thirst > 100 || v.needs.fatigue > 100) {
      v.state = 'leaving';
    }

    if (v.state === 'idle') {
      // Find a facility
      if (facilities.length > 0 && Math.random() < 0.1) {
         const target = facilities[Math.floor(Math.random() * facilities.length)];
         const w = FACILITIES[target.typeId].sizeX * CONSTANTS.CELL_SIZE;
         const h = FACILITIES[target.typeId].sizeZ * CONSTANTS.CELL_SIZE;
         
         v.targetFacilityId = target.instanceId;
         v.targetPos = {
             x: (target.x * CONSTANTS.CELL_SIZE) + w/2,
             z: (target.z * CONSTANTS.CELL_SIZE) + h/2
         };
         v.state = 'walking';
      } else {
         // Random wander
         v.targetPos = {
             x: v.pos.x + (Math.random() - 0.5) * 20,
             z: v.pos.z + (Math.random() - 0.5) * 20
         };
         v.state = 'walking';
      }
    } else if (v.state === 'walking' && v.targetPos) {
      const dx = v.targetPos.x - v.pos.x;
      const dz = v.targetPos.z - v.pos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      
      if (dist < speed) {
        v.pos = { ...v.targetPos };
        if (v.targetFacilityId) {
            // Arrived at ride
            v.state = 'riding';
            const fDef = FACILITIES[facilities.find(f => f.instanceId === v.targetFacilityId)!.typeId];
            
            // Apply effects
            v.needs.fun = Math.min(100, v.needs.fun + (fDef.excitement || 0) * 10);
            v.needs.nausea += (fDef.nausea || 0) * 5;
            
            // Spend money
            self.postMessage({ type: 'ECONOMY_UPDATE', payload: { type: 'SPEND', amount: 5 } });
            
            // Delay and leave
            setTimeout(() => {
               if(visitors[vId]) visitors[vId].state = 'idle';
            }, 2000);
        } else {
            v.state = 'idle';
        }
      } else {
        v.pos.x += (dx / dist) * speed;
        v.pos.z += (dz / dist) * speed;
      }
    } else if (v.state === 'leaving') {
      const entrance = { x: CONSTANTS.GRID_SIZE * CONSTANTS.CELL_SIZE / 2, z: 2 };
      const dx = entrance.x - v.pos.x;
      const dz = entrance.z - v.pos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < speed) {
        delete visitors[vId];
      } else {
        v.pos.x += (dx / dist) * speed;
        v.pos.z += (dz / dist) * speed;
      }
    }
  }

  // Simulate Staff
  for (const sId in staff) {
    const s = staff[sId];
    if (!s.targetPos) {
       // Find work
       if (s.type === 'cleaner') {
          const vomits = Object.values(vomitPoints);
          if (vomits.length > 0) {
             const target = vomits[0];
             s.targetPos = target.pos;
             s.targetInstanceId = target.id;
          } else {
             // Wander
             s.targetPos = {
               x: s.pos.x + (Math.random() - 0.5) * 10,
               z: s.pos.z + (Math.random() - 0.5) * 10
             };
          }
       } else if (s.type === 'mechanic') {
          const broken = facilities.filter(f => f.breakdown);
          if (broken.length > 0) {
              const target = broken[0];
              const w = FACILITIES[target.typeId].sizeX * CONSTANTS.CELL_SIZE;
              const h = FACILITIES[target.typeId].sizeZ * CONSTANTS.CELL_SIZE;
              s.targetPos = { x: target.x * CONSTANTS.CELL_SIZE + w/2, z: target.z * CONSTANTS.CELL_SIZE + h/2 };
              s.targetInstanceId = target.instanceId;
          } else {
             s.targetPos = {
               x: s.pos.x + (Math.random() - 0.5) * 10,
               z: s.pos.z + (Math.random() - 0.5) * 10
             };
          }
       }
    }

    if (s.targetPos) {
      const dx = s.targetPos.x - s.pos.x;
      const dz = s.targetPos.z - s.pos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      
      if (dist < speed * 1.5) { // Staff faster
        s.pos = { ...s.targetPos };
        
        if (s.type === 'cleaner' && s.targetInstanceId) {
           delete vomitPoints[s.targetInstanceId];
        } else if (s.type === 'mechanic' && s.targetInstanceId) {
           self.postMessage({ type: 'FACILITY_FIXED', payload: s.targetInstanceId });
        }
        
        s.targetPos = null;
        s.targetInstanceId = null;
      } else {
        s.pos.x += (dx / dist) * speed * 1.5;
        s.pos.z += (dz / dist) * speed * 1.5;
      }
    }
  }
}
