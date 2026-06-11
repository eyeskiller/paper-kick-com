const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = function(prisma) {
  const router = express.Router();
  const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_me_in_prod';

  // Register a new customer
  router.post('/register', async (req, res) => {
    try {
      const { email, password, turnstileToken } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      if (!turnstileToken) return res.status(400).json({ error: 'CAPTCHA token is required' });

      // Verify Turnstile token
      const secretKey = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: secretKey,
          response: turnstileToken
        })
      });
      const verifyData = await verifyRes.json();
      
      if (!verifyData.success) {
        console.error('[Turnstile] Verification failed:', verifyData);
        return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
      }

      const existing = await prisma.customer.findUnique({ where: { email } });
      if (existing) return res.status(400).json({ error: 'Email already in use' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const customer = await prisma.customer.create({
        data: { email, password: hashedPassword }
      });

      const token = jwt.sign({ id: customer.id, email: customer.email }, JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'strict' });
      res.json({ message: 'Registration successful' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

      const customer = await prisma.customer.findUnique({ where: { email } });
      if (!customer) return res.status(401).json({ error: 'Invalid credentials' });

      const valid = await bcrypt.compare(password, customer.password);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ id: customer.id, email: customer.email }, JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'strict' });
      res.json({ message: 'Login successful' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Logout
  router.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ message: 'Logged out' });
  });

  // Middleware to protect routes
  const requireAuth = (req, res, next) => {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  return { router, requireAuth };
};
