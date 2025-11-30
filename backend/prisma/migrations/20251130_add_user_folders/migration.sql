-- Create UserFolder table
CREATE TABLE "UserFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "thumbnail" TEXT,
    "parentId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFolder_pkey" PRIMARY KEY ("id")
);

-- Create UserFolderMember table
CREATE TABLE "UserFolderMember" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserFolderMember_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "UserFolder_parentId_idx" ON "UserFolder"("parentId");
CREATE INDEX "UserFolder_createdBy_idx" ON "UserFolder"("createdBy");
CREATE INDEX "UserFolderMember_folderId_idx" ON "UserFolderMember"("folderId");
CREATE INDEX "UserFolderMember_userId_idx" ON "UserFolderMember"("userId");
CREATE UNIQUE INDEX "UserFolderMember_folderId_userId_key" ON "UserFolderMember"("folderId", "userId");

-- Foreign Keys
ALTER TABLE "UserFolder" ADD CONSTRAINT "UserFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "UserFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFolderMember" ADD CONSTRAINT "UserFolderMember_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "UserFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFolderMember" ADD CONSTRAINT "UserFolderMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
