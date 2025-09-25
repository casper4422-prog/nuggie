#!/bin/bash
# Build script for Render deployment

echo "Starting build process..."

# Install backend dependencies
echo "Installing backend dependencies..."
npm install

# Ensure database directory exists
echo "Setting up database directory..."
mkdir -p data

# Copy client files to be served by the backend
echo "Preparing frontend files..."
if [ -d "../client" ]; then
    echo "Client directory found, backend will serve static files"
else
    echo "Warning: Client directory not found at ../client"
fi

echo "Build complete!"