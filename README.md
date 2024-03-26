# codevideo-api

The Node express API for CodeVideo video creation. Uses [`codevideo-backend-engine`](https://github.com/codevideo/codevideo-backend-engine) behind the scenes.

## Prerequisites

### Storage

You'll need a S3 bucket or similar to store the videos. (I personally use Digital Ocean Spaces, but they are compatible with the AWS SDK.)

### Supabase

You'll need a Supabase instance with the following tables:

```sql
create table job_counts (
  id serial primary key,
  count integer
);
```

```sql
create table jobs (
    id uuid primary key,
    status text
);
```

and the following stored procedures:

```sql
create function increment_jobs_in_queue () 
returns void as
$$
  update job_counts 
  set count = count + 1
  where id = 1
$$ 
language sql volatile;
```

```sql
create function decrement_jobs_in_queue ()
returns void as
$$
  update job_counts
  set count = count - 1
  where id = 1
$$
language sql volatile;
```

With that DB work done, you should be ready to run the API.

## Get Started

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

## Run via Docker

First ensure that the network is created:

```shell
docker network create codevideo-network
```
Then start up the API container and NGINX container:

```shell
docker-compose build --no-cache && docker-compose up -d
```

## Steps for SSL

Rename `nginx/conf/api.codevideo.io.conf` to `nginx/conf/yoursitename.com.conf`

Rename all instances of `api.codevideo.io` in that `.conf` file to your site name, and ensure the 443 block is commented out.

To dry run (this example for api.codevideo.io)

```shell
docker-compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d api.codevideo.io --dry-run
```

If the dry run works, issue the certbot command without --dry-run:

```shell
docker-compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d api.codevideo.io
```

Because the certbot image is mapped to folders in this repository, your certs will be in `certbot/conf/live/` folder.

You can now uncomment the 443 block in your `.conf` file and restart the NGINX container:

```shell
docker-compose restart nginx
```