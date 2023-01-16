export const EXTENT_PADDING = 0.025;
export const entries = Object.entries;
export const keys = Object.keys;
export const values = Object.values;
export const last = a => a[a.length - 1];

export const sum = a => {
  var sum = 0;
  for (let i of a) if (i != null) sum += i;
  return sum;
}

export function colorScale(steps, padding=4, interpolator=d3.interpolateCividis) {
  return [...Array(Math.floor(steps) + padding)]
    .map((_, i) => interpolator(i / (steps - 1)))
    .slice(padding / 2, padding? -padding / 2 : steps)
}

export function grayScale(steps) {
  return colorScale(steps, 0, d3.interpolateGreys);
}

function slidePieSliceIn() {
  this?.setAttribute('transform', 'translate(0, 0)');
}

export function slidePieSliceOut(_, {startAngle, endAngle}) {
  const lastElement = this.parentElement.querySelector('[data-last-element]');
  slidePieSliceIn.apply(lastElement);
  delete lastElement?.dataset.lastElement;

  // `angle` is the angle of the center point of the slice, but rotated back 90
  // degrees since d3 starts the angle from 12 o'clock (i.e. pointing up), but
  // the SVG element starts the angle from the origin of the element, which is
  // the upper left corner (i.e. pointing right).
  const ninetyDegrees = 2 * Math.PI / 4;
  const angle = (endAngle - startAngle) / 2 + startAngle - ninetyDegrees;

  // Create a unit vector corresponding to the angle.
  const [x, y] = [Math.cos(angle), Math.sin(angle)];
  const distance = 10;
  this.setAttribute('transform', `translate(${x * distance}, ${y * distance})`);
  this.dataset.lastElement = 'this';
}

export function paddedExtent(d, padding=EXTENT_PADDING) {
  const isDates = d[0] instanceof Date;
  const domain = d3.extent(d);
  const magnitude = domain[1] - domain[0];
  const paddedDomain = [
    domain[0] - magnitude * padding,
    (isDates? domain[1].getTime() : domain[1]) + magnitude * padding
  ];
  return isDates?
    [new Date(paddedDomain[0]), new Date(paddedDomain[1])] :
    paddedDomain;
}
