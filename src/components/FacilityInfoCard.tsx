import React from 'react';
import { useParkState } from '../store/useParkState';
import './FacilityInfoCard.css';

/**
 * FacilityInfoCard – shows details of the currently selected facility.
 * Includes queue length, waiting time, income, breakdown status and actions.
 */
export const FacilityInfoCard: React.FC = () => {
  const selectedFacilityId = useParkState(state => state.selectedFacilityId);
  const facilities = useParkState(state => state.facilities);
  const setFacilities = useParkState(state => state.setFacilities);

  if (!selectedFacilityId) return null;
  const facility = facilities.find(f => f.instanceId === selectedFacilityId);
  if (!facility) return null;

  const handleToggleBreakdown = () => {
    const updated = facilities.map(f =>
      f.instanceId === selectedFacilityId ? { ...f, breakdown: !f.breakdown } : f
    );
    setFacilities(updated);
  };

  return (
    <div className="facility-info-card">
      <h3>{facility.typeId.toUpperCase()}</h3>
      <p>Position: ({facility.x}, {facility.z})</p>
      <p>Breakdown: {facility.breakdown ? 'Yes' : 'No'}</p>
      <button onClick={handleToggleBreakdown}>
        {facility.breakdown ? 'Repair' : 'Break'}
      </button>
    </div>
  );
};
