import {EXTENT_PADDING, keys, paddedExtent} from '/util.js';

export default function stackedAreaChart(element, data, renderLabel, config) {
  const height = element.clientHeight;
  const width = element.querySelector('svg').clientWidth;
  const header = element.querySelector('.label');
  const seriesNames = keys(data[0]).filter(k => k !== 'date')
  const margin = 60;
  config.stack ??= x => x;
  config.yAxis ??= x => x;
  let currentKey;
  let currentData;

  function onPointerMoved(event) {
    const date = xScale.invert(d3.pointer(event)[0]);
    if (date > xDomain[0]) {
      const i = d3.bisectCenter(data.map(d => d.date), date);
      currentData = data[i];
      rule.attr('style', 'pointer-events: none')
        .attr('d', ruleLine([
          {date: currentData.date, value: yDomain[0]},
          {date: currentData.date, value: yDomain[1] * (1 - EXTENT_PADDING)}]));
      renderLabel(header, currentData, currentKey);
    }
  }
  renderLabel(header);

  const svg = d3.select(element)
    .select('svg')
      .attr('style', '')
      .attr('width', width)
      .attr('height', height)
      .on('pointerenter pointermove', onPointerMoved);

  const xDomain = d3.extent(data.map(d => d.date));

  // d3.stack() creates a function that takes an object mapping x values to maps
  // from series name to y value.
  //
  // the function outputs a nested array of series where the start and end
  // values are the extent (height) of the series on the given date.
  //
  // [
  //   /* series1 */ [
  //     /* date1 */ [startValue, endValue],
  //     /* date2 */ [startValue, endValue],
  //     ...
  //   ],
  //   /* series2 */ [
  //     /* date1 */ [startValue, endValue],
  //     /* date2 */ [startValue, endValue],
  //     ...
  //   ,
  //   ...
  // ]
  const series = config.stack(d3.stack()
      .keys(seriesNames)
      .value(([_, values], series) => values[series])
      .order(d3.stackOrderNone))
    (data.reduce((map, d) => map.set(d.date, d), new d3.InternMap()));

  const yDomain = [0, paddedExtent(series.flat(2))[1]];

  const xScale = d3.scaleTime()
    .range([margin, width])
    .domain(xDomain);
  const yScale = d3.scaleLinear().range([height - margin, 0]).domain(yDomain);
  const xAxis = d3.axisBottom(xScale).ticks(width / 80).tickSizeOuter(0);
  const yAxis = config.yAxis(d3.axisLeft(yScale).ticks(height / 50));

  const ruleLine = d3.line().x(d => xScale(d.date)).y(d => yScale(d.value));

  const area = d3.area()
    .x(({data: [date]}) => xScale(date))
    .y0(([y1]) => yScale(y1))
    .y1(([_, y2]) => yScale(y2));

  svg.append("g")
      .attr("transform", `translate(0,${height - margin})`)
      .call(xAxis)
      .call(g => g.select(".domain").remove());

  svg.append("g")
      .attr("transform", `translate(${margin},0)`)
      .call(yAxis)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line")
        .clone()
          .attr("x2", width - margin)
          .attr('stroke-opacity', d => d == 0? 1 : 0.05));

  svg.append("g")
    .selectAll("path")
    .data(series)
    .join("path")
      .classed('series', true)
      .attr("fill", ({key}, i) => typeof config.colors == 'function'?
        config.colors(key, i) : config.colors[key])
      .attr("d", area)
      .on('pointerenter', (_, {key}) => currentKey = key)
      .on('pointerleave', () => {
        currentKey = null;
        renderLabel(header, currentData);
      });

  const rule = svg.append('path')
    .attr('fill', 'none')
    .attr('stroke', 'white')
    .attr('stroke-width', '2px')
    .attr('style', 'display: none; pointer-events: none');
}
