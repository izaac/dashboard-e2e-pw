FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

# Install dependencies (layer cached unless lock changes)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile && yarn cache clean

# Copy source
COPY . .

# Default: run all tests with line reporter
CMD ["npx", "playwright", "test", "--reporter=line"]
