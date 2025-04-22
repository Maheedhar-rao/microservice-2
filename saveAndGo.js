function saveAndGo() {
  const data = {
    minFICO: parseInt(document.getElementById('fico')?.value || '0'),
    minRevenueMonthly: parseInt(document.getElementById('revenue')?.value || '0'),
    minTIB: parseInt(document.getElementById('tib')?.value || '0'),
    minADB: parseInt(document.getElementById('adb')?.value || '0'),
    maxNegativeDaysPerMonth: parseInt(document.getElementById('ned')?.value || '0'),
    industry: document.getElementById('industry')?.value?.trim().toLowerCase() || '-',
    restrictedStates: document.getElementById('state')?.value?.trim().toUpperCase() || '-',
    fundingRequested: parseInt(document.getElementById('amount')?.value || '0'),
    positions: parseInt(document.getElementById('positions')?.value || '1'), // Optional
    bankruptcy: document.getElementById('bankruptcy')?.value || 'no'
  };

  localStorage.setItem('borrowerData', JSON.stringify(data));
  window.location.href = 'lender.html';
}
