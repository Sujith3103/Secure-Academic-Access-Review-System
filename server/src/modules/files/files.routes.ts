import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { BadRequestError, NotFoundError } from '../../core/errors';

const router = Router();

const SUBMISSIONS_DIR = path.resolve('uploads/submissions');

/**
 * GET /api/v1/files/view/:filename
 *
 * Serves a submission PDF from the local filesystem.
 * Uses streaming (fs.createReadStream) for efficiency.
 * Includes path traversal protection.
 */
router.get('/view/:filename', (req: Request, res: Response, next: NextFunction): void => {
    try {
        const { filename } = req.params;

        // Prevent path traversal attacks
        const safeName = path.basename(filename);
        if (safeName !== filename || filename.includes('..')) {
            throw new BadRequestError('Invalid filename');
        }

        const filePath = path.join(SUBMISSIONS_DIR, safeName);

        // Check file exists
        if (!fs.existsSync(filePath)) {
            throw new NotFoundError('File');
        }

        // Get file stats for Content-Length
        const stats = fs.statSync(filePath);

        // Set headers for inline PDF viewing
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
        res.setHeader('Content-Length', stats.size);

        // Stream the file
        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);

        readStream.on('error', (err) => {
            next(new BadRequestError(`Failed to read file: ${err.message}`));
        });
    } catch (error) {
        next(error);
    }
});

export default router;
