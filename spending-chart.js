import {colorScale, entries, slidePieSliceOut} from '/util.js';

function renderLabel(element, description, {category, value}={}) {
  element.innerHTML = category == null?
    `
    ${description}

    <p>Hover over a the chart to see more information.</p>

    <p>Inner slices are sub-categories of their outer sections.</p>
    ` :

    `
    <h3>${category}</h3>

    <p style="font-style: normal; opacity: 1; font-size: 1.8em; margin-top: 0">
      <b>$${Math.floor(value).toLocaleString()}</b>
    </p>
    `;
}

function *formatData(radius, data) {
  for (let [account, amount] of entries(data)) {
    const nameWithoutPrefix = account.replace(/^Expenses:/, '');
    const otherItemsInRoot = entries(data).filter(([k, v]) =>
        k.startsWith(account.split(':').slice(0, 2).join(':')));
    const rootSum = otherItemsInRoot.reduce((sum, [_, v]) => sum + v, 0);
    if (account == otherItemsInRoot[0][0])
      yield {
        category: nameWithoutPrefix.split(':')[0],
        value: rootSum,
        isRoot: true,
        key: rootSum << 16,
        radius,
        visible: otherItemsInRoot.length > 1,
      };

    yield {
        category: nameWithoutPrefix,
        value: amount,
        isRoot: false,
        key: (rootSum << 16) + amount,
        radius: radius / (otherItemsInRoot.length > 1? 2 : 1),
    };
  }
}

export default function spending(element, unformattedData, description) {
  const height = element.clientHeight;
  const width = Math.min(element.clientWidth * 0.66, height);
  const margin = 40;
  const radius = Math.min(width, height) / 2 - margin

  const svg = d3.select(element)
    .append('svg')
      .attr('class', 'flex')
      .attr('width', width)
      .attr('height', height)
    .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

  const label = document.createElement('div');
  label.classList.add('flex');
  label.style = `flex-direction: column;
                 justify-content: center;
                 margin-bottom: 8rem;
                 max-width: 21rem`;
  element.appendChild(label);

  const data = [...formatData(radius, unformattedData)].sort((a, b) => b.key - a.key);
  const colors = colorScale(data.length, 2).slice(2);
  data.forEach(d => d.color = d.isRoot? colors[0] : colors.shift());

  const pie = d3.pie().sort(null).value(({value}) => value);

  // Render outer slices for root categories
  svg
    .selectAll('d')
    .data(pie(data.filter(({isRoot}) => isRoot)))
    .enter()
    .append('path')
    .classed('ease-in-out', true)
    .attr('d', d3.arc().innerRadius(radius / 2).outerRadius(radius))
    .attr('fill', ({data: {color}}) => color)
    .attr('stroke', '#151515')
    .style('stroke-width', '2px')
    .style('display', d => d.data.visible? 'initial' : 'none')
    .on('mouseenter', function(_, {data}) {
      slidePieSliceOut.apply(this, arguments);
      renderLabel(label, description, data);
    });

  // Render inner slices for sub categories
  svg
    .selectAll('d')
    .data(pie(data.filter(({isRoot}) => !isRoot)))
    .enter()
    .append('path')
    .classed('ease-in-out', true)
    .attr('d', d => d3.arc().innerRadius(0).outerRadius(d.data.radius)(d))
    .attr('fill', ({data: {color}}) => color)
    .attr('stroke', '#151515')
    .style('stroke-width', '2px')
    .on('mouseenter', function(_, {data}) {
      slidePieSliceOut.apply(this, arguments);
      renderLabel(label, description, data);
    });

    renderLabel(label, description);
}
