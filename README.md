# codevideo-api

The Node express API for CodeVideo video creation. Uses [`codevideo-backend-engine`](https://github.com/codevideo/codevideo-backend-engine) behind the scenes.

## Usage from a client

Simply call https://api.codevideo.io/generate-video-immediately with a JSON body corresponding to the interface defined in [IGenerateVideoFromActionsOptions in codevideo-backend-engine](https://github.com/codevideo/codevideo-backend-engine/blob/main/src/interfaces/IGenerateVideoFromActionsOptions.ts)

This is a first in first out endpoint, so expect this URL to get gunked up as CodeVideo gains traction (if ever, lol):

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

## Run locally via Node

Clone this repository:

```shell
git clone
```

Install dependencies:

```shell
npm install
```

Start the server:

```shell
npm start
```

If all goes well, you should see the following message:

```shell
Server running on port 7000
```

## Run locally via Docker

First, make sure you have a `.env` file wherever you are going to run this API. (See `.env.example` in the root of the project).

*Note: we know Docker stuff is a pain in the ass, so note here we are using the newer `docker compose` and `docker-compose` syntax.

First ensure that the network is created:

```shell
docker network create codevideo-network
```
Then start up the API container and NGINX container:

```shell
docker compose build --no-cache && docker compose up -d
```

## Self Deployment (On Premise or Cloud)

### Storage

You'll need a S3 bucket or similar to store the videos. (I personally use Digital Ocean Spaces, but Spaces are compatible with the AWS SDK.)

### Supabase

You'll need a Supabase instance with a single `jobs` table:

```sql
create table jobs (
    id uuid primary key,
    status text default 'queued'
    created_at timestamptz default now()
);
```

After setting up the `jobs` table, you should be ready to run the API.

### Steps for SSL

Rename `nginx/conf/api.codevideo.io.conf` to `nginx/conf/yoursitename.com.conf`

Rename all instances of `api.codevideo.io` in that `.conf` file to your site name, and ensure the 443 block is commented out.

To dry run (this example for api.codevideo.io)

```shell
docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d api.codevideo.io --dry-run
```

If the dry run works, issue the certbot command without --dry-run:

```shell
docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d api.codevideo.io
```

Because the certbot image is mapped to folders in this repository, your certs will be in `certbot/conf/live/` folder.

You can now uncomment the 443 block in your `.conf` file and restart the NGINX container:

```shell
docker compose down && docker compose up -d
```

### Renew SSL Certs

```shell
docker compose run --rm certbot renew
```

## Run Tests (not working yet, jest with ESM typescript lol)

```shell
npm test
```