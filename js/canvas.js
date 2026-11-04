// canvas.js : dessin manuscrit des post-its

let canvas, ctx, isDrawing = false;
window.initCanvas = function() {
  canvas = document.getElementById('p-canvas'); if (!canvas) return; ctx = canvas.getContext('2d'); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#090A0F';
  canvas.addEventListener('pointerdown', (e) => { isDrawing = true; const rect = canvas.getBoundingClientRect(); ctx.beginPath(); ctx.moveTo((e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height)); });
  canvas.addEventListener('pointermove', (e) => { if (!isDrawing) return; const rect = canvas.getBoundingClientRect(); ctx.lineTo((e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height)); ctx.stroke(); });
  const stopDrawing = () => { isDrawing = false; }; canvas.addEventListener('pointerup', stopDrawing); canvas.addEventListener('pointerout', stopDrawing);
};
window.clearCanvas = function() { if(ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height); };

