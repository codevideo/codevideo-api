#!/bin/bash
if [ "$ENVIRONMENT" = "staging" ]; then
  cp /etc/nginx/conf.d/staging.api.codevideo.io.conf /etc/nginx/conf.d/default.conf
else
  cp /etc/nginx/conf.d/api.codevideo.io.conf /etc/nginx/conf.d/default.conf
fi
nginx -g 'daemon off;'