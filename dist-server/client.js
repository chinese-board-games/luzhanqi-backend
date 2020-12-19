"use strict";

var _graphqlWs = require("graphql-ws");

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var _require = require('chai'),
    expect = _require.expect;

var client = (0, _graphqlWs.createClient)({
  url: 'wss://welcomer.com/graphql'
}); // query

_asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
  var result;
  return regeneratorRuntime.wrap(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.next = 2;
          return new Promise(function (resolve, reject) {
            var result;
            client.subscribe({
              query: '{ hello }'
            }, {
              next: function next(data) {
                return result = data;
              },
              error: reject,
              complete: function complete() {
                return resolve(result);
              }
            });
          });

        case 2:
          result = _context.sent;
          expect(result).toEqual({
            hello: 'Hello World!'
          });

        case 4:
        case "end":
          return _context.stop();
      }
    }
  }, _callee);
}))(); // subscription


_asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
  var onNext;
  return regeneratorRuntime.wrap(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          onNext = function onNext() {
            /**/
          };

          _context2.next = 3;
          return new Promise(function (resolve, reject) {
            client.subscribe({
              query: 'subscription { greetings }'
            }, {
              next: onNext,
              error: reject,
              complete: resolve
            });
          });

        case 3:
          expect(onNext).toBeCalledTimes(5); // we say "Hi" in 5 languages

        case 4:
        case "end":
          return _context2.stop();
      }
    }
  }, _callee2);
}))();