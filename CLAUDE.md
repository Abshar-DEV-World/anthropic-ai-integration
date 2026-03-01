# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components via chat, and the AI generates React code in a virtual file system with real-time preview.

## Development Commands

### Setup & Running
```bash
npm run setup          # Install dependencies + Prisma setup (generate client + migrations)
npm run dev            # Start development server (Next.js with Turbopack)
npm run build          # Production build
npm start              # Start production server
```

### Testing & Database
```bash
npm test               # Run Vitest tests
npx prisma studio      # Open database GUI
npx prisma migrate dev # Create new migration
npm run db:reset       # Reset database (WARNING: destructive)
```

### Running Single Tests
```bash
npx vitest <test-file-path>                    # Run specific test file
npx vitest -t "test name pattern"              # Run tests matching pattern
npx vitest src/lib/__tests__/file-system.test.ts  # Example
```

## Architecture

### Core Data Flow

1. **User Input** → Chat interface (`src/components/chat/ChatInterface.tsx`)
2. **AI Processing** → `/api/chat` route calls Anthropic Claude (or mock provider)
3. **Tool Execution** → AI uses `str_replace_editor` and `file_manager` tools to manipulate files
4. **File System Update** → VirtualFileSystem stores changes in-memory
5. **Preview Rendering** → Files transformed via Babel, rendered in iframe with import maps
6. **Persistence** → State saved to Prisma database (for authenticated users)

### Virtual File System

The **VirtualFileSystem** class (`src/lib/file-system.ts`) is the heart of the application:
- Manages files/directories in-memory using Map-based tree structure
- Never writes files to disk - all operations are in-memory
- Provides operations: create, read, update, delete, rename, list
- Serializes to/from JSON for database persistence
- Files are stored as `Map<string, FileNode>` where key is normalized path

### AI Integration

**Provider Setup** (`src/lib/provider.ts`):
- Uses `@ai-sdk/anthropic` with Claude Haiku 4.5 model
- Falls back to `MockLanguageModel` if `ANTHROPIC_API_KEY` not set
- Mock provider generates static components (counter, form, card) to demo the UI

**AI Tools** (`src/lib/tools/`):
- `str_replace_editor`: Create files, replace strings, insert lines (mimics text editor)
- `file_manager`: Rename and delete files/folders

**System Prompt** (`src/lib/prompts/generation.tsx`):
- Instructs AI on how to use tools to generate React components
- Defines tool schemas and expected behavior

### Preview System

**JSX Transformation** (`src/lib/transform/jsx-transformer.ts`):
- Transforms JSX/TSX to JavaScript using `@babel/standalone`
- Creates import map with blob URLs for each transformed module
- Handles `@/` alias for imports (maps to root directory)
- Resolves third-party packages via esm.sh CDN
- Collects and injects CSS files into preview
- Tracks syntax errors per-file for display in preview

**Preview Frame** (`src/components/preview/PreviewFrame.tsx`):
- Renders transformed code in sandboxed iframe
- Uses import maps for module resolution
- Includes Tailwind CDN for styling
- Shows syntax errors with formatted display
- Error boundary catches runtime errors

### Authentication

**JWT-based Auth** (`src/lib/auth.ts`):
- Sessions stored in HTTP-only cookies (7-day expiry)
- Uses `jose` library for JWT signing/verification
- Cookie name: `auth-token`
- Passwords hashed with bcrypt

**Middleware** (`src/middleware.ts`):
- Protects `/api/projects` and `/api/filesystem` routes
- Unauthenticated users get 401 response

**Anonymous Users**:
- Can use the app without signing up
- Work tracked in `src/lib/anon-work-tracker.ts`
- Data not persisted to database

### State Management

**Contexts** (`src/lib/contexts/`):
- `FileSystemContext`: Manages virtual file system state, selected file, CRUD operations
- `ChatContext`: Manages chat messages, streaming responses, tool call handling

Both contexts handle:
- Real-time updates from AI tool calls
- Syncing with VirtualFileSystem
- Triggering UI refreshes

### Database Schema

**Prisma Models** (`prisma/schema.prisma`):
- `User`: id, email, password (bcrypt), timestamps
- `Project`: id, name, userId (optional), messages (JSON), data (JSON), timestamps
- Projects cascade delete when user is deleted
- SQLite database at `prisma/dev.db`

## Important Patterns

### File Path Normalization
All paths in VirtualFileSystem are normalized:
- Must start with `/`
- No trailing slash (except root)
- Multiple slashes collapsed to single

### Import Resolution
Import aliases are resolved as:
- `@/components/Foo` → `/components/Foo`
- `/components/Foo.jsx` → blob URL
- Third-party packages → esm.sh CDN

### Tool Call Processing
When AI makes tool calls:
1. Frontend receives tool call in stream
2. `handleToolCall` in FileSystemContext processes it
3. VirtualFileSystem executes operation
4. UI re-renders with updated files
5. Backend saves to database on stream finish (if authenticated)

## Environment Variables

Required in `.env` (optional):
```bash
ANTHROPIC_API_KEY=sk-ant-...  # Optional - uses mock provider if not set
JWT_SECRET=...                 # Defaults to "development-secret-key"
```

## Testing Notes

- Tests use `vitest` with `jsdom` environment
- React Testing Library for component tests
- VirtualFileSystem has comprehensive unit tests
- Transform logic tested with various JSX patterns

## Authentication Flow

1. User signs up → password hashed with bcrypt → user created in DB
2. User signs in → password verified → JWT created → cookie set
3. Middleware checks cookie on protected routes
4. Session expires after 7 days or on logout (cookie deleted)
