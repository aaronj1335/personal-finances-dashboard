import {data} from './data.js';
import savingsChart from './savings-chart.js';
import spendingChart from './spending-chart.js';
import stackedAreaChart from './stacked-area-chart.js';
import timeSeriesChart from './time-series-chart.js';
import {colorScale, entries, keys, sum, values} from './util.js';

function curveCatmullRom(line) {
  return line.curve(d3.curveCatmullRom);
}

function convertDates(items) {
  return items.map(([date, value]) => ({date: new Date(date), value}));
}

savingsChart(document.getElementById('savings'), data.yearlySavingsGoals);

spendingChart(document.getElementById('spending'), data.spending, `
      <h3>Total spending</h3>
      <p>
        This chart visualizes all spending this month &mdash; groceries, health
        insurance, mortgage, taxes, etc.
      </p>`);

spendingChart(document.getElementById('discretionary-spending'), data.discretionarySpending, `
      <h3>Discretionary spending</h3>
      <p>
        This chart visualizes discretionary spending this month. It excludes
        things like mortgage, health insurance and taxes that we can't
        reasonably decide to not pay.
      </p>`);

timeSeriesChart(
  document.getElementById('historical-spending'),
  {
    markers: convertDates(data.historicalSpending.markers),
    points: convertDates(data.historicalSpending.points),
  },
  (element, {date, value}={}, adjustments) => {
    element.style.paddingRight = element.style.paddingLeft = "2rem";
    element.innerHTML = '<h2>Monthly discretionary spending</h2>' + (date == null?
      `
      <p>Hover over the chart to see spending for the given month.</p>

      <p>
      Vertical markers indicate some significant expense that's been
        <strong>excluded</strong> from this chart for clarity.
      </p>
      ` :

      `
      <h3>
        <span style="font-style: italic; opacity: 0.7; margin-right: 0.4rem">Month of</span>
        ${date.toISOString().split(/T/)[0].split('-').slice(0, 2).join('-')}
      </h3>

      <table style="padding: 2rem">
        <tr>
          <td>Spending</td>
          <td>$${Math.floor(value).toLocaleString()}</td>
        </tr>
      </table>

      ${adjustments != null?
        `<p>This ignores some significant expenses:</p>
        ${adjustments.value.map(adjustment => 
          `<ul>
            <li>${adjustment[0][0]} (${adjustment[0][1]}): $${adjustment[1].toLocaleString()}</li>
          </ul>`).join('')}
        ` :
        ''}
      `);
  },
  {
    colors: {value: colorScale(4)[0]},
    lines: {value: curveCatmullRom},
    domains: {left: ([x0, x1]) => [0, x1]}
  });

const netWorthData = data.networth.points.slice(1)
  .map(([date, costBasis, value]) => ({date: new Date(date), costBasis, value}));
const growthData = netWorthData.map(({date, costBasis, value}) => ({date, value: value - costBasis}));
const networthElement = document.getElementById('networth');
let currentData = {
  points: netWorthData,
  markers: convertDates(data.networth.markers),
};

networthElement.addEventListener('click', event => {
  if (event.target.classList.contains('toggle'))
    updateNetworthData(currentData = {
      points: currentData.points == netWorthData? growthData : netWorthData,
    });
});

const updateNetworthData = timeSeriesChart(
  networthElement,
  currentData,
  (element, {date, costBasis, value}={}, marker) => {
    element.style.paddingRight = element.style.paddingLeft = "2rem";
    element.innerHTML = `
      <h2 style="flex: 1">
        Net worth

        <button style="font-size: 0.4em; vertical-align: top; float: right" type=button class=toggle>
          Toggle growth vs total
        </button>
      </h2>

      ${date == null ?
        `<p>Hover over the chart to see net worth and earnings.</p>` :

        `
        <h3>
          <span style="font-style: italic; opacity: 0.7; margin-right: 0.4rem">Date: </span>
          ${date.toISOString().split(/T/)[0]}
        </h3>

        <table style="width: 19rem; padding: 2rem;">
          <tr>
            <td>Net worth <div class=color-block style="background-color: ${colorScale(4)[0]}"></div></td>
            <td>$${Math.floor(value).toLocaleString()}</td>
          </tr>

          <tr>
            <td>Cost basis <div class=color-block style="background-color: ${colorScale(16)[3]}"></div></td>
            <td>$${Math.floor(costBasis).toLocaleString()}</td>
          </tr>

          <tr>
            <td>Growth</td>
            <td>$${Math.floor(value - costBasis).toLocaleString()}</td>
          </tr>

        </table>
         ${marker != null?
          `<p>${marker.value}</p>` :
          ``}
        `
      }
      `;
  },
  {colors: {costBasis: colorScale(16)[3], value: colorScale(4)[0]}});

