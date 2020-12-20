import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import { buildSchema, execute, subscribe } from 'graphql';
import { graphqlHTTP } from 'express-graphql';
import https from 'https';
import ws from 'ws';
import dotenv from 'dotenv';
import indexRouter from './routes/index';
import usersRouter from './routes/users';

require('babel-core/register');
require('babel-polyfill');

dotenv.config();

// Construct a schema, using GraphQL schema language
const schema = buildSchema(`
  type Query {
    hello: String
  }
  type Subscription {
    greetings: String
  }
`);

// The root provides a resolver function for each API endpoint
const root = {
  hello: () => 'Hello World!',

  subscription: {
    greetings: async function* sayHiIn5Languages() {
      // eslint-disable-next-line no-restricted-syntax
      for (const hi of ['Hi', 'Bonjour', 'Hola', 'Ciao', 'Zdravo']) {
        yield { greetings: hi };
      }
    },
  },
};

console.log(`Starting socket on server: localhost, port: ${8080}`);
const wsServer = new ws.Server({
  port: 8080,
  // path: '/graphql',
});

wsServer.on('connection', (socket) => {
  socket.on('message', (message) => {
    console.log(`Received message => ${message}
    `);
  });
  socket.send('Received!');
});

const app = express();

app.use('/graphql', graphqlHTTP(
  {
    schema,
    rootValue: root,
    execute,
    subscribe,
    graphiql: true,
  }, wsServer,
));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.listen(process.env.API_PORT);
console.log(`Running a GraphQL API server at http://localhost:${process.env.API_PORT}/graphql`);
export default app;
