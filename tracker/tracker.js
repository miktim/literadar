/* 
 * LiteRadar tracker rev 191004
 * (c) 2019 miktim@mail.ru CC-BY-SA
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
            timeout: 30000,
            maxAge: 20000,
            minDistance: 20
        },
        locale: {
            itsme: "It's me."
        },
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
        this.latlng = undefined;     // {lat, lng}
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
        p.id = T.locale.itsme;
        p.latlng = L.latLng(l.coords.latitude, l.coords.longitude);
        p.timestamp = l.timestamp;
        p.timeout = T.options.maxAge;
        if (!this.points[p.id])
            this.map.setMarker(p, this.icons.own);
        this.onPoint(p);
    };
    T.onLocationError = function(e) {
        console.log('Geolocation: ' + e.message);
//        this.stopLocation();
    };
// https://w3c.github.io/geolocation-api/
// leaflet.src.js section Geolocation methods
    T.watchId;
    T.watchLocation = function(onLocation, onError, options) {
        if (!('geolocation' in navigator)) {
            onError({
                code: 0,
                message: 'not supported.'
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
    T.checkWatchMode = function() {
        var src = (this.search.watch + '::').split(':');
        if (parseInt(src[0]))
            this.options.timeout = parseInt(src[0]) * 1000;
        if (parseInt(src[1]))
            this.options.maxAge = parseInt(src[1]) * 1000;
        if (parseInt(src[2]))
            this.options.minDistance = parseInt(src[2]);
        if (!this.testMode('nowatch'))
            this.watchLocation(
                    function(e) {
                        T.onLocationFound(e);
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
    T.checkDemoMode = function(latlng) {
        if (this.testMode('demo'))
            this.demo.run(5000, latlng);
    };
    T.run = function(opts, mapId, latlng) {
        T.update(this.search, opts);
        this.map = this._map(mapId, latlng);
        this.checkWebSocket();
        this.checkWatchMode();
    };
// http://www.movable-type.co.uk/scripts/latlong.html
    T.distanceBetween = function(latlngA, latlngB) {
        var R = 6371010; // Earth radius in meters
        /*
         var φ1 = lat1.toRadians();
         var φ2 = lat2.toRadians();
         var Δφ = (lat2 - lat1).toRadians();
         var Δλ = (lon2 - lon1).toRadians();
         */
        latlngA = ('lat' in latlngA) ? [latlngA.lat, latlngA.lng] : latlngA;
        latlngB = ('lat' in latlngB) ? [latlngB.lat, latlngB.lng] : latlngB;
        var φ1 = latlngA[0] * Math.PI / 180;
        var φ2 = latlngB[0] * Math.PI / 180;
        var Δφ = (latlngB[0] - latlngA[0]) * Math.PI / 180;
        var Δλ = (latlngB[1] - latlngA[1]) * Math.PI / 180;

        var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };

    T._map = function(mapId, latlng) {
        var map = L.map(mapId, {
            minZoom: 10,
            zoom: 17,
            zoomControl: false
        });
        L.tileLayer(window.location.protocol + '//{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        map.isLoaded = false;
        map.showAccuracy = true;
        map.hideAccuracy = function(hide) {
            this.showAccuracy = !hide;
        };
        map.markers = [];
        map.track = {
            marker: undefined,
            path: undefined,
            accuracy: undefined,
            started: undefined,
            pathLength: undefined
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
            this.pathLength = 0;
        };
        map.onMarkerClick = function(e) {
            var id = e.target.options.alt;
            var marker = this.markers[id];
            if (this.track.marker === marker) {
                this.track.marker = undefined;
                if (this.infoPane)
                    this.UI.infoPane.removeFrom(this);
            } else {
                this.track.init(this);
                this.track.started = Date.now();
                if (!this.infoPane)
                    this.UI.infoPane.addTo(this);
                this.track.marker = marker;
                this.trackMarker(marker);
            }
        };
        map.setMarker = function(point, icon) {
            icon = icon || T.icons.active;
            var marker = this.markers[point.id];
            if (!this.isLoaded && this.markers.length === 0)
                this.setView(point.latlng, this.options.zoom);
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
                var pos = marker.getLatLng();
                var pln = this.track.path.getLatLngs();
                var dst = (pln.length > 0 ?
                        T.distanceBetween(pos, pln[pln.length - 1]) : 0);
                this.track.pathLength += dst;
                if (pln.length === 0 || dst >= T.options.minDistance) {
                    this.track.path.addLatLng(pos);
                    L.circle(pos, marker.accuracy.getRadius(),
                            {weight: 1, color: "blue"}).addTo(this.track.accuracy);
                }
                this.setView(pos, this.getZoom());
                this.UI.infoPane.update({
                    id: marker.options.alt,
                    trackLength: this.track.pathLength,
                    timestamp: Date.now(),
                    accuracy: marker.accuracy.getRadius()
                });
            }
        };
        map.moveMarker = function(point) {
            var marker = this.markers[point.id];
            if (!marker)
                this.setMarker(point);
            else {
                marker.setLatLng(point.latlng);
                marker.accuracy.setLatLng(point.latlng);
                marker.accuracy.setRadius(point.accuracy);
                this.trackMarker(marker);
            }
        };
        map.removeMarker = function(point) {

        };
        map.UI = {
            infoPane: undefined,
            consolePane: undefined,
            controlPane: undefined,
            init: function(map) {

                map.UI.infoPane = new (L.Control.extend({
                    options: {
                        position: 'bottomleft',
                        infoData: {id: {nick: 'Track', unit: ''},
                            trackLength: {nick: 'Dist', unit: 'm'},
                            trackTime: {nick: 'Time', unit: ''},
                            timestamp: {nick: 'TME', unit: ''},
                            speed: {nick: 'SPD', unit: 'm/sec'},
                            accuracy: {nick: 'ACC', unit: 'm'}
                        }
                    },
                    onAdd: function(map) {
                        var pane = L.DomUtil.create('div', 'tracker-pane');
                        var tbl = L.DomUtil.create('table', 'tracker-info-table', pane)
                                , row, el;
                        for (var key in this.options.infoData) {
                            row = L.DomUtil.create('tr', 'tracker-info-row', tbl);
                            el = L.DomUtil.create('td', 'tracker-info-cell', row);
                            el.innerHTML = this.options.infoData[key].nick;
                            el = L.DomUtil.create('td', 'tracker-info-cell', row);
                            this.options.infoData[key].element = el;
                        }
// https://stackoverflow.com/questions/33146809/find-out-if-a-leaflet-control-has-already-been-added-to-the-map                
                        el = this.options.infoData.trackTime.element;
                        el.innerHTML = '00:00:00';
                        this.options.timer = setInterval(function(element, startTime) {
                            element.innerHTML = ((new Date(Date.now() - startTime))
                                    .toISOString().substring(11, 19));
                        }, 30000, el, Date.now());
                        map.infoPane = this;
                        return pane;
                    },
                    onRemove: function(map) {
                        clearInterval(map.infoPane.options.timer);
                        delete map.infoPane;
                    },
                    update: function(info) {
                        for (var key in this.options.infoData) {
                            if (!(key in info))
                                continue;
                            var value = info[key];
                            switch (key) {
                                case 'id':
                                    break;
                                case 'timestamp' :
                                    value = (new Date(value)).toTimeString()
                                            .substring(0, 8);
                                    break;
                                default:
                                    value = Math.round(value).toString();
                            }
                            this.options.infoData[key].element.innerHTML = value;
                        }
                    }
                }));
                map.UI.consolePane = new (L.Control.extend({
                    options: {position: 'bottomright', element: undefined},
                    onAdd: function(map) {
                        var pane = L.DomUtil.create('div', 'tracker-pane');
                        this.options.element = pane;
                        L.DomUtil.create('div', 'tracker-console-message', pane);
                        pane.hidden = true;
                        map.consolePane = this;
                        return pane;
                    },
                    onRemove: function(map) {
                        delete map.consolePane;
                    },
                    log: function(m, timeout) {
                        if (m) {
                            this.options.element.childNodes[0].innerHTML =
                                    (new Date()).toTimeString().substring(0, 8)
                                    + ' ' + m;
                            this.options.element.hidden = false;
                            timeout = timeout ? timeout : 10000;
                            this.options.timer = setTimeout(function(e) {
                                e.hidden = true;
                            }, timeout, this.options.element);
                        } else {
                            this.options.element.hidden = true;
                        }
                    }
                }));
                map.UI.consolePane.addTo(map);
                map.UI.controlPane = new (L.Control.extend({
                    options: {position: 'topright'},
                    onAdd: function(map) {
                        var pane = L.DomUtil.create('div', 'tracker-pane');
                        return pane;
                    },
                    onRemove: function(map) {

                    }
                }));
                map.UI.controlPane.addTo(map);
            }
        }
        map.onLoad = function(e) {
            this.isLoaded = true;
            T.checkDemoMode(this.getCenter());
            this.UI.consolePane.log();
        };
        map.on('load', function(e) {
            map.onLoad(e); // bind?
        });

        map.UI.init(map);
        map.UI.consolePane.log('Expect location...', 100000);
        if (latlng)
            map.setView(latlng, this.options.zoom);
        else {
            map.on('locationfound', function(e) {
                T.checkDemoMode(e.latlng);
            });
            map.on('locationerror', function(e) {
                console.log(e.message);
                T.checkDemoMode();
            });
            map.locate({setView: false}); // no load event
        }
        return map;
    };

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
        pointRadialDistance: function(latlng, degreeBearing, radialDistance) {
            var R = 6371.01; // Earth radius km
            var d = radialDistance / 1000; // distance km
            var brng = (degreeBearing % 360) * Math.PI / 180; //degree bearing to radiant bearing
            latlng = (Array.isArray(latlng)) ? {lat: latlng[0], lng: latlng[1]} : latlng;
            var φ1 = latlng.lat * Math.PI / 180; // latitude to radiant
            var λ1 = latlng.lng * Math.PI / 180; // longitude to radiant
            var φ2 = Math.asin(Math.sin(φ1) * Math.cos(d / R) +
                    Math.cos(φ1) * Math.sin(d / R) * Math.cos(brng));
            var λ2 = λ1 + Math.atan2(Math.sin(brng) * Math.sin(d / R) * Math.cos(φ1),
                    Math.cos(d / R) - Math.sin(φ1) * Math.sin(φ2));
            return {lat: φ2 * 180 / Math.PI, lng: ((λ2 * 180 / Math.PI) + 540) % 360 - 180};
        },
        moveRandom: function(p) {
            p.heading = this.randDbl(0, 180);
            var dst = this.randDbl(10, 50);
            p.latlng = this.pointRadialDistance(
                    p.latlng,
                    p.heading,
                    dst
                    );
            p.speed = dst / ((Date.now() - p.timestamp) / 1000); //meters per second
            p.accuracy = this.randDbl(5, 50); //radius!
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
                p.latlng = latlng ? latlng : L.latLng(51.505, -0.09);
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






