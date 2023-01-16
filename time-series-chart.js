import {entries, keys, paddedExtent, values} from '/util.js';

export default function timeSeriesChart(element, data, renderLabel, config) {
  const height = element.clientHeight;
  const width = element.querySelector('svg').clientWidth;
  const header = element.querySelector('.label');
  const seriesNames = keys(data.points[0]).filter(k => k !== 'date');
  let xDomain, yDomains;

  // `config` allows the caller to customize various aspects of the chart.
  //
  // If the caller doesn't specify a given config, add sensible defaults so the
  // code below can be cleaner.
  seriesNames.forEach(series => {
    (config.lines ??= {})[series] ??= x => x;
    (config.domainSides ??= {})[series] ??= 'left';
    (config.paths ??= {})[series] ??= x => x;
  });
  (config.domains ??= {}).left ??= x => x;
  (config.domains ??= {}).right ??= x => x;

  const margin = {
    left: 60,
    right: values(config.domainSides).filter(d => d == 'right').length? 40 : 0,
    bottom: 60,
  };

  function verticalLine(date) {
    return lines[seriesNames[0]]([
      {date, [seriesNames[0]]: yDomains.left[0]},
      {date, [seriesNames[0]]: yDomains.left[1]},
    ]);
  }

  function onPointerMoved(event) {
    const pointer = d3.pointer(event);
    const date = xScale.invert(pointer[0]);
    if (date > xDomain[0]) {
      const index = d3.bisectCenter(data.points.map(d => d.date), date);
      rule.attr('style', '')
        .attr('d', verticalLine(data.points[index].date));

      seriesNames.forEach(series => svg.selectAll(`circle.${series}`)
        .attr('style', (_, j) => `
          transform: scale(${index == j? '1' : '0'});
          transform-origin: 50% 50%;
          transform-box: fill-box`));

      let marker;
      if (data.markers) {
        const markerIndex = d3.bisectCenter((data.markers ?? []).map(d => d.date), date);
        const pixelDistance = Math.abs(pointer[0] - xScale(data.markers[markerIndex].date));
        marker = pixelDistance < 15? data.markers[markerIndex] : null;

        svg.selectAll('.marker')
          .attr('stroke', (_, j) => marker != null && markerIndex == j? 'white' : 'gray');
      }

      renderLabel(header, data.points[index], marker);
    }
  }
  renderLabel(header);

  const svg = d3.select(element)
    .select('svg')
      .attr('class', 'flex')
      .attr('width', width)
      .attr('height', height)
      .on('pointerenter pointermove', onPointerMoved);

  const xScale = d3.scaleTime().range([margin.left, width - margin.right])
  const yScales = {
    left: d3.scaleLinear().range([height - margin.bottom, 0]),
    right: d3.scaleLinear().range([height - margin.bottom, 0]),
  };
  const xAxis = d3.axisBottom()
    .ticks(width / 80)
    .tickSizeOuter(0);

  // Assume left Y is money and right Y is %
  const yAxes = {
    left: d3.axisLeft()
      .ticks(height / 80)
      .tickFormat(d => `$${d.toLocaleString()}`),
    right: d3.axisRight()
      .ticks(height / 80)
      .tickFormat(d => `${d * 100}%`),
  };

  const lines = seriesNames.reduce((lines, series) => {
    const line = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScales[config.domainSides[series]](d[series] ?? 0));
    return {...lines, [series]: config.lines[series](line)};
  }, {});

  svg.append('g')
    .classed('left-axis', true)
    .attr('transform', `translate(${margin.left},0)`)

  svg.append('g')
    .classed('right-axis', true)
    .attr('transform', `translate(${width - margin.right},0)`);

  const rule = svg.append('path')
    .attr('fill', 'none')
    .attr('stroke', 'white')
    .attr('stroke-width', '2px')
    .attr('stroke-opacity', 0.4)
    .attr('style', 'display: none')
    .classed('ease-in-out', true);

    svg.selectAll('.marker')
      .data(data.markers ?? [])
      .enter()
      .append('path')
      .classed('marker', true)
      .attr('fill', 'none')
      .attr('stroke', 'gray')
      .attr('stroke-width', '3px')
      .attr('stroke-dasharray', '24 8');

  entries(lines).forEach(([series, line]) => {
    config.paths[series](svg.append('path')
      .classed(`series-${series}`, true)
      .attr('fill', 'none')
      .attr('stroke', config.colors[series])
      .attr('stroke-width', '2px'));

    svg.selectAll(`circle.${series}`)
      .data(data.points)
      .enter()
      .append('circle')
      .attr('fill', config.colors[series])
      .classed('ease-in-out', true)
      .classed(series, true)
      .attr('style', `transform: scale(0);
                      transform-origin: 50% 50%;
                      transform-box: fill-box`)
      .attr('r', 6);
  });

  function updateData(data) {
    xDomain = paddedExtent(data.points.map(d => d.date));
    yDomains = {
      left: config.domains.left(paddedExtent(seriesNames
        .filter(series => config.domainSides[series] == 'left')
        .map(series => data.points.map(d => d[series]))
        .reduce((domain, values) => domain.concat(values), []))),
      right: config.domains.right([0, paddedExtent(seriesNames
        .filter(series => config.domainSides[series] == 'right')
        .map(series => data.points.map(d => d[series]))
        .reduce((domain, values) => domain.concat(values), []))[1]]),
    }

    xScale.domain(xDomain);
    yScales.left.domain(yDomains.left);
    yScales.right.domain(yDomains.right);
    xAxis.scale(xScale);
    yAxes.left.scale(yScales.left)
    yAxes.right.scale(yScales.right)

    const duration = 400;

    svg.select('.left-axis')
      .transition()
        .duration(duration)
        .call(yAxes.left)
      .selection()
      // Remove the left axis line in order to make the chart cleaner
      .call(g => g.select('.domain').remove())
      // Draw horizontal lines across chart at tick marks
      .call(g => g?.selectAll('.tick line')?.clone()
        .attr('x2', width - margin.left - margin.right)
        .attr('stroke-opacity', d => d == 0? 0.37 : 0.1));

    svg.select('.right-axis')
      .transition()
        .duration(duration)
        .call(yAxes.right)
      .selection()
      // Remove the right axis line in order to make the chart cleaner
      .call(g => g.select('.domain').remove());

    svg.selectAll('.marker').attr('d', ({date}) => verticalLine(date));

    entries(lines).forEach(([series, line]) => {
      svg.select(`.series-${series}`)
        .transition()
          .duration(duration)
          .attr('d', line(data.points))
          // If the series is no longer present, make it invisible
          .attr('opacity', data.points[0][series] == null ? 0 : 1);

      svg.selectAll(`circle.${series}`)
        .data(data.points)
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yScales[config.domainSides[series]](d[series]))
        // If the series is no longer present, make it invisible
        .attr('opacity', data.points[0][series] == null ? 0 : 1);
    });
  }

  updateData(data);

  // Append X axis last since smoothing causes some lines to dip below it.
  svg.append('g')
    .attr('transform', `translate(0, ${height - margin.bottom})`)
    .call(xAxis);

  return updateData;
}
