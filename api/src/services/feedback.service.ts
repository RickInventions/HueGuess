import pool from '../config/db.js';

export interface CreateFeedbackInput {
  userId?: string;
  type: string;
  title: string;
  description: string;
  contactEmail?: string;
}

export class FeedbackService {
  
  // Submit feedback
  static async submitFeedback(input: CreateFeedbackInput) {
    const { userId, type, title, description, contactEmail } = input;
    
    const result = await pool.query(
      `INSERT INTO feedback (user_id, type, title, description, contact_email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [userId || null, type, title, description, contactEmail || null]
    );
    
    return {
      id: result.rows[0].id,
      submittedAt: result.rows[0].created_at,
    };
  }
  
  // Get all feedback (admin)
  static async getAllFeedback(filters: {
    resolved?: boolean;
    type?: string;
    limit: number;
    offset: number;
  }) {
    const { resolved, type, limit, offset } = filters;
    
    let query = `
      SELECT f.id, f.type, f.title, f.description, f.contact_email, 
             f.resolved, f.resolved_at, f.created_at,
             u.id as user_id, u.username
      FROM feedback f
      LEFT JOIN users u ON f.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (resolved !== undefined) {
      query += ` AND f.resolved = $${paramIndex}`;
      params.push(resolved);
      paramIndex++;
    }
    
    if (type) {
      query += ` AND f.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    query += ` ORDER BY f.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM feedback f WHERE 1=1`;
    const countParams: any[] = [];
    let countIndex = 1;
    
    if (resolved !== undefined) {
      countQuery += ` AND resolved = $${countIndex}`;
      countParams.push(resolved);
      countIndex++;
    }
    
    if (type) {
      countQuery += ` AND type = $${countIndex}`;
      countParams.push(type);
    }
    
    const totalResult = await pool.query(countQuery, countParams);
    
    return {
      feedback: result.rows,
      total: parseInt(totalResult.rows[0].total),
    };
  }
  
  // Get feedback by ID
  static async getFeedbackById(id: string) {
    const result = await pool.query(
      `SELECT f.*, u.username
       FROM feedback f
       LEFT JOIN users u ON f.user_id = u.id
       WHERE f.id = $1`,
      [id]
    );
    
    return result.rows[0] || null;
  }
  
  // Resolve feedback (admin)
  static async resolveFeedback(id: string, adminId: string | null) {
    let resolvedBy = null;
    if (adminId && adminId !== 'system') {
      // Validate it's a proper UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(adminId)) {
        resolvedBy = adminId;
      }
    }
    
    const result = await pool.query(
      `UPDATE feedback 
       SET resolved = TRUE, resolved_at = NOW(), resolved_by = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id, resolvedBy]
    );
    
    return result.rows[0] || null;
  }
  
  // Get feedback stats (admin dashboard)
  static async getFeedbackStats() {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN resolved = false THEN 1 END) as pending,
        COUNT(CASE WHEN type = 'bug' THEN 1 END) as bugs,
        COUNT(CASE WHEN type = 'feature' THEN 1 END) as features,
        COUNT(CASE WHEN type = 'review' THEN 1 END) as reviews,
        COUNT(CASE WHEN type = 'other' THEN 1 END) as other
      FROM feedback
    `);
    
    return result.rows[0];
  }
}