const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const { buildSchema, execute, subscribe } = require('graphql');
const { graphqlHTTP } = require('express-graphql');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const express = require('express');

dotenv.config();

// DB Setup
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost/luzhanqi';
// const mongoURI = 'mongodb://localhost/luzhanqi';
mongoose.connect(mongoURI, {
  useFindAndModify: false,
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// set mongoose promises to es6 default
mongoose.Promise = global.Promise;

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

module.exports = app;
