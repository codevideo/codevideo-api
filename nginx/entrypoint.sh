#!/bin/bash
cp /etc/nginx/conf.d/staging.api.codevideo.io.conf /etc/nginx/conf.d/default.conf
cp /etc/nginx/conf.d/api.codevideo.io.conf /etc/nginx/conf.d/default.conf
nginx -g 'daemon off;'