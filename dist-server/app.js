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

_dotenv["default"].config(); // Construct a schema, using GraphQL schema language


var schema = (0, _graphql.buildSchema)("\n  type Query {\n    hello: String\n  }\n  type Subscription {\n    greetings: String\n  }\n"); // The root provides a resolver function for each API endpoint

var root = {
  hello: function hello() {
    return 'Hello World!';
  } //   subscription: {
  //     greetings: async function* sayHiIn5Languages() {
  //       // eslint-disable-next-line no-restricted-syntax
  //       for (const hi of ['Hi', 'Bonjour', 'Hola', 'Ciao', 'Zdravo']) {
  //         yield { greetings: hi };
  //       }
  //     },
  //   },

};
var app = (0, _express["default"])();

var server = _https["default"].createServer(app);

var wsServer = new _ws["default"].Server({
  server: server,
  path: '/graphql'
});
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