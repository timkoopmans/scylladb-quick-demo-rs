let chartInstances = {};
let devicesData = [];
let activeTabIndex = 0;
const gradients = {
    readsPerSec: ['#00144B', '#00BFFF'],
    writesPerSec: ['#00144B', '#00BFFF'],
    latencyP99Ms: ['#06d6a0', '#9fffcb'],
};
window.onload = async () => {
    mdc.autoInit();

    mdc.tabBar.MDCTabBar.attachTo(document.querySelector('.mdc-tab-bar')).listen('MDCTabBar:activated', function (event) {
        document.querySelector('.panel.active').classList.remove('active');
        document.querySelector('#panel-container .panel:nth-child(' + (event.detail.index + 1) + ')').classList.add('active');
        activeTabIndex = event.detail.index;

        if (event.detail.index === 1) {
            if (chartInstances.readsPerSecChart) {
                chartInstances.readsPerSecChart.resize();
                chartInstances.readsPerSecChart.setOption(createChartOption(metricsData.readsPerSec, gradients.readsPerSec), true);
            }
            if (chartInstances.writesPerSecChart) {
                chartInstances.writesPerSecChart.resize();
                chartInstances.writesPerSecChart.setOption(createChartOption(metricsData.writesPerSec, gradients.writesPerSec), true);
            }
            if (chartInstances.latencyP99MsChart) {
                chartInstances.latencyP99MsChart.resize();
                chartInstances.latencyP99MsChart.setOption(createChartOption(metricsData.latencyP99Ms, gradients.latencyP99Ms), true);
            }
        }
    });

    chartInstances = initCharts();
    await updateCharts(chartInstances);

    setInterval(() => updateCharts(chartInstances), 15000);
};

window.addEventListener('resize', function () {
    if (chartInstances.readsPerSecChart) chartInstances.readsPerSecChart.resize();
    if (chartInstances.writesPerSecChart) chartInstances.writesPerSecChart.resize();
    if (chartInstances.latencyP99MsChart) chartInstances.latencyP99MsChart.resize();
    if (chartInstances.worldGraphChart) chartInstances.worldGraphChart.resize();
});


let metricsData = {
    readsPerSec: [], writesPerSec: [], latencyMeanMs: [], latencyP99Ms: []
};

let totalReads = 0;
let totalWrites = 0;

async function fetchAndPrepareData() {
    try {
        const response = await fetch('/metrics');
        const data = await response.json();

        let lastTimestamp = 0;
        if (metricsData.readsPerSec.length > 0) {
            lastTimestamp = metricsData.readsPerSec[metricsData.readsPerSec.length - 1][0];
        }

        data.forEach(item => {
            const timestamp = item.timestamp;

            if (timestamp > lastTimestamp) {
                metricsData.readsPerSec.push([timestamp, item.reads_per_second]);
                metricsData.writesPerSec.push([timestamp, item.writes_per_second]);
                metricsData.latencyP99Ms.push([timestamp, item.latency_p99_ms]);

                totalReads += item.total_reads;
                totalWrites += item.total_writes;

                if (metricsData.readsPerSec.length > 300) {
                    metricsData.readsPerSec.shift();
                    metricsData.writesPerSec.shift();
                    metricsData.latencyP99Ms.shift();
                }

                document.getElementById('readsPerSec').innerText = item.reads_per_second.toLocaleString('en', {maximumFractionDigits: 0}) + " reads/sec";
                document.getElementById('writesPerSec').innerText = item.writes_per_second.toLocaleString('en', {maximumFractionDigits: 0}) + " writes/sec";
                document.getElementById('latencyP99Ms').innerText = item.latency_p99_ms.toLocaleString('en', {maximumFractionDigits: 0}) + " ms";

                document.getElementById('totalReads').innerText = totalReads.toLocaleString('en', {maximumFractionDigits: 0}) + " total reads";
                document.getElementById('totalWrites').innerText = totalWrites.toLocaleString('en', {maximumFractionDigits: 0}) + " total writes";
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
    const latencyP99MsChart = echarts.init(document.getElementById('latencyP99MsChart'));
    const worldGraphChart = echarts.init(document.getElementById('worldGraphChart'));

    return {
        readsPerSecChart, writesPerSecChart, latencyP99MsChart, worldGraphChart
    };
}

async function updateCharts(chartInstances) {
    await fetchAndPrepareData();

    if (activeTabIndex === 0) {
        chartInstances.worldGraphChart.setOption(createWorldOption(), true);
        chartInstances.worldGraphChart.resize();
    }

    if (activeTabIndex === 1) {
        chartInstances.readsPerSecChart.setOption(createChartOption(metricsData.readsPerSec, gradients.readsPerSec), true);
        chartInstances.writesPerSecChart.setOption(createChartOption(metricsData.writesPerSec, gradients.writesPerSec), true);
        chartInstances.latencyP99MsChart.setOption(createChartOption(metricsData.latencyP99Ms, gradients.latencyP99Ms), true);
    }
}

function createWorldOption() {
    const graphData = devicesData.map((device, index, array) => {
        const nextDevice = array[index + 1] || array[0];
        return [[device.lat, device.lng], [nextDevice.lat, nextDevice.lng]];
    });

    const opt =  {
        geo3D: {
            map: 'world',
            silent: true,
            environment: '#5c677d',

            postEffect: {
                enable: false
            },
            groundPlane: {
                show: false,
            },

            viewControl: {
                distance: 80,
                    alpha: 90,
                    panMouseButton: 'left',
                    rotateMouseButton: 'right'
            },
            itemStyle: {
                color: '#001233'
            },
            regionHeight: 0.5
        },
        series: [
            {
                type: 'lines3D',
                coordinateSystem: 'geo3D',
                effect: {
                    show: true,
                    trailWidth: 2,
                    trailOpacity: 0.5,
                    trailLength: 0.2,
                    constantSpeed: 5
                },
                blendMode: 'lighter',
                lineStyle: {
                    width: 0.2,
                    opacity: 0.05
                },
                data: graphData
            }
        ]
    };

    return opt;
}

function createChartOption(data, gradientColors) {
    return {
        tooltip: {trigger: 'axis'}, xAxis: {
            type: 'time', splitLine: {
                show: false
            }
        }, yAxis: {type: 'value'}, series: [{
            data: data, type: 'line', step: 'start', symbol: 'none', areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{
                    offset: 0,
                    color: gradientColors[0]
                }, {offset: 1, color: gradientColors[1]}])
            }, lineStyle: {
                opacity: 0
            }, itemStyle: {
                color: gradientColors[0]
            }
        }]
    };
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

    const dataTable = new mdc.dataTable.MDCDataTable(document.querySelector('#deviceTable'));
}
