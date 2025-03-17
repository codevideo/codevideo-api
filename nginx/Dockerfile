# Use the official Nginx image
FROM nginx:latest
COPY conf/api.codevideo.io.conf /etc/nginx/conf.d/api.codevideo.io.conf
COPY conf/staging.api.codevideo.io.conf /etc/nginx/conf.d/staging.api.codevideo.io.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]