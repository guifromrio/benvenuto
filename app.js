(function() {

  require('zappajs')(function() {
    var client, getAllPlaces, getMultiplePlaces, getPlace, initializeRedis, layout, layoutKey, partials, placeArrayKeys, placeKey, redis, routes, setPlacesMulti, settings, _u,
      _this = this;
    routes = require('./routes');
    redis = require("redis");
    client = redis.createClient();
    partials = require('express-partials');
    _u = require('underscore');
    layout = {
      id: 1
    };
    settings = {
      tableRecentTimeMillis: 60000
    };
    layoutKey = function(id) {
      if (id) {
        return "layout:" + id;
      } else {
        return "layout:" + layout.id;
      }
    };
    placeKey = function(id) {
      return layoutKey() + ":place:" + id;
    };
    placeArrayKeys = function(idsArray) {
      return _u.map(idsArray, function(id) {
        return placeKey(id);
      });
    };
    initializeRedis = function() {
      return client.get("layout", function(err, reply) {
        var leanLayout, place, places, redisKey, _i, _len, _results;
        if (err) {
          console.log("Erro ao recuperar layout do banco. Usando mapa default.", err);
          layout = (require('./places/newplaces.js')).layout;
          return;
        }
        if (!reply) {
          layout = (require('./places/newplaces.js')).layout;
          leanLayout = {
            gridSizePixels: layout.gridSizePixels,
            name: layout.name,
            id: layout.id
          };
          client.set("layout", JSON.stringify(leanLayout));
          places = layout.places;
          _results = [];
          for (_i = 0, _len = places.length; _i < _len; _i++) {
            place = places[_i];
            redisKey = placeKey(place.id);
            client.sadd(layoutKey(), redisKey);
            _results.push(client.set(redisKey, JSON.stringify(place)));
          }
          return _results;
        } else {
          return layout = JSON.parse(reply);
        }
      });
    };
    getMultiplePlaces = function(idsArray, callback, keysAreStructured) {
      var placeKeys;
      placeKeys = keysAreStructured ? idsArray : placeArrayKeys(idsArray);
      return client.mget(placeKeys, function(err, replies) {
        var redisPlaces, value, _i, _len;
        if (err) {
          console.log("Erro ao recuperar lugares do banco.", err);
          callback(void 0);
          return;
        }
        redisPlaces = [];
        for (_i = 0, _len = replies.length; _i < _len; _i++) {
          value = replies[_i];
          redisPlaces.push(JSON.parse(value));
        }
        return callback(redisPlaces);
      });
    };
    getAllPlaces = function(callback) {
      return client.smembers(layoutKey(), function(err, replyKeys) {
        var keysAreStructured;
        if (err) {
          console.log("Erro ao recuperar lista de places.", err);
          callback(void 0);
          return;
        }
        keysAreStructured = true;
        return getMultiplePlaces(replyKeys, callback, keysAreStructured);
      });
    };
    getPlace = function(id, callback) {
      var fieldKey;
      layoutKey = "layout:" + layout.id;
      fieldKey = layoutKey + ":place:" + id;
      return client.get(fieldKey, function(err, reply) {
        var place;
        if (err) {
          console.log("Erro ao recuperar lugar do banco.", err);
          callback(void 0);
          return;
        }
        place = JSON.parse(reply);
        return callback(place);
      });
    };
    setPlacesMulti = function(places, execCallback) {
      var argsArray, fieldKey, place, _i, _len;
      argsArray = [];
      for (_i = 0, _len = places.length; _i < _len; _i++) {
        place = places[_i];
        fieldKey = placeKey(place.id);
        argsArray.push(fieldKey);
        argsArray.push(JSON.stringify(place));
      }
      return client.multi().mset(argsArray).exec(execCallback);
    };
    this.use(partials(), 'bodyParser', 'methodOverride', this.app.router, this.express["static"](__dirname + '/public'));
    this.configure({
      development: function() {
        return _this.use('errorHandler');
      },
      production: function() {
        return _this.use('errorHandler');
      }
    });
    this.set('views', __dirname + '/views');
    this.set('view engine', 'ejs');
    console.log('Bem vindo ao Benvenuto!');
    initializeRedis();
    this.get({
      '/': function() {
        return routes.index(this.request, this.response, settings);
      }
    });
    this.get({
      '/recepcao': function() {
        return this.render('reception.ejs');
      }
    });
    this.get({
      '/salao': function() {
        return this.render('blocks.ejs', {
          settings: settings
        });
      }
    });
    this.get({
      '/lugares.json': function() {
        var _this = this;
        return getAllPlaces(function(places) {
          return _this.response.send(places);
        });
      }
    });
    this.get({
      '/livres.json': function() {
        var _this = this;
        return getAllPlaces(function(places) {
          return _this.response.send(_u.chain(places).filter(function(place) {
            return place.occupied === false;
          }).value());
        });
      }
    });
    this.get({
      '/ocupados.json': function() {
        var _this = this;
        return getAllPlaces(function(places) {
          return _this.response.send(_u.chain(places).flatten().filter(function(place) {
            return place.occupied === true;
          }).value());
        });
      }
    });
    this.post({
      '/config/tempo': function() {
        console.log(this.request.body);
        settings.tableRecentTimeMillis = this.request.body.time * 1;
        return this.response.send(200);
      }
    });
    this.on({
      'connection': function() {
        var _this = this;
        return getAllPlaces(function(places) {
          var data, key, value;
          data = {};
          for (key in layout) {
            value = layout[key];
            data[key] = value;
          }
          data.places = places;
          _this.emit({
            welcome: {
              time: new Date(),
              data: data
            }
          });
          return console.log(layout);
        });
      }
    });
    this.on({
      'occupy': function() {
        var lastOccupation, occupiedPlacesIds,
          _this = this;
        console.log('Recebido evento occupy', this.data);
        occupiedPlacesIds = this.data.places;
        lastOccupation = new Date();
        client.watch(placeArrayKeys(occupiedPlacesIds));
        return getMultiplePlaces(occupiedPlacesIds, function(places) {
          var alreadyOccupiedPlaces, place, _i, _len;
          console.log(places);
          alreadyOccupiedPlaces = [];
          for (_i = 0, _len = places.length; _i < _len; _i++) {
            place = places[_i];
            if (place.occupied) {
              alreadyOccupiedPlaces.push(place);
            }
          }
          if (alreadyOccupiedPlaces.length > 0) {
            client.unwatch();
            _this.ack({
              result: 'fail',
              alreadyOccupiedPlaces: alreadyOccupiedPlaces
            });
            return;
          }
          _u.each(places, function(p) {
            p.occupied = true;
            return p.lastOccupation = lastOccupation;
          });
          return setPlacesMulti(places, function(err, replies) {
            var occupiedPlacesArray;
            if (err || replies === null) {
              console.log("Erro ao salvar os lugares no banco:", err);
              _this.ack({
                result: 'fail'
              });
              return;
            }
            occupiedPlacesArray = _u.map(places, function(p) {
              return {
                id: p.id,
                lastOccupation: p.lastOccupation
              };
            });
            _this.broadcast({
              'occupy': {
                'occupiedPlaces': occupiedPlacesArray
              }
            });
            return _this.ack({
              result: 'ok'
            });
          });
        });
      }
    });
    return this.on({
      'free': function() {
        var freePlacesIds,
          _this = this;
        console.log('Recebido evento occupy', this.data);
        freePlacesIds = this.data.places;
        return getMultiplePlaces(freePlacesIds, function(places) {
          console.log(places);
          _u.each(places, function(p) {
            return p.occupied = false;
          });
          return setPlacesMulti(places, function(err, replies) {
            var freePlacesArray;
            if (err || replies === null) {
              console.log("Erro ao salvar os lugares no banco:", err);
              _this.ack({
                result: 'fail'
              });
              return;
            }
            freePlacesArray = _u.map(places, function(p) {
              return {
                id: p.id
              };
            });
            _this.broadcast({
              'free': {
                'freePlaces': freePlacesArray
              }
            });
            return _this.ack({
              result: 'ok'
            });
          });
        });
      }
    });
  });

}).call(this);
