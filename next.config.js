const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA({
  reactStrictMode: true,
  images: {
    domains: [
      'lh3.googleusercontent.com',       // Google OAuth avatars
      'firebasestorage.googleapis.com',  // Firebase Storage public URLs
      'image.mux.com'                    // Mux thumbnails (if you use them)
    ],
  },
});
