/* Where the sun and the moon stand in the sky for a moment and a place.
   The formulas are the usual low-precision ones (as in SunCalc, after the astronomy of J. Meeus): good to a fraction of a degree,
   which is plenty for shadows on a house. Returns azimuth from north, clockwise, and altitude above the horizon, in degrees. */
(function (root) {
  const rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;
  const toDays = d => d.valueOf() / dayMs - 0.5 + J1970 - J2000;
  const ra = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const sidereal = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
  const sunCoords = d => {
    const M = rad * (357.5291 + 0.98560028 * d);
    const L = M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
    return {dec: dec(L, 0), ra: ra(L, 0)};
  };
  const moonCoords = d => {
    const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.229350 * d);
    const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
    return {ra: ra(l, b), dec: dec(l, b), dist: 385001 - 20905 * Math.cos(M)};
  };
  const horiz = (date, lat, lon, c) => {
    const lw = rad * -lon, phi = rad * lat, H = sidereal(toDays(date), lw) - c.ra;
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(c.dec) * Math.cos(phi));
    const alt = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H));
    return {az: (az / rad + 180 + 360) % 360, alt: alt / rad};
  };
  // the lit share of the moon's disc (0 new … 1 full) and whether it is waxing
  const moonLight = date => {
    const d = toDays(date), s = sunCoords(d), m = moonCoords(d), sdist = 149598000;
    const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
    const ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra),
      Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return {fraction: (1 + Math.cos(inc)) / 2, waxing: ang < 0};
  };
  // a unit vector toward a point of the sky, in a scene where north is −z and east is +x
  const dirTo = (az, alt) => {
    const a = az * rad, h = alt * rad;
    return {x: Math.sin(a) * Math.cos(h), y: Math.sin(h), z: -Math.cos(a) * Math.cos(h)};
  };
  root.Sun = {
    sun: (date, lat, lon) => horiz(date, lat, lon, sunCoords(toDays(date))),
    moon: (date, lat, lon) => horiz(date, lat, lon, moonCoords(toDays(date))),
    moonLight, dirTo
  };
})(window);
