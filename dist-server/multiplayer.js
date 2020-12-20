"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _ws = _interopRequireDefault(require("ws"));

var _app = _interopRequireDefault(require("./app"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var WSServer = _ws["default"].Server;

var server = require('http').createServer();

var wss = new WSServer({
  server: server,
  perMessageDeflate: false
});
server.on('request', _app["default"]); // server.listen(80, () => {
//   console.log('Amazing Zlatko Method™ combo server on 80');
// });

var _default = wss;
exports["default"] = _default;