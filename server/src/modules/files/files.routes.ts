import { Router, Request, Response, NextFunction } from 'express';
import https from 'https';
import { cloudinary } from '../../config/cloudinary';
import { BadRequestError } from '../../core/errors';

const router = Router();

/**
 * GET /api/v1/files/view?url=<cloudinary_url>
 *
 * 1. Parses the Cloudinary URL to extract public_id and resource info
 * 2. Generates a signed URL via the Cloudinary SDK (bypasses access restrictions)
 * 3. Fetches the file using the signed URL
 * 4. Serves it to the browser with correct Content-Type headers
 *
 * This solves two problems:
 * - Cloudinary free tier may block unsigned access (401)
 * - PDFs under /image/upload/ get wrong Content-Type (Chrome can't render them)
 */
router.get('/view', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const fileUrl = req.query.url as string;

        if (!fileUrl) {
            throw new BadRequestError('Missing "url" query parameter');
        }

        // Only allow Cloudinary URLs for security
        if (!fileUrl.includes('res.cloudinary.com')) {
            throw new BadRequestError('Only Cloudinary URLs are allowed');
        }

        // Parse the Cloudinary URL to extract components
        const urlObj = new URL(fileUrl);
        const pathParts = urlObj.pathname.split('/');

        // Find 'upload' segment
        const uploadIndex = pathParts.indexOf('upload');
        if (uploadIndex === -1) {
            throw new BadRequestError('Invalid Cloudinary URL format');
        }

        const resourceType = pathParts[uploadIndex - 1] || 'image';

        // Skip version segment (e.g., 'v1776794181')
        const afterUpload = pathParts.slice(uploadIndex + 1);
        const startIdx = afterUpload[0]?.match(/^v\d+$/) ? 1 : 0;
        const fullPath = afterUpload.slice(startIdx).join('/');

        // Separate public_id and format
        const lastDotIndex = fullPath.lastIndexOf('.');
        const publicId = lastDotIndex !== -1 ? fullPath.substring(0, lastDotIndex) : fullPath;
        const format = lastDotIndex !== -1 ? fullPath.substring(lastDotIndex + 1) : undefined;

        // Determine correct Content-Type from extension
        const contentTypeMap: Record<string, string> = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'txt': 'text/plain',
        };
        const contentType = contentTypeMap[format || ''] || 'application/octet-stream';
        const filename = fullPath.split('/').pop() || `file.${format}`;

        // Generate a signed URL using the Cloudinary SDK
        const signedUrl = cloudinary.url(publicId, {
            resource_type: resourceType as 'image' | 'raw' | 'video' | 'auto',
            format,
            sign_url: true,
            secure: true,
            type: 'upload',
        });

        // Fetch the file from Cloudinary via signed URL and pipe to response
        https.get(signedUrl, (proxyRes) => {
            // Follow redirects (301/302)
            if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302) {
                const redirectUrl = proxyRes.headers.location;
                if (redirectUrl) {
                    https.get(redirectUrl, (redirectRes) => {
                        if (redirectRes.statusCode !== 200) {
                            res.status(redirectRes.statusCode || 500).json({
                                success: false,
                                message: `Failed to fetch file after redirect (HTTP ${redirectRes.statusCode})`,
                            });
                            return;
                        }
                        res.setHeader('Content-Type', contentType);
                        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
                        if (redirectRes.headers['content-length']) {
                            res.setHeader('Content-Length', redirectRes.headers['content-length']);
                        }
                        redirectRes.pipe(res);
                    }).on('error', (err) => {
                        next(new BadRequestError(`Redirect fetch failed: ${err.message}`));
                    });
                    return;
                }
            }

            if (proxyRes.statusCode !== 200) {
                res.status(proxyRes.statusCode || 500).json({
                    success: false,
                    message: `Failed to fetch file (HTTP ${proxyRes.statusCode})`,
                    signedUrl, // debug: show what URL we tried
                });
                return;
            }

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            if (proxyRes.headers['content-length']) {
                res.setHeader('Content-Length', proxyRes.headers['content-length']);
            }
            proxyRes.pipe(res);
        }).on('error', (err) => {
            next(new BadRequestError(`Failed to fetch file: ${err.message}`));
        });
    } catch (error) {
        next(error);
    }
});

export default router;
