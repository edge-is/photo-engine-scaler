'use strict'

var MQ = (function (){
  return function (QID, REDIS_OPTIONS){
    if(!REDIS_OPTIONS){
      REDIS_OPTIONS = {};
    }
    return {
      client : function (){
        var redis = require("redis");
            return redis.createClient(REDIS_OPTIONS);
      },
      add : function (object, callback){
        // Create ID, and value is Object with status:'NEW'
        var _root = this;
        var ID = _root._CreateID();
        // First add to list of items
        var client = _root.client();
        client.on('connect', function (){
          client.hmset(QID, ID, "NEW", function (err, resp){
            if(err){
              callback(err);
              client.end();

              return;
            }
            client.set(ID, JSON.stringify(object), function (err, setResp){
              if(err){
                callback(err);
                client.end();
                return;
              }
              callback(null, {ID : ID, data:setResp});
              client.end();
            });
          });
        });

      },
      FetchTaskID : function (callback){
        var _root = this, client;
        _root.list(function (err, list){
          if(err) {callback(err); return;}
          for (var key in list) {
            if(list[key] !== 'ASSIGNED'){
              callback(null, key);
              return ;
            }
          }
        });
      },
      assignID : function (ID, callback){
        /* Create client */
        var client = this.client();
        /* Get by ID */
        client.get(ID, function(err, resp){
          /* If error then return error*/
          if(err){
            client.end();
            callback(err);
            return;
          }
          /* If no error, then assign key in HMSET */
          client.hmset(QID, ID, "ASSIGNED");
          /* Callback with reponse */
          callback(null, JSON.parse(resp));
          client.end();
        });

      },
      done : function (ID, callback){
        var client = this.client();
        client.del(ID, function (err, resp){
          if(err){
            client.end();
            if(callback) {
              callback(err, resp);
            }
            return;
          }
          client.hdel(QID, ID, function (err, resp){
            if(callback) {
              callback(err, resp);
            }
            client.end();
          });
        });
      },
      fail : function (ID, callback){
        var client = this.client();
        client.hmset(QID, ID, "FAILED", function(err, resp){
          if(callback) {
            callback(err, resp);
          }
          client.end();
        });
      },
      empty : function (callback){
        var _root = this;
        _root.list(function (err, list){
          for (var key in list){
            _root.done(key, function (err){
              if(err && callback){
                callback(err);
                return;
              }
            });
          }
          if(callback){
            callback(null);
          }


        });
      },
      connect : function (){
        return this.client();
      },
      list : function (callback){
        var client = this.client();
        client.hgetall(QID, function (err, response) {
            callback(err, response);
            client.end();
        });
      },
      subscribe : function (){
        var client = this.client();
        client.subscribe(QID);
        return client;
      },
      _CreateID : function (){
        var chars = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890', len = 30, ID = '';
        for (var i = 0; i < len; i++){
            ID+=chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return ID;
      }
    };
  }
})();

module.exports = MQ;
