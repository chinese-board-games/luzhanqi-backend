# luzhanqi-backend

Backend for the luzhanqi project.

## Environment

Ensure that you have VSCode installed, with ESLint and Prettier linting enabled on save.  
In your project directory, initialize a file `.env`:
Run

```bash
cat > .env << EOF
PORT=8080

MONGODB_USER=root
MONGODB_PASSWORD=alpine
MONGODB_DATABASE=luzhanqi
MONGODB_LOCAL_PORT=7017
MONGODB_DOCKER_PORT=27017

NODE_LOCAL_PORT=4000
NODE_DOCKER_PORT=8080
EOF
```

Install docker and docker-compose. Then run

## Starting the server

`git clone` to copy repository files into your local.  
`docker-compose up``
