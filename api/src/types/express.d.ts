declare namespace Express {
  interface Request {
    user?: {
      userId: string
      tenantId: string
      email: string
      role: string
    }
  }
}
