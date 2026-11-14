-- CreateTable
CREATE TABLE `room` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(64) NOT NULL,
    `featured_until` TIMESTAMP(0) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'open',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `slug`(`slug`),
    INDEX `room_status_sort_order_idx`(`status`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_i18n` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `room_id` INTEGER NOT NULL,
    `lang` VARCHAR(8) NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `description` VARCHAR(300) NOT NULL,

    UNIQUE INDEX `room_i18n_room_id_lang_key`(`room_id`, `lang`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `story` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `room_id` INTEGER NOT NULL,
    `body` TEXT NOT NULL,
    `lang` VARCHAR(8) NOT NULL,
    `age_group` VARCHAR(8) NULL,
    `country` VARCHAR(2) NULL,
    `city` VARCHAR(80) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `moderation_note` VARCHAR(64) NULL,
    `empathy_count` INTEGER NOT NULL DEFAULT 0,
    `report_count` INTEGER NOT NULL DEFAULT 0,
    `owner_token_hash` VARCHAR(64) NOT NULL,
    `voter_key` VARCHAR(64) NOT NULL,
    `is_seed` BOOLEAN NOT NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `published_at` TIMESTAMP(0) NULL,

    INDEX `story_room_id_status_empathy_count_idx`(`room_id`, `status`, `empathy_count`),
    INDEX `story_status_published_at_idx`(`status`, `published_at`),
    INDEX `story_owner_token_hash_idx`(`owner_token_hash`),
    INDEX `story_voter_key_created_at_idx`(`voter_key`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `empathy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `story_id` INTEGER NOT NULL,
    `voter_key` VARCHAR(64) NOT NULL,
    `country` VARCHAR(2) NULL,
    `city` VARCHAR(80) NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `empathy_story_id_created_at_idx`(`story_id`, `created_at`),
    INDEX `empathy_voter_key_created_at_idx`(`voter_key`, `created_at`),
    UNIQUE INDEX `empathy_story_id_voter_key_key`(`story_id`, `voter_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `story_translation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `story_id` INTEGER NOT NULL,
    `lang` VARCHAR(8) NOT NULL,
    `body` TEXT NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `story_translation_story_id_lang_key`(`story_id`, `lang`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_proposal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(100) NOT NULL,
    `lang` VARCHAR(8) NOT NULL,
    `empathy_count` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(16) NOT NULL DEFAULT 'open',
    `auto_approve` BOOLEAN NOT NULL DEFAULT true,
    `room_id` INTEGER NULL,
    `voter_key` VARCHAR(64) NOT NULL,
    `country` VARCHAR(2) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `room_proposal_status_empathy_count_idx`(`status`, `empathy_count`),
    INDEX `room_proposal_voter_key_created_at_idx`(`voter_key`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proposal_empathy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `proposal_id` INTEGER NOT NULL,
    `voter_key` VARCHAR(64) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `proposal_empathy_proposal_id_voter_key_key`(`proposal_id`, `voter_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `story_id` INTEGER NOT NULL,
    `voter_key` VARCHAR(64) NOT NULL,
    `reason` VARCHAR(32) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `report_story_id_voter_key_key`(`story_id`, `voter_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `room_i18n` ADD CONSTRAINT `room_i18n_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `story` ADD CONSTRAINT `story_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `empathy` ADD CONSTRAINT `empathy_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `story_translation` ADD CONSTRAINT `story_translation_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_empathy` ADD CONSTRAINT `proposal_empathy_proposal_id_fkey` FOREIGN KEY (`proposal_id`) REFERENCES `room_proposal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report` ADD CONSTRAINT `report_story_id_fkey` FOREIGN KEY (`story_id`) REFERENCES `story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
