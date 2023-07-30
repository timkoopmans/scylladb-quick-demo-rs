let chartInstances = {};
let devicesData = [];
let activeTabIndex = 0;

window.onload = async () => {
    mdc.autoInit();

    mdc.tabBar.MDCTabBar.attachTo(document.querySelector('.mdc-tab-bar')).listen('MDCTabBar:activated', function(event) {
        document.querySelector('.panel.active').classList.remove('active');
        document.querySelector('#panel-container .panel:nth-child(' + (event.detail.index + 1) + ')').classList.add('active');
        activeTabIndex = event.detail.index;  // Update the active tab index

        if (activeTabIndex === 1 && chartInstances.sensorDataGraph) {
            chartInstances.sensorDataGraph.resize();
            chartInstances.sensorDataGraph.setOption(createGraphOption(), true);
        }
    });


    chartInstances = initCharts();
    await updateCharts(chartInstances);

    setInterval(() => updateCharts(chartInstances), 5000);
};

window.addEventListener('resize', function() {
    if(chartInstances.readsPerSecChart) chartInstances.readsPerSecChart.resize();
    if(chartInstances.writesPerSecChart) chartInstances.writesPerSecChart.resize();
    if(chartInstances.latencyMeanMsChart) chartInstances.latencyMeanMsChart.resize();
    if(chartInstances.latencyP99MsChart) chartInstances.latencyP99MsChart.resize();
    if(chartInstances.sensorDataGraph) chartInstances.sensorDataGraph.resize();
});

let metricsData = {
    readsPerSec: [],
    writesPerSec: [],
    latencyMeanMs: [],
    latencyP99Ms: []
};

let totalReads = 0;
let totalWrites = 0;

async function fetchAndPrepareData() {
    try {
        const response = await fetch('/metrics');
        const data = await response.json();

        // Let's find the last timestamp we have in our data
        let lastTimestamp = 0;
        if (metricsData.readsPerSec.length > 0) {
            lastTimestamp = metricsData.readsPerSec[metricsData.readsPerSec.length - 1][0];
        }

        // Now we only add new data points
        data.forEach(item => {
            const timestamp = item.timestamp;

            if (timestamp > lastTimestamp) {
                metricsData.readsPerSec.push([timestamp, item.reads_per_second]);
                metricsData.writesPerSec.push([timestamp, item.writes_per_second]);
                metricsData.latencyMeanMs.push([timestamp, item.latency_mean_ms]);
                metricsData.latencyP99Ms.push([timestamp, item.latency_p99_ms]);

                totalReads += item.total_reads;
                totalWrites += item.total_writes;

                if (metricsData.readsPerSec.length > 300) {
                    metricsData.readsPerSec.shift();
                    metricsData.writesPerSec.shift();
                    metricsData.latencyMeanMs.shift();
                    metricsData.latencyP99Ms.shift();
                }

                document.getElementById('readsPerSec').innerText = item.reads_per_second.toLocaleString('en', { maximumFractionDigits: 0 }) + " reads/sec";
                document.getElementById('writesPerSec').innerText = item.writes_per_second.toLocaleString('en', { maximumFractionDigits: 0 }) + " writes/sec";
                document.getElementById('latencyMeanMs').innerText = item.latency_mean_ms.toLocaleString('en', { maximumFractionDigits: 0 }) + " ms";
                document.getElementById('latencyP99Ms').innerText = item.latency_p99_ms.toLocaleString('en', { maximumFractionDigits: 0 }) + " ms";

                document.getElementById('totalReads').innerText = totalReads.toLocaleString('en', { maximumFractionDigits: 0 }) + " total reads";
                document.getElementById('totalWrites').innerText = totalWrites.toLocaleString('en', { maximumFractionDigits: 0 }) + " total writes";
            }
        });

        devicesData = await fetchDevicesData();
        populateDeviceTable();
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

function initCharts() {
    const readsPerSecChart = echarts.init(document.getElementById('readsPerSecChart'));
    const writesPerSecChart = echarts.init(document.getElementById('writesPerSecChart'));
    const latencyMeanMsChart = echarts.init(document.getElementById('latencyMeanMsChart'));
    const latencyP99MsChart = echarts.init(document.getElementById('latencyP99MsChart'));
    const sensorDataGraph = echarts.init(document.getElementById('sensorDataGraph')); // Add this line

    return {
        readsPerSecChart,
        writesPerSecChart,
        latencyMeanMsChart,
        latencyP99MsChart,
        sensorDataGraph
    };
}

async function updateCharts(chartInstances) {
    await fetchAndPrepareData();

    const gradients = {
        readsPerSec: ['#0D41E1', '#07C8F9'],
        writesPerSec: ['#ff7b00', '#ffea00'],
        latencyMeanMs:  ['#2ea2f9', '#c632e6'],
        latencyP99Ms: ['#2ea2f9', '#c632e6'],
    };

    chartInstances.readsPerSecChart.setOption(createChartOption(metricsData.readsPerSec, gradients.readsPerSec), true);
    chartInstances.writesPerSecChart.setOption(createChartOption(metricsData.writesPerSec, gradients.writesPerSec), true);
    chartInstances.latencyMeanMsChart.setOption(createChartOption(metricsData.latencyMeanMs, gradients.latencyMeanMs), true);
    chartInstances.latencyP99MsChart.setOption(createChartOption(metricsData.latencyP99Ms, gradients.latencyP99Ms), true);

    if (activeTabIndex === 1 && chartInstances.sensorDataGraph) {
        chartInstances.sensorDataGraph.setOption(createGraphOption(), true);
    }
}
function createChartOption(data, gradientColors) {
    return {
        tooltip: { trigger: 'axis' },
        xAxis: {
            type: 'time',
            splitLine: {
                show: false
            }
        },
        yAxis: { type: 'value' },
        series: [{
            data: data,
            type: 'line',
            step: 'start',
            symbol: 'none',
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: gradientColors[0] },
                    { offset: 1, color: gradientColors[1] }
                ])
            },
            lineStyle: {
                opacity: 0
            },
            itemStyle: {
                color: gradientColors[0]
            }
        }]
    };
}



