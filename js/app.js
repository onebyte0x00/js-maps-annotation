// Initialize the map
const map = L.map('map').setView([51.505, -0.09], 13);

// Add tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Variables
let drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

let currentTool = null;
let measurePoints = [];
let measureLine = null;
let measureLabels = [];
let totalDistance = 0;

// DOM elements
const markerBtn = document.getElementById('marker-btn');
const lineBtn = document.getElementById('line-btn');
const circleBtn = document.getElementById('circle-btn');
const measureBtn = document.getElementById('measure-btn');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const distanceValue = document.getElementById('distance-value');

// Event listeners
markerBtn.addEventListener('click', () => setActiveTool('marker'));
lineBtn.addEventListener('click', () => setActiveTool('line'));
circleBtn.addEventListener('click', () => setActiveTool('circle'));
measureBtn.addEventListener('click', () => setActiveTool('measure'));
saveBtn.addEventListener('click', saveAnnotations);
clearBtn.addEventListener('click', clearAll);

// Functions
function setActiveTool(tool) {
    // Reset measurement if switching tools
    if (currentTool === 'measure') {
        resetMeasurement();
    }
    
    // Set active tool
    currentTool = tool;
    
    // Update UI
    document.querySelectorAll('.tool-buttons button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (tool === 'marker') {
        markerBtn.classList.add('active');
        map.off('click', handleMapClick);
        map.on('click', handleMapClick);
    } else if (tool === 'line') {
        lineBtn.classList.add('active');
        map.off('click', handleMapClick);
        map.on('click', handleMapClick);
    } else if (tool === 'circle') {
        circleBtn.classList.add('active');
        map.off('click', handleMapClick);
        map.on('click', handleMapClick);
    } else if (tool === 'measure') {
        measureBtn.classList.add('active');
        map.off('click', handleMapClick);
        map.on('click', handleMeasurementClick);
    }
}

function handleMapClick(e) {
    if (currentTool === 'marker') {
        const marker = L.marker(e.latlng).addTo(drawnItems);
        marker.bindPopup(`Marker at ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`).openPopup();
    } else if (currentTool === 'line') {
        if (!drawnItems.getLayers().some(layer => layer instanceof L.Polyline && layer._currentLatLngs)) {
            const polyline = L.polyline([e.latlng], {color: 'red'}).addTo(drawnItems);
            map.on('mousemove', updateLine);
            map.on('click', finishLine);
        }
    } else if (currentTool === 'circle') {
        const circle = L.circle(e.latlng, {
            color: 'blue',
            fillColor: '#3388ff',
            fillOpacity: 0.3,
            radius: 500
        }).addTo(drawnItems);
        
        const area = (Math.PI * 500 * 500).toFixed(2);
        circle.bindPopup(`Circle (Radius: 500m, Area: ${area}m²)`).openPopup();
    }
}

function updateLine(e) {
    const layers = drawnItems.getLayers();
    const lastLine = layers.find(layer => layer instanceof L.Polyline && layer._currentLatLngs);
    
    if (lastLine) {
        const latLngs = lastLine.getLatLngs();
        latLngs.push(e.latlng);
        lastLine.setLatLngs(latLngs);
    }
}

function finishLine(e) {
    map.off('mousemove', updateLine);
    map.off('click', finishLine);
    
    const layers = drawnItems.getLayers();
    const lastLine = layers.find(layer => layer instanceof L.Polyline && layer._currentLatLngs);
    
    if (lastLine) {
        const length = lastLine.getLatLngs().reduce((total, latLng, i, arr) => {
            if (i > 0) {
                return total + arr[i-1].distanceTo(latLng);
            }
            return total;
        }, 0);
        
        lastLine.bindPopup(`Line (Length: ${length.toFixed(2)} meters)`).openPopup();
    }
}

function handleMeasurementClick(e) {
    measurePoints.push(e.latlng);
    
    // Add point marker
    const marker = L.circleMarker(e.latlng, {
        radius: 5,
        fillColor: "#3388ff",
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 1
    }).addTo(map);
    measureLabels.push(marker);
    
    // Update line if we have more than one point
    if (measurePoints.length > 1) {
        if (measureLine) {
            map.removeLayer(measureLine);
        }
        
        measureLine = L.polyline(measurePoints, {
            color: '#3388ff',
            weight: 3,
            dashArray: '5, 5'
        }).addTo(map);
        
        // Calculate distance
        const segmentDistance = measurePoints[measurePoints.length-2].distanceTo(e.latlng);
        totalDistance += segmentDistance;
        distanceValue.textContent = totalDistance.toFixed(2);
        
        // Add distance label
        const midPoint = L.latLng(
            (measurePoints[measurePoints.length-2].lat + e.latlng.lat) / 2,
            (measurePoints[measurePoints.length-2].lng + e.latlng.lng) / 2
        );
        
        const label = L.marker(midPoint, {
            icon: L.divIcon({
                className: 'measurement-label',
                html: `${segmentDistance.toFixed(2)}m`,
                iconSize: [60, 24]
            })
        }).addTo(map);
        measureLabels.push(label);
    }
}

function resetMeasurement() {
    measurePoints = [];
    totalDistance = 0;
    distanceValue.textContent = '0';
    
    if (measureLine) {
        map.removeLayer(measureLine);
        measureLine = null;
    }
    
    measureLabels.forEach(label => map.removeLayer(label));
    measureLabels = [];
}

function saveAnnotations() {
    const geoJson = drawnItems.toGeoJSON();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geoJson, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "annotations.geojson");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function clearAll() {
    if (confirm('Are you sure you want to clear all annotations?')) {
        drawnItems.clearLayers();
        resetMeasurement();
    }
}
