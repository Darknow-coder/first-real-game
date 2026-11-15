// Touch / mouse steering: relative drag anywhere on the play area.
export class Input {
  constructor(el) {
    this.el = el;
    this.enabled = false;
    this.active = false;
    this.id = null;
    this.lastX = 0;
    this.lastY = 0;
    this.dx = 0;
    this.dy = 0;
    this.unitsPerPx = 1;
    this.sensitivity = 1;
    this.touched = false; // at least one interaction this run
    el.addEventListener('pointerdown', (e) => this.down(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
  }

  down(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this.active = true;
    this.touched = true;
    this.id = e.pointerId;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* not supported */
    }
  }

  move(e) {
    if (!this.enabled || !this.active || e.pointerId !== this.id) return;
    const k = this.unitsPerPx * this.sensitivity * 1.15;
    this.dx += (e.clientX - this.lastX) * k;
    this.dy += (e.clientY - this.lastY) * k;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  up(e) {
    if (e.pointerId === this.id) {
      this.active = false;
      this.id = null;
    }
  }

  consume() {
    const out = { dx: this.dx, dy: this.dy, active: this.active };
    this.dx = 0;
    this.dy = 0;
    return out;
  }

  reset() {
    this.dx = 0;
    this.dy = 0;
    this.active = false;
    this.id = null;
    this.touched = false;
  }
}