data.yearlyFormatted = entries(data.yearly).map(([year, data]) => {
  const date = new Date(Number.parseInt(year, 10), 0, 1);
  const income = data.income.agi ?? 0;
  const savings = sum(values(data.savings));
  const taxes = sum(values(data.taxes));
  const giving = data.giving ?? 0;
  const spending = income - savings - taxes - giving;
  return {date, income, savings, taxes, giving, spending};
}).filter(({date}) => date.getFullYear() < new Date().getFullYear());

const yearlyColors = {
  income: 'white',
  spending: '#8a4848',
  taxes: 'rgb(164, 157, 120)',
  savings: 'rgb(132 186 132)',
  giving: '#3794ff',
}

timeSeriesChart(
  document.getElementById('yearly'),
  {
    points: data.yearlyFormatted
      .map(({date, income, savings, taxes, giving, spending}) => ({
        date,
        income,
        spending,
        taxes: taxes / income,
        giving: giving / income,
        savings: savings / income,
      })),
  },
  (element, {date, income, savings, taxes, giving, spending}={}) => {
    element.style.paddingRight = element.style.paddingLeft = "2rem";
    element.innerHTML = '<h2>Yearly income vs. expenses</h2>' + (date == null?
      `
      <p>
        This chart visualizes income and spending over the years and the
        percentage we're saving, giving, and paying in taxes.
      </p>

      <p>
        It has 2 Y-axes &mdash; the left is in dollars, the right is in
        percent. Solid lines (income and expenses) are in dollars, and dotted
        lines (taxes, giving, and savings) are in percent of income
        (specifically AGI).
      </p>

      <p>
        This is useful for showing not just our earnings over the years, but
        also answering questions like "if we earn more, are we more generous?"
      </p>
      ` :

      `
      <h3>
        <span style="font-style: italic; opacity: 0.7; margin-right: 0.4rem">Year</span>
        ${date.getFullYear()}
      </h3>

      <table style="width: 18rem; padding: 2rem;">
        <tr>
          <td>Income <div class=color-block style="background-color: ${yearlyColors.income}"></div></td>
          <td>$${Math.floor(income).toLocaleString()}</td>
        </tr>

        <tr>
          <td>Spending <div class=color-block style="background-color: ${yearlyColors.spending}"></div></td>
          <td>$${Math.floor(spending).toLocaleString()}</td>
        </tr>

        <tr>
          <td>Savings <div class=color-block style="background-color: ${yearlyColors.savings}"></div></td>
          <td>${Math.floor(savings * 100)}%</td>
        </tr>

        <tr>
          <td>Taxes <div class=color-block style="background-color: ${yearlyColors.taxes}"></div></td>
          <td>${Math.floor(taxes * 100)}%</td>
        </tr>

        <tr>
          <td>Giving <div class=color-block style="background-color: ${yearlyColors.giving}"></div></td>
          <td>${Math.floor(giving * 100)}%</td>
        </tr>
      </table>
      `);
  },
  {
    colors: yearlyColors,
    domainSides: {income: 'left', spending: 'left', taxes: 'right', giving: 'right', savings: 'right'},
    lines: {
      income: curveCatmullRom,
      spending: curveCatmullRom,
      taxes: curveCatmullRom,
      giving: curveCatmullRom,
      savings: curveCatmullRom,
    },
    paths: {
      income: path => path.attr('stroke-width', '3px'),
      spending: path => path.attr('stroke-width', '3px'),
      taxes: path => path.style('stroke-dasharray', '3, 3'),
      giving: path => path.style('stroke-dasharray', '3, 3'),
      savings: path => path.style('stroke-dasharray', '3, 3'),
    },
  });

