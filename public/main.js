const chartHeight = Math.floor(document.documentElement.clientHeight / 2);
const resolution = 2000;

let symbol = 'ETH'; // Initial value

const chartOptions = {
    width: document.documentElement.clientWidth,
    height: chartHeight,
    timeScale: {
        visible: true,
        timeVisible: true,
        secondsVisible: true,
    },
    layout: {
        background: { color: '#222' },
        textColor: '#DDD',
    },
    grid: {
        vertLines: { color: '#444' },
        horzLines: { color: '#444' },
    },
};

const chart = createChart('chart', chartOptions);
const candlestickSeries = chart.addCandlestickSeries();
let previousData = null;
let previousTime = null;

document.getElementById('symbol').addEventListener('change', handleSymbolChange);

setupAutoRefresh();

function handleSymbolChange() {
    const dropdown = document.getElementById('symbol');
    symbol = dropdown.value; // Update the symbol variable with the selected value
    console.log(`Selected symbol: ${symbol}`);
}

function createChart(id, options) {
    const chart = LightweightCharts.createChart(document.getElementById(id), options);
    setAxisColor(chart, '#71649C');
    return chart;
}

function setAxisColor(chart, color) {
    chart.priceScale().applyOptions({ borderColor: color });
    chart.timeScale().applyOptions({ borderColor: color });
}

function fetchData(url) {
    return fetch(url).then(response => response.json());
}

function updateData() {
    fetchData(`/data/${symbol}/60s`)
        .then(formatData)
        .then(data => {
            candlestickSeries.setData(data);
            chart.timeScale().fitContent();
        })
        .catch(console.error);

    updateLiveTrades(symbol);

    updateMetrics();
}

function formatData(data) {
    return data.map(datum => ({
        time: datum.time_bucket * resolution / 1000 / 2,
        open: datum.open_price,
        high: datum.high_price,
        low: datum.low_price,
        close: datum.close_price,
    }));
}

function setupAutoRefresh() {
    updateData();
    setInterval(updateData, resolution);
}

function updateLiveTrades(symbol) {
    fetchData(`/trades/${symbol}`)
        .then(createTradeTable)
        .then(table => {
            const tradeContainer = document.getElementById('tradeContainer');
            tradeContainer.innerHTML = '';
            tradeContainer.appendChild(table);
        })
        .catch(console.error);
}

function updateMetrics() {
    const currentTime = Date.now();
    fetch('/metrics')
        .then(response => response.json())
        .then(data => {
            if (previousData) {
                // The rate is calculated as the difference in queries or errors divided by the difference in time (in seconds)
                const timeDiffSeconds = (currentTime - previousTime) / 1000;
                const queryRate = (data.queries_num + data.queries_iter_num - previousData.queries_num - previousData.queries_iter_num) / timeDiffSeconds;
                const errorRate = (data.errors_num + data.errors_iter_num - previousData.errors_num - previousData.errors_iter_num) / timeDiffSeconds;

                document.getElementById('requested').textContent = `Queries: ${queryRate.toFixed(2)}/sec |`;
                document.getElementById('errors').textContent = `Errors: ${errorRate.toFixed(2)}/sec |`;
            }
            document.getElementById('meanLatency').textContent = "Mean Latency: " + data.latency_avg_ms + " ms |";
            document.getElementById('p99Latency').textContent = "P99 Latency: " + data.latency_percentile_ms + " ms";

            // Update the previousData and previousTime for the next calculation
            previousData = data;
            previousTime = currentTime;
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}

function createTradeTable(data) {
    const tradeTable = document.createElement('table');
    tradeTable.classList.add('trade-table');
    addHeaders(tradeTable, ['ID', 'Time', 'Exchange', 'Base', 'Quote', 'Price', 'Quantity']);
    addRows(tradeTable, data);
    return tradeTable;
}

function addHeaders(table, headers) {
    const headerRow = table.insertRow();
    headers.forEach(headerText => {
        const headerCell = document.createElement('th');
        headerCell.textContent = headerText;
        headerRow.appendChild(headerCell);
    });
}

function addRows(table, data) {
    for (let i = data.length - 1; i >= 0; i--) {
        const datum = data[i];
        const row = table.insertRow();
        const cells = [
            datum.id,
            new Date(datum.timestamp).toLocaleString(),
            datum.exchange,
            datum.base,
            datum.quote,
            datum.price,
            datum.qty,
        ];
        cells.forEach(cellText => {
            const cell = row.insertCell();
            cell.textContent = cellText;
        });
    }
}
