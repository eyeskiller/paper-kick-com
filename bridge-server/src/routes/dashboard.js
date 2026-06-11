const express = require('express');

module.exports = function(prisma, requireAuth, wsManager) {
  const router = express.Router();

  // Get customer's servers
  router.get('/servers', requireAuth, async (req, res) => {
    try {
      const servers = await prisma.server.findMany({
        where: { customerId: req.user.id },
        include: {
          _count: {
            select: { linkedUsers: true }
          }
        }
      });
      
      const enrichedServers = servers.map(s => ({
        ...s,
        isConnected: wsManager.isServerConnected(s.id)
      }));
      
      res.json(enrichedServers);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Create a new server
  router.post('/servers', requireAuth, async (req, res) => {
    try {
      const { name, kickClientId, kickSecret } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      const server = await prisma.server.create({
        data: {
          name,
          kickClientId: kickClientId || null,
          kickSecret: kickSecret || null,
          customerId: req.user.id
        }
      });
      res.json(server);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Update server credentials
  router.put('/servers/:id', requireAuth, async (req, res) => {
    try {
      const { kickClientId, kickSecret } = req.body;
      const server = await prisma.server.findFirst({
        where: { id: req.params.id, customerId: req.user.id }
      });
      if (!server) return res.status(404).json({ error: 'Server not found' });

      const updated = await prisma.server.update({
        where: { id: req.params.id },
        data: {
          kickClientId: kickClientId || null,
          kickSecret: kickSecret || null
        }
      });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Get active linked users for a server
  router.get('/servers/:id/users', requireAuth, async (req, res) => {
    try {
      const server = await prisma.server.findFirst({
        where: { id: req.params.id, customerId: req.user.id }
      });
      if (!server) return res.status(404).json({ error: 'Server not found' });

      const users = await prisma.linkedUser.findMany({
        where: { serverId: req.params.id }
      });
      res.json(users);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.delete('/servers/:id', requireAuth, async (req, res) => {
    try {
      const server = await prisma.server.findFirst({
        where: { id: req.params.id, customerId: req.user.id }
      });
      if (!server) return res.status(404).json({ error: 'Server not found' });

      // Delete related records manually to handle lack of onDelete: Cascade
      await prisma.linkedUser.deleteMany({ where: { serverId: server.id } });
      await prisma.claimCode.deleteMany({ where: { serverId: server.id } });
      
      // Delete server
      await prisma.server.delete({ where: { id: server.id } });

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
};
