// Initialize the map
const map = L.map('map').setView([51.505, -0.09], 13);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Variables to manage annotations
let currentAnnotations = [];
let drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

let drawControl;
let currentDrawing = null;
let editingAnnotation = null;

// DOM elements
const addMarkerBtn = document.getElementById('add-marker');
const addPolygonBtn = document.getElementById('add-polygon');
const addLineBtn = document.getElementById('add-line');
const saveDataBtn = document.getElementById('save-data');
const clearAllBtn = document.getElementById('clear-all');
const annotationForm = document.getElementById('annotation-form');
const saveAnnotationBtn = document.getElementById('save-annotation');
const cancelAnnotationBtn = document.getElementById('cancel-annotation');
const annotationsList = document.getElementById('annotations-list');

// Load saved annotations if they exist
loadAnnotations();

// Event listeners
addMarkerBtn.addEventListener('click', () => startDrawing('marker'));
addPolygonBtn.addEventListener('click', () => startDrawing('polygon'));
addLineBtn.addEventListener('click', () => startDrawing('polyline'));
saveDataBtn.addEventListener('click', saveAnnotationsToFile);
clearAllBtn.addEventListener('click', clearAllAnnotations);
saveAnnotationBtn.addEventListener('click', saveCurrentAnnotation);
cancelAnnotationBtn.addEventListener('click', cancelCurrentAnnotation);

// Functions
function startDrawing(type) {
    // Cancel any current drawing
    if (currentDrawing) {
        map.removeLayer(currentDrawing);
    }
    
    // Reset form
    annotationForm.style.display = 'none';
    document.getElementById('annotation-title').value = '';
    document.getElementById('annotation-description').value = '';
    editingAnnotation = null;
    
    let shape;
    
    switch(type) {
        case 'marker':
            map.on('click', addMarker);
            break;
        case 'polygon':
            shape = new L.Draw.Polygon(map);
            shape.enable();
            break;
        case 'polyline':
            shape = new L.Draw.Polyline(map);
            shape.enable();
            break;
    }
    
    currentDrawing = type;
}

function addMarker(e) {
    map.off('click', addMarker);
    
    const marker = L.marker(e.latlng).addTo(drawnItems);
    currentDrawing = marker;
    
    // Show form to add details
    annotationForm.style.display = 'block';
}

function saveCurrentAnnotation() {
    const title = document.getElementById('annotation-title').value;
    const description = document.getElementById('annotation-description').value;
    
    if (!title) {
        alert('Please enter a title');
        return;
    }
    
    const annotation = { 
        id: editingAnnotation ? editingAnnotation.id : Date.now(),
        title,
        description,
        type: getFeatureType(currentDrawing),
        geometry: currentDrawing.toGeoJSON().geometry,
        properties: {}
    };
    
    if (editingAnnotation) {
        // Update existing annotation
        const index = currentAnnotations.findIndex(a => a.id === editingAnnotation.id);
        currentAnnotations[index] = annotation;
        
        // Remove the old layer and add the new one
        drawnItems.eachLayer(layer => {
            if (layer._leaflet_id === editingAnnotation._leaflet_id) {
                drawnItems.removeLayer(layer);
            }
        });
    } else {
        // Add new annotation
        currentAnnotations.push(annotation);
    }
    
    // Add to map with popup
    const layer = L.geoJSON(annotation.geometry).addTo(drawnItems);
    layer.bindPopup(`<b>${annotation.title}</b><br>${annotation.description}`);
    
    // Store leaflet id for later reference
    annotation._leaflet_id = layer._leaflet_id;
    
    // Reset form and current drawing
    annotationForm.style.display = 'none';
    currentDrawing = null;
    editingAnnotation = null;
    
    // Update the annotations list
    updateAnnotationsList();
}

function cancelCurrentAnnotation() {
    if (currentDrawing) {
        if (typeof currentDrawing === 'string') {
            map.off('click', addMarker);
        } else {
            drawnItems.removeLayer(currentDrawing);
        }
    }
    
    annotationForm.style.display = 'none';
    currentDrawing = null;
    editingAnnotation = null;
}

function getFeatureType(layer) {
    if (layer instanceof L.Marker) return 'marker';
    if (layer instanceof L.Polygon) return 'polygon';
    if (layer instanceof L.Polyline) return 'polyline';
    return 'unknown';
}

function updateAnnotationsList() {
    annotationsList.innerHTML = '';
    
    currentAnnotations.forEach(annotation => {
        const item = document.createElement('div');
        item.className = 'annotation-item';
        item.innerHTML = `<strong>${annotation.title}</strong><br>${annotation.type}`;
        
        item.addEventListener('click', () => {
            // Center map on the annotation
            const layer = findLayerById(annotation._leaflet_id);
            if (layer) {
                map.fitBounds(layer.getBounds());
                layer.openPopup();
            }
        });
        
        // Add edit button
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.style.marginTop = '5px';
        editBtn.style.backgroundColor = '#2196F3';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editAnnotation(annotation);
        });
        
        item.appendChild(editBtn);
        annotationsList.appendChild(item);
    });
}

function findLayerById(id) {
    let foundLayer = null;
    drawnItems.eachLayer(layer => {
        if (layer._leaflet_id === id) {
            foundLayer = layer;
        }
    });
    return foundLayer;
}

function editAnnotation(annotation) {
    // Find the layer
    const layer = findLayerById(annotation._leaflet_id);
    if (!layer) return;
    
    // Set current drawing and editing annotation
    currentDrawing = layer;
    editingAnnotation = annotation;
    
    // Show form with current values
    document.getElementById('annotation-title').value = annotation.title;
    document.getElementById('annotation-description').value = annotation.description;
    annotationForm.style.display = 'block';
}

function saveAnnotationsToFile() {
    const geojson = {
        type: "FeatureCollection",
        features: currentAnnotations.map(annotation => ({
            type: "Feature",
            geometry: annotation.geometry,
            properties: {
                id: annotation.id,
                title: annotation.title,
                description: annotation.description,
                type: annotation.type
            }
        }))
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojson, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "annotations.geojson");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function loadAnnotations() {
    // In a real app, you would load from a file or server
    // For now, we'll just initialize an empty array
    currentAnnotations = [];
    updateAnnotationsList();
}

function clearAllAnnotations() {
    if (confirm('Are you sure you want to clear all annotations?')) {
        currentAnnotations = [];
        drawnItems.clearLayers();
        updateAnnotationsList();
    }
}

// Handle drawn features from the control
map.on(L.Draw.Event.CREATED, function (e) {
    const layer = e.layer;
    drawnItems.addLayer(layer);
    currentDrawing = layer;
    
    // Show form to add details
    annotationForm.style.display = 'block';
});
