import {colorScale, entries, grayScale, keys, last, slidePieSliceOut, values} from './util.js';

function renderLabel(element, {category, value, saved, goal, toGo}={}) {
  element.lastElementChild.innerHTML = category == null?
    `
    <p>
      This chart visualizes progress towards yearly savings goals. The gray
      slices are the remaining goals, and the colored slices are the progress
      towards them.
    </p>

    <p>
      Hover over a the chart to see more information.
    </p>

    <p>
      Adjust the slider to see progress through the year.
    </p>
    ` :

    `
    <h3 style="text-transform: capitalize">${category
      .replace('_', ' ')
      .replace('gsu', 'GSU')
      .replace('ira', 'IRA')
      .replace('hsa', 'HSA')}</h3>

    ${toGo?
      `
      <p style="font-style: normal; opacity: 1; font-size: 1.8em; margin-top: 0">
        <b>$${value.toLocaleString()}</b> remaining
      </p>
      <p style="margin-top: 0">($${saved.toLocaleString()} so far)</p>` :

      `
      <p style="font-style: normal; opacity: 1; font-size: 1.8em; margin-top: 0">
        <b>$${value.toLocaleString()}</b> saved
      </p>
      <p style="margin-top: 0">${
        goal - saved >= 0?
          `$${(goal - saved).toLocaleString()} remaining` :
          `$${(saved - goal).toLocaleString()} saved beyond goal`
        }</p>`}
    `;
}

function *formatData(unformattedData) {
  const goals = entries(unformattedData).sort();
  const colors = colorScale(goals.length + 4, 4);
  const grays = grayScale(goals.length * 1.7 + 4).reverse().slice(4);
  for (const [category, {saved, goal, dividends=0}] of goals)
    yield {
      category,
      value: saved - Math.min(saved, dividends),
      saved,
      goal,
      color: colors.shift(),
      toGo: false,
    };

  for (const [category, {saved, goal=saved}] of goals)
    yield {
      category,
      value: goal - saved,
      saved,
      goal,
      color: grays.shift(),
      toGo: true,
    };
}

export default function savings(element, allUnformattedData) {
  const beginningOfYearPlaceholder = '1969-01-01'; 
  const height = element.clientHeight;
  const width = Math.min(element.clientWidth * 0.66, height);
  const margin = 40;
  const radius = Math.min(width, height) / 2 - margin

  allUnformattedData = {
    [beginningOfYearPlaceholder]: entries(allUnformattedData[keys(allUnformattedData)[0]])
      .reduce((o, [k, v]) => (o[k] = {...v, saved: 0}, o), {}),
    ...allUnformattedData,
  };

  const svg = d3.select(element)
    .append('svg')
      .attr('class', 'flex')
      .attr('width', width)
      .attr('height', height)
    .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

  const label = document.createElement('div');
  label.classList.add('flex');
  label.setAttribute('style', `flex-direction: column;
                               max-width: 18rem;
                               margin-top: 4rem`);
  element.appendChild(label);
  const endMonthIndex = keys(allUnformattedData).length;
  label.innerHTML = `
    <h3>Current savings progress</h3>
    <p>
      <input type=range
             name=month
             style='width: 100%'
             min=1
             max=${endMonthIndex}
             value=${endMonthIndex} />
    </p>
    <div></div>
  `;
  const header = label.querySelector('h3');

  label.addEventListener('change', event => {
    const value = +event.target.value;
    updateData(values(allUnformattedData)[value - 1])
    if (value == keys(allUnformattedData).length)
      header.textContent = 'Current savings progress';
    else if (value == 1)
      header.textContent = 'Start of year savings goals';
    else
      header.textContent = `Savings to end of ${
        keys(allUnformattedData)[value - 1].split('-').slice(0, 2).join('-')
      }`;
  });

  const pie = d3.pie().sort(null).value(({value}) => value);

  const arc = d3.arc().innerRadius(0).outerRadius(radius);

  function updateData(unformattedData) {
    const data = [...formatData(unformattedData)];
    const sectors = svg
      .selectAll('path')
      .data(pie(data), ({data}) => JSON.stringify([data.category, data.toGo]));

    sectors
      .enter()
      .append('path')
      .classed('ease-in-out', true)
      .attr('d', arc)
      .attr('fill', ({data: {color}}) => color)
      .attr('stroke', '#151515')
      .style('stroke-width', '2px')
      .on('pointerenter', function(_, {data}) {
        slidePieSliceOut.apply(this, arguments);
        renderLabel(label, data);
      });

    let currentSelectedData;
    sectors
      .join()
      .attr('d', arc)
      .call(g => g.filter('[data-last-element]')
        .call(selection => {
          if (selection.size())
            slidePieSliceOut.call(selection.node(), null, currentSelectedData = selection.datum());
        }));
    renderLabel(label, currentSelectedData?.data)
  }

  updateData(last(values(allUnformattedData)));
}