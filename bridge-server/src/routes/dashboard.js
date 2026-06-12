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

  // Toggle sub status manually
  router.post('/servers/:id/users/:uuid/toggle-sub', requireAuth, async (req, res) => {
    try {
      const server = await prisma.server.findFirst({
        where: { id: req.params.id, customerId: req.user.id }
      });
      if (!server) return res.status(404).json({ error: 'Server not found' });

      const user = await prisma.linkedUser.findFirst({
        where: { minecraftUuid: req.params.uuid, serverId: server.id }
      });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const newStatus = !user.isSubscriber;
      await prisma.linkedUser.update({
        where: { minecraftUuid: user.minecraftUuid },
        data: { isSubscriber: newStatus }
      });

      wsManager.routeToServer(server.id, {
        type: 'subscription_update',
        minecraftUuid: user.minecraftUuid,
        isSubscriber: newStatus
      });

      res.json({ success: true, isSubscriber: newStatus });
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

  router.patch('/servers/:id/events', requireAuth, async (req, res) => {
    try {
      const server = await prisma.server.findFirst({
        where: { id: req.params.id, customerId: req.user.id }
      });
      if (!server) return res.status(404).json({ error: 'Server not found' });

      const updated = await prisma.server.update({
        where: { id: server.id },
        data: { eventsEnabled: req.body.eventsEnabled }
      });

      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Get actions for a server
  router.get('/servers/:id/actions', requireAuth, async (req, res) => {
    try {
      const server = await prisma.server.findFirst({
        where: { id: req.params.id, customerId: req.user.id }
      });
      if (!server) return res.status(404).json({ error: 'Server not found' });

      const actions = await prisma.actionRule.findMany({
        where: { serverId: server.id },
        orderBy: { createdAt: 'asc' }
      });
      res.json(actions);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Create an action
  router.post('/servers/:id/actions', requireAuth, async (req, res) => {
    try {
      const server = await prisma.server.findFirst({
        where: { id: req.params.id, customerId: req.user.id }
      });
      if (!server) return res.status(404).json({ error: 'Server not found' });

      const { eventType, condition, actionType, payload } = req.body;
      if (!eventType || !actionType || !payload) return res.status(400).json({ error: 'Missing fields' });

      const action = await prisma.actionRule.create({
        data: {
          serverId: server.id,
          eventType,
          condition: condition || null,
          actionType,
          payload
        }
      });
      res.json(action);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Delete an action
  router.delete('/servers/:id/actions/:actionId', requireAuth, async (req, res) => {
    try {
      const server = await prisma.server.findFirst({
        where: { id: req.params.id, customerId: req.user.id }
      });
      if (!server) return res.status(404).json({ error: 'Server not found' });

      await prisma.actionRule.delete({
        where: { id: req.params.actionId }
      });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Test an action
  router.post('/servers/:id/actions/:actionId/test', requireAuth, async (req, res) => {
    try {
      const server = await prisma.server.findFirst({
        where: { id: req.params.id, customerId: req.user.id }
      });
      if (!server) return res.status(404).json({ error: 'Server not found' });

      const action = await prisma.actionRule.findFirst({
        where: { id: req.params.actionId, serverId: server.id }
      });
      if (!action) return res.status(404).json({ error: 'Action not found' });

      let finalPayload = action.payload;
      
      if (req.body.count && action.eventType === 'SUB_GIFT' && action.condition === 'ELSE_MULTIPLY') {
        try {
          const parsed = JSON.parse(finalPayload);
          if (parsed.amount) {
            parsed.amount = parsed.amount * req.body.count;
            finalPayload = JSON.stringify(parsed);
          }
        } catch (e) {}
      }

      wsManager.routeToServer(server.id, {
        type: 'execute_action',
        actionType: action.actionType,
        sender: 'TestUser',
        payload: finalPayload
      });

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
};
