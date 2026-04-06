import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import { BadRequestError } from '../core/errors';
import { Request } from 'express';

const UPLOAD_DIR = path.resolve(env.UPLOAD_DIR);

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${Date.now()}-${base}${ext}`);
    },
});

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
