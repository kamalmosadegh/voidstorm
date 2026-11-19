// Keyboard and mouse state: the rest of the game reads intent from here
// (move axes, aim point, fire and dash held, and one-shot key presses).

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    this.clicked = false;

    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      this.mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.clicked = true;
      }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
  }

  /** Movement axes, each -1, 0 or 1, from WASD or the arrow keys. */
  moveAxes() {
    const x = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
    const y = (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0);
    return { x, y };
  }

  get firing() {
    return this.mouse.down || this.keys.has(' ');
  }

  get dashHeld() {
    return this.keys.has('shift');
  }

  /** True once for a key pressed since the last frame; consumes the press. */
  wasPressed(key) {
    const hit = this.pressed.has(key);
    if (hit) this.pressed.delete(key);
    return hit;
  }

  /** End-of-frame bookkeeping: one-shot presses and clicks last one frame. */
  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}
