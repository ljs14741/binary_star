-- AlterTable
ALTER TABLE `empathy` ADD COLUMN `ip_hash` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `story` ADD COLUMN `edited_at` TIMESTAMP(0) NULL,
    ADD COLUMN `nickname` VARCHAR(20) NULL;

-- CreateIndex
CREATE INDEX `empathy_story_id_ip_hash_created_at_idx` ON `empathy`(`story_id`, `ip_hash`, `created_at`);
