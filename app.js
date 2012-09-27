// Generated by CoffeeScript 1.3.3
(function() {

  require('zappajs')(function() {
    var client, layout, partials, places, redis, routes, settings, _u,
      _this = this;
    routes = require('./routes');
    redis = require("redis");
    client = redis.createClient();
    partials = require('express-partials');
    _u = require('underscore');
    layout = (require('./places/newplaces.js')).layout;
    places = layout.places;
    settings = {
      tableRecentTimeMillis: 60000
    };
    this.use(partials(), 'bodyParser', 'methodOverride', this.app.router, this.express["static"](__dirname + '/public'));
    this.configure({
      development: function() {
        return _this.use({
          errorHandler: {
            dumpExceptions: true
          }
        });
      },
      production: function() {
        return _this.use('errorHandler');
      }
    });
    this.set('views', __dirname + '/views');
    this.set('view engine', 'ejs');
    console.log('Bem vindo ao Benvenuto!');
    client.get("layout", function(err, reply) {
      var layoutKey, leanLayout, place, redisKey, _i, _len, _results;
      if (err) {
        console.log("Erro ao recuperar layout do banco. Usando mapa default.", err);
        return;
      }
      if (!reply) {
        leanLayout = {
          gridSizePixels: layout.gridSizePixels,
          name: layout.name,
          id: layout.id
        };
        client.set("layout", JSON.stringify(leanLayout));
        layoutKey = "layout:" + leanLayout.id;
        _results = [];
        for (_i = 0, _len = places.length; _i < _len; _i++) {
          place = places[_i];
          redisKey = "place:" + place.id;
          _results.push(client.hset(layoutKey, redisKey, JSON.stringify(place)));
        }
        return _results;
      }
      /*else
        console.log reply
        layoutKey = "layout:" + JSON.parse(reply).id
        console.log layoutKey
        client.hgetall layoutKey, (err, reply) ->
          if err
            console.log "Erro ao recuperar lugares do banco. Usando mapa default.", err
            return
          #console.log reply
          places = []
          for key, value of reply
            console.log value
            places.push JSON.parse value
          #places = JSON.parse(reply)
      */

    });
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
        return this.response.send(places);
      }
    });
    this.get({
      '/livres.json': function() {
        return this.response.send(_u.chain(places).filter(function(place) {
          return place.occupied === false;
        }).value());
      }
    });
    this.get({
      '/ocupados.json': function() {
        return this.response.send(_u.chain(places).flatten().filter(function(place) {
          return place.occupied === true;
        }).value());
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
        return this.emit({
          welcome: {
            time: new Date(),
            data: layout
          }
        });
      }
    });
    this.on({
      'occupy': function() {
        var occupiedArray, occupiedPlaces;
        console.log(this.data);
        occupiedPlaces = this.data.places;
        occupiedArray = [];
        console.log(occupiedPlaces);
        _u.each(occupiedPlaces, function(id) {
          var place;
          place = _u.find(places, function(place) {
            return place.id * 1 === id * 1;
          });
          place.occupied = true;
          place.lastOccupation = new Date();
          return occupiedArray.push({
            id: place.id,
            lastOccupation: place.lastOccupation
          });
        });
        this.broadcast({
          'occupy': {
            'occupiedPlaces': occupiedArray
          }
        });
        return this.ack({
          result: 'ok'
        });
      }
    });
    return this.on({
      'free': function() {
        var freeArray, freePlaces;
        freePlaces = this.data.places;
        freeArray = [];
        console.log(freePlaces);
        _u.each(freePlaces, function(id) {
          var place;
          place = _u.find(places, function(place) {
            return place.id * 1 === id * 1;
          });
          place.occupied = false;
          return freeArray.push({
            id: place.id
          });
        });
        this.broadcast({
          'free': {
            'freePlaces': freeArray
          }
        });
        return this.ack({
          result: 'ok'
        });
      }
    });
  });

}).call(this);
