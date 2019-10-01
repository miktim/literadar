/* 
 * LiteRadar tracker
 * Author: miktim@mail.ru
 * Created: 2019-09-05
 * Updated: 2019-10-01
 * License: CC-BY-SA
 */

(function(window, document) {
    T = {
        version: '0.1.0',
        isSmart: (screen.width > 500) ? false : true,
// http search example: ?mode=watch,demo&ws=localhost:10090&watch=60:15:20        
        search: {
            mode: '', // [watch], nowatch, demo
            watch: '', //timeout(sec):maxAge(sec):minDistance(meters)
            ws: ''// websocket address
        },
        options: {
            timeout: 20000,
            maxAge: 20000,
            minDistance: 20
        },
        messages: {},
        points: {},
        icons: {
            own: undefined,
            active: undefined,
            inactive: undefined
        },
        map: undefined
    };
    window.T = T;
    T.update = function(obj, opts) {
        for (var key in opts)
            if (key in obj)
                obj[key] = opts[key];
        return obj;
    };
    T.makeIcon = function(url, isz) {
        isz = isz || 32;
        return L.icon({
            iconSize: [isz, isz],
            iconAnchor: [isz / 2, isz],
            iconUrl: url
        });
    };
    T.icons.own = T.makeIcon("./images/phone_y.png");
    T.icons.active = T.makeIcon("./images/phone_b.png");
    T.icons.inactive = T.makeIcon("./images/phone_g.png");

    T.Point = function() {
        this.id = '';         // unique source id (string)
        this.latlng = undefined;     // [latitude, longitude]
        this.accuracy = NaN;  // meters (radius)
        this.speed = NaN;     // meters per second
        this.altitude = NaN;  // meters
        this.heading = NaN;   // degrees counting clockwise from true North
        this.timestamp = NaN; // acquired time in milliseconds
        this.timeout = NaN;   // lifetime in milliseconds
    };
    T.onAction = function(m) {
        var obj = JSON.parse(m);
        if (obj.action === "point") {
            this.onPoint(obj); //t.map
        }
    };
    T.onPoint = function(p) {
        if (!this.points[p.id]) {
            this.points[p.id] = p;
        }
        this.map.moveMarker(p);
    };
    T.removeInactive = function() {

    };
    T.checkWebSocket = function() {
        if (this.search.ws) {
//var wsurl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://')+this.search.ws;
            var wsurl = 'wss://' + this.search.ws;
            try {
                T.webSocket = new WebSocket(wsurl);
                T.webSocket.onmessage = function(m) {
                    T.onAction(m);
                };
                T.webSocket.onopen = function(e) {
                    T.sendMessage = function(m) {
                        T.webSocket.send(m);
                    };
                    console.log('WebSocket open');
                };
                T.webSocket.onclose = function(e) {
                    console.log("WebSocket close");
                };
                T.webSocket.onerror = function(e) {
                    console.log(e.message);
                };
            } catch (e) {
                console.log(e.message);
            }
        }
    };
    T.onLocationFound = function(l) {
        var p = new T.Point();
        T.update(p, l.coords);
        p.id = "It's me";
        p.latlng = [l.coords.latitude, l.coords.longitude];
        p.timestamp = l.timestamp;
        p.timeout = T.options.maxAge;
        if (!this.points[p.id])
            this.map.setMarker(p, this.icons.own);
        this.onPoint(p);
    };
    T.onLocationError = function(e) {
        console.log(e.message);
        this.stopLocation();
    };
// https://w3c.github.io/geolocation-api/
// leaflet.src.js section Geolocation methods
    T.watchId;
    T.watchLocation = function(onLocation, onError, options) {
        if (!('geolocation' in navigator)) {
            onError({
                code: 0,
                message: 'Geolocation not supported.'
            });
            return;
        }
        if (this.watchId)
            this.stopLocation();
        this.watchId = (navigator.geolocation.watchPosition(
                onLocation, onError, options));
    };
    T.stopLocation = function() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = undefined;
        }
    };
    T.testMode = function(mode) {
        return ((new RegExp('(^|,)' + mode + '(,|$)', 'i')).test(this.search.mode));
    };
    T.checkWatch = function() {
        var src = (this.search.watch + '::').split(':');
        if (parseInt(src[0]))
            this.options.timeout = parseInt(src[0]) * 1000;
        if (parseInt(src[1]))
            this.options.maxAge = parseInt(src[1]) * 1000;
        if (parseInt(src[2]))
            this.options.minDistance = parseInt(src[2]);
        if (!this.testMode('nowatch'))
            this.watchLocation(
                    function(l) {
                        T.onLocationFound(l);
                    },
                    function(e) {
                        T.onLocationError(e);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: this.options.timeout,
                        maximumAge: this.options.maxAge
                    });
    };
    T.checkDemo = function(latlng) {
        if (this.testMode('demo'))
            this.demo.run(5000, latlng);
    };
    T.run = function(opts, mapId, latlng) {
        this.update(this.search, opts);
        this.map = this.trackerMap(mapId, latlng);
        this.checkWebSocket();
        this.checkWatch();
    };
    // http://www.movable-type.co.uk/scripts/latlong.html
    T.distance = function(latlng1, latlng2) {
        var R = 6371e3; // metres
        /*            var φ1 = lat1.toRadians();
         var φ2 = lat2.toRadians();
         var Δφ = (lat2 - lat1).toRadians();
         var Δλ = (lon2 - lon1).toRadians();
         */
        var φ1 = latlng1[0] * Math.PI / 180;
        var φ2 = latlng2[0] * Math.PI / 180;
        var Δφ = (latlng2[0] - latlng1[0]) * Math.PI / 180;
        var Δλ = (latlng2[1] - latlng1[1]) * Math.PI / 180;

        var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        var d = R * c;
        return d;
    };

    T.trackerMap = function(mapId, latlng) {
        var map = L.map(mapId, {
            minZoom: 10,
            zoom: 18,
            zoomControl: false
        });
        L.tileLayer(window.location.protocol + '//{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
//        L.control.scale({metric: true}).addTo(map);
        map.isLoaded = false;
        map.showAccuracy = true;
        map.hideAccuracy = function(hide) {
            this.showAccuracy = hide || false;
        };
        map.markers = [];
        map.track = {
            marker: undefined,
            path: undefined,
            accuracy: undefined
        };
        map.track.init = function(map) {
            if (map.hasLayer(this.accuracy)) {
                map.removeLayer(this.accuracy);
                this.accuracy = undefined;
            }
            if (map.hasLayer(this.path)) {
                map.removeLayer(this.path);
                this.path = undefined;
            }
            this.path = L.polyline([], {weight: 2, color: "red"}).addTo(map);
            this.accuracy = L.featureGroup();
            map.addLayer(this.accuracy);
            map.trackMarker(this.marker);
        };
        map.onMarkerClick = function(e) {
            var id = e.target.options.alt;
            var marker = this.markers[id];
            if (this.track.marker === marker)
                this.track.marker = undefined;
            else {
                this.track.marker = marker;
                this.track.init(this);
            }
        };
        map.setMarker = function(point, icon) {
            icon = icon || T.icons.active;
            var marker = this.markers[point.id];
            if (!this.isLoaded)
                this.setView(point.latlng, this.getZoom());
            if (!marker) {
                marker = L.marker(point.latlng, {icon: icon, alt: point.id});
                marker.on('click', function(e) {
                    map.onMarkerClick(e);
                });
                marker.addTo(this);
                marker.accuracy = L.circle(point.latlng, point.accuracy,
                        {weight: 1, color: "blue"}).addTo(this);
                this.markers[point.id] = marker;
            } else
                marker.setIcon(icon);
            return marker;
        };
        map.trackMarker = function(marker) {
            if (this.track.marker === marker) {
                var latlng = marker.getLatLng();
                var path = this.track.path.getLatLngs();
                var dist = path.length > 0 ?
                        T.distance(latlng, path[path.length - 1]) : 0;
                if (dist >= T.options.minDistance) {
                    this.track.path.addLatLng(latlng);
                    L.circle(latlng, marker.accuracy.getRadius(),
                            {weight: 1, color: "blue"}).addTo(this.track.accuracy);
                }
                this.setView(latlng, this.getZoom());
            }
        };
        map.moveMarker = function(point) {
            var marker = this.markers[point.id];
            if (!marker)
                this.setMarker(point);
            else {
                marker.setLatLng(point.latlng);
                marker.accuracy.setLatLng(point.latlng);
                marker.accuracy.setRadius(point.accuracy / 2);
                this.trackMarker(marker);
            }
        };
        map.removeMarker = function(point) {

        };
        map.onLoad = function(e) {
            this.isLoaded = true;
        };
        map.on('load', function(e) {
            map.onLoad(e); // bind?
        });
        if (latlng)
            map.setView(latlng, map.getZoom());
        else {
            map.on('locationfound', function(e) {
                T.checkDemo(e.latlng);
            });
            map.on('locationerror', function(e) {
                console.log(e.message);
                T.checkDemo();
            });
            map.locate({setView: false});
        }
        return map;
    };
    /*    
     console: {
     control: undefined,
     log: function(m, opt) {
     if (!this.control) {
     this.control = document.createElement('div');
     this.control.className = "tracker-console leaflet-control";
     T.mapElement.after(this.control);
     }
     this.control.innerHTML = m;
     },
     clear: function() {
     if (this.control) {
     this.control.remove();
     }
     }
     },
     */
    T.demo = {
        isRunning: false,
        demos: [],
// http://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range
        randInt: function(minInt, maxInt) {
            if (minInt === maxInt)
                return minInt;
            return Math.floor((Math.random() * (maxInt - minInt + 1)) + minInt);
        },
        randDbl: function(minDbl, maxDbl) {
            if (minDbl === maxDbl)
                return minDbl;
            return (Math.random() * (maxDbl - minDbl)) + minDbl;
        },
// http://www.movable-type.co.uk/scripts/latlong.html
        pointRadialDistance: function(latLng, degreeBearing, radialDistance) {
            var R = 6371.01; // Earth radius km
            var d = radialDistance / 1000; // distance km
            var brng = (degreeBearing % 360) * Math.PI / 180; //degree bearing to radiant bearing
            var φ1 = latLng[0] * Math.PI / 180; // latitude to radiant
            var λ1 = latLng[1] * Math.PI / 180; // longitude to radiant
            var φ2 = Math.asin(Math.sin(φ1) * Math.cos(d / R) +
                    Math.cos(φ1) * Math.sin(d / R) * Math.cos(brng));
            var λ2 = λ1 + Math.atan2(Math.sin(brng) * Math.sin(d / R) * Math.cos(φ1),
                    Math.cos(d / R) - Math.sin(φ1) * Math.sin(φ2));
            return [φ2 * 180 / Math.PI, ((λ2 * 180 / Math.PI) + 540) % 360 - 180];
        },
        moveRandom: function(p) {
            p.heading = this.randDbl(0, 180);
            var latlng = this.pointRadialDistance(
                    p.latlng,
                    p.heading,
                    this.randDbl(10, 50)
                    );
            p.speed = T.distance(p.latlng, latlng)
                    /((Date.now - p.timestamp)/1000); //meters per second
            p.latlng = latlng;
            p.accuracy = this.randDbl(5, 25); //radius!
            p.timestamp = Date.now();
            return p;
        },
        sendPoint: function(p) {
            T.onAction(JSON.stringify(p));
        },
        run: function(delay, latlng) { // milliseconds, initial position
            if (this.isRunning)
                return;
            for (var i = 0; i < 5; i++) {
                var p = new T.Point();
                p.action = 'point';
                p.id = 'Demo ' + (i + 1);
                p.latlng = latlng ? latlng : [51.505, -0.09];
                p.timeout = delay;
                this.demos[i] = this.moveRandom(p);
            }
            setInterval(function(d) {
                for (var i = 0; i < d.demos.length; i++)
                    d.sendPoint(d.moveRandom(d.demos[i]));
            }, delay, this); //!IE9
            this.isRunning = true;
        }
    };
}(window, document));






