import type { PlacedFacility, LoanState, MonthData, TicketMode } from '../types';
import { CONSTANTS } from '../config/constants';
import { FACILITIES, DEFAULT_TICKET_PRICES } from '../config/facilities';

/**
 * EconomySystem: self-contained economy calculations.
 * Can run in both main thread and web worker.
 */

// ─────────────────────────────────
// Ticket & Pricing
// ─────────────────────────────────

/** Calculate visitor acceptance rate for a facility's ticket price */
export function calcAcceptanceRate(facilityTypeId: string, setPrice: number): number {
  const defaultPrice = DEFAULT_TICKET_PRICES[facilityTypeId] || 5;
  const rate = 1 - 0.4 * (setPrice - defaultPrice) / defaultPrice;
  return Math.max(0, Math.min(1, rate));
}

/** Calculate entry ticket demand reduction */
export function calcTicketDemandMultiplier(ticketPrice: number): number {
  if (ticketPrice <= 0) return 1.0;
  const reduction = (ticketPrice / 10) * CONSTANTS.TICKET_DEMAND_PENALTY;
  return Math.max(0.2, 1 - reduction);
}

// ─────────────────────────────────
// Shop Sales
// ─────────────────────────────────

export function calcShopRevenue(facilityTypeId: string, setPrice: number, visitors: number): number {
  const defaultPrice = DEFAULT_TICKET_PRICES[facilityTypeId] || 4;
  const costRate = FACILITIES[facilityTypeId]?.costRate || 0.3;
  
  const baseSales = visitors * 0.1; // 10% of nearby visitors buy
  const sales = baseSales * (1 - 0.5 * (setPrice - defaultPrice) / defaultPrice);
  const actualSales = Math.max(0, Math.floor(sales));
  const cost = setPrice * costRate;
  const profit = actualSales * (setPrice - cost);
  
  return profit;
}

// ─────────────────────────────────
// Monthly Settlement
// ─────────────────────────────────

export interface MonthlySettlement {
  totalRevenue: number;
  totalExpenses: number;
  maintenanceCost: number;
  staffSalaries: number;
  loanInterest: number;
  researchCost: number;
  netIncome: number;
}

export function calcMonthlySettlement(
  facilities: PlacedFacility[],
  staffCounts: Record<string, number>,
  loan: LoanState,
  researchBudget: number,
  monthRevenue: number
): MonthlySettlement {
  // Maintenance: buildCost × 2% per month for each facility
  let maintenanceCost = 0;
  for (const fac of facilities) {
    const def = FACILITIES[fac.typeId];
    if (def) {
      maintenanceCost += def.monthlyUpkeep;
    }
  }

  // Staff salaries
  let staffSalaries = 0;
  for (const [type, count] of Object.entries(staffCounts)) {
    staffSalaries += (CONSTANTS.STAFF_SALARY[type] || 0) * count;
  }

  // Loan interest
  const loanInterest = loan.principal * loan.monthlyRate;

  // Research
  const researchCost = researchBudget;

  const totalExpenses = maintenanceCost + staffSalaries + loanInterest + researchCost;
  const totalRevenue = monthRevenue;
  const netIncome = totalRevenue - totalExpenses;

  return {
    totalRevenue,
    totalExpenses,
    maintenanceCost,
    staffSalaries,
    loanInterest,
    researchCost,
    netIncome,
  };
}

// ─────────────────────────────────
// Demolish refund
// ─────────────────────────────────

export function calcDemolishRefund(facility: PlacedFacility, currentDay: number): number {
  const def = FACILITIES[facility.typeId];
  if (!def) return 0;

  const daysSinceBuilt = currentDay - facility.builtOnDay;
  const rate = daysSinceBuilt <= 30
    ? CONSTANTS.DEMOLISH_REFUND_RATE_FIRST_MONTH
    : CONSTANTS.DEMOLISH_REFUND_RATE;

  return Math.floor(def.buildCost * rate);
}

// ─────────────────────────────────
// Loan
// ─────────────────────────────────

export function canTakeLoan(currentLoan: LoanState, amount: number): boolean {
  return currentLoan.principal + amount <= currentLoan.maxLoan;
}

export function takeLoan(currentLoan: LoanState, amount: number): LoanState {
  return {
    ...currentLoan,
    principal: currentLoan.principal + amount,
  };
}

export function repayLoan(currentLoan: LoanState, amount: number): LoanState {
  const repay = Math.min(amount, currentLoan.principal);
  return {
    ...currentLoan,
    principal: currentLoan.principal - repay,
  };
}

export function createDefaultLoan(): LoanState {
  return {
    principal: 0,
    monthlyRate: CONSTANTS.LOAN_MONTHLY_RATE,
    maxLoan: CONSTANTS.MAX_LOAN,
  };
}
