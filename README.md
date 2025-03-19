# codevideo-api

The Node express API for CodeVideo video creation. Uses [`codevideo-backend-engine`](https://github.com/codevideo/codevideo-backend-engine) behind the scenes.

## Local Development

Install dependencies:

```shell
npm install
```

Start the server:

```shell
npm start
```

This will start the server on `http://localhost:7000`.

## Usage from a client - V3

Simply call https://api.codevideo.io/create-video-v3 with a JSON body corresponding to an array of actions (`IAction` from `@fullstackcraftllc/codevide-types), and we handle the rest. You must be signed in to use this endpoint.

The V3 endpoint has 3 parts: 

1. the main express entry point, which first builds all the needed audio for the video
2. `go-video-dispatcher`, which calls the `recordVideoV3.js` node script to record the
2. the `recordVideoV3.js` script, which uses puppeteer to record the actual video

## Where is V2?

V2 was what I called the desktop driver for visual studio code and never build an API for that... maybe someday.

## Usage from a client - Legacy

Simply call https://api.codevideo.io/generate-video-immediately with a JSON body corresponding to the interface defined in [IGenerateVideoFromActionsOptions in codevideo-backend-engine](https://github.com/codevideo/codevideo-backend-engine/blob/main/src/interfaces/IGenerateVideoFromActionsOptions.ts)

This is a first-in-first-out endpoint, so expect this URL to get gunked up as CodeVideo gains traction (if ever, lol). Here is an example calling the API using bash:

```shell
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      {
        "name": "author-speak-before",
        "value": "Welcome to the amazing world of CodeVideo. Here'\''s some code!"
      },
      {
        "name": "editor-type",
        "value": "console.log('\''hello world!'\'');"
      }
    ],
    "language": "javascript",
    "textToSpeechOption": "elevenlabs",
    "ttsApiKey": "YOUR_ELEVENLABS_API_KEY",
    "ttsVoiceId": "YOUR_VOICE_ID"
  }' \
  https://api.codevideo.io/create-video-immediately
```

And using TypeScript:

```typescript
const response = await fetch("https://api.codevideo.io/generate-video-immediately", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    actions,
    language,
    textToSpeechOption,
  }),
});
const data = await response.json()
// bucket url to mp4 file
console.log(data.url)
```

## Run locally via Docker

First, make sure you have a `.env` file wherever you are going to run this API. (See `.env.example` in the root of the project and `.env.example` in the `go-video-dispatcher` folder).

*Note: we know Docker stuff is a pain in the ass, so note here we are using the newer `docker compose` and `docker-compose` syntax.

Build the Docker services:

```shell
docker compose build
```

Then start up the various containers (which includes the Express server, go microservice, puppeteer runner, and static Gatsby site for recording) and NGINX container:

```shell
docker compose up -d
```

Full restart:

```shell
docker compose build && docker compose up -d
```

Due to issues with headless chromium playing audio, we run the go dispatcher locally (which also calls the puppeteer script). To run that:

First install dependencies for the puppeteer part:

```shell
cd go-video-dispatcher/puppeteer-runner
npm install
cd ..
go build
nohup ./go-video-dispatcher &
```

## Self Deployment (On Premise or Cloud)

### Storage

You'll need a S3 bucket or similar to store the videos.

<!-- ### Supabase

You'll need a Supabase instance with a single `jobs` table:

```sql
create table jobs (
    id uuid primary key,
    status text default 'queued'
    created_at timestamptz default now()
);
``` 

After setting up the `jobs` table, you should be ready to run the API.-->

### Steps for SSL

Rename `nginx/conf/api.codevideo.io.conf` to `nginx/conf/yoursitename.com.conf`

Rename all instances of `api.codevideo.io` in that `.conf` file to your site name, and ensure the 443 block is commented out.

To dry run (this example for api.codevideo.io)

```shell
docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d api.codevideo.io --dry-run
```

or for staging.api.codevideo.io

```shell
docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d staging.api.codevideo.io --dry-run
```

If the dry run works, issue the certbot command without --dry-run:

```shell
docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d api.codevideo.io
```

or for staging.api.codevideo.io

```shell
docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d staging.api.codevideo.io
```

Note that after renewing a cert you will need to restart the NGINX container:

```shell
docker restart <container-name-or-id-here>
```

Because the certbot image is mapped to folders in this repository, your certs will be in `certbot/conf/live/` folder.

You can now uncomment the 443 block in your `.conf` file and restart the NGINX container:

```shell
docker compose down && docker compose up -d
```

### Renew SSL Certs

Ensure you are in the root of this project (we need to be able to read `docker-compose.yml`) then run:

```shell
docker compose run --rm certbot renew
```

## Run Tests (not working yet, jest with ESM typescript lol)

```shell
npm test
```