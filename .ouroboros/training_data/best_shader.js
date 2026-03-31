// Best: 25/40 | Style: abstract | 2026-03-26T01:34:33.290Z
export default (x, y, t) => {
  // Normalize coordinates
  let nx = x / 480 - 0.5;
  let ny = y / 240 - 0.5;
  
  // Domain warping
  let wx = nx + 0.3 * Math.sin(ny * 8 + t * 0.7);
  let wy = ny + 0.3 * Math.cos(nx * 6 + t * 0.5);
  
  // Second layer of warping
  let wx2 = wx + 0.15 * Math.sin(wy * 12 + t * 1.2);
  let wy2 = wy + 0.15 * Math.cos(wx * 10 - t * 0.9);
  
  // Create interference patterns
  let d1 = Math.sqrt(wx2 * wx2 + wy2 * wy2);
  let d2 = Math.sqrt((wx2 - 0.3) * (wx2 - 0.3) + (wy2 - 0.2) * (wy2 - 0.2));
  let d3 = Math.sqrt((wx2 + 0.2) * (wx2 + 0.2) + (wy2 + 0.3) * (wy2 + 0.3));
  
  let v1 = Math.sin(d1 * 30 - t * 2);
  let v2 = Math.sin(d2 * 25 + t * 1.5);
  let v3 = Math.sin(d3 * 20 - t * 1.8);
  
  let combined = (v1 + v2 + v3) / 3;
  
  // Add some angular patterns
  let angle = Math.atan2(wy2, wx2);
  let spiral = Math.sin(angle * 5 + d1 * 15 - t * 2.5);
  
  let final = (combined + spiral) * 0.5;
  
  // Color mapping using bitwise
  let r = ((Math.sin(final * 3.14 + t) * 127 + 128) | 0) & 255;
  let g = ((Math.sin(final * 3.14 + t + 2.094) * 127 + 128) | 0) & 255;
  let b = ((Math.sin(final * 3.14 + t + 4.188) * 127 + 128) | 0) & 255;
  
  return [r, g, b];
}
