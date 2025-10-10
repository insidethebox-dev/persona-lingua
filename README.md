# PersonaLingua

An AI-powered learning material recommendation system built with Next.js, TypeScript, and Tailwind CSS. The application helps teachers manage student records and discover relevant learning materials through AI-powered suggestions..

## Latest Fixes

- **Fixed maximum file size limit and student age in form

- **Fixed file attachment being processed in the AI generation material

## Features

### ✅ Core Features

- **School Management**: Schools can manage their teacher accounts
- **Teacher Authentication**: Secure login system for teachers
- **Student Records**: Teachers can create and manage student profiles with progress reports
- **File Management**: Upload and tag learning materials for AI-powered discovery
- **AI Recommendations**: Intelligent suggestions based on student needs and available materials

### 🆕 Recent Updates

- **AI-Powered Content Analysis**: Automatic file content analysis and summary generation using OpenAI
- **Enhanced Student Reports**: Complete CRUD operations for student progress reports with modal editing
- **Improved UI/UX**: Fixed input placeholder colors and enhanced form interactions
- **Asynchronous Processing**: AI summary generation runs in background during file upload

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **AI Integration**: OpenAI API (configurable)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up your environment variables in `.env`:

   ```env
   DATABASE_URL="your-postgresql-connection-string"
   NEXTAUTH_SECRET="your-secret-key"
   NEXTAUTH_URL="http://localhost:3000"

   # Cloudinary (for file storage)
   CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
   CLOUDINARY_API_KEY="your-cloudinary-api-key"
   CLOUDINARY_API_SECRET="your-cloudinary-api-secret"
   CLOUDINARY_FOLDER="personalingua" # Optional folder name

   # OpenAI (for AI content analysis)
   OPENAI_API_KEY="your-openai-api-key"
   ```

4. Generate Prisma client:

   ```bash
   npm run db:generate
   ```

5. Push the database schema:

   ```bash
   npm run db:push
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## Database Setup

The application uses PostgreSQL with Prisma. To set up your database:

1. Create a PostgreSQL database
2. Update the `DATABASE_URL` in your `.env` file
3. Run the database migration:
   ```bash
   npm run db:migrate
   ```

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard page
│   └── students/          # Student management pages
├── components/            # Reusable React components
├── lib/                   # Utility functions and configurations
├── types/                 # TypeScript type definitions
└── prisma/               # Database schema and migrations
```

## API Endpoints

- `POST /api/schools` - Create a new school with admin teacher
- `GET /api/teachers` - Get teachers for the current school
- `POST /api/teachers` - Create a new teacher (admin only)
- `GET /api/students` - Get students for the current teacher
- `POST /api/students` - Create a new student

## Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Create and run migrations
- `npm run db:studio` - Open Prisma Studio

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.
