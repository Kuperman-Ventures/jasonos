import { type VercelConfig } from "@vercel/config/v1";

// Separate Vercel project. Set Root Directory to `college/`.
// Do not point a family domain at jasonos.vercel.app.
export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "next build",
  ignoreCommand:
    'if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 1; fi; cd "$(git rev-parse --show-toplevel)" && git diff --quiet HEAD^ HEAD -- college',
};
