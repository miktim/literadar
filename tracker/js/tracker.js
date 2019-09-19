/* 
 *   LiteRadar tracker
 *   Author: miktim@mail.ru
 *   Created: 2019-09-05
 *   Updated: 2019-09-10
 *   License: CC BY-SA
 */
(window.T = {
    version: '0.1.0',
    mode: {},
// https://stackoverflow.com/questions/15521343/conditionally-load-javascript-file
    isMobileDevice: (screen.width > 500) ? false : true,
    map: undefined,
    mapIsLoaded: false,
    marker: undefined,
    markerIcon: undefined,
    track: undefined,
    trackAccuracy: undefined,
    options: {},
    onMessage: function(m) {
        var obj = JSON.parse(m);
        if (obj.action === "point") {
            T.nextPoint(obj);
        }
    },
    onClickMarker: function(e) {
        T.initTrack();
    },
    nextPoint: function(p) {
        if (T.marker) {
            T.marker.setLatLng(p.latlng);
        } else {
            T.marker = L.marker(p.latlng, {icon: T.markerIcon}).addTo(T.map);
            T.marker.on('click', T.onClickMarker);
            T.marker.bindPopup(p.id).openPopup();
        }
        T.track.addLatLng(p.latlng);
        L.circle(p.latlng, p.accuracy / 2, {weight: 1, color: "blue"}).addTo(T.trackAccuracy);
    },
    initTrack: function() {
        if (T.map.hasLayer(T.trackAccuracy)) {
            T.map.removeLayer(T.trackAccuracy);
            T.trackAccuracy = undefined;
        }
        if (T.map.hasLayer(T.track)) {
            T.map.removeLayer(T.track);
            T.track = undefined;
        }
        T.track = L.polyline([], {weight: 2, color: "red"}).addTo(T.map);
        T.trackAccuracy = L.featureGroup();
        T.map.addLayer(T.trackAccuracy);
    },
    onLocationFound: function(e) {
        if (e.latlng) {
            T.map.setView(e.latlng, T.mapIsLoaded ? T.map.getZoom() : 17);
            if (!e.id)
                e.id = "It's me.";
            T.nextPoint(e);
        }
    },
    onLocationError: function(e) {
            console.log(e.message);
            T.map.stopLocate();
//            demo.run(5000);
    },
    initMap: function(mapContainer) {
        if (T.map)
            return;
        var isz = 32; //T.isMobileDevice ? 64 : 32;
        T.markerIcon = L.icon({
            iconSize: [isz, isz],
            iconAnchor: [isz / 2, isz],
            iconUrl: "./images/phone_y.png"
        });
        T.map = L.map(mapContainer, {
            minZoom: 8,
            zoom: 17,
            zoomControl: T.isMobileDevice ? false : true
        });
        L.tileLayer(window.location.protocol + '//{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(T.map);
//                    if (T.isMobileDevice)
//                        document.getElementsByClassName("leaflet-control-attribution")[0].style.fontSize = "22px";
        T.map.on('locationerror', T.onLocationError);
        T.map.on('locationfound', T.onLocationFound);
        T.map.on('load', function() {
            T.mapIsLoaded = true;
        });
        T.map.locate({
            watch: true,
            maximumAge: 15000,
            enableHighAccuracy: true,
            setView: false,
            timeout: 5000
        });
        T.initTrack();
    },
    run: function(mapContainer, opt) {
        T.initMap(document.getElementById(mapContainer));
        if (opt.mode === "demo") demo.run(5000);
    }
}
);
var demo = {
    point: {
        action: "point",
        id: "This is a demo.",
        latlng: [51.505, -0.09],
        accuracy: 20,
        heading: 0,
        speed: 0,
        timestamp: Date.now(),
        altitude: 0,
        altitudeAccuracy: 0,
        bounds: undefined
    },
    randDbl: function(minDbl, maxDbl) {
        if (minDbl === maxDbl)
            return minDbl;
        return (Math.random() * (maxDbl - minDbl)) + minDbl;
    },
// http://www.movable-type.co.uk/scripts/latlong.html
    pointRadialDistance: function(latLng, degreeBearing, radialDistance) {
        var R = 6371.01; // Earth radius km
        var d = radialDistance; // distance km
        var brng = (degreeBearing % 360) * Math.PI / 180; //degree bearing to radiant bearing
        var φ1 = latLng[0] * Math.PI / 180; // latitude to radiant
        var λ1 = latLng[1] * Math.PI / 180; // longitude to radiant
        var φ2 = Math.asin(Math.sin(φ1) * Math.cos(d / R) +
                Math.cos(φ1) * Math.sin(d / R) * Math.cos(brng));
        var λ2 = λ1 + Math.atan2(Math.sin(brng) * Math.sin(d / R) * Math.cos(φ1),
                Math.cos(d / R) - Math.sin(φ1) * Math.sin(φ2));
        return [φ2 * 180 / Math.PI, ((λ2 * 180 / Math.PI) + 540) % 360 - 180];
    },
    moveRandom: function() {
        this.point.heading = this.randDbl(0, 90);
        var ll = this.pointRadialDistance(
                this.point.latlng,
                this.point.heading,
                this.randDbl(0.01, 0.05)
                );
//        this.point.speed =
        this.point.latlng = ll;
        this.point.accuracy = this.randDbl(10, 50);
        this.point.timestamp = Date.now();
    },
    sendPoint: function(p) {
//                    T.parseMsg(JSON.stringify(p));
        T.onLocationFound(p);
    },
    run: function(delay) { // milliseconds
        this.sendPoint(this);
        setInterval(function(t) {
            t.moveRandom();
            t.sendPoint(t.point);
        }, delay, this); //!IE9
    }
};




