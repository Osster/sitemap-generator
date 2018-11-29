var timer = setInterval(() => {
  const h1 = document.getElementById('title-h1');
  if (h1) {
    const status = h1.getAttribute('data-status');
    if (status === 'in_progress') {
      document.location.reload();
    } else {
      clearInterval(timer);
    }
  }
}, 3000);