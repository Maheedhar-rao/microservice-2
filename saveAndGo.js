function saveAndRedirect() {
  const data = {
    minFICO: parseInt(document.getElementById('minFICO')?.value || '0'),
    minRevenueMonthly: parseInt(document.getElementById('minRevenueMonthly')?.value || '0'),
    minTIB: parseInt(document.getElementById('minTIB')?.value || '0'),
    minADB: parseInt(document.getElementById('minADB')?.value || '0'),
    maxNegativeDaysPerMonth: parseInt(document.getElementById('maxNegativeDaysPerMonth')?.value || '0'),
    bankruptcy: document.getElementById('bankruptcy')?.value || 'no',
    industry: document.getElementById('industry')?.value?.trim().toLowerCase() || '-',
    restrictedStates: document.getElementById('restrictedStates')?.value?.trim().toUpperCase() || '-',
    fundingRequested: parseInt(document.getElementById('fundingRequested')?.value || '0'),
    positions: parseInt(document.getElementById('positions')?.value?.replace(/\D/g, '') || '1')
  };

  localStorage.setItem('borrowerData', JSON.stringify(data));
  window.location.href = 'lender.html';
}
