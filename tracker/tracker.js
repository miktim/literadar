/* 
 * LiteRadar tracker rev 191008
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
            maxAge: 27000,
            minDistance: 40
        },
        locale: {
            itsme: "It's me."
        },
        locations: {},
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
    T.latLng = function(obj) {
        if (Array.isArray(obj.latlng))
            obj.latlng = {lat: obj.latlng[0], lng: obj.latlng[1]};
        else if ('latitude' in obj && 'longitude' in obj)
            obj.latlng = {lat: obj.latitude, lng: obj.longitude};
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

    T.Location = function() {
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
        if (obj.action === "location") {
            this.onLocation(obj);
        }
    };
    T.onLocation = function(loc) {
        if (!this.locations[loc.id]) {
            this.locations[loc.id] = loc;
        }
        this.map.moveMarker(loc);
    };
    T.removeInactive = function() {

    };

    T.onLocationFound = function(l) {
        var loc = new T.Location();
        T.update(loc, T.latLng(l.coords));
        loc.id = T.locale.itsme;
        loc.timestamp = l.timestamp;
        loc.timeout = T.options.timeout;
        if (!this.locations[loc.id])
            this.map.setMarker(loc, this.icons.own);
        else if (this.locations[loc.id].timestamp < loc.timestamp)
            this.onLocation(loc);
    };
    T.onLocationError = function(e) {
        console.log('Geolocation: ' + e.message);
        this.map.UI.consolePane.log(e.message);
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
        this.watchId = navigator.geolocation.watchPosition(
                onLocation, onError, options);
    };
    T.stopLocation = function() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = undefined;
        }
    };

    T.checkWebSocket = function() {
        if (this.search.ws) {
            var wsurl = (window.location.protocol === 'https:' ?
                    'wss://' : 'ws://') + this.search.ws;
//            var wsurl = 'wss://' + this.search.ws;
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
                    T.map.UI.consolePane.log(e.message);
                    console.log(e.message);
                };
            } catch (e) {
                console.log(e.message);
            }
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
        latlngA = (Array.isArray(latlngA)) ? {lat: latlngA[0], lng: latlngA[1]} : latlngA;
        latlngB = (Array.isArray(latlngB)) ? {lat: latlngB[0], lng: latlngB[1]} : latlngB;
        var φ1 = latlngA.lat * Math.PI / 180;
        var φ2 = latlngB.lat * Math.PI / 180;
        var Δφ = (latlngB.lat - latlngA.lat) * Math.PI / 180;
        var Δλ = (latlngB.lng - latlngA.lng) * Math.PI / 180;

        var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };
    T._map = function(mapId, latlng) {
        var map = L.map(mapId, {
            minZoom: 5,
            zoom: 17,
            zoomControl: false
        });
        L.tileLayer(window.location.protocol + '//{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        map.isLoaded = false;
        map.accuracyLayer = L.featureGroup(); // markers accuracy
        map.addLayer(map.accuracyLayer);
        map.showAccuracy = true;
        map.toggleAccuracy = function() {
            this.showAccuracy = !this.showAccuracy;
            if (this.showAccuracy) {
                if (!map.hasLayer(this.track.accuracyLayer))
                    this.addLayer(this.track.accuracyLayer);
                this.addLayer(this.accuracyLayer);
            } else {
                if (map.hasLayer(this.track.accuracyLayer))
                    this.removeLayer(this.track.accuracyLayer);
                this.removeLayer(this.accuracyLayer);
            }
        };
        map.markers = [];
        map.boundMarkers = function() {
            var latLngs = [];
            for (var m in this.markers) {
                latLngs.push(this.markers[m].getLatLng());
            }
            if (latLngs.length > 0) {
                var bounds = L.latLngBounds(latLngs);
                this.fitBounds(bounds);
                this.setView(bounds.getCenter());
            }
        };
        map.track = {
            marker: undefined,
            pathLayer: undefined, // polyline
            accuracyLayer: L.featureGroup(), // track nodes accuracy
            pathLength: 0
        };
        map.track.init = function(map) {
            if (map.hasLayer(this.accuracyLayer)) {
                map.removeLayer(this.accuracyLayer);
            }
            if (map.hasLayer(this.pathLayer)) {
                map.removeLayer(this.pathLayer);
            }
            this.pathLayer = L.polyline([], {weight: 2, color: "red"}).addTo(map);
            this.accuracyLayer = L.featureGroup();
            if (map.showAccuracy)
                map.addLayer(this.accuracyLayer);
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
        map.setMarker = function(loc, icon) {
            icon = icon || T.icons.active;
            var marker = this.markers[loc.id];
            if (!this.isLoaded && this.markers.length === 0)
                this.setView(loc.latlng, this.options.zoom);
            if (!marker) {
                marker = L.marker(loc.latlng, {icon: icon, alt: loc.id});
                marker.on('click', function(e) {
                    map.onMarkerClick(e);
                });
                marker.addTo(this);
                marker.accuracyCircle = L.circle(loc.latlng, loc.accuracy,
                        {weight: 1, color: "blue"}).addTo(this.accuracyLayer);
                this.markers[loc.id] = marker;
            } else
                marker.setIcon(icon);
            return marker;
        };
        map.trackMarker = function(marker) {
            if (this.track.marker === marker) {
                var pos = marker.getLatLng();
                var pln = this.track.pathLayer.getLatLngs();
                var dst = (pln.length > 0 ?
                        T.distanceBetween(pos, pln[pln.length - 1]) : 0);
                this.track.pathLength += dst;
                if (pln.length === 0 || dst >= T.options.minDistance) {
                    this.track.pathLayer.addLatLng(pos);
                    L.circle(pos, marker.accuracyCircle.getRadius(),
                            {weight: 1, color: "blue"}).addTo(this.track.accuracyLayer);
                }
                this.setView(pos, this.getZoom());
                this.UI.infoPane.update({
                    id: marker.location.id,
                    trackLength: this.track.pathLength,
                    timestamp: marker.location.timestamp,
                    speed: marker.location.speed,
                    altitude: marker.location.altitude,
                    heading: marker.location.heading,
                    movement: dst,
                    accuracy: marker.location.accuracy
                });
            }
        };
        map.moveMarker = function(loc) {
            var marker = this.markers[loc.id];
            if (!marker)
                marker = this.setMarker(loc);
            else {
                marker.setLatLng(loc.latlng);
                marker.accuracyCircle.setLatLng(loc.latlng);
                marker.accuracyCircle.setRadius(loc.accuracy);
                this.trackMarker(marker);
            }
            marker.location = loc;
        };
        map.removeMarker = function(loc) {

        };
        map.UI = {
            infoPane: undefined,
            consolePane: undefined,
            controlPane: undefined,
            init: function(map) {

                map.UI.infoPane = new (L.Control.extend({
                    options: {
                        position: 'bottomleft',
                        infoData: {id: {nick: 'Track ', unit: ':'},
                            trackLength: {nick: 'DST', unit: 'm'},
                            trackTime: {nick: 'TTM', unit: ''},
                            timestamp: {nick: 'TME', unit: ''},
                            speed: {nick: 'SPD', unit: 'm/sec'},
                            altitude: {nick:'ALT',unit: 'm'},
                            movement: {nick: 'MVT',unit:'m'},
                            heading:{nick: 'HDN', unit: 'deg'},
                            accuracy: {nick: 'ACC', unit: 'm'}
                        }
                    },
                    onAdd: function(map) {
                        var pane = L.DomUtil.create('div', 'tracker-pane')
                                , tbl, tbl1, row, el;
                        el = L.DomUtil.create('div', 'tracker-info-header', pane);
                        this.options.infoData.id.element = el;
                        tbl = L.DomUtil.create('table', 'tracker-info-table', pane);
                        el = L.DomUtil.create('div', 'tracker-info-header', pane);
                        el.innerHTML = 'Location:';
                        tbl1 = L.DomUtil.create('table', 'tracker-info-table', pane);
                        for (var key in this.options.infoData) {
                            if (key === 'id')
                                continue;
                            if (key === 'timestamp')
                                tbl = tbl1;
                            row = L.DomUtil.create('tr', 'tracker-info-row', tbl);
                            el = L.DomUtil.create('td', 'tracker-info-nick', row);
                            el.innerHTML = this.options.infoData[key].nick;
                            el = L.DomUtil.create('td', 'tracker-info-value', row);
                            this.options.infoData[key].element = el;
                        }

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
                                    value = this.options.infoData[key].nick + value;
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
                    options: {position: 'topright',
                        buttons: {
                            // btnMenu: {img: './images/btn_menu.png', onclick: undefined},
                            btnAccuracy: {img: './images/btn_accuracy.png', onclick: function(e) {
                                    map.toggleAccuracy();
                                }},
                            btnBound: {img: './images/btn_bound.png', onclick: function(e) {
                                    map.boundMarkers();
                                }},
                            btnLocate: {img: './images/btn_locate.png', onclick: function(e) {
                                    map.locate({setView: true});
                                }}
                        }
                    },
                    onAdd: function(map) {
                        var pane = L.DomUtil.create('div', 'buttons-pane'), div, btn;
                        for (var key in this.options.buttons) {
                            div = L.DomUtil.create('div', 'tracker-button', pane);
                            btn = L.DomUtil.create('img', 'tracker-button', div);
                            btn.src = this.options.buttons[key].img;
                            if (this.options.buttons[key].onclick)
                                btn.onclick = this.options.buttons[key].onclick;
                        }
                        return pane;
                    },
                    onRemove: function(map) {

                    }
                }));
                map.UI.controlPane.addTo(map);
            }
        };
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
                map.UI.consolePane.log(e.message);
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
        sendLocation: function(p) {
            T.onAction(JSON.stringify(p));
        },
        run: function(delay, latlng) { // milliseconds, initial position
            if (this.isRunning)
                return;
            for (var i = 0; i < 5; i++) {
                var p = new T.Location();
                p.action = 'location';
                p.id = 'Demo ' + (i + 1);
                p.latlng = latlng ? latlng : L.latLng(51.505, -0.09);
                p.timeout = delay;
                this.demos[i] = this.moveRandom(p);
            }
            setInterval(function(d) {
                for (var i = 0; i < d.demos.length; i++)
                    d.sendLocation(d.moveRandom(d.demos[i]));
            }, delay, this); //!IE9
            this.isRunning = true;
        }
    };
}(window, document));






