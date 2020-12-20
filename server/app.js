import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import { buildSchema, execute, subscribe } from 'graphql';
import { graphqlHTTP } from 'express-graphql';
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

const app = express();

app.use('/graphql', graphqlHTTP(
  {
    schema,
    rootValue: root,
    execute,
    subscribe,
    graphiql: true,
  },
));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/', indexRouter);
app.use('/users', usersRouter);
// app.listen(process.env.API_PORT);

export default app;
