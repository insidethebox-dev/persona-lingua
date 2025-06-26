# Copilot Instructions for PersonaLingua

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview

PersonaLingua is an AI-powered learning material recommendation system built with Next.js, TypeScript, and Tailwind CSS. The application helps teachers manage student records and discover relevant learning materials through AI-powered suggestions.

## Architecture

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes with Prisma ORM
- **Database**: PostgreSQL (can be configured for other databases)
- **Authentication**: NextAuth.js for teacher authentication
- **File Storage**: Local storage with plans for cloud integration
- **AI Integration**: OpenAI API for content analysis and recommendations

## Key Features

1. **School Management**: Schools can manage their teacher accounts
2. **Teacher Authentication**: Secure login system for teachers
3. **Student Records**: Teachers can create and manage student profiles with progress reports
4. **File Management**: Upload and tag learning materials for AI-powered discovery
5. **AI Recommendations**: Intelligent suggestions based on student needs and available materials

## Development Guidelines

- Use TypeScript for all new files
- Follow Next.js App Router conventions
- Use Tailwind CSS for styling with a consistent design system
- Implement proper error handling and loading states
- Use Prisma for database operations
- Follow RESTful API conventions for API routes
- Include proper TypeScript types for all data structures
- Use React Server Components where appropriate
- Implement proper authentication and authorization

## Database Schema

The application uses the following main entities:

- Schools (admin level)
- Teachers (belong to schools)
- Students (managed by teachers, not users)
- LearningMaterials (uploaded files with tags)
- StudentReports (progress tracking)
- Recommendations (AI-generated suggestions)

## Coding Standards

- Use functional components with hooks
- Implement proper loading and error states
- Use meaningful variable and function names
- Add comments for complex business logic
- Follow the principle of least privilege for data access
- Implement proper validation for forms and API endpoints
