-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "subject_color" ADD VALUE 'red';
ALTER TYPE "subject_color" ADD VALUE 'cyan';
ALTER TYPE "subject_color" ADD VALUE 'lime';
ALTER TYPE "subject_color" ADD VALUE 'navy';
ALTER TYPE "subject_color" ADD VALUE 'plum';
ALTER TYPE "subject_color" ADD VALUE 'olive';
ALTER TYPE "subject_color" ADD VALUE 'slate';
ALTER TYPE "subject_color" ADD VALUE 'rose';
