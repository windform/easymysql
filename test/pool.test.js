/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */

var util = require('util');
var should = require('should');
var rewire = require('rewire');
var Pool = rewire(__dirname + '/../lib/pool.js');
var Common = require(__dirname + '/common.js');

var Connection = Common.mockConnection();

var Fatal = function (msg) {
  var e = new Error(msg);
  e.fatal = true;
  return e;
}; 

beforeEach(function () {
  Connection.makesureCleanAllData();
  Connection.__mockQueryResult(/SHOW\s+Variables\s+like\s+"READ_ONLY"/i, [{
    'Variable_Name' : 'READ_ONLY', 'Value' : 'OFF'
  }]);
  Connection.__mockQueryResult(/error/i, [], new Error('TestError'));
  Connection.__mockQueryResult(/fatal/i, [], Fatal('TestFatal'));

  Pool.__set__({
    'HEARTBEAT_TIMEOUT' : 5,
    'Connection' : Connection,
  });
});

describe('mysql pool', function () {

  /* {{{ should_mysql_pool_works_fine() */
  it('should_mysql_pool_works_fine', function (done) {
    var _me = Pool.create({
      'maxconnections' : 4, 
    });

    _me._queue.should.eql([]);
    _me._stack.should.eql([]);

    var _messages = [];
    ['state', 'error'].forEach(function (i) {
      _me.on(i, function () {
        _messages.push([i].concat(Array.prototype.slice.call(arguments)));
      });
    });

    var num = 9;
    for (var i = 0; i < num; i++) {
      _me.query('SELECT ' + i, function (e, r) {
        if (0 !== (--num)) {
          return;
        }
        _messages.should.eql([['state', 3]]);
        process.nextTick(function () {
          _me._queue.should.eql([]);
          // 1,2,3,4,1,[2,3,4,1]
          _me._stack.should.eql([2,3,4,1]);
          _me.query('should use 1', function (e,r) {
            _me._queue.should.eql([]);
            _me._stack.should.eql([2,3,4]);
            process.nextTick(function () {
              _me._stack.should.eql([2,3,4,1]);
              done();
            });
          });
        });
      });
    }
  });
  /* }}} */

  /* {{{ should_heartbeat_restart_works_fine() */
  it('should_heartbeat_restart_works_fine', function (done) {
    var _me = Pool.create({'maxconnections' : 2});

    var num = 0;
    var state = 3;
    _me.on('state', function (s) {
      s.should.eql(state);

      //Connection.__emitEvent(0, 'close');
      state = 0;
      setTimeout(done, 55);
    });
  });
  /* }}} */

});

