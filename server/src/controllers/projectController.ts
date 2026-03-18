// server/src/controllers/projectController.ts
import { Request, Response } from 'express';
import Project from '../models/Project';
import User from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { NotFoundError, InternalServerError } from '../utils/errors/AppError';
import { getApiToken, fetchUserRepositories, transformGitHubRepoToProject } from '../services/githubService';

/**
 * Get projects by username
 * GET /api/projects/:username
 */
export const getProjectsByUsername = asyncHandler(
  async (req: Request, res: Response) => {
    const { username } = req.params;

    // Find user by username only
    const user = await User.findOne({ username: username });

    if (!user) {
      throw new NotFoundError('User not found. Portfolio username may be incorrect.');
    }

    const projects = await Project.find({
      userId: user._id,
      isVisibleInPortfolio: true,
    }).sort({ order: 1, createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: projects,
    });
  }
);

/**
 * Import projects from GitHub
 * POST /api/projects/import-github
 */
export const importGitHubProjects = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user || !req.user._id) {
      throw new InternalServerError('User not authenticated');
    }
    const userId = req.user._id;

    const { githubUsername } = req.body;

    if (!githubUsername) {
      throw new InternalServerError('GitHub username is required');
    }

    try {
      const token = await getApiToken(userId.toString());
      // Token is optional - public repos work without token (60 requests/hour limit)
      const repos = await fetchUserRepositories(githubUsername, token);

      // Transform repos to projects
      const projectPromises = repos.map((repo) =>
        transformGitHubRepoToProject(repo, token)
      );
      const transformedProjects = (await Promise.all(projectPromises)).filter(
        (p) => p !== null
      );

      // Get current max order for this user
      const maxOrderProject = await Project.findOne({ userId })
        .sort({ order: -1 })
        .limit(1);
      const startOrder = maxOrderProject?.order !== undefined ? (maxOrderProject.order + 1) : 0;

      // Save projects to database
      const savedProjects = [];
      for (let i = 0; i < transformedProjects.length; i++) {
        const projectData = transformedProjects[i];
        // Check if project already exists
        const existingProject = await Project.findOne({
          userId,
          githubUrl: projectData.repoUrl,
        });

        if (!existingProject) {
          const project = await Project.create({
            userId,
            title: projectData.title,
            description: projectData.description,
            technologies: projectData.technologies,
            githubUrl: projectData.repoUrl,
            projectUrl: projectData.liveUrl,
            videoUrl: projectData.videoUrl || undefined,
            stars: projectData.stars,
            forks: projectData.forks,
            sourceType: 'github',
            isImported: true,
            isVisibleInPortfolio: true,
            order: startOrder + i,
          });
          savedProjects.push(project);
        }
      }

      res.status(200).json({
        status: 'success',
        message: `Imported ${savedProjects.length} projects from GitHub`,
        data: savedProjects,
      });
    } catch (error: any) {
      throw new InternalServerError(
        error.message || 'Failed to import projects from GitHub'
      );
    }
  }
);

/**
 * Get current user's projects
 * GET /api/projects
 */
export const getCurrentUserProjects = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user || !req.user._id) {
      throw new InternalServerError('User not authenticated');
    }
    const userId = req.user._id;

    const projects = await Project.find({ userId }).sort({
      order: 1,
      createdAt: -1,
    });

    res.status(200).json({
      status: 'success',
      data: projects,
    });
  }
);

/**
 * Create a new project
 * POST /api/projects
 */
export const createProject = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user._id) {
    throw new InternalServerError('User not authenticated');
  }
  const userId = req.user._id;

  const project = await Project.create({
    userId,
    ...req.body,
  });

  res.status(201).json({
    status: 'success',
    data: project,
  });
});

/**
 * Update a project
 * PUT /api/projects/:id
 */
export const updateProject = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!req.user || !req.user._id) {
      throw new InternalServerError('User not authenticated');
    }
    const userId = req.user._id;

    const project = await Project.findOneAndUpdate(
      { _id: id, userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    res.status(200).json({
      status: 'success',
      data: project,
    });
  }
);

/**
 * Update project orders in bulk
 * PUT /api/projects/reorder
 */
export const updateProjectOrders = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user || !req.user._id) {
      throw new InternalServerError('User not authenticated');
    }
    const userId = req.user._id;

    const { projectOrders } = req.body; // Array of { id: string, order: number }

    if (!Array.isArray(projectOrders)) {
      throw new InternalServerError('projectOrders must be an array');
    }

    // Update all projects in parallel
    const updatePromises = projectOrders.map(({ id, order }: { id: string; order: number }) =>
      Project.findOneAndUpdate(
        { _id: id, userId },
        { order },
        { new: true }
      )
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      status: 'success',
      message: 'Project orders updated successfully',
    });
  }
);

/**
 * Delete a project
 * DELETE /api/projects/:id
 */
export const deleteProject = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!req.user || !req.user._id) {
      throw new InternalServerError('User not authenticated');
    }
    const userId = req.user._id;

    const project = await Project.findOneAndDelete({ _id: id, userId });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    res.status(200).json({
      status: 'success',
      message: 'Project deleted successfully',
    });
  }
);

