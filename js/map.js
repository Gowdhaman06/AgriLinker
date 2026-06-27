// Leaflet Map Helpers and Utilities
const AgriMap = {
  // Custom Icon Generators
  getIcon(type) {
    let iconUrl = '';
    let markerColor = '#1e6b3f'; // default forest green
    let html = '';

    if (type === 'farmer') {
      markerColor = '#1e6b3f';
      html = `<div style="background-color: ${markerColor}; width: 36px; height: 36px; border-radius: 50%; border: 3px solid #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); color: white;"><i class="ri-plant-fill" style="font-size: 18px;"></i></div>`;
    } else if (type === 'customer') {
      markerColor = '#e8a020';
      html = `<div style="background-color: ${markerColor}; width: 36px; height: 36px; border-radius: 50%; border: 3px solid #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); color: white;"><i class="ri-user-location-fill" style="font-size: 18px;"></i></div>`;
    } else if (type === 'delivery') {
      markerColor = '#7cc243';
      html = `<div style="background-color: ${markerColor}; width: 36px; height: 36px; border-radius: 50%; border: 3px solid #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); color: white;"><i class="ri-motorbike-fill" style="font-size: 18px;"></i></div>`;
    } else {
      markerColor = '#6b7280';
      html = `<div style="background-color: ${markerColor}; width: 30px; height: 30px; border-radius: 50%; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); color: white;"><i class="ri-map-pin-fill" style="font-size: 14px;"></i></div>`;
    }

    return L.divIcon({
      html: html,
      className: 'custom-map-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
  },

  // Initialize a Leaflet map
  init(containerId, centerCoords = [12.9716, 77.5946], zoom = 12) {
    const map = L.map(containerId).setView(centerCoords, zoom);

    // Standard OpenStreetMap tiles (aesthetics managed in main.css via filters)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    return map;
  },

  // Add marker to map
  addMarker(map, coords, popupContent, type = 'default', draggable = false) {
    const markerOptions = {
      icon: this.getIcon(type),
      draggable: draggable
    };
    
    const marker = L.marker(coords, markerOptions).addTo(map);
    
    if (popupContent) {
      marker.bindPopup(popupContent);
    }
    
    return marker;
  },

  // Haversine formula to compute distance in km
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  },

  // Calculate delivery charge based on weight and distance
  calculateDeliveryCharge(distanceKm, weightKg = 1) {
    // Flat ₹40 base charge. Add ₹5 per km if distance is above 10km.
    // Double the rate if weight is above 5kg.
    let base = 40;
    
    if (distanceKm > 10) {
      base += Math.round((distanceKm - 10) * 5);
    }
    
    if (weightKg >= 5) {
      base += 40; // Heavy package surcharge
    }
    
    return base;
  },

  // Simulate delivery transit animation on the map
  simulateRoute(map, startCoords, endCoords, onComplete) {
    // Clear previous routing lines if any
    if (map._routingLine) {
      map.removeLayer(map._routingLine);
    }

    // Draw straight line path representing route
    const pathPoints = [startCoords, endCoords];
    const polyline = L.polyline(pathPoints, {
      color: '#7cc243',
      weight: 4,
      opacity: 0.8,
      dashArray: '10, 10'
    }).addTo(map);

    map._routingLine = polyline;

    // Create delivery courier animated marker
    const courierMarker = L.marker(startCoords, {
      icon: this.getIcon('delivery')
    }).addTo(map);

    let progress = 0;
    const steps = 100;
    const intervalTime = 100; // total 10s animation

    const interval = setInterval(() => {
      progress++;
      const currentLat = startCoords[0] + (endCoords[0] - startCoords[0]) * (progress / steps);
      const currentLng = startCoords[1] + (endCoords[1] - startCoords[1]) * (progress / steps);
      
      courierMarker.setLatLng([currentLat, currentLng]);

      if (progress >= steps) {
        clearInterval(interval);
        map.removeLayer(courierMarker);
        if (onComplete) onComplete();
      }
    }, intervalTime);

    return { polyline, courierMarker };
  }
};
