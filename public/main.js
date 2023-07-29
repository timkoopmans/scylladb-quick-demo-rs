let chartInstances = {};

window.onload = async () => {
    mdc.autoInit();

    chartInstances = initCharts();
    await updateCharts(chartInstances);

    // Refresh every 3 seconds
    setInterval(() => updateCharts(chartInstances), 3000);
};

window.addEventListener('resize', function() {
    if(chartInstances.readsPerSecChart) chartInstances.readsPerSecChart.resize();
    if(chartInstances.writesPerSecChart) chartInstances.writesPerSecChart.resize();
    if(chartInstances.latencyMeanMsChart) chartInstances.latencyMeanMsChart.resize();
    if(chartInstances.latencyP99MsChart) chartInstances.latencyP99MsChart.resize();
});

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

                // Update the div container with the latest values, formatted with commas and two decimal places
                document.getElementById('readsPerSec').innerText = item.reads_per_second.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                document.getElementById('writesPerSec').innerText = item.writes_per_second.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                document.getElementById('latencyMeanMs').innerText = item.latency_mean_ms.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                document.getElementById('latencyP99Ms').innerText = item.latency_p99_ms.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

    // Define gradient color pairs
    const gradients = {
        readsPerSec: ['rgb(55, 162, 255)', 'rgb(116, 21, 219)'],
        writesPerSec: ['rgb(255, 191, 0)', 'rgb(224, 62, 76)'],
        latencyMeanMs: ['rgb(128, 255, 165)', 'rgb(1, 191, 236)'],
        latencyP99Ms: ['rgb(255, 0, 135)', 'rgb(135, 0, 157)']
    };

    // Update chart options
    chartInstances.readsPerSecChart.setOption(createChartOption(metricsData.readsPerSec, gradients.readsPerSec), true);
    chartInstances.writesPerSecChart.setOption(createChartOption(metricsData.writesPerSec, gradients.writesPerSec), true);
    chartInstances.latencyMeanMsChart.setOption(createChartOption(metricsData.latencyMeanMs, gradients.latencyMeanMs), true);
    chartInstances.latencyP99MsChart.setOption(createChartOption(metricsData.latencyP99Ms, gradients.latencyP99Ms), true);
}

function createChartOption(data, gradientColors) {
    return {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'time' },
        yAxis: { type: 'value' },
        series: [{
            data: data,
            type: 'line',
            showSymbol: false,
            hoverAnimation: false,
            smooth: true,
            lineStyle: {
                width: 0
            },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{
                    offset: 0, color: gradientColors[0] // top color
                }, {
                    offset: 1, color: gradientColors[1] // bottom color
                }])
            }
        }]
    };
}

