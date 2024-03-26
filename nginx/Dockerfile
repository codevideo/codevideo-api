# Use the official Nginx image
FROM nginx:latest
COPY conf/api.codevideo.io.conf /etc/nginx/conf.d/api.codevideo.io.conf

# Copy in ssl certificates
# COPY ../certbot/conf/live/api.codevideo.io/fullchain.pem /etc/ssl/live/api.codevideo.io/fullchain.pem
# COPY ../certbot/conf/live/api.codevideo.io/privkey.pem /etc/ssl/live/api.codevideo.io/privkey.pem