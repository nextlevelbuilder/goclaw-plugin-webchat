FROM php:8.3-cli-alpine

# Install composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY composer.json .
RUN composer install --no-dev --optimize-autoloader
COPY proxy.php .

EXPOSE 3100
CMD ["php", "proxy.php"]
