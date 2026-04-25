#!/bin/bash

# Copy the template to create the final config file
cp firebase-config-template.js firebase-config.js

# Replace each placeholder with the value of the environment variable
sed -i "s|__PUBLIC_FIREBASE_API_KEY__|$PUBLIC_FIREBASE_API_KEY|g" firebase-config.js
sed -i "s|__PUBLIC_FIREBASE_AUTH_DOMAIN__|$PUBLIC_FIREBASE_AUTH_DOMAIN|g" firebase-config.js
sed -i "s|__PUBLIC_FIREBASE_PROJECT_ID__|$PUBLIC_FIREBASE_PROJECT_ID|g" firebase-config.js
sed -i "s|__PUBLIC_FIREBASE_STORAGE_BUCKET__|$PUBLIC_FIREBASE_STORAGE_BUCKET|g" firebase-config.js
sed -i "s|__PUBLIC_FIREBASE_MESSAGING_SENDER_ID__|$PUBLIC_FIREBASE_MESSAGING_SENDER_ID|g" firebase-config.js
sed -i "s|__PUBLIC_FIREBASE_APP_ID__|$PUBLIC_FIREBASE_APP_ID|g" firebase-config.js
sed -i "s|__PUBLIC_FIREBASE_MEASUREMENT_ID__|$PUBLIC_FIREBASE_MEASUREMENT_ID|g" firebase-config.js

echo "Firebase config created successfully!"