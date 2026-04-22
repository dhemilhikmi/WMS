import { Router } from 'express';

const router = Router();

// TODO: Implement registration routes
// GET /api/registrations - List registrations
// POST /api/registrations - Register for workshop
// GET /api/registrations/:id - Get registration details
// DELETE /api/registrations/:id - Cancel registration

router.get('/', (req, res) => {
  res.json({ message: 'List registrations endpoint - to be implemented' });
});

router.post('/', (req, res) => {
  res.json({ message: 'Create registration endpoint - to be implemented' });
});

export default router;
