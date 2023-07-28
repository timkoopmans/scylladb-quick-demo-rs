window.onload = async () => {
    const chartInstances = initCharts();
    await updateCharts(chartInstances);

    // Refresh every 3 seconds
    setInterval(() => updateCharts(chartInstances), 3000);

    mdc.autoInit();
};

let metricsData = {
    readsPerSec: [],
    writesPerSec: [],
    latencyMeanMs: [],
    latencyP99Ms: []
};

async function fetchAndPrepareData() {
    try {
        const response = await fetch('/metrics');
        const data = await response.json();

        // Let's find the last timestamp we have in our data
        const lastTimestamp = metricsData.readsPerSec[0] ? metricsData.readsPerSec[0][0] : 0;

        // Now we only add new data points
        data.forEach(item => {
            const timestamp = item.timestamp;

            // If the timestamp of the current item is greater, add new data
            if (timestamp > lastTimestamp) {
                metricsData.readsPerSec.unshift([timestamp, item.reads_per_second]);
                metricsData.writesPerSec.unshift([timestamp, item.writes_per_second]);
                metricsData.latencyMeanMs.unshift([timestamp, item.latency_mean_ms]);
                metricsData.latencyP99Ms.unshift([timestamp, item.latency_p99_ms]);

                // Limit size of arrays to 300
                if (metricsData.readsPerSec.length > 300) {
                    metricsData.readsPerSec.pop();
                    metricsData.writesPerSec.pop();
                    metricsData.latencyMeanMs.pop();
                    metricsData.latencyP99Ms.pop();
                }
            }
        });
    } catch (error) {
        console.error('Error fetching metrics:', error);
    }
}


function initCharts() {
    const readsPerSecChart = echarts.init(document.getElementById('readsPerSecChart'));
    const writesPerSecChart = echarts.init(document.getElementById('writesPerSecChart'));
    const latencyMeanMsChart = echarts.init(document.getElementById('latencyMeanMsChart'));
    const latencyP99MsChart = echarts.init(document.getElementById('latencyP99MsChart'));

    return {
        readsPerSecChart,
        writesPerSecChart,
        latencyMeanMsChart,
        latencyP99MsChart
    };
}

async function updateCharts(chartInstances) {
    // Fetch and prepare data
    await fetchAndPrepareData();

    // Update chart options
    chartInstances.readsPerSecChart.setOption(createChartOption('Reads / Sec', metricsData.readsPerSec), true);
    chartInstances.writesPerSecChart.setOption(createChartOption('Writes / Sec', metricsData.writesPerSec), true);
    chartInstances.latencyMeanMsChart.setOption(createChartOption('Latency Mean ms', metricsData.latencyMeanMs), true);
    chartInstances.latencyP99MsChart.setOption(createChartOption('Latency p99 ms', metricsData.latencyP99Ms), true);
}

function createChartOption(title, data) {
    return {
        title: { text: title },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'time' },
        yAxis: { type: 'value' },
        series: [{ data: data, type: 'line', showSymbol: false, hoverAnimation: false, smooth: true }]
    };
}
