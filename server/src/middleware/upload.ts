import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { BadRequestError } from '../core/errors';
import { env } from '../config/env';

// ── Submission uploads (PDFs only) ──────────────────────────────────────
const SUBMISSIONS_DIR = path.resolve('uploads/submissions');

// Ensure directory exists
if (!fs.existsSync(SUBMISSIONS_DIR)) {
    fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
}

const submissionStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, SUBMISSIONS_DIR);
    },
    filename: (req, file, cb) => {
        const userId = req.user?.id || 'unknown';
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}-${userId}${ext}`);
    },
});

const pdfFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new BadRequestError('Only PDF files are allowed for submissions'));
    }
};

export const submissionUpload = multer({
    storage: submissionStorage,
    fileFilter: pdfFilter,
    limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
});

// ── CSV uploads (for admin bulk onboarding) ─────────────────────────────
const CSV_DIR = path.resolve('uploads/csv');

if (!fs.existsSync(CSV_DIR)) {
    fs.mkdirSync(CSV_DIR, { recursive: true });
}

const csvStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, CSV_DIR);
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

export const csvUpload = multer({
    storage: csvStorage,
    fileFilter: csvFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});