function createGraphOption() {
    const graphData = devicesData.map(device => {
         return {
            name: device.ipv4,
            symbolSize: device.sensor_data,
            itemStyle: {
                color: getNodeColor(device.sensor_data),
            },
        };
    });

    const graphLinks = devicesData.map((device, index) => {
        return {
            source: device.ipv4,
            target: index === 0 ? graphData.length - 1 : index - 1, // Connect to the previous node
        };
    });

    return {
        tooltip: {},
        series: [
            {
                type: 'graph',
                layout: 'force',
                animation: false,
                data: graphData,
                links: graphLinks,
                roam: true,
                force: {
                    repulsion: 20,
                    edgeLength: 5,
                    gravity: 0.1
                },
            },
        ],
    };
}

function getNodeColor(sensorData) {
    const clampedSensorData = Math.min(25, Math.max(1, sensorData));
    const scaledSensorData = (clampedSensorData - 1) / 24;

    const color1 = 'rgb(55, 162, 255)';
    const color2 = 'rgb(142,218,112)';

    return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        {offset: 0, color: color1},
        {offset: 1, color: color2},
    ]);
}

async function fetchDevicesData() {
    try {
        const response = await fetch('/devices');
        return await response.json();
    } catch (error) {
        console.error('Error fetching devices data:', error);
        return [];
    }
}

function populateDeviceTable() {
    const tableBody = document.querySelector('#deviceTable .mdc-data-table__content');
    tableBody.innerHTML = '';  // Clear the existing content

    devicesData.forEach(device => {
        const row = document.createElement('tr');
        row.className = 'mdc-data-table__row';

        const cellIp = document.createElement('td');
        cellIp.className = 'mdc-data-table__cell';
        cellIp.innerText = device.ipv4;
        row.appendChild(cellIp);

        const cellUuid = document.createElement('td');
        cellUuid.className = 'mdc-data-table__cell';
        cellUuid.innerText = device.uuid;
        row.appendChild(cellUuid);

        const cellSensorData = document.createElement('td');
        cellSensorData.className = 'mdc-data-table__cell';
        cellSensorData.innerText = device.sensor_data;
        row.appendChild(cellSensorData);

        tableBody.appendChild(row);
    });

    // Initialize the MDC DataTable
    const dataTable = new mdc.dataTable.MDCDataTable(document.querySelector('#deviceTable'));
}
