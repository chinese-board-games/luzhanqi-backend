"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _path = _interopRequireDefault(require("path"));

var _cookieParser = _interopRequireDefault(require("cookie-parser"));

var _morgan = _interopRequireDefault(require("morgan"));

var _graphql = require("graphql");

var _expressGraphql = require("express-graphql");

var _https = _interopRequireDefault(require("https"));

var _ws = _interopRequireDefault(require("ws"));

var _dotenv = _interopRequireDefault(require("dotenv"));

var _index = _interopRequireDefault(require("./routes/index"));

var _users = _interopRequireDefault(require("./routes/users"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _awaitAsyncGenerator(value) { return new _AwaitValue(value); }

function _wrapAsyncGenerator(fn) { return function () { return new _AsyncGenerator(fn.apply(this, arguments)); }; }

function _AsyncGenerator(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume(key === "return" ? "return" : "next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen["return"] !== "function") { this["return"] = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator.prototype["throw"] = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator.prototype["return"] = function (arg) { return this._invoke("return", arg); };

function _AwaitValue(value) { this.wrapped = value; }

require('babel-core/register');

require('babel-polyfill');

_dotenv["default"].config(); // Construct a schema, using GraphQL schema language


var schema = (0, _graphql.buildSchema)("\n  type Query {\n    hello: String\n  }\n  type Subscription {\n    greetings: String\n  }\n"); // The root provides a resolver function for each API endpoint

var root = {
  hello: function hello() {
    return 'Hello World!';
  },
  subscription: {
    greetings: function () {
      var _sayHiIn5Languages = _wrapAsyncGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var _i, _arr, hi;

        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _i = 0, _arr = ['Hi', 'Bonjour', 'Hola', 'Ciao', 'Zdravo'];

              case 1:
                if (!(_i < _arr.length)) {
                  _context.next = 8;
                  break;
                }

                hi = _arr[_i];
                _context.next = 5;
                return {
                  greetings: hi
                };

              case 5:
                _i++;
                _context.next = 1;
                break;

              case 8:
              case "end":
                return _context.stop();
            }
          }
        }, _callee);
      }));

      function sayHiIn5Languages() {
        return _sayHiIn5Languages.apply(this, arguments);
      }

      return sayHiIn5Languages;
    }()
  }
};
console.log("Starting socket on server: localhost, port: ".concat(8080));
var wsServer = new _ws["default"].Server({
  port: 8080 // path: '/graphql',

});
wsServer.on('connection', function (socket) {
  socket.on('message', function (message) {
    console.log("Received message => ".concat(message, "\n    "));
  });
  socket.send('Received!');
});
var app = (0, _express["default"])();
app.use('/graphql', (0, _expressGraphql.graphqlHTTP)({
  schema: schema,
  rootValue: root,
  execute: _graphql.execute,
  subscribe: _graphql.subscribe,
  graphiql: true
}, wsServer));
app.use((0, _morgan["default"])('dev'));
app.use(_express["default"].json());
app.use(_express["default"].urlencoded({
  extended: false
}));
app.use((0, _cookieParser["default"])());
app.use(_express["default"]["static"](_path["default"].join(__dirname, '../public')));
app.use('/', _index["default"]);
app.use('/users', _users["default"]);
app.listen(process.env.API_PORT);
console.log("Running a GraphQL API server at http://localhost:".concat(process.env.API_PORT, "/graphql"));
var _default = app;
exports["default"] = _default;