stackedAreaChart(
  document.getElementById('yearly-normalized'),
  data.yearlyFormatted.map(({date, savings, taxes, giving, spending}) => ({
    date,
    savings,
    giving,
    taxes,
    spending,
  })),
  (element, {date, savings, taxes, giving, spending}={}) => {
    const total = savings + taxes + giving + spending;
    element.style.paddingRight = element.style.paddingLeft = "2rem";
    element.innerHTML = '<h2>Yearly expense proportions</h2>' + (date == null?
      `
      <p>
        This chart visualizes our expense breakdown over the years.
      </p>

      <p>
        This is useful for understanding the relationship between different
        expense categories over time.
      </p>
      ` :

      `
      <h3>
        <span style="font-style: italic; opacity: 0.7; margin-right: 0.4rem">Year</span>
        ${date.getFullYear()}
      </h3>

      <table style="width: 18rem; padding: 2rem;">
        <tr>
          <td>Spending <div class=color-block style="background-color: ${yearlyColors.spending}"></div></td>
          <td>${Math.floor(spending / total * 100)}%</td>
        </tr>

        <tr>
          <td>Savings <div class=color-block style="background-color: ${yearlyColors.savings}"></div></td>
          <td>${Math.floor(savings / total * 100)}%</td>
        </tr>

        <tr>
          <td>Taxes <div class=color-block style="background-color: ${yearlyColors.taxes}"></div></td>
          <td>${Math.floor(taxes / total * 100)}%</td>
        </tr>

        <tr>
          <td>Giving <div class=color-block style="background-color: ${yearlyColors.giving}"></div></td>
          <td>${Math.floor(giving / total * 100)}%</td>
        </tr>
      </table>
      `);
  },
  {
    colors: yearlyColors,
    stack: stack => stack.offset(d3.stackOffsetExpand),
    yAxis: y => y.tickFormat(d => `${d * 100}%`),
  });

data.networthObjects = data.networth.points.slice(1)
  .map(row => row.reduce((object, value, i) => {
    const key = i == 0? 'date' : data.networth.points[0][i];
    if (key != 'Cost basis' && key != 'Value')
      object[key] = (i == 0 ? new Date(value) : value) ?? 0;
    return object;
  }, {}));

stackedAreaChart(
  document.getElementById('networth-stacked'),
  data.networthObjects,
  (element, object, highlighted) => {
    element.innerHTML = object != null?
      `
        <h3>
          <span style="opacity: 0.6">Assets on ${object.date.toISOString().split('T')[0]}</span>
          <span style="float: right; font-size: 0.9em; font-style: italic">
            ${highlighted ?? ''}
          </span>
        </h3>

        <div class=grid>
          ${keys(object).filter(k => k != 'date').map((k, i) => `
            <span>
              <span class=color-block
                    style="display: inline-block;
                            opacity: ${!highlighted || k == highlighted? 1 : 0.8};
                            background-color: ${d3.schemeTableau10[i % d3.schemeTableau10.length]}">
              </span>

              <span style="opacity: ${!highlighted || k == highlighted? 1 : 0.6}">
                ${k.split(':')
                   .reverse()
                   .map((segment, i) => i == 0? segment : segment[0])
                   .reverse()
                   .join(':')}:
                $${object[k].toLocaleString()}
              </span>
            </span>
          `).join(' ')}
        </div>
      ` :
      
      `<p>
        This chart visualizes our net worth each week broken down by
        asset/investment.  It's useful for understanding what accounts are
        contributing to increases/decreases and identifying potential issues
        with investments or bookkeeping.
      </p>
      
      <p>
        Hover over the chart to see the specific asset's name as well as every
        asset's value at that time.
      </p>`;
  },
  {
    colors: (_, i) => d3.schemeTableau10[i % d3.schemeTableau10.length],
    yAxis: y => y.tickFormat(d => `$${d.toLocaleString()}`)
  });