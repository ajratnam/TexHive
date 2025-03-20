# Stage 1: Build dependencies using Poetry
FROM python:3.12-slim AS builder

# Set environment variables for improved Python performance and Poetry
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    PATH="/root/.local/bin:$PATH"

# Install build dependencies and Poetry installer dependencies
RUN apt-get update && apt-get install -y --no-install-recommends curl build-essential \
    && curl -sSL https://install.python-poetry.org | python3 - \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory for the build stage
WORKDIR /app

# Copy only dependency files to leverage Docker cache
COPY pyproject.toml poetry.lock ./

# Install only main dependencies (skip dev)
RUN poetry install --only main --no-root

# Stage 2: Final image with full TeXLive and runtime setup
FROM python:3.12-slim

# Set environment variables for Python and Poetry
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    PATH="/root/.local/bin:$PATH"

# Install the full TeXLive package (as required) along with minimal extra tools
RUN apt-get update && apt-get install -y --no-install-recommends \
      texlive-full \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy Poetry installation and virtual environment from builder stage
COPY --from=builder /root/.local /root/.local
COPY --from=builder /app /app

# Set working directory
WORKDIR /app

# Copy the rest of the application source code
COPY . .

# Expose the application port
EXPOSE 8000

# Run the app.py
CMD ["poetry", "run", "python", "app.py"]
