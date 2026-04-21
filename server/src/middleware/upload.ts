import multer from 'multer';
import { Request } from 'express';
import { BadRequestError } from '../core/errors';
import { cloudinary } from '../config/cloudinary';
import { env } from '../config/env';

// Use memory storage — files go to buffer, then we upload to Cloudinary
const storage = multer.memoryStorage();

const csvFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        cb(null, true);
    } else {
        cb(new BadRequestError('Only CSV files are allowed'));
    }
};

const documentFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'text/plain',
    ];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new BadRequestError('File type not allowed. Allowed: PDF, Word, images, text files'));
    }
};

export const csvUpload = multer({
    storage,
    fileFilter: csvFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max for CSV
});

export const documentUpload = multer({
    storage,
    fileFilter: documentFilter,
    limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
});

/**
 * Upload a multer file buffer to Cloudinary and return the secure URL.
 * Uses resource_type 'auto' which publicly serves all file types.
 * For non-image files (PDF, Word, text), we modify the returned URL to include
 * fl_attachment so the browser receives proper Content-Type headers.
 *
 * @param file - The multer file from req.file
 * @param folder - The Cloudinary folder to store the file in
 * @returns The secure URL of the uploaded file
 */
export async function uploadToCloudinary(
    file: Express.Multer.File,
    folder: string = 'saars/submissions',
): Promise<string> {
    // Strip extension from public_id to avoid double extensions (e.g. report.pdf.pdf)
    const nameWithoutExt = file.originalname
        .replace(/\.[^.]+$/, '')           // remove extension
        .replace(/[^a-zA-Z0-9_-]/g, '_'); // sanitize

    const publicId = `${Date.now()}-${nameWithoutExt}`;

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'auto',
                public_id: publicId,
            },
            (error, result) => {
                if (error) {
                    reject(new BadRequestError(`File upload failed: ${error.message}`));
                } else {
                    resolve(result!.secure_url);
                }
            },
        );
        uploadStream.end(file.buffer);
    });
}

