# Use the official Nginx image
FROM nginx:latest

# Remove default Nginx configuration
# RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/

# Expose port 80
EXPOSE 80
