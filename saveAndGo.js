function saveAndGo() {
  const fieldIds = ['fico', 'tib', 'industry', 'state', 'amount', 'revenue', 'adb', 'ned', 'positions'];
  const data = {};

  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    data[id] = el ? (el.value || el.textContent || '-') : '-';
  });

  localStorage.setItem('borrowerData', JSON.stringify(data));
  window.location.href = 'lender.html';
}
