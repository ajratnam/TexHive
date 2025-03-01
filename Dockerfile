FROM ubuntu:22.04

# Set non-interactive mode to prevent timezone prompts
ENV DEBIAN_FRONTEND=noninteractive

# Update and upgrade system
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y tzdata python3 python3-pip texlive-full texlive && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /TexHive

# Install required Python packages
RUN pip3 install flask flask-socketio eventlet requests tree-sitter==0.21.3 tree-sitter-languages

# Copy the application code
COPY . /TexHive

# Expose port 80
EXPOSE 80

# Define the command to run the application
CMD ["python3", "app.py"]
