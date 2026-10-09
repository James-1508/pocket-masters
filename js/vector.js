/**
 * Vector2D - 2D Vector mathematics utility class
 */
class Vector2D {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  copy() {
    return new Vector2D(this.x, this.y);
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  static add(v1, v2) {
    return new Vector2D(v1.x + v2.x, v1.y + v2.y);
  }

  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  static sub(v1, v2) {
    return new Vector2D(v1.x - v2.x, v1.y - v2.y);
  }

  mult(n) {
    this.x *= n;
    this.y *= n;
    return this;
  }

  static mult(v, n) {
    return new Vector2D(v.x * n, v.y * n);
  }

  div(n) {
    if (n !== 0) {
      this.x /= n;
      this.y /= n;
    }
    return this;
  }

  magSq() {
    return this.x * this.x + this.y * this.y;
  }

  mag() {
    return Math.sqrt(this.magSq());
  }

  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  distSq(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  dist(v) {
    return Math.sqrt(this.distSq(v));
  }

  normalize() {
    const m = this.mag();
    if (m > 0) {
      this.div(m);
    }
    return this;
  }

  heading() {
    return Math.atan2(this.y, this.x);
  }

  rotate(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nx = this.x * cos - this.y * sin;
    const ny = this.x * sin + this.y * cos;
    this.x = nx;
    this.y = ny;
    return this;
  }

  perp() {
    return new Vector2D(-this.y, this.x);
  }

  clamp(maxMag) {
    const m = this.mag();
    if (m > maxMag) {
      this.normalize().mult(maxMag);
    }
    return this;
  }
}
