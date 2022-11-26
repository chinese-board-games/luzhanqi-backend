# luzhanqi-backend

Backend for the luzhanqi project.

## Environment

Ensure that you have VSCode installed, with ESLint and Prettier linting enabled on save.  
In your project directory, initialize a file `.env` with contents `PORT=4000`.
Run

```bash
cat > .env << EOF
PORT=4000
EOF
```

Install docker and docker-compose. Then run

```bash
docker-compose up
```

in order to start mongoDB.

## Starting the server

`git clone` to copy repository files into your local.  
Run `npm install` to install dependencies.  
Run `npm run dev` (for nodemon) or `npm run start` to start the server on `localhost:4000`.
