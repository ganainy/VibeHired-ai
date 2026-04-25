import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import CvAnalysis from '../models/CvAnalysis';
import { performAnalysis, performJsonAnalysis, generateSectionImprovement } from '../services/analysisService';
import mongoose, { Types } from 'mongoose';
import { JsonResumeSchema } from '../types/jsonresume';
import { ValidatedRequest } from '../middleware/validateRequest';
import { ValidationError, NotFoundError, AuthorizationError, InternalServerError } from '../utils/errors/AppError';

// Ensure temp_uploads directory exists
const uploadDir = path.join(__dirname, '../../temp_uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|docx/;
        const mimetype = allowedTypes.test(file.mimetype);
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Error: File upload only supports the following filetypes - ' + allowedTypes));
    }
}).single('cvFile');

export const analyzeCv = async (req: ValidatedRequest, res: Response) => {
    const cvData: JsonResumeSchema = req.validated!.body!.cv;
    const jobData = req.validated!.body!.job;

    const userId = req.user?.id ? new Types.ObjectId(req.user.id) : new Types.ObjectId();

    // Create the analysis document first
    const analysis = await CvAnalysis.create({
        userId,
        status: 'pending',
        overallScore: 0,
        issueCount: 0,
        categoryScores: {},
        detailedResults: {}
    });

    // Start analysis in background
    performJsonAnalysis(cvData, userId, analysis._id as unknown as Types.ObjectId, jobData)
        .catch(error => {
            console.error('Background analysis failed:', error);
        });

    res.json(analysis);
};

export const getAnalysisResults = async (req: ValidatedRequest, res: Response) => {
    const { id } = req.validated!.params!;
    const analysis = await CvAnalysis.findById(id);

    if (!analysis) {
        throw new NotFoundError('Analysis not found');
    }

    if (analysis.userId.toString() !== req.user?.id) {
        throw new AuthorizationError('Unauthorized access to analysis');
    }

    // Debug logging to check ATS scores
    console.log(`[DEBUG] Fetching analysis ${id}:`);
    console.log(`[DEBUG] - Status: ${analysis.status}`);
    console.log(`[DEBUG] - Has ATS scores: ${!!analysis.atsScores}`);
    if (analysis.atsScores) {
        console.log(`[DEBUG] - ATS scores structure:`, JSON.stringify(analysis.atsScores, null, 2));
        console.log(`[DEBUG] - ATS Score: ${analysis.atsScores.score}`);
    }

    // Convert Mongoose document to plain object to ensure proper serialization
    const analysisObj = analysis.toObject ? analysis.toObject() : analysis;
    res.json(analysisObj);
};

export const generateImprovement = async (req: ValidatedRequest, res: Response) => {
    // Get section from params if available, otherwise from body
    const sectionFromParams = req.validated!.params?.section;
    const { analysisId, section: sectionFromBody, currentContent } = req.validated!.body!;
    const section = sectionFromParams || sectionFromBody;
    
    // Use id from params as analysisId if not in body
    const analysisIdToUse = analysisId || req.validated!.params?.id;

    if (!analysisIdToUse || !section || !currentContent) {
        throw new ValidationError('Analysis ID, section, and current content are required');
    }

    const analysis = await CvAnalysis.findById(analysisIdToUse);
    if (!analysis) {
        throw new NotFoundError('Analysis not found');
    }

    if (analysis.userId.toString() !== req.user?.id) {
        throw new AuthorizationError('Unauthorized access to analysis');
    }

    const improvement = await generateSectionImprovement(analysis, section, currentContent);
    res.json({ improvement });
};

export const deleteAnalysis = async (req: ValidatedRequest, res: Response) => {
    const { id } = req.validated!.params!;
    const analysis = await CvAnalysis.findById(id);

    if (!analysis) {
        throw new NotFoundError('Analysis not found');
    }

    if (analysis.userId.toString() !== req.user?.id) {
        throw new AuthorizationError('Unauthorized access to analysis');
    }

    await analysis.deleteOne();
    res.json({ message: 'Analysis deleted successfully' });
};

export const analyzeAllCvSections = async (req: ValidatedRequest, res: Response) => {
    const cvData = req.validated!.body!.cv;

    if (!cvData) {
        throw new ValidationError('CV data is required');
    }

    try {
        if (!req.user) {
            throw new ValidationError('User not authenticated');
        }
        const { getAllSectionsAnalysis } = await import('../services/analysisService');
        const userId = String(req.user._id);
        const analyses = await getAllSectionsAnalysis(cvData, userId);
        res.json(analyses);
    } catch (error: any) {
        console.error('Error in analyzeAllCvSections:', error);
        throw new InternalServerError(error.message || 'Failed to analyze CV sections');
    }
};