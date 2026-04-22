import { Router } from 'express';

const router = Router();

// TODO: Implement workshop routes
// GET /api/workshops - List all workshops (tenant-specific)
// POST /api/workshops - Create workshop
// GET /api/workshops/:id - Get workshop details
// PUT /api/workshops/:id - Update workshop
// DELETE /api/workshops/:id - Delete workshop

router.get('/', (req, res) => {
  res.json({ message: 'List workshops endpoint - to be implemented' });
});

router.post('/', (req, res) => {
  res.json({ message: 'Create workshop endpoint - to be implemented' });
});

export default router;
