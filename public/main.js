let chartInstances = {};
let devicesData = [];
let targetData = {};
let activeTabIndex = 0;

window.onload = async () => {
    mdc.autoInit();

    mdc.tabBar.MDCTabBar.attachTo(document.querySelector('.mdc-tab-bar')).listen('MDCTabBar:activated', function (event) {
        document.querySelector('.panel.active').classList.remove('active');
        document.querySelector('#panel-container .panel:nth-child(' + (event.detail.index + 1) + ')').classList.add('active');
        activeTabIndex = event.detail.index;  // Update the active tab index

        if (activeTabIndex === 1 && chartInstances.sensorDataGraph) {
            chartInstances.sensorDataGraph.resize();
            chartInstances.sensorDataGraph.setOption(createGraphOption(), true);
        }

        if (event.detail.index === 2 && chartInstances.worldGraphChart) {
            chartInstances.worldGraphChart.resize();
            chartInstances.worldGraphChart.setOption(createWorldOption(), true);
        }
    });


    chartInstances = initCharts();
    await updateCharts(chartInstances);

    setInterval(() => updateCharts(chartInstances), 15000);
};

window.addEventListener('resize', function () {
    if (chartInstances.readsPerSecChart) chartInstances.readsPerSecChart.resize();
    if (chartInstances.writesPerSecChart) chartInstances.writesPerSecChart.resize();
    if (chartInstances.latencyMeanMsChart) chartInstances.latencyMeanMsChart.resize();
    if (chartInstances.latencyP99MsChart) chartInstances.latencyP99MsChart.resize();
    if (chartInstances.sensorDataGraph) chartInstances.sensorDataGraph.resize();
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

                document.getElementById('readsPerSec').innerText = item.reads_per_second.toLocaleString('en', {maximumFractionDigits: 0}) + " reads/sec";
                document.getElementById('writesPerSec').innerText = item.writes_per_second.toLocaleString('en', {maximumFractionDigits: 0}) + " writes/sec";
                document.getElementById('latencyMeanMs').innerText = item.latency_mean_ms.toLocaleString('en', {maximumFractionDigits: 0}) + " ms";
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
    const latencyMeanMsChart = echarts.init(document.getElementById('latencyMeanMsChart'));
    const latencyP99MsChart = echarts.init(document.getElementById('latencyP99MsChart'));
    const sensorDataGraph = echarts.init(document.getElementById('sensorDataGraph'));
    const worldGraphChart = echarts.init(document.getElementById('worldGraphChart'));

    return {
        readsPerSecChart, writesPerSecChart, latencyMeanMsChart, latencyP99MsChart, sensorDataGraph, worldGraphChart
    };
}

async function updateCharts(chartInstances) {
    await fetchAndPrepareData();

    const gradients = {
        readsPerSec: ['#0D41E1', '#07C8F9'],
        writesPerSec: ['#ff7b00', '#ffea00'],
        latencyMeanMs: ['#2ea2f9', '#c632e6'],
        latencyP99Ms: ['#2ea2f9', '#c632e6'],
    };

    chartInstances.readsPerSecChart.setOption(createChartOption(metricsData.readsPerSec, gradients.readsPerSec), true);
    chartInstances.writesPerSecChart.setOption(createChartOption(metricsData.writesPerSec, gradients.writesPerSec), true);
    chartInstances.latencyMeanMsChart.setOption(createChartOption(metricsData.latencyMeanMs, gradients.latencyMeanMs), true);
    chartInstances.latencyP99MsChart.setOption(createChartOption(metricsData.latencyP99Ms, gradients.latencyP99Ms), true);

    if (activeTabIndex === 1 && chartInstances.sensorDataGraph) {
        chartInstances.sensorDataGraph.setOption(createGraphOption(), true);
    }

    if (activeTabIndex === 2 && chartInstances.worldGraphChart) {
        chartInstances.worldGraphChart.setOption(createWorldOption(), true);
        chartInstances.worldGraphChart.resize();
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
                shading: 'realistic',
                silent: true,
                environment: '#333',
                realisticMaterial: {
                roughness: 0.8,
                    metalness: 0
            },
            postEffect: {
                enable: true
            },
            groundPlane: {
                show: false,
            },
            light: {
                main: {
                    intensity: 1,
                        alpha: 30
                },
                ambient: {
                    intensity: 0
                }
            },
            viewControl: {
                distance: 80,
                    alpha: 90,
                    panMouseButton: 'left',
                    rotateMouseButton: 'right'
            },
            itemStyle: {
                color: '#000'
            },
            regionHeight: 0.5
        },
        series: [
            {
                type: 'lines3D',
                coordinateSystem: 'geo3D',
                effect: {
                    show: true,
                    trailWidth: 1.5,
                    trailOpacity: 0.25,
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

function getIpClass(ipv4) {
    const firstOctet = parseInt(ipv4.split('.')[0]);
    if (firstOctet >= 1 && firstOctet <= 126) {
        return 'A';
    } else if (firstOctet === 127) {
        return 'Loopback';
    } else if (firstOctet >= 128 && firstOctet <= 191) {
        return 'B';
    } else if (firstOctet >= 192 && firstOctet <= 223) {
        return 'C';
    } else if (firstOctet >= 224 && firstOctet <= 239) {
        return 'D';
    } else if (firstOctet >= 240 && firstOctet <= 255) {
        return 'E';
    } else {
        return 'Other';
    }
}

function createGraphOption() {
    const graphData = devicesData.map(device => {
        return {
            name: device.ipv4, symbolSize: device.sensor_data, itemStyle: {
                color: getNodeColor(device),
            }, class: getIpClass(device.ipv4),
        };
    });

    const graphLinks = [];
    const ipClassToIndexMap = {};
    graphData.forEach((node, index) => {
        if (ipClassToIndexMap[node.class] !== undefined) {
            graphLinks.push({
                source: ipClassToIndexMap[node.class], target: index,
            });
        }
        ipClassToIndexMap[node.class] = index;
    });

    return {
        tooltip: {}, series: [{
            type: 'graph',
            layout: 'force',
            animation: false,
            draggable: false,
            data: graphData,
            links: graphLinks,
            roam: true,
            force: {
                repulsion: 20, edgeLength: 5, gravity: 0.1
            },
            lineStyle: {
                color: 'source',
            }
        },],
    };
}

function getNodeColor(device) {
    const ipClass = getIpClass(device.ipv4);

    switch (ipClass) {
        case 'A':
            return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{offset: 0, color: 'rgb(255, 99, 132)'}, {
                offset: 1,
                color: 'rgb(255, 159, 64)'
            },]);
        case 'B':
            return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{offset: 0, color: 'rgb(75, 192, 192)'}, {
                offset: 1,
                color: 'rgb(153, 102, 255)'
            },]);
        case 'C':
            return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{offset: 0, color: 'rgb(255, 206, 86)'}, {
                offset: 1,
                color: 'rgb(255, 159, 64)'
            },]);
        case 'D':
            return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{offset: 0, color: 'rgb(153, 102, 255)'}, {
                offset: 1,
                color: 'rgb(75, 192, 192)'
            },]);
        case 'E':
            return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{offset: 0, color: 'rgb(255, 159, 64)'}, {
                offset: 1,
                color: 'rgb(255, 99, 132)'
            },]);
        case 'Loopback':
            return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{offset: 0, color: 'rgb(0, 0, 0)'}, {
                offset: 1,
                color: 'rgb(255, 255, 255)'
            },]);
        default:
            return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{offset: 0, color: 'rgb(255, 255, 255)'}, {
                offset: 1,
                color: 'rgb(0, 0, 0)'
            },]);
    }
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
